import { useEffect, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { CreditCard, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

const stripePublishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
const stripePromise = stripePublishableKey ? loadStripe(stripePublishableKey) : null;
const isTestMode = Boolean(stripePublishableKey?.startsWith('pk_test_'));

interface StripeCheckoutProps {
  orderId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
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

function PaymentForm({ orderId, onSuccess, onError }: StripeCheckoutProps) {
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
      if (!paymentIntent || paymentIntent.status !== 'succeeded') {
        throw new Error(`Payment did not complete (status: ${paymentIntent?.status || 'unknown'}).`);
      }

      // The order is only marked paid after the server verifies the intent
      // with Stripe directly.
      const { data, error: confirmFnError } = await supabase.functions.invoke('confirm-order-payment', {
        body: { orderId, paymentIntentId: paymentIntent.id },
      });
      if (confirmFnError) throw new Error(await extractFunctionError(confirmFnError, 'The payment could not be verified.'));
      if (data?.error) throw new Error(String(data.error));

      onSuccess();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Payment failed.';
      setError(message);
      onError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <button
        disabled={submitting || !stripe || !elements}
        onClick={pay}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#07513B] py-4 text-lg font-black text-white shadow-lg transition hover:bg-[#032F24] disabled:opacity-60"
      >
        {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-5 w-5" />}
        {submitting ? 'Processing payment…' : 'Pay now'}
      </button>
    </div>
  );
}

export default function StripeCheckout({ orderId, onSuccess, onError }: StripeCheckoutProps) {
  const [clientSecret, setClientSecret] = useState('');
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [loadError, setLoadError] = useState('');
  const createStartedRef = useRef(false);

  useEffect(() => {
    if (!orderId || createStartedRef.current) return;
    createStartedRef.current = true;

    supabase.functions
      .invoke('create-order-payment', { body: { orderId } })
      .then(async ({ data, error }) => {
        if (error) {
          setLoadError(await extractFunctionError(error, 'Could not start the payment.'));
          return;
        }
        if (data?.error) {
          setLoadError(String(data.error));
          return;
        }
        if (data?.alreadyPaid) {
          onSuccess();
          return;
        }
        setClientSecret(String(data.clientSecret));
        setTotalAmount(Number(data.totalAmount));
      })
      .catch((caught) => {
        setLoadError(caught instanceof Error ? caught.message : 'Could not start the payment.');
      });
  }, [orderId, onSuccess]);

  if (!stripePromise) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
        Stripe is not configured. Set <code className="font-mono">VITE_STRIPE_PUBLISHABLE_KEY</code> in your .env file.
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {loadError}
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-12">
        <Loader2 className="h-8 w-8 animate-spin text-[#07513B]" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
        <h3 className="mb-1 text-center text-2xl font-bold text-gray-900">Complete Your Payment</h3>
        <p className="mb-6 text-center text-gray-600">
          Secure card payment powered by Stripe
          {totalAmount !== null && (
            <span className="mt-1 block text-lg font-black text-[#07513B]">${totalAmount.toFixed(2)}</span>
          )}
        </p>

        {isTestMode && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800">
            <CreditCard className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <strong>Test mode:</strong> use card number <code className="font-mono font-bold">4242 4242 4242 4242</code>,
              any future expiry date, any CVC, and any ZIP code.
            </p>
          </div>
        )}

        <Elements stripe={stripePromise} options={{ clientSecret }}>
          <PaymentForm orderId={orderId} onSuccess={onSuccess} onError={onError} />
        </Elements>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <ShieldCheck className="h-5 w-5" />
        <span className="font-medium">Secure Checkout Powered by Stripe</span>
      </div>
    </div>
  );
}
