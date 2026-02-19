import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Package, Truck, CheckCircle, Clock, ExternalLink, MapPin, Filter, ChevronDown, Eye, X, ShoppingBag, DollarSign } from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
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
  shipping_address: string;
  order_items: {
    product_id: string;
    quantity: number;
    price: number;
    products: {
      id: string;
      title: string;
      image_url: string;
      description: string;
      condition: string;
    };
  }[];
}

export default function BuyerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [orders, filterStatus, sortBy]);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            product_id,
            quantity,
            price,
            products (
              id,
              title,
              image_url,
              description,
              condition
            )
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...orders];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(order => order.status === filterStatus);
    }

    switch (sortBy) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'oldest':
        filtered.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'highest':
        filtered.sort((a, b) => b.total_amount - a.total_amount);
        break;
      case 'lowest':
        filtered.sort((a, b) => a.total_amount - b.total_amount);
        break;
    }

    setFilteredOrders(filtered);
  };

  const handleConfirmDelivery = async () => {
    if (!orderToConfirm) return;

    try {
      setConfirming(orderToConfirm);

      const { error } = await supabase
        .from('orders')
        .update({
          confirmed_by_buyer: true,
          delivered_at: new Date().toISOString(),
          status: 'delivered'
        })
        .eq('id', orderToConfirm);

      if (error) throw error;

      const order = orders.find(o => o.id === orderToConfirm);
      if (order) {
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('product_id, products(user_id)')
          .eq('order_id', orderToConfirm);

        if (orderItems) {
          const sellerIds = new Set<string>();
          orderItems.forEach(item => {
            if (item.products?.user_id) {
              sellerIds.add(item.products.user_id);
            }
          });

          for (const sellerId of sellerIds) {
            try {
              await supabase.from('notifications').insert({
                user_id: sellerId,
                type: 'order_delivered',
                title: 'Order Delivered Successfully',
                message: `Order #${order.order_number} has been confirmed as delivered by the buyer. Payment will be transferred soon.`,
                data: {
                  order_id: order.id,
                  order_number: order.order_number,
                  total_amount: order.total_amount
                }
              });
            } catch (notifError) {
              console.error('Error creating seller notification:', notifError);
            }
          }
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          const token = session?.access_token;
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

          await fetch(`${supabaseUrl}/functions/v1/send-delivery-confirmation`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
              orderId: order.id
            }),
          });
        } catch (emailError) {
          console.error('Failed to send delivery confirmation email:', emailError);
        }
      }

      await loadOrders();
    } catch (error) {
      console.error('Error confirming delivery:', error);
    } finally {
      setConfirming(null);
      setShowConfirmModal(false);
      setOrderToConfirm(null);
    }
  };

  const getStats = () => {
    const totalOrders = orders.length;
    const totalSpent = orders.reduce((sum, order) => sum + order.total_amount, 0);
    const activeOrders = orders.filter(order => !order.confirmed_by_buyer && order.status !== 'cancelled').length;
    const deliveredOrders = orders.filter(order => order.confirmed_by_buyer).length;

    return { totalOrders, totalSpent, activeOrders, deliveredOrders };
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

  const getOrderProgress = (order: Order) => {
    const steps = [
      { label: 'Order Placed', completed: true },
      { label: 'Payment Confirmed', completed: order.status !== 'pending' },
      { label: 'Shipped', completed: order.shipped_at !== null },
      { label: 'Delivered', completed: order.confirmed_by_buyer },
    ];
    return steps;
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50/30 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-4 lg:py-8">
        <div className="mb-4 lg:mb-6">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1 lg:mb-2">My Orders</h1>
          <p className="text-xs sm:text-sm lg:text-base text-gray-600">Track all your orders and shipping status</p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3 lg:gap-4 mb-4 lg:mb-6">
          <QuickStatsCard
            icon={ShoppingBag}
            label="Total Orders"
            value={stats.totalOrders}
            gradient="from-teal-500 to-emerald-600"
            iconColor="text-white"
          />
          <QuickStatsCard
            icon={DollarSign}
            label="Total Spent"
            value={`$${stats.totalSpent.toFixed(0)}`}
            gradient="from-blue-500 to-cyan-600"
            iconColor="text-white"
          />
          <QuickStatsCard
            icon={Truck}
            label="Active Orders"
            value={stats.activeOrders}
            gradient="from-orange-500 to-amber-600"
            iconColor="text-white"
          />
          <QuickStatsCard
            icon={CheckCircle}
            label="Completed Orders"
            value={stats.deliveredOrders}
            gradient="from-green-500 to-emerald-600"
            iconColor="text-white"
          />
        </div>

        <div className="mb-4 lg:mb-6 bg-white rounded-xl lg:rounded-2xl shadow-sm p-3 sm:p-4">
          <div className="flex items-center justify-between mb-3 lg:mb-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2.5 sm:py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition lg:hidden active:scale-95"
            >
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            <div className="hidden lg:flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Status:</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Processing</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700">Sort By:</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Price</option>
                  <option value="lowest">Lowest Price</option>
                </select>
              </div>

              <div className="ml-auto text-sm text-gray-600">
                {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-3 lg:hidden">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Processing</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-base"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Price</option>
                  <option value="lowest">Lowest Price</option>
                </select>
              </div>

              <div className="text-sm text-gray-600 text-center pt-2 border-t">
                {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
              </div>
            </div>
          )}
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-lg overflow-hidden">
            <EmptyStateDisplay
              icon={Package}
              title="No Orders Found"
              description={filterStatus === 'all' ? 'You haven\'t placed any orders yet' : 'No orders with this status'}
            />
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4 lg:space-y-6">
            {filteredOrders.map((order) => {
              const steps = getOrderProgress(order);
              return (
                <div key={order.id} className="bg-white rounded-xl lg:rounded-2xl shadow-lg overflow-hidden transition-all duration-300 hover:shadow-xl border border-gray-100">
                  <div className="p-3 sm:p-4 lg:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between mb-3 sm:mb-4 lg:mb-6 gap-2 sm:gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5 sm:mb-2">
                          <h3 className="text-sm sm:text-base lg:text-lg font-bold text-gray-900 truncate">Order #{order.order_number}</h3>
                          <OrderStatusBadge status={order.status} size="sm" />
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600">
                          {new Date(order.created_at).toLocaleDateString('en-US')}
                        </p>
                      </div>
                      <div className="flex items-center justify-between lg:flex-col lg:items-end gap-2 sm:gap-3">
                        <p className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-teal-600 to-emerald-600 bg-clip-text text-transparent">${order.total_amount.toFixed(2)}</p>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm bg-gradient-to-r from-teal-50 to-emerald-50 text-teal-700 hover:from-teal-100 hover:to-emerald-100 rounded-lg sm:rounded-xl transition-all duration-200 font-medium shadow-sm hover:shadow active:scale-95"
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>

                    <div className="mb-4 sm:mb-5 lg:mb-6">
                      <div className="flex items-center justify-between mb-2 relative">
                        <div className="absolute top-4 sm:top-5 left-0 right-0 h-0.5 sm:h-1 bg-gray-200" style={{ width: 'calc(100% - 32px)', marginLeft: '16px', marginRight: '16px' }}>
                          <div
                            className="h-full bg-emerald-500 transition-all duration-500"
                            style={{ width: `${(steps.filter(s => s.completed).length - 1) / (steps.length - 1) * 100}%` }}
                          />
                        </div>
                        {steps.map((step, idx) => (
                          <div key={idx} className="flex-1 flex flex-col items-center relative z-10">
                            <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center ${
                              step.completed ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
                            }`}>
                              {step.completed ? <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> : <Clock className="w-4 h-4 sm:w-5 sm:h-5" />}
                            </div>
                            <p className={`text-[10px] sm:text-xs mt-1.5 sm:mt-2 text-center leading-tight px-0.5 ${
                              step.completed ? 'text-emerald-600 font-semibold' : 'text-gray-400'
                            }`}>
                              {step.label}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-gray-200 pt-3 sm:pt-4 mb-3 sm:mb-4">
                      <h4 className="font-semibold text-gray-900 mb-2 sm:mb-3 text-sm lg:text-base">Products:</h4>
                      <div className="space-y-2 sm:space-y-3">
                        {order.order_items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2 sm:gap-3 lg:gap-4 p-2 sm:p-2.5 lg:p-3 bg-gray-50 rounded-lg">
                            <img
                              src={item.products.image_url}
                              alt={item.products.title}
                              className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 object-cover rounded-lg shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-xs sm:text-sm lg:text-base truncate">{item.products.title}</p>
                              <p className="text-[11px] sm:text-xs lg:text-sm text-gray-600">Quantity: {item.quantity} × ${item.price.toFixed(2)}</p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedProduct(item.products);
                                setShowProductModal(true);
                              }}
                              className="flex items-center gap-1 px-2.5 sm:px-3 py-2 sm:py-2.5 text-[11px] sm:text-xs lg:text-sm bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-all font-medium shrink-0 active:scale-95"
                            >
                              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              <span className="hidden xs:inline">Details</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.tracking_number && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-3 sm:mb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          <div className="flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-blue-900 mb-1.5 sm:mb-2">Shipping Information:</p>
                            <p className="text-xs sm:text-sm text-blue-800 mb-0.5">
                              Shipping Company: <span className="font-bold">{order.shipping_company}</span>
                            </p>
                            <p className="text-xs sm:text-sm text-blue-800 mb-0.5">
                              Tracking Number: <span className="font-bold">{order.tracking_number}</span>
                            </p>
                            {order.shipped_at && (
                              <p className="text-[10px] sm:text-xs text-blue-700 mt-1">
                                Shipped Date: {new Date(order.shipped_at).toLocaleDateString('en-US')}
                              </p>
                            )}
                          </div>
                          <a
                            href={getTrackingUrl(order.shipping_company || '', order.tracking_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center gap-1.5 sm:gap-2 px-4 py-2.5 sm:py-3 bg-blue-600 text-white rounded-lg sm:rounded-xl hover:bg-blue-700 transition-all text-xs sm:text-sm font-semibold active:scale-95 shrink-0"
                          >
                            <span>Track Shipment</span>
                            <ExternalLink className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </a>
                        </div>
                      </div>
                    )}

                    {order.tracking_number && !order.confirmed_by_buyer && (
                      <button
                        onClick={() => {
                          setOrderToConfirm(order.id);
                          setShowConfirmModal(true);
                        }}
                        disabled={confirming === order.id}
                        className="w-full px-4 py-3 sm:py-3.5 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg sm:rounded-xl hover:from-teal-700 hover:to-emerald-700 transition-all duration-200 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg hover:shadow-xl active:scale-95 text-sm sm:text-base"
                      >
                        <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        {confirming === order.id ? 'Confirming...' : 'Confirm Order Received'}
                      </button>
                    )}

                    {order.confirmed_by_buyer && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3">
                        <p className="text-xs sm:text-sm text-green-800 font-semibold flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Order receipt confirmed successfully
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900">Order Details</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 lg:p-6 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Order Number</h3>
                <p className="text-base lg:text-lg font-bold text-gray-900">#{selectedOrder.order_number}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Order Date</h3>
                  <p className="text-sm text-gray-900">{new Date(selectedOrder.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">Total Amount</h3>
                  <p className="text-lg font-bold text-emerald-600">${selectedOrder.total_amount.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-1">Status</h3>
                <OrderStatusBadge status={selectedOrder.status} />
              </div>

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  Shipping Address
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-900 whitespace-pre-line leading-relaxed">{selectedOrder.shipping_address}</p>
                </div>
              </div>

              {selectedOrder.tracking_number && (
                <div className="border-t border-gray-200 pt-4">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <Truck className="w-4 h-4 text-blue-600" />
                    Shipping Information
                  </h3>
                  <div className="bg-blue-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs text-blue-700 mb-1">Shipping Company</p>
                        <p className="text-sm font-bold text-blue-900">{selectedOrder.shipping_company}</p>
                      </div>
                      <a
                        href={getTrackingUrl(selectedOrder.shipping_company || '', selectedOrder.tracking_number)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-xs font-semibold"
                      >
                        Track
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div>
                      <p className="text-xs text-blue-700 mb-1">Tracking Number</p>
                      <p className="text-sm font-mono font-bold text-blue-900">{selectedOrder.tracking_number}</p>
                    </div>
                    {selectedOrder.shipped_at && (
                      <div>
                        <p className="text-xs text-blue-700 mb-1">Shipped Date</p>
                        <p className="text-sm text-blue-900">{new Date(selectedOrder.shipped_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-gray-200 pt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Order Progress</h3>
                <div className="space-y-3">
                  {getOrderProgress(selectedOrder).map((step, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                        step.completed ? 'bg-emerald-500 text-white' : 'bg-gray-200 text-gray-400'
                      }`}>
                        {step.completed ? <CheckCircle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      </div>
                      <p className={`text-sm font-medium ${
                        step.completed ? 'text-emerald-600' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-4 lg:px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg lg:text-xl font-bold text-gray-900">Product Details</h2>
              <button
                onClick={() => {
                  setShowProductModal(false);
                  setSelectedProduct(null);
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 lg:p-6">
              <div className="aspect-square w-full mb-6 rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={selectedProduct.image_url}
                  alt={selectedProduct.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-xl lg:text-2xl font-bold text-gray-900 mb-2">{selectedProduct.title}</h3>
                  <span className="inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-semibold rounded-full">
                    {selectedProduct.condition}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Description</h4>
                  <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">
                    {selectedProduct.description || 'No description available'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setOrderToConfirm(null);
        }}
        onConfirm={handleConfirmDelivery}
        title="Confirm Order Receipt"
        message="Are you sure you received this order? This action cannot be undone."
        confirmText="Yes, I Received It"
        cancelText="Cancel"
      />
    </div>
  );
}
