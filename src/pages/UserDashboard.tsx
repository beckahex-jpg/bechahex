import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, DollarSign, Clock, CheckCircle, Plus, ShoppingBag } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface DashboardStats {
  totalSubmissions: number;
  pendingSubmissions: number;
  approvedSubmissions: number;
  totalRevenue: number;
  totalOrders: number;
}

interface Submission {
  id: string;
  title: string;
  submission_type: string;
  price: number;
  status: string;
  created_at: string;
  images: string[];
}

interface Order {
  id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  created_at: string;
  order_items: {
    quantity: number;
    price: number;
    products: {
      id: string;
      title: string;
      image_url: string;
    };
  }[];
}

export default function UserDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({
    totalSubmissions: 0,
    pendingSubmissions: 0,
    approvedSubmissions: 0,
    totalRevenue: 0,
    totalOrders: 0,
  });
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    loadDashboardData();
  }, [user, navigate]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      const [submissionsResponse, ordersResponse] = await Promise.all([
        supabase
          .from('product_submissions')
          .select('*')
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false }),

        supabase
          .from('orders')
          .select(`
            *,
            order_items (
              quantity,
              price,
              products (
                id,
                title,
                image_url
              )
            )
          `)
          .eq('user_id', user?.id)
          .order('created_at', { ascending: false })
      ]);

      const submissions = submissionsResponse.data || [];
      const orders = ordersResponse.data || [];

      setSubmissions(submissions);
      setOrders(orders);

      const pending = submissions.filter(s => s.status === 'pending').length;
      const approved = submissions.filter(s => s.status === 'approved').length;
      const revenue = submissions
        .filter(s => s.status === 'approved')
        .reduce((sum, s) => sum + parseFloat(s.price.toString()), 0);

      setStats({
        totalSubmissions: submissions.length,
        pendingSubmissions: pending,
        approvedSubmissions: approved,
        totalRevenue: revenue,
        totalOrders: orders.length,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubmissions = submissions.filter(submission => {
    if (activeTab === 'all') return true;
    return submission.status === activeTab;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
      case 'completed':
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'rejected':
      case 'cancelled':
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ');
  };

  const getSubmissionTypeText = (type: string) => {
    switch (type) {
      case 'donation':
        return 'Donation';
      case 'symbolic_sale':
        return 'Symbolic Sale';
      case 'public_sale':
        return 'Public Sale';
      default:
        return type;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">My Dashboard</h1>
              <p className="text-gray-600">Welcome back, {user?.user_metadata?.full_name || user?.email}</p>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="hidden md:flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white px-6 py-3 rounded-lg font-semibold transition shadow-md hover:shadow-lg"
            >
              <Package className="w-5 h-5" />
              View All Orders
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="p-2 md:p-3 bg-red-100 rounded-lg mb-2">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-red-600" />
              </div>
              <span className="text-xs md:text-sm font-medium text-gray-500">My Products</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900 text-center">{stats.totalSubmissions}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="p-2 md:p-3 bg-yellow-100 rounded-lg mb-2">
                <Clock className="w-5 h-5 md:w-6 md:h-6 text-yellow-600" />
              </div>
              <span className="text-xs md:text-sm font-medium text-gray-500">Pending</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900 text-center">{stats.pendingSubmissions}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="p-2 md:p-3 bg-green-100 rounded-lg mb-2">
                <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
              <span className="text-xs md:text-sm font-medium text-gray-500">Approved</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900 text-center">{stats.approvedSubmissions}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="p-2 md:p-3 bg-blue-100 rounded-lg mb-2">
                <DollarSign className="w-5 h-5 md:w-6 md:h-6 text-blue-600" />
              </div>
              <span className="text-xs md:text-sm font-medium text-gray-500">Revenue</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900 text-center">${stats.totalRevenue.toFixed(2)}</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-4 md:p-6 border border-gray-100 col-span-2 lg:col-span-1">
            <div className="flex flex-col items-center text-center mb-2">
              <div className="p-2 md:p-3 bg-purple-100 rounded-lg mb-2">
                <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
              </div>
              <span className="text-xs md:text-sm font-medium text-gray-500">My Orders</span>
            </div>
            <div className="text-2xl md:text-3xl font-bold text-gray-900 text-center">{stats.totalOrders}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                <h2 className="text-xl font-bold text-gray-900">My Submissions</h2>
                <button
                  onClick={() => navigate('/submit-product')}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition shadow-md hover:shadow-lg text-sm"
                >
                  <Plus className="w-4 h-4" />
                  Submit Product
                </button>
              </div>

              <div className="flex gap-2 overflow-x-auto">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg font-medium transition whitespace-nowrap text-sm ${
                      activeTab === tab
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 max-h-[600px] overflow-y-auto">
              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm mb-2">No submissions yet</p>
                  <p className="text-gray-500 text-xs mb-4">Start by submitting your first product</p>
                  <button
                    onClick={() => navigate('/submit-product')}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Submit Product
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition"
                    >
                      <div className="flex gap-3">
                        <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {submission.images && submission.images.length > 0 ? (
                            <img
                              src={submission.images[0]}
                              alt={submission.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-gray-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-gray-900 text-sm mb-1">{submission.title}</h3>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100">
                                  {getSubmissionTypeText(submission.submission_type)}
                                </span>
                                <span>${parseFloat(submission.price.toString()).toFixed(2)}</span>
                                <span className="text-gray-400">•</span>
                                <span>{new Date(submission.created_at).toLocaleDateString()}</span>
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${getStatusColor(
                                submission.status
                              )}`}
                            >
                              {getStatusText(submission.status)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-bold text-gray-900">My Orders</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1">Track your purchase orders and their status</p>
            </div>

            <div className="p-6 max-h-[600px] overflow-y-auto">
              {orders.length === 0 ? (
                <div className="text-center py-8">
                  <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600 text-sm mb-2">No orders yet</p>
                  <p className="text-gray-500 text-xs mb-4">Start shopping to see your orders here</p>
                  <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-semibold transition text-sm"
                  >
                    Browse Products
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-gray-900 text-sm">
                              Order #{order.id.slice(0, 8)}
                            </span>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                                order.status
                              )}`}
                            >
                              {getStatusText(order.status)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600">
                            {new Date(order.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-base font-bold text-gray-900">
                            ${parseFloat(order.total_amount.toString()).toFixed(2)}
                          </p>
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                              order.payment_status
                            )}`}
                          >
                            {getStatusText(order.payment_status)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        {order.order_items?.map((item, index) => (
                          <div key={index} className="flex gap-2 items-center bg-gray-50 p-2 rounded">
                            <div className="w-12 h-12 bg-gray-200 rounded overflow-hidden flex-shrink-0">
                              {item.products?.image_url ? (
                                <img
                                  src={item.products.image_url}
                                  alt={item.products.title}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-5 h-5 text-gray-400" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 text-sm truncate">
                                {item.products?.title || 'Product'}
                              </p>
                              <p className="text-xs text-gray-600">Qty: {item.quantity}</p>
                            </div>
                            <p className="font-semibold text-gray-900 text-sm">
                              ${parseFloat(item.price.toString()).toFixed(2)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
