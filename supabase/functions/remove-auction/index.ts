import { authenticatedClient, corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { paypalAccessToken, paypalConfig } from "../_shared/paypal.ts";
import { stripeConfig, stripeRequest } from "../_shared/stripe.ts";

interface AuctionPaymentRow {
  id: string;
  status: string;
  provider: string;
  provider_order_id: string | null;
  provider_capture_id: string | null;
  provider_refund_id: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { client, user } = await authenticatedClient(req);
    const { auctionId, reason } = await req.json() as { auctionId?: string; reason?: string };
    if (!auctionId || !reason || reason.trim().length < 3) {
      return jsonResponse({ error: "auctionId and a cancellation reason are required" }, 400);
    }

    const { data: profile } = await client.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") return jsonResponse({ error: "Admin role required" }, 403);

    const admin = serviceClient();
    const { data: auction, error: auctionError } = await admin
      .from("auctions")
      .select("id, status")
      .eq("id", auctionId)
      .maybeSingle();
    if (auctionError || !auction) return jsonResponse({ error: "Auction not found" }, 404);

    const { data: payments, error: paymentError } = await admin
      .from("auction_payments")
      .select("id, status, provider, provider_order_id, provider_capture_id, provider_refund_id")
      .eq("auction_id", auctionId)
      .in("status", ["created", "approved", "captured", "refunded", "review_required", "authorized"]);
    if (paymentError) throw paymentError;

    const rows = (payments || []) as AuctionPaymentRow[];
    if (rows.some((p) => p.status === "approved" || p.status === "review_required")) {
      return jsonResponse({
        error: "This auction has a payment capture in progress or awaiting manual review",
      }, 409);
    }

    let refunded = rows.some((p) => p.status === "refunded");
    let holdReleased = false;

    /* Cancel a PaymentIntent, tolerating one already cancelled at Stripe
       (e.g. by the maintenance tick) so a stale DB row can still reconcile.
       Returns null on success/already-cancelled, or an error Response.
       The idempotency key is remove-auction-specific: sharing maintenance's
       key with a different body would be a Stripe idempotency_error. */
    const cancelPaymentIntent = async (payment: AuctionPaymentRow): Promise<Response | null> => {
      const canceled = await stripeRequest(
        stripeConfig(),
        "POST",
        `/payment_intents/${payment.provider_order_id}/cancel`,
        { cancellation_reason: "requested_by_customer" },
        `pi-cancel-remove-${payment.id}`,
      );
      if (canceled.ok) return null;
      const stripeCode = String((canceled.body.error as { code?: string })?.code || "");
      if (stripeCode !== "payment_intent_unexpected_state") {
        console.error("remove-auction PaymentIntent cancel failed", payment.id, canceled.body);
        return jsonResponse({ error: "Releasing the buyer's card hold failed; the auction was not removed" }, 502);
      }
      const intent = await stripeRequest(stripeConfig(), "GET", `/payment_intents/${payment.provider_order_id}`);
      if (!intent.ok || String(intent.body.status) !== "canceled") {
        // Genuinely moved on (e.g. captured mid-flight): make the operator
        // re-run against the current state instead of guessing.
        return jsonResponse({ error: "The payment hold changed state; review the payment and retry" }, 409);
      }
      return null;
    };

    // A 'created' Stripe PaymentIntent is still confirmable from the buyer's
    // open payment page; cancel it so removal can't race a fresh hold.
    for (const payment of rows.filter((p) => p.status === "created" && p.provider === "stripe" && p.provider_order_id)) {
      const failure = await cancelPaymentIntent(payment);
      if (failure) return failure;
      const { error: staleUpdateError } = await admin
        .from("auction_payments")
        .update({ status: "cancelled", failure_reason: `Auction removed by an administrator: ${reason.trim()}` })
        .eq("id", payment.id)
        .eq("status", "created");
      if (staleUpdateError) throw staleUpdateError;
    }

    // Void any live Stripe hold before touching the auction row so the
    // buyer's card is never left with a dangling authorization.
    for (const payment of rows.filter((p) => p.status === "authorized")) {
      if (payment.provider !== "stripe" || !payment.provider_order_id) {
        return jsonResponse({ error: "Held payment is missing its Stripe reference" }, 409);
      }
      const failure = await cancelPaymentIntent(payment);
      if (failure) return failure;
      const { error: releaseError } = await admin.rpc("cancel_stripe_authorization", {
        p_payment_id: payment.id,
        p_reason: `Auction removed by an administrator: ${reason.trim()}`,
        p_relist: false,
      });
      if (releaseError) throw releaseError;
      holdReleased = true;
    }

    for (const payment of rows.filter((p) => p.status === "captured")) {
      if (payment.provider === "stripe") {
        if (!payment.provider_order_id) throw new Error("Captured payment has no Stripe PaymentIntent ID");

        // A previous run may already have created the refund (it was pending
        // then); re-read its CURRENT state instead of re-POSTing — Stripe's
        // idempotency cache would replay the stale first response, and a
        // fresh POST after the key expires fails with charge_already_refunded.
        let refundBody: Record<string, unknown> | null = null;
        if (payment.provider_refund_id) {
          const existing = await stripeRequest(stripeConfig(), "GET", `/refunds/${payment.provider_refund_id}`);
          if (existing.ok) refundBody = existing.body;
        }
        if (!refundBody) {
          const created = await stripeRequest(
            stripeConfig(),
            "POST",
            "/refunds",
            { payment_intent: payment.provider_order_id },
            `pi-refund-${payment.id}`,
          );
          if (created.ok) {
            refundBody = created.body;
          } else if (String((created.body.error as { code?: string })?.code) === "charge_already_refunded") {
            const list = await stripeRequest(stripeConfig(), "GET", "/refunds", {
              payment_intent: payment.provider_order_id,
              limit: "1",
            });
            const latest = (list.body.data as Array<Record<string, unknown>> | undefined)?.[0];
            if (!list.ok || !latest) {
              console.error("Stripe refund reconcile failed", payment.id, list.body);
              return jsonResponse({ error: "Stripe refund lookup failed; the auction was not removed" }, 502);
            }
            refundBody = latest;
          } else {
            console.error("Stripe refund failed", payment.id, created.body);
            return jsonResponse({ error: "Stripe refund failed; the auction was not removed" }, 502);
          }
        }

        const refundStatus = String(refundBody.status || "");
        if (refundStatus === "failed" || refundStatus === "canceled") {
          console.error("Stripe refund did not complete", payment.id, refundBody);
          return jsonResponse({ error: "Stripe refund failed; the auction was not removed" }, 502);
        }
        if (refundStatus !== "succeeded") {
          // Persist the refund id so the retry above reconciles by GET once
          // the refund settles (mirrors the PayPal pending branch).
          const { error: pendingUpdateError } = await admin
            .from("auction_payments")
            .update({ provider_refund_id: String(refundBody.id || ""), refund_payload: refundBody })
            .eq("id", payment.id)
            .eq("status", "captured");
          if (pendingUpdateError) throw pendingUpdateError;
          return jsonResponse({
            error: "Stripe refund is pending; the auction remains visible until the refund completes",
            refundStatus,
          }, 409);
        }
        const { error: refundUpdateError } = await admin
          .from("auction_payments")
          .update({
            status: "refunded",
            provider_refund_id: String(refundBody.id || ""),
            refund_payload: refundBody,
            refunded_at: new Date().toISOString(),
          })
          .eq("id", payment.id)
          .eq("status", "captured");
        if (refundUpdateError) throw refundUpdateError;
        refunded = true;
        continue;
      }

      if (!payment.provider_capture_id) throw new Error("Captured payment has no PayPal capture ID");

      const config = paypalConfig();
      const accessToken = await paypalAccessToken(config);
      const refundResponse = await fetch(
        `${config.baseUrl}/v2/payments/captures/${encodeURIComponent(payment.provider_capture_id)}/refund`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "PayPal-Request-Id": `auction-refund-${payment.id}`,
            "Prefer": "return=representation",
          },
          body: "{}",
        },
      );
      const refund = await refundResponse.json();
      if (!refundResponse.ok) {
        console.error("PayPal refund failed", refund);
        return jsonResponse({ error: "PayPal refund failed; the auction was not removed" }, 502);
      }
      if (refund.status !== "COMPLETED") {
        return jsonResponse({
          error: "PayPal refund is pending; the auction remains visible until the refund completes",
          refundStatus: refund.status,
        }, 409);
      }

      const { error: refundUpdateError } = await admin
        .from("auction_payments")
        .update({
          status: "refunded",
          provider_refund_id: refund.id,
          refund_payload: refund,
          refunded_at: new Date().toISOString(),
        })
        .eq("id", payment.id)
        .eq("status", "captured");
      if (refundUpdateError) throw refundUpdateError;
      refunded = true;
    }

    const { error: cancelError } = await client.rpc("admin_cancel_auction", {
      p_auction_id: auctionId,
      p_reason: reason.trim(),
    });
    if (cancelError) throw cancelError;

    return jsonResponse({ success: true, refunded, holdReleased });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected auction removal error";
    console.error("remove-auction:", message);
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
