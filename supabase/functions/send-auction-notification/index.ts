import { corsHeaders, jsonResponse, requireEnvironment, serviceClient } from "../_shared/auction.ts";

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  })[character] || character);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { serviceRoleKey, url } = requireEnvironment();
    const cronSecret = Deno.env.get("AUCTION_CRON_SECRET");
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    const suppliedCronSecret = req.headers.get("x-cron-secret");
    // Key rotations change SUPABASE_SERVICE_ROLE_KEY out from under stored
    // copies (email_config); the shared cron secret survives rotations.
    if (token !== serviceRoleKey && (!cronSecret || suppliedCronSecret !== cronSecret)) {
      return jsonResponse({ error: "Service role required" }, 403);
    }

    const { notificationId } = await req.json() as { notificationId?: string };
    if (!notificationId) return jsonResponse({ error: "notificationId is required" }, 400);

    const admin = serviceClient();
    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();
    if (notificationError || !notification) return jsonResponse({ error: "Notification not found" }, 404);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("email, full_name, email_notifications_enabled")
      .eq("id", notification.user_id)
      .single();
    if (profileError || !profile?.email) return jsonResponse({ error: "Notification recipient not found" }, 404);
    if (profile.email_notifications_enabled === false) return jsonResponse({ skipped: true, reason: "Email disabled" });

    const siteUrl = Deno.env.get("SITE_URL") || "https://beckahex.org";
    const auctionId = notification.data?.auction_id;
    const productId = notification.data?.product_id;
    const winnerOfferId = notification.data?.winner_offer_id;
    const actionUrl = winnerOfferId && ['auction_won', 'auction_second_chance'].includes(notification.type)
      ? `${siteUrl}/auction-payment/${winnerOfferId}`
      // A cancelled auction's product page is no longer publicly readable;
      // send recipients to their own auctions overview instead.
      : notification.type === 'auction_cancelled' ? `${siteUrl}/my-auctions`
      : productId ? `${siteUrl}/product/${productId}` : auctionId ? `${siteUrl}/products?listing=auction` : `${siteUrl}/my-auctions`;
    const html = `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,sans-serif;color:#111827"><div style="max-width:600px;margin:32px auto;background:#fff;border-radius:16px;overflow:hidden"><div style="background:#064e3b;color:#fff;padding:28px"><h1 style="margin:0;font-size:24px">${escapeHtml(notification.title)}</h1></div><div style="padding:28px"><p>Hello ${escapeHtml(profile.full_name || 'there')},</p><p style="line-height:1.7">${escapeHtml(notification.message)}</p><a href="${escapeHtml(actionUrl)}" style="display:inline-block;margin-top:12px;background:#059669;color:#fff;text-decoration:none;padding:13px 22px;border-radius:10px;font-weight:bold">Open auction</a><p style="margin-top:28px;color:#6b7280;font-size:12px">This is an automated Beckah Exchange auction notification.</p></div></div></body></html>`;

    const response = await fetch(`${url}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceRoleKey}` },
      body: JSON.stringify({
        to: profile.email,
        subject: notification.title,
        html,
        userId: notification.user_id,
        emailType: notification.type,
        metadata: { notificationId, auctionId },
      }),
    });
    if (!response.ok) throw new Error(`send-email returned ${response.status}`);
    return jsonResponse({ sent: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected email error";
    console.error("send-auction-notification:", message);
    return jsonResponse({ error: message }, 500);
  }
});
