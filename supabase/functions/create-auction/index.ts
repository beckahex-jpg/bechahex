import {
  authenticatedClient,
  corsHeaders,
  jsonResponse,
  parseMoney,
  requireEnvironment,
  serviceClient,
  suggestedIncrement,
} from "../_shared/auction.ts";

interface CreateAuctionBody {
  title: string;
  description?: string;
  categoryId?: string | null;
  condition?: string;
  reviewImagePaths?: string[];
  publicImageUrls?: string[];
  sellerId?: string;
  startingPrice: number;
  minimumBidIncrement?: number;
  shippingCost?: number;
  startsAt: string;
  endsAt: string;
  winnerPaymentWindowHours: number;
  submissionType?: "donation" | "symbolic_sale" | "public_sale";
  originalPrice?: number | null;
  sellerSymbolicPrice?: number | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const { user } = await authenticatedClient(req);
    const admin = serviceClient();
    const body = await req.json() as CreateAuctionBody;
    const reviewImagePaths = Array.isArray(body.reviewImagePaths) ? body.reviewImagePaths : [];
    const publicImageUrls = Array.isArray(body.publicImageUrls) ? body.publicImageUrls : [];
    const sellerId = body.sellerId || user.id;

    if (!reviewImagePaths.every((path) => typeof path === "string") || !publicImageUrls.every((imageUrl) => typeof imageUrl === "string")) {
      return jsonResponse({ error: "Image paths and URLs must be strings" }, 400);
    }

    const requiresAdmin = sellerId !== user.id || publicImageUrls.length > 0;
    if (requiresAdmin) {
      const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (profile?.role !== "admin") return jsonResponse({ error: "Admin role required" }, 403);
    }

    const title = body.title?.trim();
    const description = body.description?.trim() || "";
    if (!title || title.length < 3 || title.length > 160) {
      return jsonResponse({ error: "Title must contain between 3 and 160 characters" }, 400);
    }
    if (description.length > 5000) {
      return jsonResponse({ error: "Description must not exceed 5000 characters" }, 400);
    }

    const condition = body.condition?.trim() || "Good";
    if (!["New", "Brand New", "Like New", "Good", "Fair", "Poor"].includes(condition)) {
      return jsonResponse({ error: "Invalid product condition" }, 400);
    }

    if (reviewImagePaths.length + publicImageUrls.length < 1 || reviewImagePaths.length + publicImageUrls.length > 8) {
      return jsonResponse({ error: "Between 1 and 8 product images are required" }, 400);
    }

    if (reviewImagePaths.some((path) => !path.startsWith(`${user.id}/`) || path.includes(".."))) {
      return jsonResponse({ error: "Invalid review image path" }, 403);
    }

    const { url, serviceRoleKey } = requireEnvironment();
    const publicImagePrefix = `${url}/storage/v1/object/public/product-images/`;
    if (publicImageUrls.some((imageUrl) => !imageUrl.startsWith(publicImagePrefix))) {
      return jsonResponse({ error: "Only existing product-images URLs can be reused by an administrator" }, 403);
    }

    const startingPrice = parseMoney(body.startingPrice, "startingPrice");
    const minimumBidIncrement = body.minimumBidIncrement == null
      ? suggestedIncrement(startingPrice)
      : parseMoney(body.minimumBidIncrement, "minimumBidIncrement");
    const shippingCost = parseMoney(body.shippingCost ?? 0, "shippingCost", true);
    const submissionType = body.submissionType || "public_sale";
    if (!["donation", "symbolic_sale", "public_sale"].includes(submissionType)) {
      return jsonResponse({ error: "Invalid submission type" }, 400);
    }
    const originalPrice = body.originalPrice == null ? null : parseMoney(body.originalPrice, "originalPrice", true);
    const sellerSymbolicPrice = body.sellerSymbolicPrice == null
      ? null
      : parseMoney(body.sellerSymbolicPrice, "sellerSymbolicPrice", true);
    const startsAt = new Date(body.startsAt);
    const endsAt = new Date(body.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return jsonResponse({ error: "Auction end time must be after its start time" }, 400);
    }
    if (endsAt.getTime() <= Date.now()) {
      return jsonResponse({ error: "Auction end time must be in the future" }, 400);
    }
    const duration = endsAt.getTime() - startsAt.getTime();
    if (duration < 5 * 60 * 1000 || duration > 30 * 24 * 60 * 60 * 1000) {
      return jsonResponse({ error: "Auction duration must be between 5 minutes and 30 days" }, 400);
    }
    if (startsAt.getTime() > Date.now() + 365 * 24 * 60 * 60 * 1000) {
      return jsonResponse({ error: "Auction start time cannot be more than one year ahead" }, 400);
    }

    const paymentWindow = Number(body.winnerPaymentWindowHours);
    if (!Number.isInteger(paymentWindow) || paymentWindow < 1 || paymentWindow > 168) {
      return jsonResponse({ error: "Winner payment window must be between 1 and 168 hours" }, 400);
    }

    const { data: auction, error: insertError } = await admin
      .from("auctions")
      .insert({
        seller_id: sellerId,
        category_id: body.categoryId || null,
        title,
        description,
        condition,
        review_image_paths: reviewImagePaths,
        images: publicImageUrls,
        submission_type: submissionType,
        original_price: originalPrice,
        seller_symbolic_price: sellerSymbolicPrice,
        starting_price: startingPrice,
        minimum_bid_increment: minimumBidIncrement,
        shipping_cost: shippingCost,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        winner_payment_window_hours: paymentWindow,
        status: "pending_ai_review",
        ai_moderation_status: "pending",
      })
      .select("*")
      .single();

    if (insertError || !auction) throw insertError || new Error("Failed to create auction");

    await admin.from("auction_events").insert({
      auction_id: auction.id,
      actor_id: user.id,
      event_type: "auction_created",
      data: { source: requiresAdmin ? "admin" : "seller", publication: "pending_ai_review" },
    });

    const moderationResponse = await fetch(`${url}/functions/v1/moderate-auction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ auctionId: auction.id }),
    });

    const moderation = await moderationResponse.json().catch(() => ({
      approved: false,
      status: "pending_ai_review",
      reason: "Moderation response could not be read",
    }));

    return jsonResponse({ auctionId: auction.id, moderation }, moderationResponse.ok ? 201 : 202);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("create-auction:", message);
    const status = /Authentication|session/i.test(message) ? 401 : 500;
    return jsonResponse({ error: message }, status);
  }
});
