import {
  authenticatedClient,
  corsHeaders,
  jsonResponse,
  requireEnvironment,
  serviceClient,
} from "../_shared/auction.ts";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { client, user } = await authenticatedClient(req);
    const { auctionId } = await req.json() as { auctionId?: string };
    if (!auctionId) return jsonResponse({ error: "auctionId is required" }, 400);

    const admin = serviceClient();
    const [{ data: auction }, { data: profile }] = await Promise.all([
      admin.from("auctions").select("id, seller_id, status, ai_moderation_status").eq("id", auctionId).maybeSingle(),
      client.from("profiles").select("role").eq("id", user.id).maybeSingle(),
    ]);
    if (!auction) return jsonResponse({ error: "Auction not found" }, 404);
    if (auction.seller_id !== user.id && profile?.role !== "admin") {
      return jsonResponse({ error: "Auction owner or admin required" }, 403);
    }
    if (auction.status !== "pending_ai_review" || auction.ai_moderation_status !== "error") {
      return jsonResponse({ error: "Only a failed pending review can be retried" }, 409);
    }

    await admin.from("auctions").update({
      ai_moderation_status: "pending",
      ai_moderation_reason: null,
    }).eq("id", auctionId);

    const { url, serviceRoleKey } = requireEnvironment();
    const response = await fetch(`${url}/functions/v1/moderate-auction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ auctionId }),
    });
    const result = await response.json().catch(() => ({ error: "Unreadable moderation response" }));
    return jsonResponse(result, response.ok ? 200 : 503);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected moderation retry error";
    console.error("retry-auction-moderation:", message);
    return jsonResponse({ error: message }, /Authentication|session/i.test(message) ? 401 : 500);
  }
});
