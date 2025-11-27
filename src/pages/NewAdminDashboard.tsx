import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import Sidebar from '../components/admin/Sidebar';
import TopBar from '../components/admin/TopBar';
import CategoryManager from '../components/admin/CategoryManager';
import AddProduct from '../components/admin/AddProduct';
import ProductList from '../components/admin/ProductList';
import ProductSubmissions from '../components/admin/ProductSubmissions';
import UserManagement from '../components/admin/UserManagement';
import OrderManagement from '../components/admin/OrderManagement';
import { ShoppingBag, Users, Package, DollarSign, TrendingUp, TrendingDown, Clock } from 'lucide-react';

interface DashboardStats {
  totalRevenue: number;
  totalOrders: number;
  totalProducts: number;
  totalUsers: number;
  pendingSubmissions: number;
  approvedProducts: number;
  rejectedSubmissions: number;
}

export default function NewAdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [pendingSubmissions, setPendingSubmissions] = useState(0);
  const [stats, setStats] = useState<DashboardStats>({
    totalRevenue: 0,
    totalOrders: 0,
    totalProducts: 0,
    totalUsers: 0,
    pendingSubmissions: 0,
    approvedProducts: 0,
    rejectedSubmissions: 0,
  });

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    checkAdminStatus();
  }, [user, navigate]);

  useEffect(() => {
    if (!isAdmin) return;

    const interval = setInterval(() => {
      fetchDashboardStats();
    }, 30000);

    return () => clearInterval(interval);
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin && activeSection === 'dashboard') {
      fetchDashboardStats();
    }
  }, [activeSection, isAdmin]);

  const checkAdminStatus = async () => {
    try {
      setLoading(true);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user?.id)
        .maybeSingle();

      if (profile?.role !== 'admin') {
        navigate('/');
        return;
      }

      setIsAdmin(true);
      await fetchDashboardStats();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const [ordersData, productsData, usersData, submissionsData] = await Promise.all([
        supabase.from('orders').select('total_amount', { count: 'exact' }),
        supabase.from('products').select('id', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }),
        supabase.from('product_submissions').select('status', { count: 'exact' }),
      ]);

      const totalRevenue = ordersData.data?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const totalOrders = ordersData.data?.length || 0;
      const totalProducts = productsData.data?.length || 0;
      const totalUsers = usersData.data?.length || 0;

      const pending = submissionsData.data?.filter(s => s.status === 'pending').length || 0;
      const approved = submissionsData.data?.filter(s => s.status === 'approved').length || 0;
      const rejected = submissionsData.data?.filter(s => s.status === 'rejected').length || 0;

      setStats({
        totalRevenue,
        totalOrders,
        totalProducts,
        totalUsers,
        pendingSubmissions: pending,
        approvedProducts: approved,
        rejectedSubmissions: rejected,
      });

      setPendingSubmissions(pending);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        pendingSubmissions={pendingSubmissions}
      />

      <div className="ml-64">
        <TopBar />

        <main className="pt-20 p-6">
          {activeSection === 'dashboard' && (
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-6">Dashboard Overview</h1>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <DollarSign className="w-6 h-6" />
                    </div>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-emerald-100 text-sm font-medium mb-1">Total Revenue</p>
                  <p className="text-3xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
                </div>

                <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <ShoppingBag className="w-6 h-6" />
                    </div>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-blue-100 text-sm font-medium mb-1">Total Orders</p>
                  <p className="text-3xl font-bold">{stats.totalOrders}</p>
                </div>

                <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <Package className="w-6 h-6" />
                    </div>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-purple-100 text-sm font-medium mb-1">Total Products</p>
                  <p className="text-3xl font-bold">{stats.totalProducts}</p>
                </div>

                <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-white/20 p-3 rounded-lg">
                      <Users className="w-6 h-6" />
                    </div>
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-orange-100 text-sm font-medium mb-1">Total Users</p>
                  <p className="text-3xl font-bold">{stats.totalUsers}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white rounded-xl p-6 border-2 border-yellow-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-yellow-100 p-3 rounded-lg">
                      <Clock className="w-6 h-6 text-yellow-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Pending Submissions</p>
                  <p className="text-3xl font-bold text-yellow-600">{stats.pendingSubmissions}</p>
                  <p className="text-xs text-gray-500 mt-2">Awaiting review</p>
                </div>

                <div className="bg-white rounded-xl p-6 border-2 border-green-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-green-100 p-3 rounded-lg">
                      <Package className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Approved Products</p>
                  <p className="text-3xl font-bold text-green-600">{stats.approvedProducts}</p>
                  <p className="text-xs text-gray-500 mt-2">Successfully published</p>
                </div>

                <div className="bg-white rounded-xl p-6 border-2 border-red-200 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-red-100 p-3 rounded-lg">
                      <TrendingDown className="w-6 h-6 text-red-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm font-medium mb-1">Rejected Submissions</p>
                  <p className="text-3xl font-bold text-red-600">{stats.rejectedSubmissions}</p>
                  <p className="text-xs text-gray-500 mt-2">Not approved</p>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'category-list' && <CategoryManager />}

          {activeSection === 'new-category' && <CategoryManager />}

          {activeSection === 'add-product' && <AddProduct />}

          {activeSection === 'product-list' && <ProductList />}

          {activeSection === 'product-submissions' && <ProductSubmissions onSubmissionChange={fetchDashboardStats} />}

          {activeSection === 'orders' && <OrderManagement />}

          {activeSection === 'all-users' && <UserManagement />}
        </main>
      </div>
    </div>
  );
}
