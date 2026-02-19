import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { Package, CreditCard, MapPin, ArrowLeft, Loader2, ShoppingCart, Plus, Minus, Trash2 } from 'lucide-react';
import { US_STATES } from '../utils/usStates';
import MultiPaymentOptions from '../components/MultiPaymentOptions';
import CartDrawer from '../components/CartDrawer';

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
  const { items, totalAmount, clearCart, updateQuantity, removeFromCart } = useCart();
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
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
        product_title: item.products.title,
        product_image: item.products.image_url,
        seller_id: item.products.seller_id,
      }));

      console.log('Inserting order items...');
      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Items error:', itemsError);
        throw itemsError;
      }

      const sellerIds = new Set<string>();
      for (const item of items) {
        if (item.products.user_id) {
          sellerIds.add(item.products.user_id);
        }
      }

      for (const sellerId of sellerIds) {
        const sellerItems = items.filter(item => item.products.user_id === sellerId);
        const sellerTotal = sellerItems.reduce((sum, item) => {
          const price = typeof item.products.price === 'string'
            ? parseFloat(item.products.price)
            : item.products.price;
          return sum + (price * item.quantity);
        }, 0);

        try {
          await supabase.from('notifications').insert({
            user_id: sellerId,
            type: 'new_order',
            title: 'New Order Received!',
            message: `You have a new order worth $${sellerTotal.toFixed(2)} with ${sellerItems.length} item(s).`,
            data: {
              order_id: order.id,
              order_number: order.order_number,
              item_count: sellerItems.length,
              amount: sellerTotal
            }
          });
        } catch (notifError) {
          console.error('Error creating seller notification:', notifError);
        }
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

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;

        const orderConfirmationUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-order-confirmation`;
        await fetch(orderConfirmationUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: orderId,
          }),
        });
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
      }

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
        <div className="max-w-4xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <button
              onClick={() => setShowPaymentOptions(false)}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 active:scale-95"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm sm:text-base">Back to Shipping</span>
            </button>
            <button
              onClick={() => {
                setShowPaymentOptions(false);
                setIsCartOpen(true);
              }}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              <ShoppingCart className="w-4 h-4" />
              <span>Edit Cart</span>
            </button>
          </div>

          <div className="grid lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
            <div className="lg:col-span-2">
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

            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200 lg:sticky lg:top-8">
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5 text-purple-600" />
                  Order Items ({items.length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {items.map((item) => {
                    const price = typeof item.products.price === 'string'
                      ? parseFloat(item.products.price)
                      : item.products.price;

                    return (
                      <div key={item.id} className="flex gap-2 pb-3 border-b border-gray-100 last:border-0">
                        {item.products.images && item.products.images[0] && (
                          <img
                            src={item.products.images[0]}
                            alt={item.products.title}
                            className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-medium text-gray-900 line-clamp-2">{item.products.title}</h4>
                          <p className="text-xs text-gray-500 mt-1">Qty: {item.quantity}</p>
                          <p className="text-xs font-bold text-gray-900">${(price * item.quantity).toFixed(2)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-sm font-bold">
                    <span>Total:</span>
                    <span className="text-blue-600">${finalTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-4 sm:py-6 lg:py-8 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm sm:text-base">Continue Shopping</span>
          </button>
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition shadow-md text-sm"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>View Cart ({items.length})</span>
          </button>
        </div>

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
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Order Summary</h2>
                </div>
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>View Cart</span>
                </button>
              </div>

              <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-800">
                  <span className="font-semibold">💡 Tip:</span> You can edit quantities or remove items directly from here, or click "View Cart" for more options.
                </p>
              </div>

              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6 max-h-96 overflow-y-auto">
                {items.map((item) => {
                  const price = typeof item.products.price === 'string'
                    ? parseFloat(item.products.price)
                    : item.products.price;

                  return (
                    <div key={item.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                      <div className="flex gap-3">
                        {item.products.images && item.products.images[0] && (
                          <img
                            src={item.products.images[0]}
                            alt={item.products.title}
                            className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0 cursor-pointer hover:opacity-80"
                            onClick={() => navigate(`/product/${item.product_id}`)}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <h3
                            className="font-medium text-gray-900 text-sm line-clamp-2 cursor-pointer hover:text-blue-600"
                            onClick={() => navigate(`/product/${item.product_id}`)}
                          >
                            {item.products.title}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">{item.products.condition}</p>
                          <p className="text-sm font-bold text-gray-900 mt-1">
                            ${price.toFixed(2)} × {item.quantity} = ${(price * item.quantity).toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg">
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className="p-1.5 hover:bg-gray-100 rounded-l-lg transition"
                            disabled={item.quantity <= 1}
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-semibold px-3">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            className="p-1.5 hover:bg-gray-100 rounded-r-lg transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="p-2 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
                          title="Remove from cart"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
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

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
