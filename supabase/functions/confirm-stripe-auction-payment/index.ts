import { authenticatedClient, corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { stripeConfig, stripeRequest } from "../_shared/stripe.ts";

/* Happy-path companion to the webhook: right after the client confirms the
   PaymentIntent, verify its state with Stripe and record the authorization
   (idempotent — whichever of webhook/confirm arrives first wins). */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await authenticatedClient(req);
    const { paymentId, paymentIntentId } = await req.json() as { paymentId?: string; paymentIntentId?: string };
    if (!paymentId) return jsonResponse({ error: "paymentId is required" }, 400);

    const admin = serviceClient();
    const { data: payment, error: paymentError } = await admin
      .from("auction_payments")
      .select("id, user_id, provider, provider_order_id, status")
      .eq("id", paymentId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment || payment.user_id !== user.id) {
      return jsonResponse({ error: "Payment not found" }, 404);
    }
    // Prefer the intent the client actually confirmed (a duplicate intent
    // created by a double-mounted effect could otherwise be checked instead);
    // its metadata must point back at this payment row.
    const intentId = paymentIntentId || payment.provider_order_id;
    if (!intentId || payment.provider !== "stripe") {
      return jsonResponse({ error: "No Stripe payment to confirm" }, 409);
    }

    const config = stripeConfig();
    const intent = await stripeRequest(config, "GET", `/payment_intents/${intentId}`);
    if (!intent.ok) {
      console.error("Stripe retrieve intent failed", intent.body);
      return jsonResponse({ error: "Could not verify the payment with Stripe" }, 502);
    }
    const intentMetadata = (intent.body.metadata || {}) as Record<string, string>;
    if (intentMetadata.payment_id !== payment.id) {
      return jsonResponse({ error: "Payment reference mismatch" }, 409);
    }

    const intentStatus = String(intent.body.status || "");

    if (intentStatus === "requires_capture") {
      const { data, error } = await admin.rpc("record_stripe_authorization", {
        p_payment_id: payment.id,
        p_provider_order_id: String(intent.body.id),
        p_payload: intent.body,
      });
      if (error) throw error;
      return jsonResponse({ authorized: true, orderId: data.order_id }, 200);
    }

    if (intentStatus === "succeeded") {
      // Shouldn't happen with manual capture, but never lose a real charge.
      await admin.rpc("record_stripe_authorization", {
        p_payment_id: payment.id,
        p_provider_order_id: String(intent.body.id),
        p_payload: intent.body,
      });
      const { data, error } = await admin.rpc("record_stripe_capture", {
        p_payment_id: payment.id,
        p_capture_id: String(intent.body.latest_charge || ""),
        p_payload: intent.body,
      });
      if (error) throw error;
      return jsonResponse({ authorized: true, captured: true, orderId: data.order_id }, 200);
    }

    return jsonResponse({ authorized: false, status: intentStatus }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("confirm-stripe-auction-payment:", message);
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
