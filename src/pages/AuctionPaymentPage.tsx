import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { AddressElement, Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { ArrowLeft, Clock, Loader2, Lock, ShieldCheck, Trophy } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Auction } from '../types/auction';

interface WinnerOffer {
  id: string;
  amount: number;
  status: string;
  expires_at: string;
  auctions: Auction;
}

async function extractFunctionError(caught: unknown, fallback: string): Promise<string> {
  if (!(caught instanceof Error)) return fallback;
  let message = caught.message || fallback;
  try {
    const context = (caught as { context?: Response }).context;
    const body = context ? await context.json() : null;
    if (body?.error) message = String(body.error);
  } catch { /* keep generic */ }
  return message;
}

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;

function HoldPaymentForm({ paymentId, onDone }: { paymentId: string; onDone: (orderId?: string) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const pay = async () => {
    if (!stripe || !elements) return;
    try {
      setSubmitting(true);
      setError('');
      const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });
      if (confirmError) throw new Error(confirmError.message || 'Payment could not be confirmed.');
      if (!paymentIntent || !['requires_capture', 'succeeded', 'processing'].includes(paymentIntent.status)) {
        throw new Error(`Payment did not complete (status: ${paymentIntent?.status || 'unknown'}).`);
      }

      // Record the hold server-side (idempotent with the webhook). Send the
      // intent id Elements actually confirmed so a stray duplicate intent
      // can never be checked instead.
      const { data, error: confirmFnError } = await supabase.functions.invoke('confirm-stripe-auction-payment', {
        body: { paymentId, paymentIntentId: paymentIntent.id },
      });
      if (confirmFnError) throw new Error(await extractFunctionError(confirmFnError, 'The payment could not be verified.'));
      if (data?.error) throw new Error(String(data.error));

      onDone(data?.orderId ? String(data.orderId) : undefined);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Payment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-sm font-bold text-gray-700">Shipping address</p>
        <AddressElement options={{ mode: 'shipping' }} />
      </div>
      <div>
        <p className="mb-2 text-sm font-bold text-gray-700">Payment method</p>
        <PaymentElement />
      </div>
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button
        disabled={submitting || !stripe || !elements}
        onClick={pay}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-lg font-black text-white shadow-lg transition hover:bg-emerald-700 disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
        {submitting ? 'Placing hold…' : 'Place payment hold'}
      </button>
      <p className="text-center text-xs text-gray-500">
        Your card is only <strong>authorized</strong> now. It is charged when the seller ships — if they never ship, the hold is released automatically.
      </p>
    </div>
  );
}

export default function AuctionPaymentPage() {
  const { offerId } = useParams();
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [offer, setOffer] = useState<WinnerOffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [done, setDone] = useState(false);
  const prepareStartedRef = useRef(false);

  useEffect(() => {
    // Wait for the session to restore before deciding (hard-refresh race).
    if (authLoading) return;
    if (!user) {
      openAuthModal('Please sign in to pay for your winning auction');
      navigate('/my-auctions');
      return;
    }
    supabase
      .from('auction_winner_offers')
      .select('id, amount, status, expires_at, auctions(*)')
      .eq('id', offerId)
      .eq('bidder_id', user.id)
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message);
        else setOffer(data as unknown as WinnerOffer | null);
        setLoading(false);
      });
  }, [navigate, offerId, openAuthModal, user, authLoading]);

  const expired = offer ? new Date(offer.expires_at).getTime() <= Date.now() : false;
  const payable = Boolean(offer && !expired && ['offered', 'payment_started'].includes(offer.status));

  useEffect(() => {
    if (!offer || !payable || clientSecret) return;
    // Ref guard: a state flag is not synchronous enough to stop StrictMode's
    // dev double-effect from creating two PaymentIntents.
    if (prepareStartedRef.current) return;
    prepareStartedRef.current = true;
    supabase.functions
      .invoke('create-stripe-auction-payment', { body: { winnerOfferId: offer.id } })
      .then(async ({ data, error: fnError }) => {
        if (fnError) {
          setError(await extractFunctionError(fnError, 'The payment could not be prepared.'));
          prepareStartedRef.current = false;
        } else if (data?.alreadyPaid) {
          setDone(true);
        } else if (data?.error || !data?.clientSecret) {
          setError(String(data?.error || 'The payment could not be prepared.'));
          prepareStartedRef.current = false;
        } else {
          setClientSecret(String(data.clientSecret));
          setPaymentId(String(data.paymentId));
        }
      });
  }, [offer, payable, clientSecret]);

  const elementsOptions = useMemo(() => ({
    clientSecret,
    appearance: { variables: { colorPrimary: '#059669', borderRadius: '12px' } },
  }), [clientSecret]);

  if (loading) return <div className="flex min-h-[70vh] items-center justify-center"><Loader2 className="h-10 w-10 animate-spin text-emerald-600" /></div>;
  if (error && !offer) return <div className="mx-auto max-w-xl px-4 py-20"><div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">{error}</div></div>;
  if (!offer) return <div className="mx-auto max-w-xl px-4 py-20"><div className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-700">Winning offer not found.</div></div>;

  const total = Number(offer.amount) + Number(offer.auctions.shipping_cost);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <button onClick={() => navigate('/my-auctions')} className="mb-5 flex items-center gap-2 text-sm font-semibold text-gray-600"><ArrowLeft className="h-4 w-4" />My auctions</button>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg">
          <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-7 text-white">
            <Trophy className="mb-3 h-10 w-10" />
            <h1 className="text-3xl font-black">Complete your winning payment</h1>
            <p className="mt-2 text-orange-50">{offer.auctions.title}</p>
          </div>
          <div className="space-y-5 p-6 sm:p-8">
            <div className="space-y-3 rounded-xl bg-gray-50 p-4 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Winning bid</span><strong>${Number(offer.amount).toFixed(2)}</strong></div>
              <div className="flex justify-between"><span className="text-gray-500">Shipping</span><strong>${Number(offer.auctions.shipping_cost).toFixed(2)}</strong></div>
              <div className="flex justify-between border-t border-gray-200 pt-3 text-lg"><span className="font-bold">Total to hold</span><strong>${total.toFixed(2)} USD</strong></div>
            </div>
            <div className={`flex items-start gap-2 rounded-xl p-3 text-sm ${expired ? 'bg-red-50 text-red-800' : 'bg-blue-50 text-blue-900'}`}><Clock className="mt-0.5 h-4 w-4 shrink-0" />Payment deadline: {new Date(offer.expires_at).toLocaleString()}</div>
            <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />The amount is calculated and verified on the server, and only charged after the seller ships.</div>

            {done ? (
              <div className="space-y-4 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-5 text-center">
                <Lock className="mx-auto h-8 w-8 text-emerald-600" />
                <p className="font-bold text-emerald-900">Your payment hold is in place.</p>
                <p className="text-sm text-emerald-800">You will be charged only when the seller ships. Track everything from My Orders.</p>
                <button onClick={() => navigate('/buyer-orders')} className="rounded-xl bg-emerald-600 px-6 py-3 font-bold text-white hover:bg-emerald-700">Go to My Orders</button>
              </div>
            ) : !stripePromise ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-800">Stripe publishable key is not configured.</div>
            ) : !payable ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">This payment offer is no longer available.</div>
            ) : !clientSecret ? (
              <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" /> Preparing secure payment…
                {error && <span className="text-red-600">{error}</span>}
              </div>
            ) : (
              <Elements stripe={stripePromise} options={elementsOptions}>
                <HoldPaymentForm
                  paymentId={paymentId}
                  onDone={(orderId) => {
                    if (orderId) navigate(`/order-confirmation/${orderId}`);
                    else setDone(true);
                  }}
                />
              </Elements>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
