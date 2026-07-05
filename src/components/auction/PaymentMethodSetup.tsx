import { useEffect, useMemo, useRef, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { AlertCircle, CreditCard, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface SavedCard {
  brand: string | null;
  last4: string | null;
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

function SetupForm({ onSaved }: { onSaved: (card: SavedCard) => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async () => {
    if (!stripe || !elements) return;
    try {
      setSaving(true);
      setError('');
      const { error: confirmError, setupIntent } = await stripe.confirmSetup({ elements, redirect: 'if_required' });
      if (confirmError) throw new Error(confirmError.message || 'The card could not be saved.');
      if (!setupIntent || setupIntent.status !== 'succeeded') {
        throw new Error(`Card setup did not complete (status: ${setupIntent?.status || 'unknown'}).`);
      }
      // Confirm against the intent Elements ACTUALLY used — never a stored
      // id, which can point to a duplicate created by a double-mounted
      // effect (React StrictMode).
      const { data, error: fnError } = await supabase.functions.invoke('setup-payment-method', {
        body: { action: 'confirm', setupIntentId: setupIntent.id },
      });
      if (fnError) throw new Error(await extractFunctionError(fnError, 'The card could not be saved.'));
      if (data?.error || !data?.saved) {
        throw new Error(String(data?.error || (data?.status
          ? `Card setup incomplete (Stripe status: ${data.status}). Close this window and try again.`
          : 'The card could not be saved.')));
      }
      onSaved({ brand: data.cardBrand || null, last4: data.cardLast4 || null });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The card could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      {error && <p className="flex items-start gap-2 text-sm text-red-600"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />{error}</p>}
      <button
        disabled={saving || !stripe || !elements}
        onClick={save}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 py-3 font-bold text-white hover:bg-black disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
        {saving ? 'Saving card…' : 'Save card & continue'}
      </button>
    </div>
  );
}

export default function PaymentMethodSetup({ onSaved }: { onSaved: (card: SavedCard) => void }) {
  const [clientSecret, setClientSecret] = useState('');
  const [error, setError] = useState('');
  const startedRef = useRef(false);

  useEffect(() => {
    // Ref guard: StrictMode double-runs effects in dev; two SetupIntents
    // would desync Elements (locked to the first secret) from later state.
    if (startedRef.current) return;
    startedRef.current = true;
    supabase.functions
      .invoke('setup-payment-method', { body: { action: 'create' } })
      .then(async ({ data, error: fnError }) => {
        if (fnError) setError(await extractFunctionError(fnError, 'Card setup could not be prepared.'));
        else if (data?.error || !data?.clientSecret) setError(String(data?.error || 'Card setup could not be prepared.'));
        else setClientSecret(String(data.clientSecret));
      });
  }, []);

  const options = useMemo(() => ({
    clientSecret,
    appearance: { variables: { colorPrimary: '#059669', borderRadius: '12px' } },
  }), [clientSecret]);

  if (!stripePromise) {
    return <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">Stripe publishable key is not configured.</div>;
  }
  if (error) {
    return <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>;
  }
  if (!clientSecret) {
    return <div className="flex items-center justify-center gap-2 py-8 text-gray-500"><Loader2 className="h-5 w-5 animate-spin" /> Preparing secure card setup…</div>;
  }

  return (
    <Elements stripe={stripePromise} options={options}>
      <SetupForm onSaved={onSaved} />
    </Elements>
  );
}
