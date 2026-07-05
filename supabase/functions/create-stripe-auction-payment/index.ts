import { authenticatedClient, corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { stripeConfig, stripeRequest, toCents } from "../_shared/stripe.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { client, user } = await authenticatedClient(req);
    const { winnerOfferId } = await req.json() as { winnerOfferId?: string };
    if (!winnerOfferId) return jsonResponse({ error: "winnerOfferId is required" }, 400);

    // Server-side validation + server-side amounts; the client never sends a price.
    const { data: paymentContext, error: prepareError } = await client.rpc("prepare_auction_payment", {
      p_winner_offer_id: winnerOfferId,
    });
    if (prepareError) return jsonResponse({ error: prepareError.message }, 409);
    if (paymentContext.already_paid) {
      return jsonResponse({ alreadyPaid: true, paymentId: paymentContext.payment_id });
    }

    const config = stripeConfig();
    // Idempotency key pins one PaymentIntent per payment row across retries.
    const intent = await stripeRequest(config, "POST", "/payment_intents", {
      "amount": String(toCents(Number(paymentContext.total_amount))),
      "currency": "usd",
      "capture_method": "manual",
      "payment_method_types[]": "card",
      "description": `Beckah auction: ${String(paymentContext.title).slice(0, 200)}`,
      "metadata[payment_id]": String(paymentContext.payment_id),
      "metadata[auction_id]": String(paymentContext.auction_id),
      "metadata[offer_id]": String(paymentContext.offer_id),
      "metadata[user_id]": user.id,
    }, `pi-create-${paymentContext.payment_id}`);

    if (!intent.ok || !intent.body.id || !intent.body.client_secret) {
      console.error("Stripe create intent failed", intent.body);
      return jsonResponse({ error: "Stripe could not create the payment" }, 502);
    }

    const admin = serviceClient();
    const { error: updateError } = await admin.from("auction_payments").update({
      provider: "stripe",
      provider_order_id: String(intent.body.id),
      status: "created",
    }).eq("id", paymentContext.payment_id).eq("user_id", user.id);
    if (updateError) throw updateError;

    return jsonResponse({
      clientSecret: String(intent.body.client_secret),
      paymentId: paymentContext.payment_id,
      totalAmount: paymentContext.total_amount,
      currency: "USD",
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected payment error";
    console.error("create-stripe-auction-payment:", message);
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
