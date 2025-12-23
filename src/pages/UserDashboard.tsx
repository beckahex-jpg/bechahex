import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, DollarSign, Clock, CheckCircle, Plus, ShoppingBag, Tag, Eye } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import QuickStatsCard from '../components/QuickStatsCard';

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
  product_id?: string;
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
  const { user, openAuthModal } = useAuth();
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
      openAuthModal('Please sign in to view your dashboard');
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
          .select('*, product_id')
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-teal-50/30 pb-24 lg:pb-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-4 lg:py-8">
        <div className="mb-4 lg:mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start lg:items-center lg:justify-between gap-3 sm:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent mb-1 lg:mb-2 truncate">Dashboard</h1>
              <p className="text-xs sm:text-sm lg:text-base text-gray-600 truncate">Welcome back, {user?.user_metadata?.full_name || user?.email}</p>
            </div>
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={() => navigate('/my-products')}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 sm:gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white px-3 sm:px-4 lg:px-6 py-2.5 sm:py-2 lg:py-3 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 text-xs sm:text-sm lg:text-base"
              >
                <Package className="w-4 h-4 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                <span className="whitespace-nowrap">Manage Products</span>
              </button>
              <button
                onClick={() => navigate('/orders')}
                className="flex-1 sm:flex-initial hidden xs:flex items-center justify-center gap-1.5 sm:gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-3 sm:px-4 lg:px-6 py-2.5 sm:py-2 lg:py-3 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl active:scale-95 text-xs sm:text-sm lg:text-base"
              >
                <ShoppingBag className="w-4 h-4 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                <span className="whitespace-nowrap">View Orders</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 mb-4 lg:mb-6 xl:mb-8">
          <div onClick={() => navigate('/my-products')} className="cursor-pointer">
            <QuickStatsCard
              icon={Package}
              label="My Products"
              value={stats.totalSubmissions}
              gradient="from-red-500 to-rose-600"
              iconColor="text-white"
            />
          </div>

          <div
            onClick={() => {
              navigate('/my-products');
              setTimeout(() => {
                const pendingButton = document.querySelector('[data-tab="pending"]') as HTMLElement;
                if (pendingButton) pendingButton.click();
              }, 100);
            }}
            className="cursor-pointer"
          >
            <QuickStatsCard
              icon={Clock}
              label="Pending"
              value={stats.pendingSubmissions}
              gradient="from-yellow-500 to-amber-600"
              iconColor="text-white"
            />
          </div>

          <div
            onClick={() => {
              navigate('/my-products');
              setTimeout(() => {
                const approvedButton = document.querySelector('[data-tab="approved"]') as HTMLElement;
                if (approvedButton) approvedButton.click();
              }, 100);
            }}
            className="cursor-pointer"
          >
            <QuickStatsCard
              icon={CheckCircle}
              label="Approved"
              value={stats.approvedSubmissions}
              gradient="from-green-500 to-emerald-600"
              iconColor="text-white"
            />
          </div>

          <div onClick={() => navigate('/seller-orders')} className="cursor-pointer">
            <QuickStatsCard
              icon={DollarSign}
              label="Revenue"
              value={`$${stats.totalRevenue.toFixed(0)}`}
              gradient="from-blue-500 to-cyan-600"
              iconColor="text-white"
            />
          </div>

          <div onClick={() => navigate('/orders')} className="cursor-pointer col-span-2 md:col-span-1">
            <QuickStatsCard
              icon={ShoppingBag}
              label="My Orders"
              value={stats.totalOrders}
              gradient="from-purple-500 to-pink-600"
              iconColor="text-white"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
          <div className="bg-white rounded-xl lg:rounded-2xl shadow-lg border border-gray-100">
            <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
              <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center gap-2 sm:gap-3 lg:gap-4 mb-3 sm:mb-4">
                <h2 className="text-base sm:text-lg lg:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">My Submitted Products</h2>
                <button
                  onClick={() => navigate('/submit-product')}
                  className="w-full xs:w-auto flex items-center justify-center gap-1.5 sm:gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-xs sm:text-sm active:scale-95"
                >
                  <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span>Sell Product</span>
                </button>
              </div>

              <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {(['all', 'pending', 'approved', 'rejected'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl font-medium transition-all duration-200 whitespace-nowrap text-xs sm:text-sm ${
                      activeTab === tab
                        ? 'bg-gradient-to-r from-teal-600 to-emerald-600 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-95'
                    }`}
                  >
                    {tab === 'all' ? 'All' : tab === 'pending' ? 'Pending' : tab === 'approved' ? 'Approved' : 'Rejected'}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 sm:p-4 lg:p-6 max-h-[500px] sm:max-h-[600px] overflow-y-auto">
              {filteredSubmissions.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <div className="relative mb-3 sm:mb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-teal-400/20 to-emerald-400/20 rounded-full blur-2xl" />
                    <div className="relative bg-gradient-to-br from-teal-50 to-emerald-50 rounded-full p-3 sm:p-4 w-fit mx-auto">
                      <Package className="w-10 h-10 sm:w-12 sm:h-12 text-teal-600" />
                    </div>
                  </div>
                  <p className="text-gray-900 font-semibold text-sm mb-1.5 sm:mb-2">No Submitted Products</p>
                  <p className="text-gray-500 text-xs mb-3 sm:mb-4">Start by selling your first product</p>
                  <button
                    onClick={() => navigate('/submit-product')}
                    className="inline-flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-xs sm:text-sm active:scale-95"
                  >
                    <Tag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Sell Product
                  </button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {filteredSubmissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="border border-gray-200 rounded-lg sm:rounded-xl p-2 sm:p-3 hover:shadow-lg hover:border-teal-200 transition-all duration-200"
                    >
                      <div className="flex gap-2 sm:gap-3">
                        <div className="w-14 h-14 sm:w-16 sm:h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                          {submission.images && submission.images.length > 0 ? (
                            <img
                              src={submission.images[0]}
                              alt={submission.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400" />
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 text-xs sm:text-sm mb-1 truncate">{submission.title}</h3>
                              <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs text-gray-600">
                                <span className="inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded bg-gray-100 whitespace-nowrap">
                                  {getSubmissionTypeText(submission.submission_type)}
                                </span>
                                <span className="whitespace-nowrap">${parseFloat(submission.price.toString()).toFixed(2)}</span>
                                <span className="text-gray-400 hidden xs:inline">•</span>
                                <span className="hidden xs:inline whitespace-nowrap">{new Date(submission.created_at).toLocaleDateString('ar-SA')}</span>
                              </div>
                            </div>
                            <span
                              className={`inline-flex items-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium whitespace-nowrap shrink-0 ${getStatusColor(
                                submission.status
                              )}`}
                            >
                              {getStatusText(submission.status)}
                            </span>
                          </div>
                          {submission.status === 'approved' && (
                            <button
                              onClick={async () => {
                                let productId = submission.product_id;

                                if (!productId) {
                                  const { data, error } = await supabase
                                    .from('products')
                                    .select('id')
                                    .ilike('title', submission.title.trim())
                                    .maybeSingle();

                                  if (error) {
                                    console.error('Error finding product:', error);
                                    return;
                                  }

                                  productId = data?.id;
                                }

                                if (productId) {
                                  navigate(`/product/${productId}`);
                                }
                              }}
                              className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-3 py-1.5 rounded-md font-medium transition shadow-sm hover:shadow-md text-xs"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              View Product
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl lg:rounded-2xl shadow-lg border border-gray-100">
            <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
              <div className="flex items-center gap-2 mb-1">
                <div className="p-1.5 sm:p-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg">
                  <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
                </div>
                <h2 className="text-base sm:text-lg lg:text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">My Orders</h2>
              </div>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">Track your purchase orders and their status</p>
            </div>

            <div className="p-3 sm:p-4 lg:p-6 max-h-[500px] sm:max-h-[600px] overflow-y-auto">
              {orders.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <div className="relative mb-3 sm:mb-4">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-2xl" />
                    <div className="relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-full p-3 sm:p-4 w-fit mx-auto">
                      <ShoppingBag className="w-10 h-10 sm:w-12 sm:h-12 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-gray-900 font-semibold text-sm mb-1.5 sm:mb-2">No Orders Yet</p>
                  <p className="text-gray-500 text-xs mb-3 sm:mb-4">Start shopping to see your orders here</p>
                  <button
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-1.5 sm:gap-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg sm:rounded-xl font-semibold transition-all duration-200 shadow-lg hover:shadow-xl text-xs sm:text-sm active:scale-95"
                  >
                    Browse Products
                  </button>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-gray-200 rounded-lg sm:rounded-xl p-2.5 sm:p-3 lg:p-4 hover:shadow-lg hover:border-purple-200 transition-all duration-200"
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
