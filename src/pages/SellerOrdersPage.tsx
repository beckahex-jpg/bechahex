import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Package, Truck, CheckCircle, Clock, ExternalLink, ShoppingBag, DollarSign, X, TrendingUp, Percent } from 'lucide-react';
import OrderStatusBadge from '../components/OrderStatusBadge';
import QuickStatsCard from '../components/QuickStatsCard';
import EmptyStateDisplay from '../components/EmptyStateDisplay';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  admin_commission: number | null;
  seller_amount: number | null;
  created_at: string;
  tracking_number: string | null;
  shipping_company: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  confirmed_by_buyer: boolean;
  payment_released: boolean;
  payment_released_at: string | null;
  buyer_name: string;
  buyer_email: string;
  shipping_address: string;
  order_items: {
    product_id: string;
    quantity: number;
    price: number;
    product_title: string;
    product_image: string | null;
    products: {
      title: string;
      image_url: string;
    } | null;
  }[];
}

export default function SellerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCompany, setShippingCompany] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('seller-orders-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
        },
        (payload) => {
          console.log('Order update received:', payload);
          loadOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const { data: orderItems, error: itemsError } = await supabase
        .from('order_items')
        .select('order_id')
        .eq('seller_id', user?.id);

      if (itemsError) throw itemsError;

      if (!orderItems || orderItems.length === 0) {
        setOrders([]);
        return;
      }

      const orderIds = [...new Set(orderItems.map(oi => oi.order_id))];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            product_id,
            quantity,
            price,
            product_title,
            product_image,
            products (
              title,
              image_url
            )
          )
        `)
        .in('id', orderIds)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTracking = (order: Order) => {
    setSelectedOrder(order);
    setTrackingNumber(order.tracking_number || '');
    setShippingCompany(order.shipping_company || '');
    setShowShippingModal(true);
  };

  const handleUpdateTracking = async () => {
    if (!selectedOrder || !trackingNumber || !shippingCompany) {
      return;
    }

    try {
      setUpdating(true);

      const { error } = await supabase
        .from('orders')
        .update({
          tracking_number: trackingNumber,
          shipping_company: shippingCompany,
          shipped_at: new Date().toISOString(),
          status: 'shipped'
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      try {
        await supabase.from('notifications').insert({
          user_id: selectedOrder.user_id,
          type: 'order_shipped',
          title: 'Order Shipped!',
          message: `Your order #${selectedOrder.order_number} has been shipped via ${shippingCompany}. Tracking number: ${trackingNumber}`,
          data: {
            order_id: selectedOrder.id,
            order_number: selectedOrder.order_number,
            tracking_number: trackingNumber,
            shipping_company: shippingCompany
          }
        });
      } catch (notifError) {
        console.error('Error creating notification:', notifError);
      }

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

        await fetch(`${supabaseUrl}/functions/v1/send-shipping-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            orderId: selectedOrder.id,
            trackingNumber,
            shippingCompany
          }),
        });
      } catch (emailError) {
        console.error('Failed to send shipping notification email:', emailError);
      }

      setShowShippingModal(false);
      await loadOrders();
    } catch (error) {
      console.error('Error updating tracking:', error);
    } finally {
      setUpdating(false);
    }
  };

  const getStats = () => {
    const totalOrders = orders.length;
    const totalEarningsPending = orders
      .filter(order => !order.payment_released)
      .reduce((sum, order) => sum + (order.seller_amount || order.total_amount * 0.9), 0);
    const totalEarningsTransferred = orders
      .filter(order => order.payment_released)
      .reduce((sum, order) => sum + (order.seller_amount || 0), 0);
    const totalCommissionDeducted = orders
      .filter(order => order.payment_released && order.admin_commission)
      .reduce((sum, order) => sum + (order.admin_commission || 0), 0);
    const pendingShipment = orders.filter(order => !order.tracking_number).length;
    const completedOrders = orders.filter(order => order.payment_released).length;

    return {
      totalOrders,
      totalEarningsPending,
      totalEarningsTransferred,
      totalCommissionDeducted,
      pendingShipment,
      completedOrders
    };
  };

  const getTrackingUrl = (company: string, trackingNumber: string) => {
    const urls: Record<string, string> = {
      'SMSA': `https://www.smsaexpress.com/track/?tracknumbers=${trackingNumber}`,
      'Aramex': `https://www.aramex.com/sa/en/track/shipments?ShipmentNumber=${trackingNumber}`,
      'DHL': `https://www.dhl.com/sa-en/home/tracking.html?tracking-id=${trackingNumber}`,
      'UPS': `https://www.ups.com/track?tracknum=${trackingNumber}`,
      'FedEx': `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`,
    };
    return urls[company] || '#';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center py-20">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  const stats = getStats();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50/30 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 lg:py-8">
        <div className="mb-4 lg:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1 lg:mb-2">Seller Orders</h1>
          <p className="text-xs sm:text-sm lg:text-base text-gray-600">Manage all orders for your products</p>
        </div>

        <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl lg:rounded-2xl shadow-lg p-4 lg:p-6 mb-4 lg:mb-6">
          <h2 className="text-white text-lg lg:text-xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 lg:w-6 lg:h-6" />
            Earnings Summary
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:gap-4">
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 lg:p-4 border border-white/30">
              <p className="text-white/90 text-xs lg:text-sm mb-1">Pending Transfer</p>
              <p className="text-white text-2xl lg:text-3xl font-bold">${stats.totalEarningsPending.toFixed(2)}</p>
              <p className="text-white/80 text-xs mt-1">Awaiting bank transfer</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 lg:p-4 border border-white/30">
              <p className="text-white/90 text-xs lg:text-sm mb-1">Transferred</p>
              <p className="text-white text-2xl lg:text-3xl font-bold">${stats.totalEarningsTransferred.toFixed(2)}</p>
              <p className="text-white/80 text-xs mt-1">Received via bank</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-3 lg:p-4 border border-white/30">
              <p className="text-white/90 text-xs lg:text-sm mb-1">Commission Deducted</p>
              <p className="text-white text-2xl lg:text-3xl font-bold">${stats.totalCommissionDeducted.toFixed(2)}</p>
              <p className="text-white/80 text-xs mt-1">Platform fees</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4 mb-4 lg:mb-6">
          <QuickStatsCard
            icon={ShoppingBag}
            label="Total Orders"
            value={stats.totalOrders}
            gradient="from-blue-500 to-cyan-600"
            iconColor="text-white"
          />
          <QuickStatsCard
            icon={CheckCircle}
            label="Completed Orders"
            value={stats.completedOrders}
            gradient="from-green-500 to-emerald-600"
            iconColor="text-white"
          />
          <QuickStatsCard
            icon={Truck}
            label="Pending Shipment"
            value={stats.pendingShipment}
            gradient="from-orange-500 to-amber-600"
            iconColor="text-white"
          />
          <QuickStatsCard
            icon={DollarSign}
            label="Total Earnings"
            value={`$${(stats.totalEarningsPending + stats.totalEarningsTransferred).toFixed(0)}`}
            gradient="from-teal-500 to-emerald-600"
            iconColor="text-white"
          />
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-lg overflow-hidden">
            <EmptyStateDisplay
              icon={Package}
              title="No Orders Found"
              description="You haven't received any orders for your products yet"
            />
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4 lg:space-y-6">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl lg:rounded-2xl shadow-lg p-3 sm:p-4 lg:p-6 hover:shadow-xl transition-all duration-300 border border-gray-100">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-3 sm:mb-4 gap-2 sm:gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5 sm:mb-2">
                      <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 truncate">Order #{order.order_number}</h3>
                      <OrderStatusBadge status={order.status} size="sm" />
                      {order.payment_released ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                          <CheckCircle className="w-3 h-3" />
                          Transferred
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                          <Clock className="w-3 h-3" />
                          Pending Transfer
                        </span>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString('en-US')}
                    </p>
                  </div>
                  <div className="bg-gradient-to-br from-teal-50 to-emerald-50 border border-teal-200 rounded-lg p-3">
                    <p className="text-xs text-teal-700 mb-1">Order Total</p>
                    <p className="text-xl lg:text-2xl font-bold text-teal-900">${order.total_amount.toFixed(2)}</p>
                    {order.admin_commission && order.seller_amount ? (
                      <div className="mt-2 pt-2 border-t border-teal-200">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-teal-700">Commission:</span>
                          <span className="font-semibold text-red-600">-${order.admin_commission.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-teal-700">Your Earnings:</span>
                          <span className="font-bold text-emerald-600">${order.seller_amount.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-teal-700 mt-1">
                        Est. Earnings: <span className="font-semibold text-emerald-600">${(order.total_amount * 0.9).toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 sm:pt-4 mb-3 sm:mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm lg:text-base">Buyer Information:</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 lg:gap-4 text-xs sm:text-sm">
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <p className="text-gray-600 mb-0.5">Name:</p>
                      <p className="font-medium text-gray-900">{order.buyer_name}</p>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-lg">
                      <p className="text-gray-600 mb-0.5">Email:</p>
                      <p className="font-medium text-gray-900 truncate">{order.buyer_email}</p>
                    </div>
                    <div className="col-span-1 sm:col-span-2 bg-gray-50 p-2 rounded-lg">
                      <p className="text-gray-600 mb-0.5">Shipping Address:</p>
                      <p className="font-medium text-gray-900 leading-relaxed">{order.shipping_address}</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-3 sm:pt-4 mb-3 sm:mb-4">
                  <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm lg:text-base">Products:</h4>
                  <div className="space-y-2 sm:space-y-3">
                    {order.order_items?.map((item, idx) => {
                      const title = item.products?.title || item.product_title;
                      const imageUrl = item.products?.image_url || item.product_image || '/placeholder.png';
                      const isDeleted = !item.products;

                      return (
                        <div key={idx} className="flex items-center gap-2 sm:gap-3 lg:gap-4 p-2 bg-gray-50 rounded-lg">
                          <img
                            src={imageUrl}
                            alt={title}
                            className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-cover rounded-lg shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 text-xs sm:text-sm lg:text-base truncate">
                              {title}
                              {isDeleted && (
                                <span className="ml-2 text-[10px] sm:text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">Deleted</span>
                              )}
                            </p>
                            <p className="text-[11px] sm:text-xs lg:text-sm text-gray-600">Quantity: {item.quantity} × ${item.price.toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {order.tracking_number ? (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex-1">
                        <p className="text-xs sm:text-sm font-semibold text-emerald-900 mb-1.5 sm:mb-2">Shipping Information:</p>
                        <p className="text-xs sm:text-sm text-emerald-800 mb-0.5">
                          Shipping Company: <span className="font-bold">{order.shipping_company}</span>
                        </p>
                        <p className="text-xs sm:text-sm text-emerald-800 mb-0.5">
                          Tracking Number: <span className="font-bold">{order.tracking_number}</span>
                        </p>
                        {order.shipped_at && (
                          <p className="text-[10px] sm:text-xs text-emerald-700 mt-1">
                            Shipped Date: {new Date(order.shipped_at).toLocaleDateString('en-US')}
                          </p>
                        )}
                      </div>
                      <a
                        href={getTrackingUrl(order.shipping_company || '', order.tracking_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg sm:rounded-xl hover:bg-emerald-700 transition-all text-xs sm:text-sm font-semibold active:scale-95 shrink-0"
                      >
                        <span>Track Shipment</span>
                        <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddTracking(order)}
                    className="w-full px-4 py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 font-semibold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 text-sm sm:text-base"
                  >
                    <Truck className="w-4 h-4 sm:w-5 sm:h-5" />
                    Add Shipping Information
                  </button>
                )}

                {order.payment_released ? (
                  <div className="mt-3 sm:mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="flex items-start gap-3 mb-2">
                      <CheckCircle className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm sm:text-base text-green-900 font-bold mb-1">
                          Payment Transferred to Your Bank Account
                        </p>
                        <p className="text-xs sm:text-sm text-green-700">
                          ${order.seller_amount?.toFixed(2)} has been transferred to your registered bank account on {new Date(order.payment_released_at!).toLocaleDateString('en-US')}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 sm:mt-4 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 rounded-lg sm:rounded-xl p-3 sm:p-4">
                    <div className="flex items-start gap-3">
                      <Clock className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm sm:text-base text-yellow-900 font-bold mb-1">
                          Payment Pending Transfer
                        </p>
                        <p className="text-xs sm:text-sm text-yellow-700">
                          Your earnings of ${order.seller_amount ? order.seller_amount.toFixed(2) : (order.total_amount * 0.9).toFixed(2)} will be transferred to your bank account once the order is processed by admin.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showShippingModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-xl sm:rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent pr-4">Add Shipping Information</h2>
              <button
                onClick={() => setShowShippingModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition active:scale-95 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Shipping Company <span className="text-red-500">*</span>
                </label>
                <select
                  value={shippingCompany}
                  onChange={(e) => setShippingCompany(e.target.value)}
                  className="w-full px-4 py-3 sm:py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
                >
                  <option value="">Select Shipping Company</option>
                  <option value="SMSA">SMSA Express</option>
                  <option value="Aramex">Aramex</option>
                  <option value="DHL">DHL</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tracking Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                  className="w-full px-4 py-3 sm:py-3.5 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-base"
                />
              </div>
            </div>

            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => setShowShippingModal(false)}
                disabled={updating}
                className="flex-1 px-4 py-3 sm:py-3.5 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all duration-200 font-semibold active:scale-95 text-sm sm:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTracking}
                disabled={updating || !trackingNumber || !shippingCompany}
                className="flex-1 px-4 py-3 sm:py-3.5 bg-gradient-to-r from-blue-600 to-cyan-600 text-white rounded-xl hover:from-blue-700 hover:to-cyan-700 transition-all duration-200 font-semibold disabled:opacity-50 shadow-lg hover:shadow-xl active:scale-95 text-sm sm:text-base"
              >
                {updating ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
