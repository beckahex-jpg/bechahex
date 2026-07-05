import { useCallback, useEffect, useMemo, useState } from 'react';
import { CreditCard, Gavel, RotateCcw, ShieldCheck, Timer, Truck } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Auction, AuctionAutoBid, PublicAuctionBid } from '../../types/auction';
import { auctionPrice, minimumNextBid } from '../../types/auction';
import AuctionCountdown from './AuctionCountdown';
import BidModal from './BidModal';

interface AuctionProductPanelProps {
  auction: Auction;
  onBidsChange: (bids: PublicAuctionBid[]) => void;
}

export default function AuctionProductPanel({ auction: initialAuction, onBidsChange }: AuctionProductPanelProps) {
  const { user, openAuthModal } = useAuth();
  const [auction, setAuction] = useState(initialAuction);
  const [showBidModal, setShowBidModal] = useState(false);
  const [autoBid, setAutoBid] = useState<AuctionAutoBid | null>(null);
  const [hasCard, setHasCard] = useState<boolean | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const auctionId = auction.id;
  const userId = user?.id;
  const reload = useCallback(async () => {
    const [{ data: auctionData, error: auctionError }, { data: bidData }] = await Promise.all([
      supabase.from('auctions').select('*').eq('id', auctionId).maybeSingle(),
      supabase.from('public_auction_bid_history').select('*').eq('auction_id', auctionId).order('amount', { ascending: false }).limit(50),
    ]);
    if (auctionData) setAuction(auctionData as Auction);
    // A clean empty read (no error) means RLS hid the row: the auction was
    // cancelled or removed, so close bidding locally instead of leaving a
    // stale live page. A failed read keeps the previous state.
    else if (!auctionError) setAuction((previous) => previous.status === 'active' || previous.status === 'scheduled' ? { ...previous, status: 'cancelled_by_seller' } : previous);
    onBidsChange((bidData || []) as PublicAuctionBid[]);
    if (userId) {
      const [{ data: autoData }, { data: profileData }] = await Promise.all([
        supabase.from('auction_auto_bids').select('*').eq('auction_id', auctionId).maybeSingle(),
        supabase.from('payment_profiles').select('status, payment_method_id').eq('user_id', userId).maybeSingle(),
      ]);
      setAutoBid((autoData || null) as AuctionAutoBid | null);
      setHasCard(Boolean(profileData?.status === 'active' && profileData.payment_method_id));
    } else {
      setAutoBid(null);
      setHasCard(null);
    }
  }, [auctionId, onBidsChange, userId]);

  useEffect(() => {
    setAuction(initialAuction);
  }, [initialAuction]);

  useEffect(() => {
    void reload();
    const channel = supabase.channel(`marketplace-auction-${auctionId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'auctions', filter: `id=eq.${auctionId}` }, () => { void reload(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [auctionId, reload]);

  const canBid = useMemo(() => {
    return auction.status === 'active'
      && now >= new Date(auction.starts_at).getTime()
      && now < new Date(auction.ends_at).getTime()
      && user?.id !== auction.seller_id;
  }, [auction, user, now]);

  return (
    <>
      <aside className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-lg xl:sticky xl:top-20">
        <div className="flex items-center justify-between bg-emerald-700 px-4 py-3 text-white">
          <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wide"><Gavel className="h-5 w-5" />Live auction</span>
          {auction.ai_moderation_status === 'approved' && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-50"><ShieldCheck className="h-4 w-4" />AI reviewed</span>
          )}
        </div>
        <div className="space-y-4 p-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{auction.bid_count ? 'Current highest bid' : 'Starting price'}</p>
            <div className="mt-1 flex items-end justify-between gap-3">
              <p className="text-3xl font-black tracking-tight text-emerald-700">${auctionPrice(auction).toFixed(2)}</p>
              <p className="pb-1 text-sm font-semibold text-gray-500">{auction.bid_count} {auction.bid_count === 1 ? 'bid' : 'bids'}</p>
            </div>
            <div className="mt-2 flex items-center justify-between gap-3 text-xs text-gray-500">
              <span>Starting bid: ${Number(auction.starting_price).toFixed(2)}</span>
              {auction.status === 'active' && <span className="font-bold text-emerald-700">Next: ${minimumNextBid(auction).toFixed(2)}</span>}
            </div>
          </div>

          <div className="border-y border-gray-100 py-3">
            <AuctionCountdown startsAt={auction.starts_at} endsAt={auction.ends_at} status={auction.status} />
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs font-semibold text-emerald-900"><Truck className="h-4 w-4 text-emerald-700" />Buyer pays ${Number(auction.shipping_cost).toFixed(2)} shipping.</div>

          {autoBid?.status === 'active' && (
            <div className={`flex items-start gap-2 rounded-xl border-2 px-3 py-2.5 text-xs font-semibold ${auction.highest_bidder_id === user?.id ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
              <Timer className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Auto-bid active up to ${Number(autoBid.max_amount).toFixed(2)} — {auction.highest_bidder_id === user?.id ? "you're leading" : 'you have been outbid, raise your maximum'}</span>
            </div>
          )}
          {autoBid?.status === 'exhausted' && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-700">
              <Timer className="mt-0.5 h-4 w-4 shrink-0" />
              <span>Your maximum of ${Number(autoBid.max_amount).toFixed(2)} was exceeded. Set a higher one to rejoin.</span>
            </div>
          )}

          {user && hasCard === false && canBid && (
            <div className="flex items-start gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800">
              <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
              <span>A saved card is required to bid — you will add it in the next step. It is never charged unless you win.</span>
            </div>
          )}

          <button disabled={!canBid} onClick={() => user ? setShowBidModal(true) : openAuthModal('Please sign in to place a bid')} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white shadow-md transition hover:bg-emerald-700 hover:shadow-lg disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none"><Gavel className="h-4 w-4" />{user?.id === auction.seller_id ? 'This is your listing' : canBid ? 'Place Bid' : auction.status === 'scheduled' ? 'Auction has not started' : 'Bidding closed'}</button>

          <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
            <div className="text-center"><ShieldCheck className="mx-auto h-4 w-4 text-emerald-600" /><p className="mt-1 text-[9px] font-semibold text-gray-700">Secure payment</p></div>
            <div className="text-center"><Truck className="mx-auto h-4 w-4 text-emerald-600" /><p className="mt-1 text-[9px] font-semibold text-gray-700">Tracked shipping</p></div>
            <div className="text-center"><RotateCcw className="mx-auto h-4 w-4 text-emerald-600" /><p className="mt-1 text-[9px] font-semibold text-gray-700">Easy returns</p></div>
          </div>
        </div>
      </aside>
      {showBidModal && <BidModal auction={auction} onClose={() => setShowBidModal(false)} onSuccess={reload} />}
    </>
  );
}
