import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Package, ArrowLeft, Calendar, DollarSign, Truck, CheckCircle, Clock, XCircle, Search, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Order {
  id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  full_name?: string;
  phone?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  shipping_address: string;
  shipping_city: string;
  shipping_postal_code: string;
  shipping_country: string;
  order_items: {
    id: string;
    quantity: number;
    price: number;
    products: {
      id: string;
      title: string;
      image_url: string;
      images?: string[];
      description: string;
    };
  }[];
}

type FilterTab = 'all' | 'pending' | 'processing' | 'completed' | 'cancelled';

export default function OrderHistoryPage() {
  const { orderId } = useParams();
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'amount'>('date');

  useEffect(() => {
    if (!user) {
      openAuthModal('Please sign in to view your orders');
      navigate('/');
      return;
    }
    loadOrders();
  }, [user, navigate]);

  useEffect(() => {
    if (orderId && orders.length > 0) {
      const order = orders.find(o => o.id === orderId);
      if (order) {
        setSelectedOrder(order);
      }
    }
  }, [orderId, orders]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            id,
            quantity,
            price,
            products (
              id,
              title,
              image_url,
              images,
              description
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'processing':
        return 'bg-blue-100 text-blue-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'processing':
        return <Truck className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'cancelled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Package className="w-4 h-4" />;
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  const filteredOrders = orders
    .filter(order => {
      if (activeFilter !== 'all' && order.status !== activeFilter) return false;
      if (searchQuery) {
        return (
          order.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
          order.order_items.some(item =>
            item.products?.title.toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return parseFloat(b.total_amount.toString()) - parseFloat(a.total_amount.toString());
    });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (selectedOrder) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => {
              setSelectedOrder(null);
              navigate('/orders');
            }}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Orders</span>
          </button>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-8">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <p className="text-orange-100 text-sm mb-1">Order ID</p>
                  <h1 className="text-2xl font-bold">#{selectedOrder.id.slice(0, 8)}</h1>
                </div>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${getStatusColor(selectedOrder.status)}`}>
                  {getStatusIcon(selectedOrder.status)}
                  {getStatusText(selectedOrder.status)}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <p className="text-orange-100 text-sm mb-1">Order Date</p>
                  <p className="font-semibold text-lg">
                    {new Date(selectedOrder.created_at).toLocaleDateString('en-US', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm mb-1">Total Amount</p>
                  <p className="font-bold text-2xl">
                    ${parseFloat(selectedOrder.total_amount.toString()).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-orange-100 text-sm mb-1">Items</p>
                  <p className="font-semibold text-lg">
                    {selectedOrder.order_items?.length || 0} Products
                  </p>
                </div>
              </div>
            </div>

            <div className="p-8">
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <CheckCircle className="w-5 h-5 text-green-600" />
                  <h2 className="text-lg font-bold text-gray-900">Delivered Items</h2>
                  <span className="text-sm text-gray-500">
                    {selectedOrder.order_items?.length || 0} items delivered
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {selectedOrder.order_items?.map((item) => (
                    <div
                      key={item.id}
                      className="bg-gray-50 rounded-xl p-3 hover:shadow-md transition cursor-pointer"
                      onClick={() => navigate(`/product/${item.products?.id}`)}
                    >
                      <div className="aspect-square bg-white rounded-lg overflow-hidden mb-3">
                        {(() => {
                          let images = item.products?.images;
                          if (typeof images === 'string') {
                            try {
                              images = JSON.parse(images);
                            } catch {
                              images = [];
                            }
                          }
                          const hasImage = (images && images.length > 0) || item.products?.image_url;
                          const imageUrl = (images && images.length > 0 ? images[0] : item.products?.image_url) || '';

                          return hasImage ? (
                            <img
                              src={imageUrl}
                              alt={item.products?.title || ''}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-12 h-12 text-gray-300" />
                            </div>
                          );
                        })()}
                      </div>
                      <p className="text-sm font-medium text-gray-900 line-clamp-2 mb-1">
                        {item.products?.title || 'Product'}
                      </p>
                      <p className="text-xs text-gray-500">Qty: {item.quantity}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-orange-600" />
                    Shipping Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    {selectedOrder.full_name && (
                      <p className="font-semibold text-gray-900">{selectedOrder.full_name}</p>
                    )}
                    {selectedOrder.phone && (
                      <p className="text-gray-600">{selectedOrder.phone}</p>
                    )}
                    <p className="text-gray-900">{selectedOrder.shipping_address}</p>
                    <p className="text-gray-600">
                      {selectedOrder.shipping_city}, {selectedOrder.shipping_postal_code}
                    </p>
                    <p className="text-gray-600">{selectedOrder.shipping_country}</p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-xl p-6">
                  <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-orange-600" />
                    Payment Details
                  </h3>
                  <div className="space-y-3 text-sm">
                    {selectedOrder.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Payment Method</span>
                        <span className="font-medium text-gray-900 capitalize">
                          {selectedOrder.payment_method.replace('_', ' ')}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment Status</span>
                      <span className={`font-medium px-2 py-1 rounded ${getStatusColor(selectedOrder.payment_status)}`}>
                        {getStatusText(selectedOrder.payment_status)}
                      </span>
                    </div>
                    {selectedOrder.notes && (
                      <div className="pt-3 border-t border-gray-200">
                        <p className="text-gray-600 mb-1">Order Notes</p>
                        <p className="text-gray-900">{selectedOrder.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-gray-200">
                <div className="flex justify-between items-center text-xl">
                  <span className="font-bold text-gray-900">Total Amount</span>
                  <span className="font-bold text-orange-600 text-2xl">
                    ${parseFloat(selectedOrder.total_amount.toString()).toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => navigate('/')}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white px-6 py-3 rounded-xl font-semibold transition shadow-md hover:shadow-lg"
                >
                  Continue Shopping
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">My Orders</h1>

          <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by order ID or product name"
                className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="flex gap-2 overflow-x-auto w-full sm:w-auto">
              {(['all', 'pending', 'processing', 'completed', 'cancelled'] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveFilter(tab)}
                  className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                    activeFilter === tab
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'amount')}
                className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-10 font-medium text-gray-700 hover:border-gray-400 focus:ring-2 focus:ring-orange-500 focus:border-transparent cursor-pointer"
              >
                <option value="date">Sort by Date</option>
                <option value="amount">Sort by Amount</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-16 text-center">
            <Package className="w-20 h-20 text-gray-300 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No orders found</h2>
            <p className="text-gray-600 mb-6">
              {activeFilter !== 'all' ? `No ${activeFilter} orders yet` : 'Start shopping to see your orders here'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-xl font-semibold transition shadow-md hover:shadow-lg"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredOrders.map((order) => (
              <div
                key={order.id}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-lg transition cursor-pointer"
                onClick={() => {
                  setSelectedOrder(order);
                  navigate(`/orders/${order.id}`);
                }}
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row justify-between gap-4 mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <p className="text-sm text-gray-500">Order Date</p>
                        <p className="font-semibold text-gray-900">
                          {new Date(order.created_at).toLocaleDateString('en-US', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mb-3">
                        <p className="text-sm text-gray-500">Order Summary</p>
                        <p className="font-semibold text-gray-900">
                          {order.order_items?.length || 0} Items, {order.order_items?.reduce((sum, item) => sum + item.quantity, 0)} Products
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-500">Buyer</p>
                        <p className="font-semibold text-gray-900">{order.full_name || 'Customer'}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-start lg:items-end justify-between">
                      <div className="text-right mb-3">
                        <p className="text-sm text-gray-500 mb-1">Total</p>
                        <p className="text-2xl font-bold text-orange-600">
                          ${parseFloat(order.total_amount.toString()).toFixed(2)}
                        </p>
                      </div>
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${getStatusColor(order.status)}`}>
                        {getStatusIcon(order.status)}
                        {getStatusText(order.status)}
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100 pt-4">
                    <div className="flex items-center gap-2 mb-3">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      <p className="text-sm font-medium text-gray-700">
                        {order.order_items?.length || 0} items delivered
                      </p>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-2">
                      {order.order_items?.map((item) => (
                        <div
                          key={item.id}
                          className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded-lg overflow-hidden"
                        >
                          {(() => {
                            let images = item.products?.images;
                            if (typeof images === 'string') {
                              try {
                                images = JSON.parse(images);
                              } catch {
                                images = [];
                              }
                            }
                            const hasImage = (images && images.length > 0) || item.products?.image_url;
                            const imageUrl = (images && images.length > 0 ? images[0] : item.products?.image_url) || '';

                            return hasImage ? (
                              <img
                                src={imageUrl}
                                alt={item.products?.title || ''}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-8 h-8 text-gray-300" />
                              </div>
                            );
                          })()}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="bg-orange-50 px-6 py-4 flex justify-end">
                  <button className="text-orange-600 hover:text-orange-700 font-semibold flex items-center gap-2 transition">
                    View Details
                    <ArrowLeft className="w-4 h-4 rotate-180" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
