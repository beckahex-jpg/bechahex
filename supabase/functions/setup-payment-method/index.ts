import { authenticatedClient, corsHeaders, jsonResponse, serviceClient } from "../_shared/auction.ts";
import { stripeConfig, stripeRequest } from "../_shared/stripe.ts";

/* Card-on-file management for bidders:
   - action "status": does the caller have an active saved card?
   - action "create": ensure a Stripe customer + return a SetupIntent secret
   - action "confirm": verify the SetupIntent and persist the card */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await authenticatedClient(req);
    const body = await req.json() as { action?: "status" | "create" | "confirm"; setupIntentId?: string };
    const admin = serviceClient();
    const config = stripeConfig();

    const { data: profile } = await admin
      .from("payment_profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (body.action === "status" || !body.action) {
      return jsonResponse({
        active: Boolean(profile && profile.status === "active" && profile.payment_method_id),
        cardBrand: profile?.card_brand || null,
        cardLast4: profile?.card_last4 || null,
      });
    }

    if (body.action === "create") {
      let customerId = profile?.stripe_customer_id as string | undefined;
      if (!customerId) {
        // No idempotency key on purpose: a failed first attempt would be
        // replayed by Stripe for 24h and permanently lock the user out.
        // A rare duplicate customer is harmless — our table keeps one id.
        const customerParams: Record<string, string> = { "metadata[user_id]": user.id };
        if (user.email) customerParams["email"] = user.email;
        const customer = await stripeRequest(config, "POST", "/customers", customerParams);
        if (!customer.ok || !customer.body.id) {
          const reason = String((customer.body.error as { message?: string })?.message || `HTTP ${customer.status}`);
          console.error("Stripe create customer failed", customer.body);
          return jsonResponse({ error: `Stripe customer could not be created: ${reason}` }, 502);
        }
        customerId = String(customer.body.id);
        const { error: upsertError } = await admin.from("payment_profiles").upsert({
          user_id: user.id,
          stripe_customer_id: customerId,
          status: "incomplete",
          updated_at: new Date().toISOString(),
        });
        if (upsertError) throw upsertError;
      }

      // Card only: keeps the form compact (no Link signup / bank options)
      // and guarantees the saved method supports off-session holds.
      const setupIntent = await stripeRequest(config, "POST", "/setup_intents", {
        "customer": customerId,
        "usage": "off_session",
        "payment_method_types[]": "card",
        "metadata[user_id]": user.id,
      });
      if (!setupIntent.ok || !setupIntent.body.client_secret) {
        const reason = String((setupIntent.body.error as { message?: string })?.message || `HTTP ${setupIntent.status}`);
        console.error("Stripe create setup intent failed", setupIntent.body);
        return jsonResponse({ error: `Stripe setup could not be created: ${reason}` }, 502);
      }

      return jsonResponse({
        clientSecret: String(setupIntent.body.client_secret),
        setupIntentId: String(setupIntent.body.id),
      }, 201);
    }

    if (body.action === "confirm") {
      if (!body.setupIntentId) return jsonResponse({ error: "setupIntentId is required" }, 400);
      if (!profile) return jsonResponse({ error: "No payment profile" }, 409);

      const setupIntent = await stripeRequest(config, "GET", `/setup_intents/${body.setupIntentId}`);
      if (!setupIntent.ok) return jsonResponse({ error: "Could not verify the card with Stripe" }, 502);
      if (String(setupIntent.body.customer) !== profile.stripe_customer_id) {
        return jsonResponse({ error: "Setup does not belong to this account" }, 403);
      }
      if (String(setupIntent.body.status) !== "succeeded" || !setupIntent.body.payment_method) {
        return jsonResponse({ saved: false, status: String(setupIntent.body.status) }, 200);
      }

      const methodId = String(setupIntent.body.payment_method);
      const method = await stripeRequest(config, "GET", `/payment_methods/${methodId}`);
      const card = (method.body.card || {}) as { brand?: string; last4?: string };

      const { error: updateError } = await admin.from("payment_profiles").update({
        payment_method_id: methodId,
        card_brand: card.brand || null,
        card_last4: card.last4 || null,
        status: "active",
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
      if (updateError) throw updateError;

      return jsonResponse({ saved: true, cardBrand: card.brand || null, cardLast4: card.last4 || null }, 200);
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("setup-payment-method:", message);
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
