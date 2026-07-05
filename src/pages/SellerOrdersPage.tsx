import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  CalendarDays, CheckCircle, Clock, ExternalLink, Landmark, Mail,
  MapPin, Package, ShoppingBag, Truck, UserRound, X, TrendingUp,
} from 'lucide-react';
import OrderStatusBadge from '../components/OrderStatusBadge';
import EmptyStateDisplay from '../components/EmptyStateDisplay';

interface Order {
  id: string;
  user_id: string;
  auction_id: string | null;
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
    seller_id: string;
    products: {
      title: string;
      image_url: string;
    } | null;
  }[];
}

function sellerSubtotal(order: Order): number {
  return order.order_items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

export default function SellerOrdersPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [hasPayoutDetails, setHasPayoutDetails] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showShippingModal, setShowShippingModal] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [shippingCompany, setShippingCompany] = useState('');
  const [updating, setUpdating] = useState(false);
  const [updateError, setUpdateError] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'to_ship' | 'shipped' | 'completed'>('all');

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
          loadOrders(true);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadOrders = async (silent = false) => {
    try {
      if (!silent) setLoading(true);

      // !inner + the embedded filter scopes both the parent orders AND the
      // embedded items to this seller — other sellers' items in a shared
      // order are never fetched.
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items!inner (
            product_id,
            quantity,
            price,
            product_title,
            product_image,
            seller_id,
            products (
              title,
              image_url
            )
          )
        `)
        .eq('order_items.seller_id', user?.id)
        // checkout inserts the order before payment; unpaid/abandoned orders
        // are not the seller's business
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);

      const { data: payout } = await supabase
        .from('seller_payout_details')
        .select('id')
        .eq('user_id', user?.id)
        .maybeSingle();
      setHasPayoutDetails(Boolean(payout));
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
    setUpdateError('');
    setShowShippingModal(true);
  };

  const handleUpdateTracking = async () => {
    if (!selectedOrder || !trackingNumber || !shippingCompany) {
      return;
    }

    try {
      setUpdating(true);
      setUpdateError('');

      // Sellers have no direct UPDATE access to orders; this SECURITY DEFINER
      // function verifies ownership, updates shipping fields only, and
      // notifies the buyer atomically.
      const { error } = await supabase.rpc('mark_order_shipped', {
        p_order_id: selectedOrder.id,
        p_shipping_company: shippingCompany,
        p_tracking_number: trackingNumber,
      });

      if (error) throw error;

      // Auction orders paid via Stripe hold: shipping releases the money.
      // Failures here are non-fatal — the hourly maintenance job captures
      // any shipped-but-uncaptured hold automatically.
      if (selectedOrder.auction_id) {
        try {
          await supabase.functions.invoke('capture-stripe-auction-payment', {
            body: { orderId: selectedOrder.id },
          });
        } catch (captureError) {
          console.error('Stripe capture call failed (maintenance will retry):', captureError);
        }
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
      setUpdateError(error instanceof Error ? error.message : 'Failed to save shipping information.');
    } finally {
      setUpdating(false);
    }
  };

  const getStats = () => {
    const totalOrders = orders.length;
    const totalEarningsPending = orders
      .filter(order => !order.payment_released)
      .reduce((sum, order) => sum + (order.seller_amount || sellerSubtotal(order) * 0.9), 0);
    const totalEarningsTransferred = orders
      .filter(order => order.payment_released)
      .reduce((sum, order) => sum + (order.seller_amount || 0), 0);
    const totalCommissionDeducted = orders
      .filter(order => order.payment_released && order.admin_commission)
      .reduce((sum, order) => sum + (order.admin_commission || 0), 0);
    // Keep these in sync with the filter-tab definitions below
    const pendingShipment = orders.filter(order => !order.tracking_number && !['delivered', 'cancelled'].includes(order.status)).length;
    const completedOrders = orders.filter(order => order.confirmed_by_buyer).length;

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
      <div className="flex min-h-[70vh] items-center justify-center bg-gray-50">
        <div className="h-11 w-11 animate-spin rounded-full border-2 border-gray-200 border-t-[#07513B]" />
      </div>
    );
  }

  const stats = getStats();

  const filteredOrders = orders.filter((order) => {
    switch (filterStatus) {
      case 'to_ship':
        return !order.tracking_number && !['delivered', 'cancelled'].includes(order.status);
      case 'shipped':
        return Boolean(order.tracking_number) && !order.confirmed_by_buyer && order.status !== 'cancelled';
      case 'completed':
        return order.confirmed_by_buyer;
      default:
        return true;
    }
  });

  const filterOptions: { value: typeof filterStatus; label: string; count: number }[] = [
    { value: 'all', label: 'All', count: orders.length },
    { value: 'to_ship', label: 'To ship', count: stats.pendingShipment },
    {
      value: 'shipped',
      label: 'Shipped',
      count: orders.filter((order) => Boolean(order.tracking_number) && !order.confirmed_by_buyer && order.status !== 'cancelled').length,
    },
    { value: 'completed', label: 'Completed', count: stats.completedOrders },
  ];

  return (
    <main className="min-h-screen bg-gray-50 pb-24 lg:pb-12">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <header className="mb-8">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#07513B]">Seller center</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">Sales &amp; orders</h1>
          <p className="mt-2 text-sm text-gray-500 sm:text-base">Manage customer orders, shipping, and your earnings.</p>
        </header>

        {hasPayoutDetails === false && stats.totalEarningsPending > 0 && (
          <div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Landmark className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-bold text-amber-950">Add your payout details</p>
                  <p className="mt-1 text-sm text-amber-800">
                    You have ${stats.totalEarningsPending.toFixed(2)} pending. Add a bank account or PayPal account to receive your earnings.
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/settings')}
                className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full bg-amber-700 px-5 text-sm font-bold text-white transition hover:bg-amber-800"
              >
                Add payout details
              </button>
            </div>
          </div>
        )}

        <section aria-label="Order statistics" className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[#CFE8AC] bg-[#F2FAE8] p-4 text-[#07513B]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white">
              <ShoppingBag className="h-5 w-5" />
            </span>
            <div><p className="text-xs font-bold text-[#07513B]/70">Total orders</p><p className="mt-0.5 text-2xl font-black text-[#032F24]">{stats.totalOrders}</p></div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#BFE89A] bg-[#E4F7C9] p-4 text-[#07513B]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80">
              <CheckCircle className="h-5 w-5" />
            </span>
            <div><p className="text-xs font-bold text-[#07513B]/70">Completed</p><p className="mt-0.5 text-2xl font-black text-[#032F24]">{stats.completedOrders}</p></div>
          </div>

          <div className="flex items-center gap-3 rounded-2xl border border-[#E7D185] bg-[#FFF4CC] p-4 text-[#735400]">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80">
              <Truck className="h-5 w-5" />
            </span>
            <div><p className="text-xs font-bold text-[#735400]/75">Ready to ship</p><p className="mt-0.5 text-2xl font-black text-[#5A4300]">{stats.pendingShipment}</p></div>
          </div>
        </section>

        <section className="mb-8 overflow-hidden rounded-2xl border border-[#07513B]/15 bg-white" aria-labelledby="earnings-heading">
          <div className="flex items-center gap-3 border-b border-[#CFE8AC] bg-[#F2FAE8] px-4 py-4 text-[#07513B] sm:px-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#07513B]">
              <TrendingUp className="h-5 w-5" />
            </span>
            <div>
              <h2 id="earnings-heading" className="font-black">Earnings overview</h2>
              <p className="text-xs text-[#07513B]/65">Your payout summary at a glance</p>
            </div>
          </div>
          <div className="grid gap-3 bg-[#F8FAF8] p-3 sm:grid-cols-3 sm:p-4">
            <div className="rounded-xl border border-[#E7D185] bg-[#FFF4CC] p-4">
              <p className="text-sm font-bold text-[#735400]">Pending transfer</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-[#5A4300]">${stats.totalEarningsPending.toFixed(2)}</p>
              <p className="mt-1 text-xs text-[#735400]/70">Awaiting payout</p>
            </div>
            <div className="rounded-xl border border-[#CFE8AC] bg-[#E4F7C9] p-4">
              <p className="text-sm font-bold text-[#07513B]">Transferred</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-[#032F24]">${stats.totalEarningsTransferred.toFixed(2)}</p>
              <p className="mt-1 text-xs text-[#07513B]/65">Paid to your account</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-bold text-gray-600">Platform fees</p>
              <p className="mt-2 text-2xl font-black tracking-tight text-gray-950">${stats.totalCommissionDeducted.toFixed(2)}</p>
              <p className="mt-1 text-xs text-gray-400">Commission deducted</p>
            </div>
          </div>
        </section>

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-gray-950">Orders</h2>
            <p className="mt-1 text-sm text-gray-500">
              {filteredOrders.length} {filteredOrders.length === 1 ? 'order' : 'orders'} in this view
            </p>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" aria-label="Filter orders by status">
            {filterOptions.map(({ value, label, count }) => (
              <button
                key={value}
                onClick={() => setFilterStatus(value)}
                aria-pressed={filterStatus === value}
                className={`inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-bold transition ${
                  filterStatus === value
                    ? 'border border-[#9BEC2D] bg-[#E4F7C9] text-[#07513B]'
                    : 'border border-gray-300 bg-white text-gray-700 hover:border-[#CFE8AC] hover:bg-[#F2FAE8] hover:text-[#07513B]'
                }`}
              >
                {label}
                <span className={`flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] ${
                  filterStatus === value ? 'bg-white/70 text-[#07513B]' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <EmptyStateDisplay
              icon={Package}
              title="No orders found"
              description={filterStatus === 'all' ? "You haven't received any orders for your products yet" : 'No orders match this filter'}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <article
                key={order.id}
                className={`rounded-2xl border border-gray-200 border-l-4 bg-white p-4 transition hover:border-gray-300 hover:shadow-sm sm:p-6 ${
                  order.confirmed_by_buyer
                    ? 'border-l-[#07513B]'
                    : order.tracking_number
                      ? 'border-l-[#9BEC2D]'
                      : 'border-l-[#B8860B]'
                }`}
              >
                <div className="mb-5 flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-black text-gray-950 sm:text-lg">Order #{order.order_number}</h3>
                      <OrderStatusBadge status={order.status} size="sm" />
                      {order.payment_released ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F2FAE8] px-2.5 py-1 text-xs font-bold text-[#07513B]">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Paid out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                          <Clock className="h-3.5 w-3.5" />
                          Payout pending
                        </span>
                      )}
                    </div>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-gray-500">
                      <CalendarDays className="h-4 w-4 text-[#07513B]" />
                      {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[#F2FAE8] px-4 py-3 sm:min-w-52">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#07513B]">Your items total</p>
                    <p className="mt-1 text-2xl font-black text-[#032F24]">${sellerSubtotal(order).toFixed(2)}</p>
                    {order.admin_commission && order.seller_amount ? (
                      <div className="mt-2 space-y-1 border-t border-[#CFE8AC] pt-2 text-xs">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-gray-600">Commission</span>
                          <span className="font-bold text-red-600">-${order.admin_commission.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-gray-700">Your earnings</span>
                          <span className="font-black text-[#07513B]">${order.seller_amount.toFixed(2)}</span>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-1 text-xs text-gray-600">
                        Estimated earnings <span className="font-black text-[#07513B]">${(sellerSubtotal(order) * 0.9).toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-5">
                  <h4 className="mb-3 text-sm font-black text-gray-950">Buyer information</h4>
                  <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                    <div className="flex items-center gap-3 rounded-xl border border-[#CFE8AC] bg-[#F2FAE8] p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#07513B]">
                        <UserRound className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#07513B]/65">Buyer</p>
                        <p className="mt-0.5 truncate font-bold text-[#032F24]">{order.buyer_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl border border-[#E7D185] bg-[#FFF9E6] p-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[#8A6500]">
                        <Mail className="h-4 w-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold uppercase tracking-wide text-[#735400]/65">Email</p>
                        <p className="mt-0.5 truncate font-bold text-[#5A4300]" title={order.buyer_email}>{order.buyer_email}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:col-span-2">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-[#07513B]">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-wide text-gray-400">Shipping address</p>
                        <p className="mt-0.5 leading-relaxed text-gray-700">{order.shipping_address}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-5 border-t border-gray-100 pt-5">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-sm font-black text-gray-950">Products</h4>
                    <span className="rounded-full bg-[#F2FAE8] px-2.5 py-1 text-xs font-bold text-[#07513B]">
                      {order.order_items.length} {order.order_items.length === 1 ? 'item' : 'items'}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {order.order_items?.map((item, idx) => {
                      const title = item.products?.title || item.product_title;
                      const imageUrl = item.products?.image_url || item.product_image || '/placeholder.png';
                      const isDeleted = !item.products;

                      return (
                        <div key={idx} className="flex items-center gap-3 rounded-xl border border-[#E4ECDD] bg-[#FAFCF8] p-2.5 sm:p-3">
                          <img
                            src={imageUrl}
                            alt={title}
                            className="h-14 w-14 shrink-0 rounded-lg object-cover sm:h-16 sm:w-16"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-bold text-gray-900">
                              {title}
                              {isDeleted && (
                                <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-[10px] text-red-600">Deleted</span>
                              )}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">{item.quantity} × ${item.price.toFixed(2)} each</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Total</p>
                            <p className="mt-0.5 text-sm font-black text-[#07513B]">${(item.price * item.quantity).toFixed(2)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {order.tracking_number ? (
                  <div className="rounded-xl border border-[#CFE8AC] bg-[#F2FAE8] p-4">
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
                ) : (
                  <div className="flex flex-col gap-4 rounded-xl border border-[#E7D185] bg-[#FFF4CC] p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#8A6500]">
                        <Truck className="h-5 w-5" />
                      </span>
                      <div>
                        <p className="text-sm font-black text-[#5A4300]">Ready to ship</p>
                        <p className="mt-0.5 text-xs text-[#735400]/75">Add the carrier and tracking number</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddTracking(order)}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#07513B] px-5 text-sm font-bold text-white transition hover:bg-[#032F24]"
                    >
                      Add shipping information
                    </button>
                  </div>
                )}

                {order.payment_released ? (
                  <div className="mt-3 rounded-xl border border-[#CFE8AC] bg-[#E4F7C9] p-4">
                    <div className="flex items-start gap-3">
                      <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#07513B]" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#032F24]">
                          Payment transferred
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#07513B]/80">
                          ${order.seller_amount?.toFixed(2)} was transferred to your registered payout account on {new Date(order.payment_released_at!).toLocaleDateString('en-US')}.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-[#E7D185] bg-[#FFF9E6] p-4">
                    <div className="flex items-start gap-3">
                      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-[#8A6500]" />
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#5A4300]">
                          Payment pending transfer
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-[#735400]/80">
                          Your earnings of ${order.seller_amount ? order.seller_amount.toFixed(2) : (sellerSubtotal(order) * 0.9).toFixed(2)} will be transferred after the order is processed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}
      </div>

      {showShippingModal && selectedOrder && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={updating ? undefined : () => setShowShippingModal(false)}>
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-[#07513B]">Order #{selectedOrder.order_number}</p>
                <h2 className="mt-2 text-xl font-black text-gray-950 sm:text-2xl">Add shipping information</h2>
              </div>
              <button
                onClick={() => setShowShippingModal(false)}
                disabled={updating}
                aria-label="Close shipping form"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 disabled:opacity-50"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mb-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-bold text-gray-800" htmlFor="shipping-company">
                  Shipping company <span className="text-red-500">*</span>
                </label>
                <select
                  id="shipping-company"
                  value={shippingCompany}
                  onChange={(e) => setShippingCompany(e.target.value)}
                  className="min-h-12 w-full rounded-xl border border-gray-300 bg-white px-4 text-base text-gray-900 transition focus:border-[#07513B] focus:outline-none focus:ring-2 focus:ring-[#07513B]/20"
                >
                  <option value="">Select shipping company</option>
                  <option value="SMSA">SMSA Express</option>
                  <option value="Aramex">Aramex</option>
                  <option value="DHL">DHL</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-bold text-gray-800" htmlFor="tracking-number">
                  Tracking number <span className="text-red-500">*</span>
                </label>
                <input
                  id="tracking-number"
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                  className="min-h-12 w-full rounded-xl border border-gray-300 px-4 text-base text-gray-900 transition focus:border-[#07513B] focus:outline-none focus:ring-2 focus:ring-[#07513B]/20"
                />
              </div>
            </div>

            {updateError && (
              <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{updateError}</p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <button
                onClick={() => setShowShippingModal(false)}
                disabled={updating}
                className="min-h-12 flex-1 rounded-full border border-gray-300 px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateTracking}
                disabled={updating || !trackingNumber || !shippingCompany}
                className="min-h-12 flex-1 rounded-full bg-[#07513B] px-4 text-sm font-bold text-white transition hover:bg-[#032F24] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updating ? 'Saving...' : 'Save shipment'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
