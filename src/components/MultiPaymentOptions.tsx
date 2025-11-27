import { PayPalScriptProvider, PayPalButtons } from '@paypal/react-paypal-js';

interface MultiPaymentOptionsProps {
  amount: number;
  orderId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function MultiPaymentOptions({
  amount,
  orderId,
  onSuccess,
  onError,
}: MultiPaymentOptionsProps) {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-sm">
        <h3 className="text-2xl font-bold text-gray-900 mb-2 text-center">Complete Your Payment</h3>
        <p className="text-gray-600 text-center mb-8">Secure checkout with PayPal</p>

        <PayPalScriptProvider
          options={{
            clientId: import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test',
            currency: 'USD',
          }}
        >
          <div className="max-w-md mx-auto">
            <PayPalButtons
              style={{
                layout: 'vertical',
                color: 'gold',
                shape: 'rect',
                label: 'checkout',
                height: 55,
                tagline: false,
              }}
              createOrder={(_data, actions) => {
                return actions.order.create({
                  purchase_units: [
                    {
                      amount: {
                        value: amount.toFixed(2),
                      },
                      reference_id: orderId,
                    },
                  ],
                  intent: 'CAPTURE',
                });
              }}
              onApprove={async (_data, actions) => {
                if (actions.order) {
                  await actions.order.capture();
                  onSuccess();
                }
              }}
              onError={(err) => {
                console.error('PayPal error:', err);
                onError('PayPal payment failed');
              }}
            />
          </div>
        </PayPalScriptProvider>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-600">
            Have an account? <a href="#" className="text-blue-600 hover:underline font-medium">Log in</a>
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 text-sm text-gray-500">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
        </svg>
        <span className="font-medium">Secure Checkout Powered by PayPal</span>
      </div>
    </div>
  );
}
