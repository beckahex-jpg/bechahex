export type AuctionStatus =
  | 'draft'
  | 'pending_ai_review'
  | 'scheduled'
  | 'active'
  | 'blocked'
  | 'awaiting_payment'
  | 'paid'
  | 'ended_no_bids'
  | 'cancelled_by_admin'
  | 'cancelled_by_seller'
  | 'closed';

export interface Auction {
  id: string;
  product_id: string | null;
  seller_id: string;
  category_id: string | null;
  title: string;
  description: string;
  condition: string;
  images: string[];
  currency: 'USD';
  starting_price: number;
  current_price: number | null;
  minimum_bid_increment: number;
  shipping_cost: number;
  starts_at: string;
  ends_at: string;
  winner_payment_window_hours: number;
  payment_due_at: string | null;
  status: AuctionStatus;
  bid_count: number;
  highest_bidder_id: string | null;
  winner_id: string | null;
  ai_moderation_status: 'pending' | 'approved' | 'blocked' | 'error';
  ai_risk_score: number | null;
  ai_moderation_reason: string | null;
  cancellation_reason: string | null;
  created_at: string;
  categories?: { name: string } | null;
  auction_payments?: Array<{ status: string }>;
}

export interface PublicAuctionBid {
  id: string;
  auction_id: string;
  amount: number;
  status: 'accepted' | 'invalidated';
  created_at: string;
  bidder_alias: string;
}

export interface AuctionAutoBid {
  id: string;
  auction_id: string;
  max_amount: number;
  status: 'active' | 'exhausted' | 'cancelled';
  created_at: string;
}

export function auctionPrice(auction: Auction): number {
  return Number(auction.current_price ?? auction.starting_price);
}

export function minimumNextBid(auction: Auction): number {
  // Round to cents: float addition (e.g. 55.05 + 5) can produce values like
  // 60.050000000000004 that would then fail exact comparisons downstream.
  const raw = auction.bid_count > 0
    ? auctionPrice(auction) + Number(auction.minimum_bid_increment)
    : Number(auction.starting_price);
  return Math.round(raw * 100) / 100;
}
