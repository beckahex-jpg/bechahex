import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { Package, CreditCard, MapPin, ArrowLeft, Loader2 } from 'lucide-react';
import { US_STATES } from '../utils/usStates';
import MultiPaymentOptions from '../components/MultiPaymentOptions';

interface ShippingAddress {
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export default function CheckoutPage() {
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();
  const { items, totalAmount, clearCart } = useCart();
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    fullName: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'United States',
  });

  const shippingCost = 0;
  const tax = totalAmount * 0.15;
  const finalTotal = totalAmount + shippingCost + tax;

  useEffect(() => {
    if (!user) {
      openAuthModal('Please sign in to complete your purchase');
      navigate('/');
      return;
    }
    if (items.length === 0) {
      navigate('/');
      return;
    }
    loadUserProfile();
  }, [user, items, navigate]);

  const loadUserProfile = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, shipping_street, shipping_city, shipping_state, shipping_zip_code, shipping_country')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setShippingAddress({
          fullName: data.full_name || user.user_metadata?.full_name || '',
          phone: data.phone || '',
          street: data.shipping_street || '',
          city: data.shipping_city || '',
          state: data.shipping_state || '',
          zipCode: data.shipping_zip_code || '',
          country: data.shipping_country || 'United States',
        });
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleInputChange = (field: keyof ShippingAddress, value: string) => {
    setShippingAddress(prev => ({ ...prev, [field]: value }));
  };

  const validateForm = () => {
    const required = ['fullName', 'phone', 'street', 'city', 'state', 'zipCode', 'country'];
    for (const field of required) {
      if (!shippingAddress[field as keyof ShippingAddress]) {
        alert(`Please fill in the ${field} field`);
        return false;
      }
    }
    return true;
  };

  const handleProceedToPayment = async () => {
    if (!validateForm()) return;
    if (!user) return;

    setLoading(true);

    try {
      console.log('Saving shipping address to profile...');
      await supabase
        .from('profiles')
        .update({
          full_name: shippingAddress.fullName,
          phone: shippingAddress.phone,
          shipping_street: shippingAddress.street,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_zip_code: shippingAddress.zipCode,
          shipping_country: shippingAddress.country,
        })
        .eq('id', user.id);

      console.log('Creating order...');
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: user.id,
          total_amount: finalTotal,
          status: 'pending',
          payment_status: 'pending',
          shipping_address: shippingAddress.street,
          shipping_city: shippingAddress.city,
          shipping_state: shippingAddress.state,
          shipping_postal_code: shippingAddress.zipCode,
          shipping_country: shippingAddress.country,
        })
        .select()
        .single();

      if (orderError) {
        console.error('Order error:', orderError);
        throw orderError;
      }

      console.log('Order created:', order);

      const orderItems = items.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: typeof item.products.price === 'string'
          ? parseFloat(item.products.price)
          : item.products.price,
      }));

      console.log('Inserting order items...');
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Items error:', itemsError);
        throw itemsError;
      }

      setOrderId(order.id);
      setShowPaymentOptions(true);
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error: ${error.message || 'An error occurred. Please try again.'}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      console.log('Payment successful, updating order...');
      await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
        })
        .eq('id', orderId);

      await supabase
        .from('notifications')
        .insert({
          user_id: user?.id,
          type: 'order_update',
          title: 'Payment Successful!',
          message: `Your payment for order #${orderId.slice(0, 8)} has been processed successfully.`,
          data: { order_id: orderId }
        });

      await clearCart();
      navigate(`/order-confirmation/${orderId}`);
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const handlePaymentError = (error: string) => {
    alert(`Payment Failed: ${error}`);
  };

  if (showPaymentOptions && orderId) {
    return (
      <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8 pb-24 lg:pb-8">
        <div className="max-w-2xl mx-auto px-3 sm:px-6 lg:px-8">
          <button
            onClick={() => setShowPaymentOptions(false)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm sm:text-base">Back to Shipping</span>
          </button>

          <div className="mb-4 sm:mb-6 p-4 sm:p-6 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0">
              <div>
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Your Order</p>
                <p className="text-base sm:text-lg font-bold text-gray-900">Order #{orderId.slice(0, 8)}</p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xs sm:text-sm text-gray-600 mb-1">Total</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">${finalTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>

          <MultiPaymentOptions
            amount={finalTotal}
            orderId={orderId}
            onSuccess={handlePaymentSuccess}
            onError={handlePaymentError}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 sm:mb-6 active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm sm:text-base">Continue Shopping</span>
        </button>

        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6 sm:mb-8">Checkout</h1>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          <div className="lg:col-span-2 space-y-4 sm:space-y-6">
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Shipping Address</h2>
                </div>
              </div>

              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs sm:text-sm text-blue-800">
                  <span className="font-semibold">Note:</span> Your shipping address will be saved for future orders
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.fullName}
                    onChange={(e) => handleInputChange('fullName', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="John Smith"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={shippingAddress.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="+1 (555) 123-4567"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Street Address *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.street}
                    onChange={(e) => handleInputChange('street', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="123 Main Street"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    City *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Los Angeles"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    State *
                  </label>
                  <select
                    value={shippingAddress.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select State</option>
                    {US_STATES.map(state => (
                      <option key={state.value} value={state.value}>
                        {state.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    ZIP Code *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.zipCode}
                    onChange={(e) => handleInputChange('zipCode', e.target.value)}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="90001"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Country *
                  </label>
                  <input
                    type="text"
                    value={shippingAddress.country}
                    disabled
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 rounded-lg bg-gray-50 text-gray-500"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm p-4 sm:p-6 border border-gray-200 lg:sticky lg:top-8">
              <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Order Summary</h2>
              </div>

              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 max-h-64 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-2 sm:gap-3">
                    {item.products.images && item.products.images[0] && (
                      <img
                        src={item.products.images[0]}
                        alt={item.products.title}
                        className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 text-xs sm:text-sm line-clamp-2">{item.products.title}</h3>
                      <p className="text-xs sm:text-sm text-gray-600">Quantity: {item.quantity}</p>
                      <p className="text-xs sm:text-sm font-bold text-gray-900">
                        ${(typeof item.products.price === 'string'
                          ? parseFloat(item.products.price)
                          : item.products.price
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 pt-3 sm:pt-4 space-y-2">
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span className="font-medium text-gray-900">${totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Shipping</span>
                  <span className="font-medium text-green-600">Free</span>
                </div>
                <div className="flex justify-between text-xs sm:text-sm">
                  <span className="text-gray-600">Tax (15%)</span>
                  <span className="font-medium text-gray-900">${tax.toFixed(2)}</span>
                </div>
                <div className="border-t border-gray-200 pt-2 flex justify-between">
                  <span className="text-base sm:text-lg font-bold text-gray-900">Total</span>
                  <span className="text-xl sm:text-2xl font-bold text-blue-600">${finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleProceedToPayment}
                disabled={loading}
                className="w-full mt-4 sm:mt-6 bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base hover:from-green-700 hover:to-blue-700 transition flex items-center justify-center gap-2 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 lg:active:scale-100"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    <span className="text-sm sm:text-base">Processing...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="text-sm sm:text-base">Proceed to Payment</span>
                  </>
                )}
              </button>

              <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-3 sm:mt-4">
                🔒 Secure Payment with PayPal
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
