import { corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { paypalAccessToken, paypalConfig, paypalMoney } from "../_shared/paypal.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const event = await req.json();
    const config = paypalConfig();
    if (!config.webhookId) throw new Error("PAYPAL_WEBHOOK_ID is not configured");
    const accessToken = await paypalAccessToken(config);

    const verificationResponse = await fetch(`${config.baseUrl}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        auth_algo: req.headers.get("paypal-auth-algo"),
        cert_url: req.headers.get("paypal-cert-url"),
        transmission_id: req.headers.get("paypal-transmission-id"),
        transmission_sig: req.headers.get("paypal-transmission-sig"),
        transmission_time: req.headers.get("paypal-transmission-time"),
        webhook_id: config.webhookId,
        webhook_event: event,
      }),
    });
    const verification = await verificationResponse.json();
    if (!verificationResponse.ok || verification.verification_status !== "SUCCESS") {
      return jsonResponse({ error: "Invalid PayPal webhook signature" }, 401);
    }

    if (event.event_type !== "PAYMENT.CAPTURE.COMPLETED") {
      return jsonResponse({ received: true, ignored: true });
    }

    const capture = event.resource;
    const providerOrderId = capture?.supplementary_data?.related_ids?.order_id;
    if (!providerOrderId || !capture?.id) return jsonResponse({ error: "Webhook capture identifiers are missing" }, 400);

    const admin = serviceClient();
    const { data: payment, error: paymentError } = await admin
      .from("auction_payments")
      .select("*")
      .eq("provider_order_id", providerOrderId)
      .maybeSingle();
    if (paymentError || !payment) return jsonResponse({ received: true, unmatched: true });
    if (payment.status === "captured") return jsonResponse({ received: true, duplicate: true });

    if (capture.status !== "COMPLETED" || capture.amount?.currency_code !== "USD" || paypalMoney(capture.amount?.value) !== paypalMoney(payment.total_amount)) {
      await admin.from("auction_payments").update({
        status: "review_required",
        failure_reason: "Verified PayPal webhook did not match the expected capture",
        provider_payload: event,
      }).eq("id", payment.id).neq("status", "captured");
      return jsonResponse({ error: "Webhook payment amount or status does not match" }, 409);
    }

    if (payment.status !== "approved") {
      await admin.from("auction_payments").update({
        status: "review_required",
        failure_reason: "PayPal reported a completed capture without an active server capture claim",
        provider_capture_id: capture.id,
        provider_payload: event,
      }).eq("id", payment.id).neq("status", "captured");
      return jsonResponse({ received: true, manualReviewRequired: true }, 202);
    }

    const orderResponse = await fetch(`${config.baseUrl}/v2/checkout/orders/${encodeURIComponent(providerOrderId)}`, {
      headers: { "Authorization": `Bearer ${accessToken}` },
    });
    const orderDetails = orderResponse.ok ? await orderResponse.json() : null;

    const { error: finalizeError } = await admin.rpc("finalize_auction_payment", {
      p_payment_id: payment.id,
      p_provider_order_id: providerOrderId,
      p_provider_capture_id: capture.id,
      p_provider_payload: { webhook: event, order: orderDetails },
    });
    if (finalizeError) throw finalizeError;

    return jsonResponse({ received: true, finalized: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected webhook error";
    console.error("paypal-auction-webhook:", message);
    return jsonResponse({ error: message }, 500);
  }
});
