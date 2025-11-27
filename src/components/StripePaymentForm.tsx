import { useState } from 'react';
import { PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Loader2 } from 'lucide-react';

interface StripePaymentFormProps {
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function StripePaymentForm({ onSuccess, onError }: StripePaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        redirect: 'if_required',
      });

      if (error) {
        setMessage(error.message || 'حدث خطأ أثناء معالجة الدفع');
        onError(error.message || 'حدث خطأ أثناء معالجة الدفع');
      } else if (paymentIntent && paymentIntent.status === 'succeeded') {
        setMessage('تم الدفع بنجاح!');
        onSuccess();
      } else {
        setMessage('حدث خطأ غير متوقع');
        onError('حدث خطأ غير متوقع');
      }
    } catch (error: any) {
      console.error('Payment error:', error);
      setMessage(error.message || 'حدث خطأ أثناء معالجة الدفع');
      onError(error.message || 'حدث خطأ أثناء معالجة الدفع');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-white rounded-lg">
        <PaymentElement
          options={{
            layout: 'tabs',
            paymentMethodOrder: ['card'],
          }}
        />
      </div>

      {message && (
        <div
          className={`p-4 rounded-lg text-sm ${
            message.includes('بنجاح')
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {message}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-4 rounded-xl font-bold hover:from-green-700 hover:to-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
      >
        {loading ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            جاري معالجة الدفع...
          </>
        ) : (
          'إتمام الدفع'
        )}
      </button>

      <p className="text-xs text-center text-gray-500">
        جميع المعاملات آمنة ومشفرة
      </p>
    </form>
  );
}
