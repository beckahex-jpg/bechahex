import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  CalendarDays, CheckCircle, ChevronDown, Clock, DollarSign, ExternalLink,
  Eye, Filter, MapPin, Package, ShoppingBag, Star, Truck, X,
} from 'lucide-react';
import ConfirmationModal from '../components/ConfirmationModal';
import OrderStatusBadge from '../components/OrderStatusBadge';
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

type OrderProduct = Order['order_items'][number]['products'];

export default function BuyerOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviewedKeys, setReviewedKeys] = useState<Set<string>>(new Set());
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('newest');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<OrderProduct | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [orderToConfirm, setOrderToConfirm] = useState<string | null>(null);
  const [reviewPromptOrderId, setReviewPromptOrderId] = useState<string | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (user) {
      loadOrders();
    }
  }, [user]);

  useEffect(() => {
    applyFilters();
  }, [orders, filterStatus, sortBy]);

  // Deep link (?order=<id>): notifications land here and auto-open the order.
  useEffect(() => {
    const orderId = searchParams.get('order');
    if (!orderId || orders.length === 0) return;
    const match = orders.find((order) => order.id === orderId);
    if (match) {
      setSelectedOrder(match);
      const next = new URLSearchParams(searchParams);
      next.delete('order');
      setSearchParams(next, { replace: true });
    }
  }, [orders, searchParams]);

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

      const { data: reviewRows } = await supabase
        .from('product_reviews')
        .select('order_id, product_id')
        .eq('reviewer_id', user?.id);
      setReviewedKeys(new Set((reviewRows || []).map((row) => `${row.order_id}:${row.product_id}`)));
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const isOrderFullyReviewed = (order: Order) =>
    order.order_items.length > 0 &&
    order.order_items.every((item) => reviewedKeys.has(`${order.id}:${item.product_id}`));

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
        // order_items.seller_id is the reliable seller reference
        // (products.user_id does not exist — the old query always returned nothing)
        const { data: orderItems } = await supabase
          .from('order_items')
          .select('seller_id')
          .eq('order_id', orderToConfirm);

        if (orderItems) {
          const sellerIds = new Set<string>();
          (orderItems as { seller_id: string | null }[]).forEach(item => {
            if (item.seller_id) {
              sellerIds.add(item.seller_id);
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
      // Delivery confirmed — immediately invite the buyer to review it.
      setReviewPromptOrderId(orderToConfirm);
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
      { label: 'Order placed', completed: true, icon: ShoppingBag },
      { label: 'Payment confirmed', completed: order.status !== 'pending', icon: DollarSign },
      { label: 'In transit', completed: order.shipped_at !== null, icon: Truck },
      { label: 'Delivered', completed: order.confirmed_by_buyer, icon: Package },
    ];
    return steps;
  };

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-gray-50">
        <div className="h-11 w-11 animate-spin rounded-full border-2 border-gray-200 border-t-[#07513B]" />
      </div>
    );
  }

  const stats = getStats();

  return (
    <main className="min-h-screen bg-gray-50 pb-24 lg:pb-12">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <header className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#07513B]">Buyer center</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">Purchases &amp; orders</h1>
          <p className="mt-2 text-sm text-gray-500 sm:text-base">Track your purchases, delivery progress, and order history.</p>
        </header>

        <section aria-label="Order statistics" className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4 lg:gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#CFE8AC] bg-[#F2FAE8] p-4 text-[#07513B]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white"><ShoppingBag className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold text-[#07513B]/70">Total orders</p><p className="mt-0.5 text-2xl font-black text-[#032F24]">{stats.totalOrders}</p></div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#BFE89A] bg-[#E4F7C9] p-4 text-[#07513B]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80"><DollarSign className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold text-[#07513B]/70">Total spent</p><p className="mt-0.5 text-2xl font-black text-[#032F24]">${stats.totalSpent.toFixed(0)}</p></div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#E7D185] bg-[#FFF4CC] p-4 text-[#735400]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80"><Truck className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold text-[#735400]/75">Active orders</p><p className="mt-0.5 text-2xl font-black text-[#5A4300]">{stats.activeOrders}</p></div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#C7E5D8] bg-[#EEF8F4] p-4 text-[#07513B]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white"><CheckCircle className="h-5 w-5" /></span>
            <div><p className="text-xs font-bold text-[#07513B]/70">Completed</p><p className="mt-0.5 text-2xl font-black text-[#032F24]">{stats.deliveredOrders}</p></div>
          </div>
        </section>

        <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-3 lg:mb-0">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex min-h-10 items-center gap-2 rounded-full bg-[#F2FAE8] px-4 text-sm font-bold text-[#07513B] transition hover:bg-[#E4F7C9] lg:hidden"
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            <div className="hidden lg:flex items-center gap-4 flex-1">
              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="min-h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm focus:border-[#07513B] focus:outline-none focus:ring-2 focus:ring-[#07513B]/20"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Processing</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-bold text-gray-700">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="min-h-10 rounded-xl border border-gray-300 bg-white px-3 text-sm focus:border-[#07513B] focus:outline-none focus:ring-2 focus:ring-[#07513B]/20"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="highest">Highest Price</option>
                  <option value="lowest">Lowest Price</option>
                </select>
              </div>

              <div className="ml-auto rounded-full bg-[#F2FAE8] px-3 py-1.5 text-sm font-bold text-[#07513B]">
                {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'}
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="mt-3 space-y-3 lg:hidden">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Status</label>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base focus:border-[#07513B] focus:outline-none focus:ring-2 focus:ring-[#07513B]/20"
                >
                  <option value="all">All Orders</option>
                  <option value="pending">Processing</option>
                  <option value="paid">Paid</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-700">Sort by</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base focus:border-[#07513B] focus:outline-none focus:ring-2 focus:ring-[#07513B]/20"
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
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <EmptyStateDisplay
              icon={Package}
              title="No orders found"
              description={filterStatus === 'all' ? 'You haven\'t placed any orders yet' : 'No orders with this status'}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => {
              const steps = getOrderProgress(order);
              const completedSteps = steps.filter((step) => step.completed).length;
              const currentStepIndex = Math.max(0, completedSteps - 1);
              return (
                <article
                  key={order.id}
                  className={`overflow-hidden rounded-2xl border border-gray-200 border-l-4 bg-white transition hover:border-gray-300 hover:shadow-sm ${
                    order.confirmed_by_buyer
                      ? 'border-l-[#07513B]'
                      : order.shipped_at
                        ? 'border-l-[#9BEC2D]'
                        : 'border-l-[#B8860B]'
                  }`}
                >
                  <div className="p-3 sm:p-4">
                    <div className="mb-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="truncate text-base font-black text-gray-950 sm:text-lg">Order #{order.order_number}</h3>
                          <OrderStatusBadge status={order.status} size="sm" />
                        </div>
                        <p className="mt-1.5 inline-flex items-center gap-1.5 text-xs text-gray-500 sm:text-sm">
                          <CalendarDays className="h-4 w-4 text-[#07513B]" />
                          {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="rounded-xl bg-[#F2FAE8] px-3 py-2 text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-[#07513B]/65">Order total</p>
                          <p className="text-xl font-black leading-tight text-[#07513B]">${order.total_amount.toFixed(2)}</p>
                        </div>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-[#CFE8AC] bg-white px-3 text-xs font-bold text-[#07513B] transition hover:bg-[#F2FAE8]"
                        >
                          <Eye className="h-4 w-4" />
                          <span>View</span>
                        </button>
                      </div>
                    </div>

                    <section className="mb-4 rounded-xl border border-[#E1EADB] bg-[#FAFCF8] px-1 py-3 sm:px-3" aria-label={`Progress for order ${order.order_number}`}>
                      <div className="relative grid grid-cols-4">
                        <div className="absolute left-[12.5%] right-[12.5%] top-5 h-0.5 rounded-full bg-gray-200">
                          <div
                            className="h-full rounded-full bg-[#07513B] transition-all duration-500"
                            style={{ width: `${Math.max(0, (completedSteps - 1) / (steps.length - 1) * 100)}%` }}
                          />
                        </div>
                        {steps.map((step, idx) => {
                          const StepIcon = step.icon;
                          const isCurrent = idx === currentStepIndex;
                          return (
                            <div key={step.label} className="relative z-10 flex min-w-0 flex-col items-center px-1 text-center">
                              <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition ${
                                isCurrent
                                  ? 'border-[#9BEC2D] bg-[#9BEC2D] text-[#032F24] shadow-[0_0_0_4px_rgba(155,236,45,0.18)]'
                                  : step.completed
                                    ? 'border-[#07513B] bg-[#07513B] text-white'
                                    : 'border-gray-200 bg-white text-gray-400'
                              }`}>
                                <StepIcon className="h-4.5 w-4.5" />
                              </div>
                              <p className={`mt-1.5 text-[9px] font-bold leading-tight sm:text-[11px] ${
                                step.completed || isCurrent ? 'text-[#07513B]' : 'text-gray-400'
                              }`}>
                                {step.label}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </section>

                    <div className="mb-4 border-t border-gray-100 pt-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h4 className="text-sm font-black text-gray-950">Products</h4>
                        <span className="rounded-full bg-[#F2FAE8] px-2.5 py-1 text-xs font-bold text-[#07513B]">
                          {order.order_items.length} {order.order_items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {order.order_items?.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-3 rounded-xl border border-[#E4ECDD] bg-[#FAFCF8] p-2">
                            <img
                              src={item.products.image_url}
                              alt={item.products.title}
                              className="h-12 w-12 shrink-0 rounded-lg object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-gray-900">{item.products.title}</p>
                              <p className="mt-0.5 text-xs text-gray-500">{item.quantity} × ${item.price.toFixed(2)} each</p>
                              <p className="mt-0.5 text-sm font-black text-[#07513B]">${(item.price * item.quantity).toFixed(2)}</p>
                            </div>
                            <button
                              onClick={() => {
                                setSelectedProduct(item.products);
                                setShowProductModal(true);
                              }}
                              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-gray-300 bg-white px-3 text-xs font-bold text-gray-700 transition hover:border-[#07513B] hover:text-[#07513B]"
                            >
                              <Eye className="h-4 w-4" />
                              <span className="hidden sm:inline">Details</span>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.tracking_number && (
                      <div className="mb-3 rounded-xl border border-[#CFE8AC] bg-[#F2FAE8] p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-black text-[#032F24]">Shipping information</p>
                            <p className="mt-2 text-sm text-gray-700">
                              Shipping company: <span className="font-bold">{order.shipping_company}</span>
                            </p>
                            <p className="mt-1 text-sm text-gray-700">
                              Tracking number: <span className="font-bold">{order.tracking_number}</span>
                            </p>
                            {order.shipped_at && (
                              <p className="mt-1 text-xs text-gray-500">
                                Shipped {new Date(order.shipped_at).toLocaleDateString('en-US')}
                              </p>
                            )}
                          </div>
                          <a
                            href={getTrackingUrl(order.shipping_company || '', order.tracking_number)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#07513B] px-5 text-sm font-bold text-white transition hover:bg-[#032F24]"
                          >
                            <span>Track shipment</span>
                            <ExternalLink className="h-4 w-4" />
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
                        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#07513B] px-5 text-sm font-bold text-white transition hover:bg-[#032F24] disabled:opacity-50"
                      >
                        <CheckCircle className="h-5 w-5" />
                        {confirming === order.id ? 'Confirming...' : 'Confirm Order Received'}
                      </button>
                    )}

                    {order.confirmed_by_buyer && (
                      <div className="rounded-xl border border-[#CFE8AC] bg-[#E4F7C9] p-3">
                        <p className="flex items-center gap-2 text-sm font-bold text-[#07513B]">
                          <CheckCircle className="h-4 w-4" />
                          Order receipt confirmed successfully
                        </p>
                      </div>
                    )}

                    {(order.confirmed_by_buyer || order.status === 'delivered') && (
                      isOrderFullyReviewed(order) ? (
                        <button
                          onClick={() => navigate(`/review/${order.id}`)}
                          className="mt-3 flex w-full items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-gray-500 transition hover:text-[#07513B]"
                        >
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          Review submitted — view your review
                        </button>
                      ) : (
                        <button
                          onClick={() => navigate(`/review/${order.id}`)}
                          className="mt-3 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-[#CFE8AC] bg-white px-4 text-sm font-bold text-[#07513B] transition hover:bg-[#F2FAE8]"
                        >
                          <Star className="w-4 h-4 sm:w-5 sm:h-5" />
                          Write a Review
                        </button>
                      )
                    )}
                  </div>
                </article>
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

      {reviewPromptOrderId && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-2xl sm:p-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
              <CheckCircle className="h-9 w-9 text-green-600" />
            </div>
            <h3 className="mb-2 text-xl font-black text-gray-900">Order Received! 🎉</h3>
            <p className="mb-1 text-gray-700">Thanks for confirming your delivery.</p>
            <p className="mb-6 text-sm text-gray-500">
              How was your purchase? Your rating helps other shoppers and supports the seller.
            </p>
            <div className="mb-4 flex justify-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => navigate(`/review/${reviewPromptOrderId}?rating=${star}`)}
                  aria-label={`Rate ${star} out of 5`}
                  className="p-1 transition hover:scale-125"
                >
                  <Star className="h-8 w-8 fill-yellow-400 text-yellow-400" />
                </button>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                onClick={() => navigate(`/review/${reviewPromptOrderId}`)}
                className="flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-teal-600 to-emerald-600 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:from-teal-700 hover:to-emerald-700"
              >
                <Star className="h-4 w-4" />
                Write a Review
              </button>
              <button
                onClick={() => setReviewPromptOrderId(null)}
                className="rounded-full border border-gray-300 px-8 py-3 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Maybe Later
              </button>
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
        description="Are you sure you received this order? This action cannot be undone."
        confirmText="Yes, I Received It"
        cancelText="Cancel"
      />
    </main>
  );
}
