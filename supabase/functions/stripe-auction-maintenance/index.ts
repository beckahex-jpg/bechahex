import { corsHeaders, jsonResponse, requireEnvironment, serviceClient } from "../_shared/auction.ts";
import { stripeConfig, stripeRequest } from "../_shared/stripe.ts";

const WARN_AFTER_HOURS = 4 * 24;
const VOID_AFTER_HOURS = 5.5 * 24; // Stripe guarantees card holds for 7 days

/* Hourly safety net for held payments:
   - order shipped but hold never captured (client call failed) -> capture
   - day 4 without shipment -> warn the seller once
   - day ~5.5 without shipment -> void the hold and unwind the sale */
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

    const admin = serviceClient();
    const config = stripeConfig();
    const summary = { captured: 0, warned: 0, voided: 0, errors: 0 };

    const { data: held, error: heldError } = await admin
      .from("auction_payments")
      .select("id, auction_id, user_id, provider_order_id, updated_at")
      .eq("provider", "stripe")
      .eq("status", "authorized");
    if (heldError) throw heldError;

    for (const payment of held || []) {
      try {
        const { data: order } = await admin
          .from("orders")
          .select("id, seller_id, tracking_number, created_at")
          .eq("auction_id", payment.auction_id)
          .maybeSingle();
        if (!order) continue;

        if (order.tracking_number) {
          // Shipped: money must move.
          const captured = await stripeRequest(config, "POST", `/payment_intents/${payment.provider_order_id}/capture`, undefined, `pi-capture-${payment.id}`);
          if (captured.ok) {
            await admin.rpc("record_stripe_capture", {
              p_payment_id: payment.id,
              p_capture_id: String(captured.body.latest_charge || ""),
              p_payload: captured.body,
            });
            summary.captured += 1;
          } else {
            console.error("maintenance capture failed", payment.id, captured.body);
            summary.errors += 1;
          }
          continue;
        }

        const ageHours = (Date.now() - new Date(order.created_at).getTime()) / 3_600_000;

        if (ageHours >= VOID_AFTER_HOURS) {
          const canceled = await stripeRequest(config, "POST", `/payment_intents/${payment.provider_order_id}/cancel`, {
            cancellation_reason: "abandoned",
          }, `pi-cancel-${payment.id}`);
          if (canceled.ok || String((canceled.body.error as { code?: string })?.code) === "payment_intent_unexpected_state") {
            const { error: releaseError } = await admin.rpc("cancel_stripe_authorization", {
              p_payment_id: payment.id,
              p_reason: "Seller did not ship within the allowed window",
            });
            if (releaseError) {
              // PI is cancelled at Stripe but our row is still 'authorized';
              // count it so the stale state is visible until the next tick.
              console.error("maintenance void reconcile failed", payment.id, releaseError);
              summary.errors += 1;
            } else {
              summary.voided += 1;
            }
          } else {
            console.error("maintenance void failed", payment.id, canceled.body);
            summary.errors += 1;
          }
          continue;
        }

        if (ageHours >= WARN_AFTER_HOURS) {
          const { data: alreadyWarned } = await admin
            .from("auction_events")
            .select("id")
            .eq("auction_id", payment.auction_id)
            .eq("event_type", "ship_reminder")
            .limit(1);
          if (!alreadyWarned || alreadyWarned.length === 0) {
            await admin.from("notifications").insert({
              user_id: order.seller_id,
              type: "auction_ship_reminder",
              title: "Ship soon or the sale is cancelled",
              message: "The buyer's payment hold will be released automatically if you do not add shipping details within the next day.",
              data: { order_id: order.id, auction_id: payment.auction_id },
            });
            await admin.from("auction_events").insert({
              auction_id: payment.auction_id,
              actor_id: order.seller_id,
              event_type: "ship_reminder",
              data: { payment_id: payment.id },
            });
            summary.warned += 1;
          }
        }
      } catch (innerError) {
        console.error("maintenance item failed", payment.id, innerError);
        summary.errors += 1;
      }
    }

    return jsonResponse(summary, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected maintenance error";
    console.error("stripe-auction-maintenance:", message);
    return jsonResponse({ error: message }, 500);
  }
});
