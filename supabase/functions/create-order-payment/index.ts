import { authenticatedClient, corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { stripeConfig, stripeRequest, toCents } from "../_shared/stripe.ts";

const TAX_RATE = 0.15;

/* Creates a Stripe PaymentIntent (immediate capture) for a pending
   fixed-price order. The amount is recomputed server-side from the live
   product prices — the client never sends a price. */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { client, user } = await authenticatedClient(req);
    const { orderId } = await req.json() as { orderId?: string };
    if (!orderId) return jsonResponse({ error: "orderId is required" }, 400);

    // RLS scopes this to the caller's own orders.
    const { data: order, error: orderError } = await client
      .from("orders")
      .select("id, user_id, status, payment_status, total_amount")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.user_id !== user.id) return jsonResponse({ error: "Order not found" }, 404);
    if (order.payment_status === "paid") return jsonResponse({ alreadyPaid: true });

    const { data: items, error: itemsError } = await client
      .from("order_items")
      .select("product_id, quantity")
      .eq("order_id", orderId);
    if (itemsError) throw itemsError;
    if (!items || items.length === 0) return jsonResponse({ error: "Order has no items" }, 409);

    const admin = serviceClient();
    const productIds = [...new Set(items.map((item) => item.product_id))];
    const { data: products, error: productsError } = await admin
      .from("products")
      .select("id, price, status")
      .in("id", productIds);
    if (productsError) throw productsError;

    const priceById = new Map<string, number>((products || []).map((p) => [p.id, Number(p.price)]));

    let subtotal = 0;
    for (const item of items) {
      const price = priceById.get(item.product_id);
      if (price === undefined || !Number.isFinite(price)) {
        return jsonResponse({ error: "A product in this order is no longer available" }, 409);
      }
      subtotal += price * Number(item.quantity || 1);
    }

    const totalCents = toCents(subtotal * (1 + TAX_RATE));
    if (totalCents < 50) return jsonResponse({ error: "Order total is below the payment minimum" }, 409);
    const totalAmount = totalCents / 100;

    // Keep the stored order total in sync with the server-computed amount so
    // seller payouts and admin stats use the authoritative number.
    const { error: syncError } = await admin
      .from("orders")
      .update({ total_amount: totalAmount })
      .eq("id", orderId)
      .eq("payment_status", "pending");
    if (syncError) throw syncError;

    const config = stripeConfig();
    // Idempotency key pins one PaymentIntent per order across retries.
    const intent = await stripeRequest(config, "POST", "/payment_intents", {
      "amount": String(totalCents),
      "currency": "usd",
      "payment_method_types[]": "card",
      "description": `Beckah order ${String(orderId).slice(0, 8)}`,
      "metadata[order_id]": String(orderId),
      "metadata[user_id]": user.id,
    }, `order-pi-${orderId}`);

    if (!intent.ok || !intent.body.id || !intent.body.client_secret) {
      console.error("Stripe create intent failed", intent.body);
      return jsonResponse({ error: "Stripe could not create the payment" }, 502);
    }

    return jsonResponse({
      clientSecret: String(intent.body.client_secret),
      paymentIntentId: String(intent.body.id),
      totalAmount,
      currency: "USD",
    }, 201);
  } catch (error) {
    // PostgrestError objects are not Error instances — read .message off any
    // object so real causes are never masked as "Unexpected payment error".
    const message = error instanceof Error
      ? error.message
      : (error && typeof error === "object" && "message" in error)
        ? String((error as { message: unknown }).message)
        : "Unexpected payment error";
    console.error("create-order-payment:", message, JSON.stringify(error));
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
