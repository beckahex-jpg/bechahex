import { authenticatedClient, corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { paypalAccessToken, paypalConfig, paypalMoney } from "../_shared/paypal.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { client, user } = await authenticatedClient(req);
    const { winnerOfferId } = await req.json() as { winnerOfferId?: string };
    if (!winnerOfferId) return jsonResponse({ error: "winnerOfferId is required" }, 400);

    const { data: paymentContext, error: prepareError } = await client.rpc("prepare_auction_payment", {
      p_winner_offer_id: winnerOfferId,
    });
    if (prepareError) return jsonResponse({ error: prepareError.message }, 409);
    if (paymentContext.already_paid) {
      return jsonResponse({ alreadyPaid: true, paymentId: paymentContext.payment_id });
    }

    const config = paypalConfig();
    const accessToken = await paypalAccessToken(config);
    const itemAmount = paypalMoney(paymentContext.item_amount);
    const shippingAmount = paypalMoney(paymentContext.shipping_amount);
    const totalAmount = paypalMoney(paymentContext.total_amount);

    const response = await fetch(`${config.baseUrl}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": String(paymentContext.payment_id),
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: String(paymentContext.auction_id),
          custom_id: String(paymentContext.payment_id),
          description: String(paymentContext.title).slice(0, 127),
          amount: {
            currency_code: "USD",
            value: totalAmount,
            breakdown: {
              item_total: { currency_code: "USD", value: itemAmount },
              shipping: { currency_code: "USD", value: shippingAmount },
            },
          },
          items: [{
            name: String(paymentContext.title).slice(0, 127),
            quantity: "1",
            unit_amount: { currency_code: "USD", value: itemAmount },
            category: "PHYSICAL_GOODS",
          }],
        }],
        payment_source: {
          paypal: {
            experience_context: {
              user_action: "PAY_NOW",
              shipping_preference: "GET_FROM_FILE",
            },
          },
        },
      }),
    });

    const paypalOrder = await response.json();
    if (!response.ok || !paypalOrder.id) {
      console.error("PayPal create order failed", paypalOrder);
      return jsonResponse({ error: "PayPal could not create the payment order" }, 502);
    }

    const admin = serviceClient();
    const { error: updateError } = await admin.from("auction_payments").update({
      provider_order_id: paypalOrder.id,
      provider_payload: paypalOrder,
      status: "created",
    }).eq("id", paymentContext.payment_id).eq("user_id", user.id);
    if (updateError) throw updateError;

    return jsonResponse({
      orderId: paypalOrder.id,
      paymentId: paymentContext.payment_id,
      amount: totalAmount,
      currency: "USD",
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected payment error";
    console.error("create-auction-payment:", message);
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
