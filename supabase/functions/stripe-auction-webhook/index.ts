import { jsonResponse, serviceClient } from "../_shared/auction.ts";
import { stripeWebhookSecret, verifyStripeSignature } from "../_shared/stripe.ts";

/* Deployed with --no-verify-jwt: Stripe cannot send Supabase JWTs. Every
   request is authenticated by verifying Stripe's signature over the RAW
   body instead. */
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const rawBody = await req.text();
    const valid = await verifyStripeSignature(rawBody, req.headers.get("Stripe-Signature"), stripeWebhookSecret());
    if (!valid) return jsonResponse({ error: "Invalid signature" }, 400);

    const event = JSON.parse(rawBody) as { type: string; data: { object: Record<string, unknown> } };
    const intent = event.data?.object || {};
    const metadata = (intent.metadata || {}) as Record<string, string>;
    const paymentId = metadata.payment_id;

    if (!paymentId) return jsonResponse({ ignored: true, reason: "no payment_id metadata" }, 200);

    const admin = serviceClient();

    switch (event.type) {
      case "payment_intent.amount_capturable_updated": {
        if (String(intent.status) === "requires_capture") {
          const { error } = await admin.rpc("record_stripe_authorization", {
            p_payment_id: paymentId,
            p_provider_order_id: String(intent.id),
            p_payload: intent,
          });
          if (error) console.error("webhook authorization record failed:", error.message);
        }
        break;
      }
      case "payment_intent.succeeded": {
        // Ensure the sale is recorded even if the authorization event was missed.
        await admin.rpc("record_stripe_authorization", {
          p_payment_id: paymentId,
          p_provider_order_id: String(intent.id),
          p_payload: intent,
        });
        const { error } = await admin.rpc("record_stripe_capture", {
          p_payment_id: paymentId,
          p_capture_id: String(intent.latest_charge || ""),
          p_payload: intent,
        });
        if (error) console.error("webhook capture record failed:", error.message);
        break;
      }
      case "payment_intent.canceled": {
        const { data: payment } = await admin
          .from("auction_payments")
          .select("status")
          .eq("id", paymentId)
          .maybeSingle();
        // Only unwind a recorded hold; a cancelled never-authorized intent
        // just means the winner abandoned checkout.
        if (payment?.status === "authorized") {
          // 'requested_by_customer' is only sent by admin removal
          // (remove-auction), which takes the auction down right after this
          // hold releases — relisting here would race it and briefly put a
          // removed-for-cause item back on sale. Maintenance voids use
          // 'abandoned' and should relist as before.
          const cancellationReason = String((intent.cancellation_reason as string) || "");
          const { error } = await admin.rpc("cancel_stripe_authorization", {
            p_payment_id: paymentId,
            p_reason: cancellationReason || "Payment authorization was canceled",
            p_relist: cancellationReason !== "requested_by_customer",
          });
          if (error) console.error("webhook cancel record failed:", error.message);
        }
        break;
      }
      case "payment_intent.payment_failed": {
        await admin.from("auction_events").insert({
          auction_id: metadata.auction_id || null,
          actor_id: metadata.user_id || null,
          event_type: "payment_attempt_failed",
          data: { payment_id: paymentId, provider: "stripe" },
        });
        break;
      }
      default:
        break;
    }

    return jsonResponse({ received: true }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected webhook error";
    console.error("stripe-auction-webhook:", message);
    return jsonResponse({ error: message }, 500);
  }
});
