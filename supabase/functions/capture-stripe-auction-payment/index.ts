import { authenticatedClient, corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { stripeConfig, stripeRequest } from "../_shared/stripe.ts";

/* Called by the seller's client right after shipping details are saved.
   The hourly maintenance tick is the safety net if this call never lands. */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await authenticatedClient(req);
    const { orderId } = await req.json() as { orderId?: string };
    if (!orderId) return jsonResponse({ error: "orderId is required" }, 400);

    const admin = serviceClient();
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select("id, auction_id, tracking_number")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order) return jsonResponse({ error: "Order not found" }, 404);
    if (!order.auction_id) return jsonResponse({ skipped: true, reason: "not an auction order" }, 200);

    const { data: sellerItems, error: sellerError } = await admin
      .from("order_items")
      .select("id")
      .eq("order_id", order.id)
      .eq("seller_id", user.id)
      .limit(1);
    if (sellerError) throw sellerError;
    if (!sellerItems || sellerItems.length === 0) {
      return jsonResponse({ error: "Only the seller of this order can trigger the capture" }, 403);
    }
    if (!order.tracking_number) {
      return jsonResponse({ error: "Add shipping details before capturing the payment" }, 409);
    }

    const { data: payment, error: paymentError } = await admin
      .from("auction_payments")
      .select("id, status, provider, provider_order_id")
      .eq("auction_id", order.auction_id)
      .eq("provider", "stripe")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) return jsonResponse({ error: "No Stripe payment found for this auction" }, 404);
    if (payment.status === "captured") return jsonResponse({ captured: true, already: true }, 200);
    if (payment.status !== "authorized" || !payment.provider_order_id) {
      return jsonResponse({ error: `Payment is not on hold (status: ${payment.status})` }, 409);
    }

    const config = stripeConfig();
    const captured = await stripeRequest(
      config,
      "POST",
      `/payment_intents/${payment.provider_order_id}/capture`,
      undefined,
      `pi-capture-${payment.id}`,
    );
    if (!captured.ok) {
      console.error("Stripe capture failed", captured.body);
      return jsonResponse({ error: "Stripe could not capture the payment" }, 502);
    }

    const { error: recordError } = await admin.rpc("record_stripe_capture", {
      p_payment_id: payment.id,
      p_capture_id: String(captured.body.latest_charge || ""),
      p_payload: captured.body,
    });
    if (recordError) throw recordError;

    return jsonResponse({ captured: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("capture-stripe-auction-payment:", message);
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
