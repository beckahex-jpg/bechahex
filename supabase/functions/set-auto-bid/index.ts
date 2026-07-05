import { authenticatedClient, corsHeaders, jsonResponse, parseMoney } from "../_shared/auction.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { client } = await authenticatedClient(req);
    const body = await req.json() as { auctionId?: string; maxAmount?: number; action?: "set" | "cancel" };
    if (!body.auctionId) {
      return jsonResponse({ error: "auctionId is required" }, 400);
    }

    if (body.action === "cancel") {
      const { data, error } = await client.rpc("cancel_auction_auto_bid", {
        p_auction_id: body.auctionId,
      });
      if (error) return jsonResponse({ error: error.message, code: error.code }, 409);
      return jsonResponse(data, 200);
    }

    const maxAmount = parseMoney(body.maxAmount, "maxAmount");
    const { data, error } = await client.rpc("set_auction_auto_bid", {
      p_auction_id: body.auctionId,
      p_max_amount: maxAmount,
    });
    if (error) {
      const conflict = /at least|not open|own auction|only raise|cannot be below/i.test(error.message);
      return jsonResponse({ error: error.message, code: error.code }, conflict ? 409 : 400);
    }
    return jsonResponse(data, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
