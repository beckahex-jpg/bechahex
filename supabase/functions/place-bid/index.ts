import { authenticatedClient, corsHeaders, jsonResponse, parseMoney } from "../_shared/auction.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { client } = await authenticatedClient(req);
    const body = await req.json() as { auctionId?: string; amount?: number; idempotencyKey?: string };
    if (!body.auctionId || !body.idempotencyKey) {
      return jsonResponse({ error: "auctionId and idempotencyKey are required" }, 400);
    }
    const amount = parseMoney(body.amount, "amount");

    const { data, error } = await client.rpc("place_auction_bid", {
      p_auction_id: body.auctionId,
      p_amount: amount,
      p_idempotency_key: body.idempotencyKey,
    });
    if (error) {
      const conflict = /at least|not open|own auction|idempotency key/i.test(error.message);
      return jsonResponse({ error: error.message, code: error.code }, conflict ? 409 : 400);
    }
    return jsonResponse(data, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
