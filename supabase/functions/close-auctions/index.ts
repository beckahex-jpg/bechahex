import { corsHeaders, jsonResponse, requireEnvironment, serviceClient } from "../_shared/auction.ts";

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
    const { data: closed, error: closeError } = await admin.rpc("close_expired_auctions", {
      p_auction_id: null,
    });
    if (closeError) throw closeError;

    const { data: advanced, error: advanceError } = await admin.rpc("advance_expired_auction_offers");
    if (advanceError) throw advanceError;

    return jsonResponse({ closedAuctions: closed, advancedWinnerOffers: advanced });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected scheduler error";
    console.error("close-auctions:", message);
    return jsonResponse({ error: message }, 500);
  }
});
