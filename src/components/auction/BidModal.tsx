import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CreditCard, Gavel, Loader2, ShieldCheck, Timer, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import type { Auction, AuctionAutoBid } from '../../types/auction';
import { minimumNextBid } from '../../types/auction';
import PaymentMethodSetup, { type SavedCard } from './PaymentMethodSetup';

interface BidModalProps {
  auction: Auction;
  onClose: () => void;
  onSuccess: () => void;
}

async function extractFunctionError(caught: unknown, fallback: string): Promise<string> {
  if (!(caught instanceof Error)) return fallback;
  // On non-2xx the SDK returns a generic FunctionsHttpError; the real reason
  // (bid too low, auction closed, ...) is in the response body.
  let message = caught.message || fallback;
  try {
    const context = (caught as { context?: Response }).context;
    const body = context ? await context.json() : null;
    if (body?.error) message = String(body.error);
  } catch { /* keep generic message */ }
  return message;
}

export default function BidModal({ auction, onClose, onSuccess }: BidModalProps) {
  const { user, openAuthModal } = useAuth();
  const minimum = useMemo(() => minimumNextBid(auction), [auction]);
  const [mode, setMode] = useState<'once' | 'auto'>('once');

  const [amount, setAmount] = useState(minimum.toFixed(2));
  const [step, setStep] = useState<'amount' | 'confirm'>('amount');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());

  const [autoBid, setAutoBid] = useState<AuctionAutoBid | null>(null);
  const [maxAmount, setMaxAmount] = useState('');
  const [autoSubmitting, setAutoSubmitting] = useState(false);
  const [autoError, setAutoError] = useState('');
  const [autoNotice, setAutoNotice] = useState('');
  const [cardState, setCardState] = useState<'loading' | 'missing' | 'active'>('loading');
  const [savedCard, setSavedCard] = useState<SavedCard | null>(null);

  const isLeading = Boolean(user && auction.highest_bidder_id === user.id);
  const hasActiveAuto = autoBid?.status === 'active';

  // Card-on-file gate: bidding (either mode) requires a saved payment
  // method — the server enforces the same rule inside the bid functions.
  useEffect(() => {
    if (!user) return;
    supabase
      .from('payment_profiles')
      .select('status, payment_method_id, card_brand, card_last4')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.status === 'active' && data.payment_method_id) {
          setSavedCard({ brand: data.card_brand, last4: data.card_last4 });
          setCardState('active');
        } else {
          setCardState('missing');
        }
      });
  }, [user]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('auction_auto_bids')
      .select('*')
      .eq('auction_id', auction.id)
      .maybeSingle()
      .then(({ data }) => {
        const existing = (data || null) as AuctionAutoBid | null;
        setAutoBid(existing);
        if (existing?.status === 'active') {
          setMaxAmount(Number(existing.max_amount).toFixed(2));
        }
      });
  }, [user, auction.id]);

  const proceed = () => {
    const numericAmount = Number(amount);
    // Small epsilon so float noise never rejects the prefilled minimum.
    if (!Number.isFinite(numericAmount) || numericAmount + 1e-9 < minimum) {
      setError(`Your bid must be at least $${minimum.toFixed(2)}.`);
      return;
    }
    setError('');
    setStep('confirm');
  };

  const placeBid = async () => {
    if (!user) {
      onClose();
      openAuthModal('Please sign in to place a bid');
      return;
    }
    try {
      setSubmitting(true);
      setError('');
      const { data, error: bidError } = await supabase.functions.invoke('place-bid', {
        body: {
          auctionId: auction.id,
          amount: Math.round(Number(amount) * 100) / 100,
          idempotencyKey: requestKey,
        },
      });
      if (bidError) throw new Error(await extractFunctionError(bidError, 'The bid could not be placed.'));
      if (data?.error) throw new Error(String(data.error));
      setRequestKey(crypto.randomUUID());
      window.dispatchEvent(new Event('products-updated'));
      onSuccess();
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The bid could not be placed.');
      setStep('amount');
    } finally {
      setSubmitting(false);
    }
  };

  const submitAutoBid = async () => {
    if (!user) {
      onClose();
      openAuthModal('Please sign in to place a bid');
      return;
    }
    const numericMax = Number(maxAmount);
    const lowest = hasActiveAuto ? Math.max(minimum, Number(autoBid?.max_amount)) : minimum;
    if (!Number.isFinite(numericMax) || numericMax + 1e-9 < lowest) {
      setAutoError(`Your maximum must be at least $${lowest.toFixed(2)}.`);
      return;
    }
    try {
      setAutoSubmitting(true);
      setAutoError('');
      setAutoNotice('');
      const { data, error: fnError } = await supabase.functions.invoke('set-auto-bid', {
        body: {
          auctionId: auction.id,
          maxAmount: Math.round(numericMax * 100) / 100,
        },
      });
      if (fnError) throw new Error(await extractFunctionError(fnError, 'The auto-bid could not be saved.'));
      if (data?.error) throw new Error(String(data.error));
      window.dispatchEvent(new Event('products-updated'));
      onSuccess();
      if (data?.is_leading) {
        onClose();
      } else {
        setAutoBid((prev) => ({
          id: prev?.id || 'pending',
          auction_id: auction.id,
          max_amount: numericMax,
          status: (data?.status as AuctionAutoBid['status']) || 'exhausted',
          created_at: prev?.created_at || new Date().toISOString(),
        }));
        setAutoNotice(`Another bidder holds a higher maximum — the price is now $${Number(data?.current_price).toFixed(2)}. Raise your maximum to take the lead.`);
      }
    } catch (caught) {
      setAutoError(caught instanceof Error ? caught.message : 'The auto-bid could not be saved.');
    } finally {
      setAutoSubmitting(false);
    }
  };

  const cancelAutoBid = async () => {
    try {
      setAutoSubmitting(true);
      setAutoError('');
      const { data, error: fnError } = await supabase.functions.invoke('set-auto-bid', {
        body: { auctionId: auction.id, action: 'cancel' },
      });
      if (fnError) throw new Error(await extractFunctionError(fnError, 'The auto-bid could not be cancelled.'));
      if (data?.error) throw new Error(String(data.error));
      setAutoBid((prev) => (prev ? { ...prev, status: 'cancelled' } : prev));
      setMaxAmount('');
      setAutoNotice('Your auto-bid was cancelled.');
      onSuccess();
    } catch (caught) {
      setAutoError(caught instanceof Error ? caught.message : 'The auto-bid could not be cancelled.');
    } finally {
      setAutoSubmitting(false);
    }
  };

  // Rendered through a portal: cards hosting this modal are transformed on
  // hover (hover:-translate-y-1) which would otherwise clip position:fixed
  // descendants. stopPropagation keeps clicks from bubbling to the card's
  // navigate handler through the React tree.
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={(event) => event.stopPropagation()}>
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900"><Gavel className="h-5 w-5" /> Place a bid</h2>
            <p className="mt-1 text-sm text-gray-500 line-clamp-1">{auction.title}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>

        {!user ? (
          <div className="space-y-4 text-center">
            <p className="text-gray-600">You need to sign in before placing a bid.</p>
            <button onClick={() => { onClose(); openAuthModal('Please sign in to place a bid'); }} className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white">Sign in</button>
          </div>
        ) : cardState === 'loading' ? (
          <div className="flex items-center justify-center gap-2 py-10 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Checking payment method…
          </div>
        ) : cardState === 'missing' ? (
          <div className="space-y-4">
            <div className="rounded-xl bg-lime-50 p-4 text-sm leading-6 text-[#0b2e20]">
              <p className="mb-1 flex items-center gap-2 font-bold"><CreditCard className="h-4 w-4" /> Add a payment method to start bidding</p>
              Your card is saved securely with Stripe and is <strong>never charged for bidding</strong>. Only if you win, the amount is held and charged when the seller ships.
            </div>
            <PaymentMethodSetup
              onSaved={(card) => {
                setSavedCard(card);
                setCardState('active');
              }}
            />
          </div>
        ) : (
          <>
            {savedCard && (
              <p className="mb-3 flex items-center gap-2 text-xs font-semibold text-gray-500">
                <CreditCard className="h-3.5 w-3.5" />
                Paying with {savedCard.brand ? savedCard.brand.toUpperCase() : 'card'} •••• {savedCard.last4 || '????'}
              </p>
            )}
            <div className="mb-5 grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
              <button
                onClick={() => setMode('once')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${mode === 'once' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Gavel className="h-4 w-4" /> Bid once
              </button>
              <button
                onClick={() => setMode('auto')}
                className={`flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition ${mode === 'auto' ? 'bg-white text-gray-900 shadow' : 'text-gray-500 hover:text-gray-700'}`}
              >
                <Timer className="h-4 w-4" /> Auto-bid
              </button>
            </div>

            {mode === 'once' ? (
              step === 'amount' ? (
                <div className="space-y-4">
                  <div className="rounded-xl bg-gray-50 p-4">
                    <div className="flex justify-between text-sm"><span className="text-gray-500">Minimum bid</span><strong>${minimum.toFixed(2)}</strong></div>
                    <div className="mt-2 flex justify-between text-sm"><span className="text-gray-500">Increment</span><strong>${Number(auction.minimum_bid_increment).toFixed(2)}</strong></div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-gray-700">Your bid (USD)</label>
                    <input type="number" min={minimum} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xl font-bold" />
                  </div>
                  {error && <p className="flex items-start gap-2 text-sm text-red-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
                  <button onClick={proceed} className="w-full rounded-xl bg-gray-900 py-3 font-bold text-white hover:bg-black">Review bid</button>
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 p-5 text-center">
                    <ShieldCheck className="mx-auto mb-2 h-8 w-8 text-emerald-600" />
                    <p className="text-sm text-emerald-900">You are about to bid</p>
                    <p className="text-3xl font-black text-emerald-900">${Number(amount).toFixed(2)}</p>
                  </div>
                  <p className="text-sm leading-6 text-gray-600">Confirm that the amount is correct. The server will reject the bid if a higher bid arrived first.</p>
                  {error && <p className="text-sm text-red-600">{error}</p>}
                  <div className="grid grid-cols-2 gap-3">
                    <button disabled={submitting} onClick={() => setStep('amount')} className="rounded-xl border border-gray-300 py-3 font-bold text-gray-700">Back</button>
                    <button disabled={submitting} onClick={placeBid} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 font-bold text-white disabled:opacity-60">
                      {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm bid
                    </button>
                  </div>
                </div>
              )
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl bg-lime-50 p-4 text-sm leading-6 text-[#0b2e20]">
                  Set the most you are willing to pay. We bid the minimum needed to keep you in front and <strong>never reveal your maximum</strong>. If bidding passes it, we stop and notify you.
                </div>

                {hasActiveAuto && (
                  <div className={`rounded-xl border-2 p-4 text-sm font-semibold ${isLeading ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-800'}`}>
                    Your current maximum: ${Number(autoBid?.max_amount).toFixed(2)} — {isLeading ? "you're leading 🏆" : 'you have been outbid'}
                  </div>
                )}
                {autoBid?.status === 'exhausted' && (
                  <div className="rounded-xl border-2 border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
                    Your previous maximum of ${Number(autoBid.max_amount).toFixed(2)} was exceeded. Set a higher one to rejoin.
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-semibold text-gray-700">Your maximum (USD)</label>
                  <input type="number" min={minimum} step="0.01" value={maxAmount} onChange={(event) => setMaxAmount(event.target.value)} placeholder={minimum.toFixed(2)} className="w-full rounded-xl border border-gray-300 px-4 py-3 text-xl font-bold" />
                  <p className="mt-1 text-xs text-gray-500">Minimum: ${minimum.toFixed(2)}{hasActiveAuto ? ' — an active maximum can only be raised' : ''}</p>
                </div>

                {autoNotice && <p className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">{autoNotice}</p>}
                {autoError && <p className="flex items-start gap-2 text-sm text-red-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{autoError}</p>}

                <button disabled={autoSubmitting} onClick={submitAutoBid} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#062b1d] py-3 font-bold text-lime-400 hover:bg-[#0b3d2a] disabled:opacity-60">
                  {autoSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {hasActiveAuto ? 'Raise maximum' : 'Activate auto-bid'}
                </button>
                {hasActiveAuto && !isLeading && (
                  <button disabled={autoSubmitting} onClick={cancelAutoBid} className="w-full rounded-xl border border-gray-300 py-2.5 text-sm font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-60">
                    Cancel auto-bid
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>,
    document.body
  );
}
