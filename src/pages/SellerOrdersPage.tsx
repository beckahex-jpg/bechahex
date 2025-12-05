import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Package, Truck, CheckCircle, Clock, ExternalLink, ShoppingBag, DollarSign, X } from 'lucide-react';
import OrderStatusBadge from '../components/OrderStatusBadge';
import QuickStatsCard from '../components/QuickStatsCard';
import EmptyStateDisplay from '../components/EmptyStateDisplay';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  tracking_number: string | null;
  shipping_company: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  confirmed_by_buyer: boolean;
  payment_released: boolean;
  seller_amount: number;
  buyer_name: string;
  buyer_email: string;
  shipping_address: string;
  order_items: {
    product_id: string;
    quantity: number;
    price: number;
    products: {
      title: string;
      image_url: string;
    };
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

  const loadOrders = async () => {
    try {
      setLoading(true);

      const { data: userProducts } = await supabase
        .from('products')
        .select('id')
        .eq('seller_id', user?.id);

      if (!userProducts || userProducts.length === 0) {
        setOrders([]);
        return;
      }

      const productIds = userProducts.map(p => p.id);

      const { data: orderItems } = await supabase
        .from('order_items')
        .select('order_id')
        .in('product_id', productIds);

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
    const totalRevenue = orders.reduce((sum, order) => sum + (order.seller_amount || order.total_amount), 0);
    const pendingShipment = orders.filter(order => !order.tracking_number).length;
    const completedOrders = orders.filter(order => order.payment_released).length;

    return { totalOrders, totalRevenue, pendingShipment, completedOrders };
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

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4 mb-4 lg:mb-6">
          <QuickStatsCard
            icon={ShoppingBag}
            label="Total Orders"
            value={stats.totalOrders}
            gradient="from-blue-500 to-cyan-600"
            iconColor="text-white"
          />
          <QuickStatsCard
            icon={DollarSign}
            label="Total Revenue"
            value={`$${stats.totalRevenue.toFixed(0)}`}
            gradient="from-teal-500 to-emerald-600"
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
            icon={CheckCircle}
            label="Completed Orders"
            value={stats.completedOrders}
            gradient="from-green-500 to-emerald-600"
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
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {new Date(order.created_at).toLocaleDateString('en-US')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:flex-col sm:items-end gap-2">
                    <p className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">${order.total_amount.toFixed(2)}</p>
                    {order.seller_amount > 0 && (
                      <p className="text-xs sm:text-sm text-gray-600">Your Amount: <span className="font-semibold">${order.seller_amount.toFixed(2)}</span></p>
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
                    {order.order_items?.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2 sm:gap-3 lg:gap-4 p-2 bg-gray-50 rounded-lg">
                        <img
                          src={item.products.image_url}
                          alt={item.products.title}
                          className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-cover rounded-lg shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 text-xs sm:text-sm lg:text-base truncate">{item.products.title}</p>
                          <p className="text-[11px] sm:text-xs lg:text-sm text-gray-600">Quantity: {item.quantity} × ${item.price.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
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

                {order.payment_released && (
                  <div className="mt-3 sm:mt-4 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                    <p className="text-xs sm:text-sm text-green-800 font-semibold flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Payment transferred to your account
                    </p>
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
