import { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, CheckCircle, Clock, Gavel, Loader2, Plus, Trophy, XCircle } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuctionCard from '../components/auction/AuctionCard';
import { supabase } from '../lib/supabase';
import type { Auction } from '../types/auction';
import { useProtectedRoute } from '../hooks/useProtectedRoute';

interface BidWithAuction {
  amount: number;
  created_at: string;
  auctions: Auction | null;
}

interface WinnerOfferWithAuction {
  id: string;
  amount: number;
  rank: number;
  status: string;
  expires_at: string;
  auctions: Auction | null;
}

export default function MyAuctionsPage() {
  const { user, authLoading } = useProtectedRoute('Please sign in to view your auctions', '/products');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selling, setSelling] = useState<Auction[]>([]);
  const [bids, setBids] = useState<BidWithAuction[]>([]);
  const [offers, setOffers] = useState<WinnerOfferWithAuction[]>([]);
  const [tab, setTab] = useState<'selling' | 'bidding' | 'won' | 'lost'>('selling');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    try {
      setError('');
      setLoading(true);
      const [sellingResult, bidResult, offerResult] = await Promise.all([
        supabase.from('auctions').select('*, categories(name)').eq('seller_id', user.id).order('created_at', { ascending: false }),
        supabase.from('auction_bids').select('amount, created_at, auctions!auction_bids_auction_id_fkey(*)').eq('bidder_id', user.id).order('created_at', { ascending: false }),
        supabase.from('auction_winner_offers').select('id, amount, rank, status, expires_at, auctions!auction_winner_offers_auction_id_fkey(*)').eq('bidder_id', user.id).order('created_at', { ascending: false }),
      ]);

      setSelling(sellingResult.error ? [] : (sellingResult.data || []) as unknown as Auction[]);
      setBids(bidResult.error ? [] : (bidResult.data || []) as unknown as BidWithAuction[]);
      setOffers(offerResult.error ? [] : (offerResult.data || []) as unknown as WinnerOfferWithAuction[]);

      const queryErrors = [sellingResult.error, bidResult.error, offerResult.error].filter(Boolean);
      if (queryErrors.length > 0) {
        setError(queryErrors.map((queryError) => queryError?.message).filter(Boolean).join(' '));
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load your auctions.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    // Wait for the session to restore before deciding (hard-refresh race).
    if (authLoading || !user) return;
    load();
  }, [load, user, authLoading]);

  const uniqueBidAuctions = useMemo(() => {
    const seen = new Set<string>();
    return bids.filter((bid) => {
      if (!bid.auctions || seen.has(bid.auctions.id)) return false;
      seen.add(bid.auctions.id);
      return true;
    });
  }, [bids]);

  const lostAuctions = uniqueBidAuctions.filter((bid) => {
    const auction = bid.auctions;
    return auction && ['paid', 'closed', 'ended_no_bids'].includes(auction.status) && auction.winner_id !== user?.id;
  });

  const openAuctionProduct = (auction: Auction | null) => {
    navigate(auction?.product_id ? `/product/${auction.product_id}` : '/products?listing=auction');
  };

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center bg-gray-50"><Loader2 className="h-10 w-10 animate-spin text-[#07513B]" /></div>;

  return (
    <main className="min-h-screen bg-gray-50 pb-24 lg:pb-12">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#07513B]">Seller center</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">My auctions</h1>
            <p className="mt-2 text-sm text-gray-500 sm:text-base">Manage selling, bidding, wins, and losses in one place.</p>
          </div>
          <button
            onClick={() => navigate('/submit-product?listing=auction')}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-[#9BEC2D] bg-[#E4F7C9] px-5 text-sm font-bold text-[#07513B] transition hover:bg-[#D6F4AA]"
          >
            <Plus className="h-4 w-4" />
            Create auction
          </button>
        </header>

        {searchParams.get('created') && (
          <div className="mb-6 flex items-start gap-2 rounded-xl border border-[#CFE8AC] bg-[#F2FAE8] p-4 text-sm text-[#07513B]">
            <CheckCircle className="mt-0.5 h-5 w-5 shrink-0" />
            Auction submitted. It will publish automatically if the AI safety review approves it.
          </div>
        )}

        <section aria-label="Auction statistics" className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {([
            ['selling', 'Selling', selling.length, Gavel, 'border-[#CFE8AC] bg-[#F2FAE8] text-[#07513B]'],
            ['bidding', 'My bids', uniqueBidAuctions.length, Clock, 'border-[#BFE89A] bg-[#E4F7C9] text-[#07513B]'],
            ['won', 'Won', offers.length, Trophy, 'border-[#E7D185] bg-[#FFF4CC] text-[#735400]'],
            ['lost', 'Lost', lostAuctions.length, XCircle, 'border-gray-200 bg-white text-gray-600'],
          ] as const).map(([value, label, count, Icon, tone]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition hover:shadow-sm ${tone} ${tab === value ? 'ring-2 ring-[#9BEC2D] ring-offset-2' : ''}`}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80"><Icon className="h-5 w-5" /></span>
              <span>
                <span className="block text-xs font-bold opacity-75">{label}</span>
                <span className="mt-0.5 block text-2xl font-black">{count}</span>
              </span>
            </button>
          ))}
        </section>

        <div className="mb-6 flex gap-2 overflow-x-auto pb-1 scrollbar-hide" aria-label="Filter auctions">
          {([
            ['selling', 'Selling', selling.length, Gavel],
            ['bidding', 'My bids', uniqueBidAuctions.length, Clock],
            ['won', 'Won', offers.length, Trophy],
            ['lost', 'Lost', lostAuctions.length, XCircle],
          ] as const).map(([value, label, count, Icon]) => (
            <button
              key={value}
              onClick={() => setTab(value)}
              className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${
                tab === value
                  ? 'border border-[#9BEC2D] bg-[#E4F7C9] text-[#07513B]'
                  : 'border border-gray-300 bg-white text-gray-600 hover:border-[#CFE8AC] hover:bg-[#F2FAE8] hover:text-[#07513B]'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
              <span className={`rounded-full px-1.5 py-0.5 text-[11px] ${tab === value ? 'bg-white/70' : 'bg-gray-100 text-gray-500'}`}>{count}</span>
            </button>
          ))}
        </div>

        {error && <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</div>}

        {tab === 'selling' && (
          selling.length === 0 ? <Empty message="You have not created an auction yet." /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{selling.map((auction) => <SellerAuctionCard key={auction.id} auction={auction} onOpen={() => navigate(auction.product_id ? `/product/${auction.product_id}` : '/my-auctions')} onChanged={load} />)}</div>
        )}

        {tab === 'bidding' && (
          uniqueBidAuctions.length === 0 ? <Empty message="You have not placed any bids yet." /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{uniqueBidAuctions.map((bid) => bid.auctions && <AuctionCard key={bid.auctions.id} auction={bid.auctions} />)}</div>
        )}

        {tab === 'won' && (
          offers.length === 0 ? <Empty message="You do not have any winning offers." /> : <div className="space-y-3">{offers.map((offer) => <div key={offer.id} className="flex flex-col justify-between gap-4 rounded-2xl border border-[#E7D185] bg-[#FFF9E6] p-4 sm:flex-row sm:items-center"><div><div className="mb-1 flex items-center gap-2"><Trophy className="h-5 w-5 text-[#8A6500]" /><h2 className="font-bold">{offer.auctions?.title || 'Auction'}</h2></div><p className="text-sm text-gray-500">Rank #{offer.rank} · Offer ${Number(offer.amount).toFixed(2)} · Expires {new Date(offer.expires_at).toLocaleString()}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white px-3 py-2 text-sm font-bold text-[#735400]">{offer.status.replace('_', ' ')}</span>{['offered', 'payment_started'].includes(offer.status) && new Date(offer.expires_at).getTime() > Date.now() && <button onClick={() => navigate(`/auction-payment/${offer.id}`)} className="rounded-full border border-[#9BEC2D] bg-[#E4F7C9] px-4 py-2 text-sm font-bold text-[#07513B]">Pay now</button>}{offer.auctions && <button onClick={() => openAuctionProduct(offer.auctions)} className="rounded-full border border-[#CFE8AC] bg-white px-4 py-2 text-sm font-bold text-[#07513B]">Open</button>}</div></div>)}</div>
        )}

        {tab === 'lost' && (
          lostAuctions.length === 0 ? <Empty message="No lost auctions." /> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{lostAuctions.map((bid) => bid.auctions && <AuctionCard key={bid.auctions.id} auction={bid.auctions} />)}</div>
        )}
      </div>
    </main>
  );
}

function Empty({ message }: { message: string }) {
  return <div className="rounded-2xl border border-gray-200 bg-white py-12 text-center"><div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F2FAE8]"><Gavel className="h-5 w-5 text-[#07513B]" /></div><p className="font-semibold text-gray-600">{message}</p></div>;
}

function SellerAuctionCard({ auction, onOpen, onChanged }: { auction: Auction; onOpen: () => void; onChanged: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const publicAuction = ['active', 'scheduled', 'awaiting_payment', 'paid', 'ended_no_bids', 'closed'].includes(auction.status);
  const cancellable = ['pending_ai_review', 'scheduled', 'active', 'blocked'].includes(auction.status);
  const cancelUi = cancellable && (
    <>
      <button onClick={() => setCancelOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white py-2.5 text-sm font-bold text-red-600 hover:bg-red-50"><Ban className="h-4 w-4" />Cancel auction</button>
      {cancelOpen && <CancelAuctionModal auction={auction} onClose={() => setCancelOpen(false)} onDone={async () => { setCancelOpen(false); await onChanged(); }} />}
    </>
  );
  if (publicAuction) {
    return <div className="flex flex-col gap-2"><AuctionCard auction={auction} />{cancelUi}</div>;
  }
  const statusStyles: Record<string, string> = {
    pending_ai_review: 'bg-blue-50 text-blue-700',
    blocked: 'bg-red-50 text-red-700',
    cancelled_by_admin: 'bg-gray-100 text-gray-700',
    cancelled_by_seller: 'bg-gray-100 text-gray-700',
  };
  const retry = async () => {
    try {
      setRetrying(true);
      setRetryError('');
      const { data, error } = await supabase.functions.invoke('retry-auction-moderation', { body: { auctionId: auction.id } });
      if (error) throw error;
      if (data?.error) throw new Error(String(data.error));
      await onChanged();
    } catch (caught) {
      setRetryError(caught instanceof Error ? caught.message : 'Review could not be retried.');
    } finally {
      setRetrying(false);
    }
  };
  const summary = auction.status === 'cancelled_by_seller' || auction.status === 'cancelled_by_admin'
    ? (auction.cancellation_reason ? `Cancelled: ${auction.cancellation_reason}` : 'This auction was cancelled.')
    : (auction.ai_moderation_reason || 'Automated review is still processing.');
  return <div className="rounded-2xl border border-gray-200 bg-white p-4 text-left"><button onClick={onOpen} className="w-full text-left"><div className="mb-3 flex items-center justify-between"><Gavel className="h-6 w-6 text-[#07513B]" /><span className={`rounded-full px-3 py-1 text-xs font-bold ${statusStyles[auction.status] || 'bg-gray-100 text-gray-700'}`}>{auction.status.replace(/_/g, ' ')}</span></div><h2 className="font-bold text-gray-900">{auction.title}</h2><p className="mt-2 line-clamp-3 text-sm text-gray-500">{summary}</p></button>{auction.ai_moderation_status === 'error' && <button disabled={retrying} onClick={retry} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-[#CFE8AC] bg-[#F2FAE8] py-2.5 text-sm font-bold text-[#07513B] disabled:opacity-60">{retrying && <Loader2 className="h-4 w-4 animate-spin" />}Retry AI review</button>}{retryError && <p className="mt-2 text-xs text-red-600">{retryError}</p>}{cancellable && <div className="mt-3">{cancelUi}</div>}</div>;
}

/*
  eBay-style early-ending rules, mirrored from seller_cancel_auction:
    no bids            -> cancel any time
    bids + >=12h left  -> cancel (voids every bid) OR sell to highest bidder
    bids + <12h left   -> sell to highest bidder only
  The server enforces these; this modal just explains them up front.
*/
function CancelAuctionModal({ auction: initialAuction, onClose, onDone }: { auction: Auction; onClose: () => void; onDone: () => Promise<void> }) {
  // The list row can be minutes old; bids arriving in the meantime change
  // which options the 12-hour rule allows, so refresh the row on open. The
  // server enforces the rules either way.
  const [auction, setAuction] = useState<Auction>(initialAuction);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const hasBids = auction.bid_count > 0;
  const hoursLeft = Math.max(0, (new Date(auction.ends_at).getTime() - Date.now()) / 3_600_000);
  const inFinalWindow = hasBids && hoursLeft < 12;
  const canSellToHighest = hasBids && auction.status === 'active';
  const [mode, setMode] = useState<'cancel' | 'sell_to_highest'>(inFinalWindow && canSellToHighest ? 'sell_to_highest' : 'cancel');

  useEffect(() => {
    let alive = true;
    supabase.from('auctions').select('*').eq('id', initialAuction.id).single().then(({ data }) => {
      if (!alive || !data) return;
      const fresh = data as Auction;
      setAuction(fresh);
      const freshFinalWindow = fresh.bid_count > 0 && (new Date(fresh.ends_at).getTime() - Date.now()) / 3_600_000 < 12;
      if (freshFinalWindow && fresh.status === 'active') setMode('sell_to_highest');
    });
    return () => { alive = false; };
  }, [initialAuction.id]);

  const submit = async () => {
    try {
      setSubmitting(true);
      setError('');
      const { data: cancelled, error: rpcError } = await supabase.rpc('seller_cancel_auction', {
        p_auction_id: auction.id,
        p_reason: reason.trim(),
        p_mode: mode,
      });
      if (rpcError) throw rpcError;
      if (mode === 'cancel' && ['pending_ai_review', 'blocked'].includes(auction.status)) {
        // Unpublished auctions still hold their review images in the private
        // quarantine bucket; clean them up best-effort (owner DELETE policy).
        try {
          const row = Array.isArray(cancelled) ? cancelled[0] : cancelled;
          const paths = ((row as { review_image_paths?: unknown })?.review_image_paths as unknown[] | undefined) || [];
          const valid = paths.filter((path): path is string => typeof path === 'string');
          if (valid.length) await supabase.storage.from('auction-review-images').remove(valid);
        } catch { /* cleanup only; never block the cancel flow */ }
      }
      await onDone();
    } catch (caught) {
      setError((caught as { message?: string })?.message || 'The auction could not be cancelled.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={submitting ? undefined : onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" onClick={(event) => event.stopPropagation()}>
        <h2 className="text-lg font-black text-gray-900">End "{auction.title}"</h2>
        <p className="mt-2 text-sm text-gray-600">
          {!hasBids && 'This auction has no bids yet, so cancelling it affects nobody else.'}
          {hasBids && !inFinalWindow && `This auction has ${auction.bid_count} bid${auction.bid_count === 1 ? '' : 's'}. You can cancel it — every bid is voided and all bidders are notified — or end it now by selling to the highest bidder.`}
          {inFinalWindow && 'Auctions with bids cannot be cancelled during their final 12 hours. Your only option is to end it now and sell to the highest bidder.'}
        </p>
        {hasBids && (
          <div className="mt-4 space-y-2">
            <label className={`flex items-start gap-3 rounded-xl border p-3 ${inFinalWindow ? 'cursor-not-allowed border-gray-100 opacity-50' : 'cursor-pointer border-gray-200'} ${mode === 'cancel' ? 'border-red-300 bg-red-50' : ''}`}>
              <input type="radio" name="cancel-mode" className="mt-1" checked={mode === 'cancel'} disabled={inFinalWindow} onChange={() => setMode('cancel')} />
              <span className="text-sm"><span className="font-bold text-gray-900">Cancel the auction</span><br /><span className="text-gray-500">Voids all bids. Bidders are notified and nothing is charged.</span></span>
            </label>
            {canSellToHighest && (
              <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${mode === 'sell_to_highest' ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200'}`}>
                <input type="radio" name="cancel-mode" className="mt-1" checked={mode === 'sell_to_highest'} onChange={() => setMode('sell_to_highest')} />
                <span className="text-sm"><span className="font-bold text-gray-900">End now & sell to the highest bidder</span><br /><span className="text-gray-500">Closes immediately at ${Number(auction.current_price ?? auction.starting_price).toFixed(2)}. The winner gets the usual payment window.</span></span>
              </label>
            )}
          </div>
        )}
        <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} placeholder="Why are you ending this auction? (required)" className="mt-4 w-full rounded-xl border border-gray-200 p-3 text-sm focus:border-emerald-500 focus:outline-none" />
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        <div className="mt-5 flex gap-2">
          <button onClick={onClose} disabled={submitting} className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-gray-700">Keep auction</button>
          <button onClick={submit} disabled={submitting || reason.trim().length < 3} className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-50 ${mode === 'sell_to_highest' ? 'bg-emerald-600' : 'bg-red-600'}`}>
            {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === 'sell_to_highest' ? 'End & sell now' : 'Cancel auction'}
          </button>
        </div>
      </div>
    </div>
  );
}
