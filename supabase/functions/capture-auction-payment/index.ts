import { authenticatedClient, corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { paypalAccessToken, paypalConfig, paypalMoney } from "../_shared/paypal.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  let claimedPaymentId: string | null = null;
  try {
    const { user } = await authenticatedClient(req);
    const { orderId } = await req.json() as { orderId?: string };
    if (!orderId) return jsonResponse({ error: "orderId is required" }, 400);

    const admin = serviceClient();
    const { data: payment, error: paymentError } = await admin
      .from("auction_payments")
      .select("*")
      .eq("provider_order_id", orderId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (paymentError || !payment) return jsonResponse({ error: "Payment not found" }, 404);
    if (payment.status === "captured") return jsonResponse({ success: true, alreadyCaptured: true });

    const { error: claimError } = await admin.rpc("claim_auction_payment_capture", {
      p_payment_id: payment.id,
    });
    if (claimError) return jsonResponse({ error: claimError.message }, 409);
    claimedPaymentId = payment.id;

    const config = paypalConfig();
    const accessToken = await paypalAccessToken(config);
    const response = await fetch(`${config.baseUrl}/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `capture-${payment.id}`,
      },
      body: "{}",
    });
    const capture = await response.json();
    if (!response.ok) {
      console.error("PayPal capture failed", capture);
      await admin.from("auction_payments").update({
        status: "review_required",
        failure_reason: `PayPal capture returned ${response.status}`,
      }).eq("id", payment.id).eq("status", "approved");
      return jsonResponse({ error: "PayPal payment capture failed" }, 502);
    }

    const capturedPayment = capture?.purchase_units?.[0]?.payments?.captures?.[0];
    if (
      capture.status !== "COMPLETED" ||
      capturedPayment?.status !== "COMPLETED" ||
      capturedPayment?.amount?.currency_code !== "USD" ||
      paypalMoney(capturedPayment?.amount?.value) !== paypalMoney(payment.total_amount)
    ) {
      await admin.from("auction_payments").update({
        status: "review_required",
        failure_reason: "PayPal returned a capture whose status, currency, or amount did not match",
        provider_payload: capture,
      }).eq("id", payment.id).eq("status", "approved");
      return jsonResponse({ error: "PayPal capture did not match the expected completed payment" }, 409);
    }

    const { error: captureRecordError } = await admin.from("auction_payments").update({
      provider_order_id: orderId,
      provider_capture_id: capturedPayment.id,
      provider_payload: capture,
    }).eq("id", payment.id).eq("status", "approved");
    if (captureRecordError) throw captureRecordError;

    const { data: result, error: finalizeError } = await admin.rpc("finalize_auction_payment", {
      p_payment_id: payment.id,
      p_provider_order_id: orderId,
      p_provider_capture_id: capturedPayment.id,
      p_provider_payload: capture,
    });
    if (finalizeError) throw finalizeError;

    return jsonResponse({ success: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected capture error";
    if (claimedPaymentId) {
      await serviceClient().from("auction_payments").update({
        status: "review_required",
        failure_reason: message.slice(0, 500),
      }).eq("id", claimedPaymentId).eq("status", "approved");
    }
    console.error("capture-auction-payment:", message);
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
