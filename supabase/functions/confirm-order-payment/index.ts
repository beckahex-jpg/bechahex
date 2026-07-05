import { authenticatedClient, corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { stripeConfig, stripeRequest, toCents } from "../_shared/stripe.ts";

/* Verifies a confirmed Stripe PaymentIntent against Stripe's API (never
   trusting the client) and marks the order paid. Idempotent: re-running on a
   paid order is a no-op success. */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { client, user } = await authenticatedClient(req);
    const { orderId, paymentIntentId } = await req.json() as { orderId?: string; paymentIntentId?: string };
    if (!orderId || !paymentIntentId) {
      return jsonResponse({ error: "orderId and paymentIntentId are required" }, 400);
    }

    // NOTE: the live orders table has no order_number column — do not select it.
    const { data: order, error: orderError } = await client
      .from("orders")
      .select("id, user_id, payment_status, total_amount")
      .eq("id", orderId)
      .maybeSingle();
    if (orderError) throw orderError;
    if (!order || order.user_id !== user.id) return jsonResponse({ error: "Order not found" }, 404);
    if (order.payment_status === "paid") return jsonResponse({ success: true, alreadyPaid: true });

    const config = stripeConfig();
    const intent = await stripeRequest(config, "GET", `/payment_intents/${encodeURIComponent(paymentIntentId)}`);
    if (!intent.ok || !intent.body.id) {
      console.error("Stripe retrieve intent failed", intent.body);
      return jsonResponse({ error: "The payment could not be verified with Stripe" }, 502);
    }

    const metadata = (intent.body.metadata || {}) as Record<string, string>;
    if (metadata.order_id !== String(orderId) || metadata.user_id !== user.id) {
      return jsonResponse({ error: "Payment does not belong to this order" }, 409);
    }

    const status = String(intent.body.status || "");
    if (status === "processing") {
      return jsonResponse({ error: "The payment is still processing — please wait a moment and try again" }, 409);
    }
    if (status !== "succeeded") {
      return jsonResponse({ error: `Payment has not completed (status: ${status})` }, 409);
    }

    if (Number(intent.body.amount) !== toCents(Number(order.total_amount))) {
      return jsonResponse({ error: "Payment amount does not match the order total" }, 409);
    }

    const admin = serviceClient();
    const { error: updateError } = await admin
      .from("orders")
      .update({ payment_status: "paid", status: "confirmed" })
      .eq("id", orderId)
      .eq("payment_status", "pending");
    if (updateError) throw updateError;

    try {
      await admin.from("notifications").insert({
        user_id: user.id,
        type: "order_update",
        title: "Payment Successful!",
        message: `Your payment for order #${String(orderId).slice(0, 8)} has been processed successfully.`,
        data: { order_id: orderId },
      });
    } catch (notifyError) {
      console.error("confirm-order-payment: notification failed", notifyError);
    }

    return jsonResponse({ success: true });
  } catch (error) {
    // PostgrestError objects are not Error instances — read .message off any
    // object so real causes are never masked as "Unexpected payment error".
    const message = error instanceof Error
      ? error.message
      : (error && typeof error === "object" && "message" in error)
        ? String((error as { message: unknown }).message)
        : "Unexpected payment error";
    console.error("confirm-order-payment:", message, JSON.stringify(error));
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
