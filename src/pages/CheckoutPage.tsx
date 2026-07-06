import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';
import { Package, CreditCard, MapPin, ArrowLeft, Loader2, ShoppingCart, Plus, Minus, Trash2, CheckCircle, X } from 'lucide-react';
import { US_STATES } from '../utils/usStates';
import StripeCheckout from '../components/StripeCheckout';
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
  const { user, loading: authLoading, openAuthModal } = useAuth();
  const { items, totalAmount, clearCart, updateQuantity, removeFromCart } = useCart();
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPaymentOptions, setShowPaymentOptions] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
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
    // Wait for the session to restore before deciding (hard-refresh race).
    if (authLoading) return;
    if (!user) {
      openAuthModal('Please sign in to complete your purchase');
      navigate('/');
      return;
    }
    // clearCart after a successful payment empties items — don't bounce the
    // buyer to the homepage while the payment modal / success screen is up.
    if (items.length === 0 && !showPaymentOptions && !paymentDone) {
      navigate('/');
      return;
    }
    loadUserProfile();
  }, [user, authLoading, items, navigate, showPaymentOptions, paymentDone]);

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
      // Re-check live stock before creating the order; the sold-out product
      // may have been bought since it was added to the cart.
      const { data: liveProducts, error: stockError } = await supabase
        .from('products')
        .select('id, title, status, stock')
        .in('id', items.map(item => item.product_id));

      if (stockError) throw stockError;

      const liveById = new Map((liveProducts || []).map(p => [p.id, p]));
      for (const item of items) {
        const live = liveById.get(item.product_id);
        if (!live || live.status !== 'available') {
          alert(`"${item.products.title}" is no longer available. Please remove it from your cart.`);
          setLoading(false);
          return;
        }
        const stock = Math.max(0, Number(live.stock ?? 1));
        if (item.quantity > stock) {
          alert(stock > 0
            ? `Only ${stock} unit(s) of "${live.title}" are left in stock. Please adjust the quantity in your cart.`
            : `"${live.title}" is sold out. Please remove it from your cart.`);
          setLoading(false);
          return;
        }
      }

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
        if (item.products.seller_id) {
          sellerIds.add(item.products.seller_id);
        }
      }

      for (const sellerId of sellerIds) {
        const sellerItems = items.filter(item => item.products.seller_id === sellerId);
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
    // The confirm-order-payment edge function has already verified the
    // payment with Stripe, marked the order paid, and notified the buyer.
    setPaymentDone(true);

    window.setTimeout(() => {
      navigate(`/order-confirmation/${orderId}`);
    }, 3500);

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

    try {
      await clearCart();
    } catch (error) {
      console.error('Error clearing cart:', error);
    }
  };

  const handlePaymentError = (error: string) => {
    // StripeCheckout renders the error inline inside the modal.
    console.error('Payment failed:', error);
  };

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
            className="flex items-center gap-2 rounded-full bg-[#07513B] px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-[#032F24]"
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
                  <div className="rounded-lg bg-[#F2FAE8] p-2">
                    <MapPin className="w-4 h-4 text-[#07513B] sm:w-5 sm:h-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Shipping Address</h2>
                </div>
              </div>

              <div className="mb-4 rounded-lg border border-[#CFE8AC] bg-[#F2FAE8] p-3">
                <p className="text-xs text-[#07513B] sm:text-sm">
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#07513B] focus:ring-2 focus:ring-[#07513B]/20 sm:px-4 sm:py-2.5 sm:text-base"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#07513B] focus:ring-2 focus:ring-[#07513B]/20 sm:px-4 sm:py-2.5 sm:text-base"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#07513B] focus:ring-2 focus:ring-[#07513B]/20 sm:px-4 sm:py-2.5 sm:text-base"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#07513B] focus:ring-2 focus:ring-[#07513B]/20 sm:px-4 sm:py-2.5 sm:text-base"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#07513B] focus:ring-2 focus:ring-[#07513B]/20 sm:px-4 sm:py-2.5 sm:text-base"
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
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-[#07513B] focus:ring-2 focus:ring-[#07513B]/20 sm:px-4 sm:py-2.5 sm:text-base"
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
                  <div className="rounded-lg bg-[#F2FAE8] p-2">
                    <Package className="w-4 h-4 text-[#07513B] sm:w-5 sm:h-5" />
                  </div>
                  <h2 className="text-lg sm:text-xl font-bold text-gray-900">Order Summary</h2>
                </div>
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="flex items-center gap-1 text-sm font-bold text-[#07513B] hover:text-[#032F24]"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span>View Cart</span>
                </button>
              </div>

              <div className="mb-3 rounded-lg border border-[#CFE8AC] bg-[#F2FAE8] p-3">
                <p className="text-xs text-[#07513B]">
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
                            className="line-clamp-2 cursor-pointer text-sm font-medium text-gray-900 hover:text-[#07513B]"
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
                  <span className="text-xl font-black text-[#07513B] sm:text-2xl">${finalTotal.toFixed(2)}</span>
                </div>
              </div>

              <button
                onClick={handleProceedToPayment}
                disabled={loading}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-[#07513B] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#032F24] hover:shadow-lg active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:mt-6 sm:py-4 sm:text-base lg:active:scale-100"
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
                🔒 Secure Payment with Stripe
              </p>
            </div>
          </div>
        </div>
      </div>

      {showPaymentOptions && orderId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-3 sm:p-4 overflow-y-auto">
          <div className="relative my-4 w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-gray-50 shadow-2xl">
            {!paymentDone && (
              <button
                onClick={() => setShowPaymentOptions(false)}
                aria-label="Close payment"
                className="absolute right-3 top-3 z-10 rounded-full bg-white p-2 text-gray-500 shadow-sm transition hover:bg-gray-100 hover:text-gray-900"
              >
                <X className="h-5 w-5" />
              </button>
            )}

            <div className="p-4 sm:p-6">
              {paymentDone ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 animate-bounce">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                  <h3 className="mb-2 text-2xl font-black text-gray-900">Payment Successful! 🎉</h3>
                  <p className="mb-1 text-gray-700">
                    Your order <span className="font-bold">#{orderId.slice(0, 8)}</span> has been confirmed.
                  </p>
                  <p className="mb-2 text-lg font-black text-[#07513B]">${finalTotal.toFixed(2)}</p>
                  <p className="mb-6 text-sm text-gray-500">
                    A confirmation email is on its way. Redirecting you to your order…
                  </p>
                  <button
                    onClick={() => navigate(`/order-confirmation/${orderId}`)}
                    className="inline-flex items-center gap-2 rounded-full bg-[#07513B] px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#032F24]"
                  >
                    <Package className="h-4 w-4" />
                    View Order Details
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between rounded-xl border border-[#CFE8AC] bg-[#F2FAE8] p-3 pr-12 sm:p-4 sm:pr-12">
                    <div>
                      <p className="text-xs text-gray-600">Order #{orderId.slice(0, 8)}</p>
                      <p className="text-sm font-semibold text-gray-900">{items.length} item{items.length === 1 ? '' : 's'}</p>
                    </div>
                    <p className="text-xl font-black text-[#07513B] sm:text-2xl">${finalTotal.toFixed(2)}</p>
                  </div>

                  <StripeCheckout
                    orderId={orderId}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
}
