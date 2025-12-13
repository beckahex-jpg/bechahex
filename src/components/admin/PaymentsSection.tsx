import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  DollarSign,
  CheckCircle,
  Clock,
  User,
  Package,
  Eye,
  Calendar,
  TrendingUp,
  Search,
  Filter,
  CreditCard,
  Truck,
  AlertCircle,
  X,
  Download,
  Users,
  BarChart3
} from 'lucide-react';

interface PaymentOrder {
  id: string;
  order_number?: string;
  user_id: string;
  seller_id?: string;
  total_amount: number;
  admin_commission?: number;
  seller_amount?: number;
  payment_status: string;
  payment_method?: string;
  payment_released: boolean;
  payment_released_at: string | null;
  confirmed_by_buyer: boolean;
  delivered_at: string | null;
  shipped_at: string | null;
  tracking_number?: string;
  shipping_company?: string;
  status: string;
  created_at: string;
  shipping_address?: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
  seller_profiles?: {
    full_name: string;
    email: string;
  } | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price: number;
  products: {
    title: string;
    image_url: string;
  };
}

type ViewType = 'all' | 'pending_payouts' | 'completed_payouts' | 'history';
type PaymentMethodFilter = 'all' | 'card' | 'cash_on_delivery' | 'paypal';

export default function PaymentsSection() {
  const [orders, setOrders] = useState<PaymentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewType, setViewType] = useState<ViewType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter>('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [releasing, setReleasing] = useState<string | null>(null);
  const [commissionRate, setCommissionRate] = useState(10);
  const [selectedOrder, setSelectedOrder] = useState<PaymentOrder | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false });

      console.log('PaymentsSection - Orders data:', ordersData);
      console.log('PaymentsSection - Error:', error);

      if (error) throw error;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      const userIds = [...new Set(ordersData.map(o => o.user_id).filter(Boolean))];
      const sellerIds = [...new Set(ordersData.map(o => o.seller_id).filter(Boolean))];

      const buyersPromise = userIds.length > 0
        ? supabase.from('profiles').select('id, full_name, email').in('id', userIds)
        : Promise.resolve({ data: [], error: null });

      const sellersPromise = sellerIds.length > 0
        ? supabase.from('profiles').select('id, full_name, email').in('id', sellerIds)
        : Promise.resolve({ data: [], error: null });

      const [buyersRes, sellersRes] = await Promise.all([buyersPromise, sellersPromise]);

      const buyersMap = new Map((buyersRes.data || []).map(p => [p.id, p]));
      const sellersMap = new Map((sellersRes.data || []).map(p => [p.id, p]));

      const ordersWithProfiles = ordersData.map(order => ({
        ...order,
        profiles: buyersMap.get(order.user_id) || null,
        seller_profiles: order.seller_id ? (sellersMap.get(order.seller_id) || null) : null,
      }));

      console.log('PaymentsSection - Orders with profiles:', ordersWithProfiles);
      setOrders(ordersWithProfiles);
    } catch (error) {
      console.error('PaymentsSection - Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAmounts = (totalAmount: number) => {
    const commission = (totalAmount * commissionRate) / 100;
    const sellerAmount = totalAmount - commission;
    return { commission, sellerAmount };
  };

  const handleReleasePayment = async (order: PaymentOrder) => {
    const { commission, sellerAmount } = calculateAmounts(order.total_amount);

    if (!confirm(`Confirm payment release:\n\nOrder Total: $${order.total_amount.toFixed(2)}\nAdmin Commission (${commissionRate}%): $${commission.toFixed(2)}\nSeller Amount: $${sellerAmount.toFixed(2)}\n\nTransfer $${sellerAmount.toFixed(2)} to seller?`)) {
      return;
    }

    try {
      setReleasing(order.id);

      const { error } = await supabase
        .from('orders')
        .update({
          payment_released: true,
          payment_released_at: new Date().toISOString(),
          admin_commission: commission,
          seller_amount: sellerAmount,
          status: 'completed'
        })
        .eq('id', order.id);

      if (error) throw error;

      if (order.seller_id) {
        await supabase.from('notifications').insert({
          user_id: order.seller_id,
          title: 'Payment Released',
          message: `Payment of $${sellerAmount.toFixed(2)} has been released for your order.`,
          type: 'success'
        });
      }

      await loadOrders();
      if (selectedOrder?.id === order.id) {
        setShowDetailsModal(false);
        setSelectedOrder(null);
      }
    } catch (error) {
      console.error('Error releasing payment:', error);
      alert('Error releasing payment. Please try again.');
    } finally {
      setReleasing(null);
    }
  };

  const handleViewDetails = async (order: PaymentOrder) => {
    try {
      setSelectedOrder(order);
      setShowDetailsModal(true);

      const { data, error } = await supabase
        .from('order_items')
        .select(`
          *,
          products (
            title,
            image_url
          )
        `)
        .eq('order_id', order.id);

      if (error) throw error;
      setOrderItems(data || []);
    } catch (error) {
      console.error('Error loading order details:', error);
    }
  };

  const filterOrders = () => {
    let filtered = [...orders];

    if (viewType === 'pending_payouts') {
      filtered = filtered.filter(o => !o.payment_released && o.confirmed_by_buyer);
    } else if (viewType === 'completed_payouts') {
      filtered = filtered.filter(o => o.payment_released);
    }

    if (paymentMethodFilter !== 'all') {
      filtered = filtered.filter(o => o.payment_method === paymentMethodFilter);
    }

    if (dateFilter !== 'all') {
      const now = new Date();
      const startDate = new Date();

      if (dateFilter === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (dateFilter === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (dateFilter === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      }

      filtered = filtered.filter(o => new Date(o.created_at) >= startDate);
    }

    if (searchQuery) {
      filtered = filtered.filter(o =>
        o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        o.seller_profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const filteredOrders = filterOrders();

  const totalRevenue = orders.reduce((sum, o) => sum + o.total_amount, 0);
  const totalPendingPayouts = orders
    .filter(o => !o.payment_released && o.confirmed_by_buyer)
    .reduce((sum, o) => sum + o.total_amount, 0);
  const totalReleasedToSellers = orders
    .filter(o => o.payment_released)
    .reduce((sum, o) => sum + (o.seller_amount || 0), 0);
  const totalCommissionEarned = orders
    .filter(o => o.payment_released)
    .reduce((sum, o) => sum + (o.admin_commission || 0), 0);

  const todayRevenue = orders
    .filter(o => {
      const orderDate = new Date(o.created_at);
      const today = new Date();
      return orderDate.toDateString() === today.toDateString();
    })
    .reduce((sum, o) => sum + o.total_amount, 0);

  const weekRevenue = orders
    .filter(o => {
      const orderDate = new Date(o.created_at);
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      return orderDate >= weekAgo;
    })
    .reduce((sum, o) => sum + o.total_amount, 0);

  const monthRevenue = orders
    .filter(o => {
      const orderDate = new Date(o.created_at);
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return orderDate >= monthAgo;
    })
    .reduce((sum, o) => sum + o.total_amount, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payments Management</h1>
        <p className="text-gray-600">Manage all payments, seller payouts, and commission tracking</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-green-600 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <TrendingUp className="w-5 h-5 text-green-600" />
          </div>
          <p className="text-sm text-green-700 font-medium mb-1">Total Revenue</p>
          <p className="text-3xl font-bold text-green-900">${totalRevenue.toFixed(2)}</p>
          <p className="text-xs text-green-600 mt-2">All paid orders</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-2 border-yellow-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-yellow-600 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-yellow-700 font-medium mb-1">Pending Payouts</p>
          <p className="text-3xl font-bold text-yellow-900">${totalPendingPayouts.toFixed(2)}</p>
          <p className="text-xs text-yellow-600 mt-2">
            {orders.filter(o => !o.payment_released && o.confirmed_by_buyer).length} orders awaiting
          </p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-blue-700 font-medium mb-1">Released to Sellers</p>
          <p className="text-3xl font-bold text-blue-900">${totalReleasedToSellers.toFixed(2)}</p>
          <p className="text-xs text-blue-600 mt-2">
            {orders.filter(o => o.payment_released).length} completed payouts
          </p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 border-2 border-purple-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-purple-600 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
          <p className="text-sm text-purple-700 font-medium mb-1">Commission Earned</p>
          <p className="text-3xl font-bold text-purple-900">${totalCommissionEarned.toFixed(2)}</p>
          <p className="text-xs text-purple-600 mt-2">Platform revenue</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Today's Revenue</p>
              <p className="text-2xl font-bold text-gray-900">${todayRevenue.toFixed(2)}</p>
            </div>
            <Calendar className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">This Week</p>
              <p className="text-2xl font-bold text-gray-900">${weekRevenue.toFixed(2)}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-gray-400" />
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">This Month</p>
              <p className="text-2xl font-bold text-gray-900">${monthRevenue.toFixed(2)}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-gray-400" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-5 h-5 text-gray-600" />
          <label className="text-sm font-semibold text-gray-700">
            Commission Rate (%)
          </label>
        </div>
        <input
          type="number"
          min="0"
          max="100"
          step="0.1"
          value={commissionRate}
          onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
          className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
        />
        <p className="text-xs text-gray-500 mt-2">
          This rate will be applied when releasing payments to sellers
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl mb-6">
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search orders, customers, sellers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>

            <div className="flex gap-2">
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value as PaymentMethodFilter)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Methods</option>
                <option value="card">Card</option>
                <option value="cash_on_delivery">Cash on Delivery</option>
                <option value="paypal">PayPal</option>
              </select>

              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="all">All Time</option>
                <option value="today">Today</option>
                <option value="week">This Week</option>
                <option value="month">This Month</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setViewType('all')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              viewType === 'all'
                ? 'bg-green-50 text-green-700 border-b-2 border-green-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            All Payments ({orders.length})
          </button>
          <button
            onClick={() => setViewType('pending_payouts')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              viewType === 'pending_payouts'
                ? 'bg-yellow-50 text-yellow-700 border-b-2 border-yellow-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Pending Payouts ({orders.filter(o => !o.payment_released && o.confirmed_by_buyer).length})
          </button>
          <button
            onClick={() => setViewType('completed_payouts')}
            className={`flex-1 px-6 py-3 font-medium transition ${
              viewType === 'completed_payouts'
                ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Completed Payouts ({orders.filter(o => o.payment_released).length})
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Order Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payout Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => {
                const { commission, sellerAmount } = calculateAmounts(order.total_amount);

                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-mono font-medium text-gray-900">
                          #{order.id.slice(0, 8)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {order.profiles?.full_name || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-500">{order.profiles?.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          ${order.total_amount.toFixed(2)}
                        </p>
                        {order.payment_released && (
                          <p className="text-xs text-gray-500">
                            Seller: ${sellerAmount.toFixed(2)}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1">
                        <CreditCard className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          {order.payment_method || 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Calendar className="w-4 h-4" />
                        {new Date(order.created_at).toLocaleDateString()}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {order.payment_released ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                          <CheckCircle className="w-3 h-3" />
                          Released
                        </span>
                      ) : order.confirmed_by_buyer ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                          <Clock className="w-3 h-3" />
                          Ready
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold">
                          <AlertCircle className="w-3 h-3" />
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleViewDetails(order)}
                        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium text-sm"
                      >
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredOrders.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 font-medium">No payments found</p>
              <p className="text-sm text-gray-500 mt-1">Try adjusting your filters</p>
            </div>
          )}
        </div>
      </div>

      {showDetailsModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 sticky top-0 bg-white flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Payment Details</h2>
                <p className="text-sm text-gray-600">Order ID: #{selectedOrder.id.slice(0, 8)}</p>
              </div>
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedOrder(null);
                  setOrderItems([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-600" />
                    Customer Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <p className="font-medium text-gray-900">{selectedOrder.profiles?.full_name}</p>
                    <p className="text-gray-600">{selectedOrder.profiles?.email}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-gray-600" />
                    Payment Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Method:</span>
                      <span className="font-medium text-gray-900">
                        {selectedOrder.payment_method || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-xs font-medium">
                        Paid
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(selectedOrder.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-gray-600" />
                    Shipping Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    {selectedOrder.shipped_at ? (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Shipped:</span>
                          <span className="font-medium text-gray-900">
                            {new Date(selectedOrder.shipped_at).toLocaleDateString()}
                          </span>
                        </div>
                        {selectedOrder.tracking_number && (
                          <div className="flex justify-between">
                            <span className="text-gray-600">Tracking:</span>
                            <span className="font-mono text-xs text-gray-900">
                              {selectedOrder.tracking_number}
                            </span>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-gray-500">Not yet shipped</p>
                    )}
                  </div>
                </div>
              </div>

              {selectedOrder.shipping_address && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <Package className="w-5 h-5 text-blue-600" />
                    Shipping Address
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line">
                    {selectedOrder.shipping_address}
                  </p>
                </div>
              )}

              <div>
                <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  Order Items ({orderItems.length})
                </h3>
                <div className="space-y-3">
                  {orderItems.map((item) => (
                    <div key={item.id} className="flex gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {item.products?.image_url ? (
                          <img
                            src={item.products.image_url}
                            alt={item.products.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 mb-1">
                          {item.products?.title || 'Unknown Product'}
                        </h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Qty: {item.quantity}</span>
                          <span>•</span>
                          <span className="font-semibold text-gray-900">
                            ${parseFloat(item.price.toString()).toFixed(2)} each
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Subtotal</div>
                        <div className="text-lg font-bold text-gray-900">
                          ${(parseFloat(item.price.toString()) * item.quantity).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-6 border border-gray-200">
                <h3 className="font-bold text-gray-900 mb-4">Payment Breakdown</h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Order Total</span>
                    <span className="text-xl font-bold text-gray-900">
                      ${selectedOrder.total_amount.toFixed(2)}
                    </span>
                  </div>

                  {selectedOrder.payment_released && (
                    <>
                      <div className="border-t border-gray-300 pt-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            Admin Commission ({commissionRate}%)
                          </span>
                          <span className="text-sm font-semibold text-purple-600">
                            ${(selectedOrder.admin_commission || 0).toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Seller Amount</span>
                          <span className="text-sm font-semibold text-green-600">
                            ${(selectedOrder.seller_amount || 0).toFixed(2)}
                          </span>
                        </div>
                      </div>

                      <div className="bg-green-100 border border-green-200 rounded-lg p-3 mt-4">
                        <p className="text-sm text-green-800 font-semibold flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Payment released on:{' '}
                          {new Date(selectedOrder.payment_released_at!).toLocaleString()}
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {!selectedOrder.payment_released && selectedOrder.confirmed_by_buyer && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleReleasePayment(selectedOrder)}
                    disabled={releasing === selectedOrder.id}
                    className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <DollarSign className="w-5 h-5" />
                    {releasing === selectedOrder.id
                      ? 'Releasing Payment...'
                      : `Release $${calculateAmounts(selectedOrder.total_amount).sellerAmount.toFixed(2)} to Seller`}
                  </button>
                </div>
              )}

              {!selectedOrder.confirmed_by_buyer && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <p className="font-semibold mb-1">Awaiting Delivery Confirmation</p>
                      <p>
                        Payment can only be released after the buyer confirms receipt of the order.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
