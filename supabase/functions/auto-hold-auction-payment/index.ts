import { corsHeaders, jsonResponse, requireEnvironment, serviceClient } from "../_shared/auction.ts";
import { stripeConfig, stripeRequest, toCents } from "../_shared/stripe.ts";

/* Fired by a DB trigger the moment a winner offer is created: place the
   Stripe hold on the winner's saved card automatically. If the off-session
   charge needs authentication or is declined, the winner simply pays
   manually from the payment page (existing fallback). */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { serviceRoleKey } = requireEnvironment();
    const cronSecret = Deno.env.get("AUCTION_CRON_SECRET");
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const suppliedCronSecret = req.headers.get("x-cron-secret");
    if (token !== serviceRoleKey && (!cronSecret || suppliedCronSecret !== cronSecret)) {
      return jsonResponse({ error: "Scheduler authorization required" }, 403);
    }

    const { offerId } = await req.json() as { offerId?: string };
    if (!offerId) return jsonResponse({ error: "offerId is required" }, 400);

    const admin = serviceClient();

    const { data: context, error: prepareError } = await admin.rpc("service_prepare_auction_payment", {
      p_winner_offer_id: offerId,
    });
    if (prepareError) return jsonResponse({ skipped: true, reason: prepareError.message }, 200);
    if (context.skip) return jsonResponse({ skipped: true, reason: `payment status ${context.status}` }, 200);

    const { data: profile } = await admin
      .from("payment_profiles")
      .select("stripe_customer_id, payment_method_id, status")
      .eq("user_id", context.user_id)
      .maybeSingle();
    if (!profile || profile.status !== "active" || !profile.payment_method_id) {
      return jsonResponse({ skipped: true, reason: "winner has no saved card" }, 200);
    }

    const config = stripeConfig();
    const intent = await stripeRequest(config, "POST", "/payment_intents", {
      "amount": String(toCents(Number(context.total_amount))),
      "currency": "usd",
      "capture_method": "manual",
      "customer": profile.stripe_customer_id,
      "payment_method": profile.payment_method_id,
      "off_session": "true",
      "confirm": "true",
      "description": `Beckah auction (auto-hold): ${String(context.title).slice(0, 180)}`,
      "metadata[payment_id]": String(context.payment_id),
      "metadata[auction_id]": String(context.auction_id),
      "metadata[offer_id]": String(context.offer_id),
      "metadata[user_id]": String(context.user_id),
    }, `pi-autohold-${context.payment_id}`);

    if (intent.ok && String(intent.body.status) === "requires_capture") {
      const { error: recordError } = await admin.rpc("record_stripe_authorization", {
        p_payment_id: context.payment_id,
        p_provider_order_id: String(intent.body.id),
        p_payload: intent.body,
      });
      if (recordError) throw recordError;
      return jsonResponse({ held: true, paymentId: context.payment_id }, 200);
    }

    // Declined / needs 3-D Secure: leave the manual payment page as fallback.
    console.error("Auto-hold not completed", intent.status, intent.body?.error || intent.body?.status);
    await admin.from("auction_events").insert({
      auction_id: context.auction_id,
      actor_id: context.user_id,
      event_type: "auto_hold_failed",
      data: {
        payment_id: context.payment_id,
        reason: String((intent.body?.error as { code?: string })?.code || intent.body?.status || "unknown"),
      },
    });
    return jsonResponse({ held: false, fallback: "manual payment page" }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("auto-hold-auction-payment:", message);
    return jsonResponse({ error: message }, 500);
  }
});
