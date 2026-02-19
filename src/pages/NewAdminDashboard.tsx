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
import PaymentManagement from '../components/admin/PaymentManagement';
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
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
        onSectionChange={(section) => {
          setActiveSection(section);
          setIsSidebarOpen(false);
        }}
        pendingSubmissions={pendingSubmissions}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />

      <div className="lg:ml-64 min-h-screen flex flex-col">
        <TopBar
          onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSectionChange={setActiveSection}
        />

        <main className="flex-1 pt-24 p-4 lg:p-6 pb-8 lg:pb-12">
          {activeSection === 'dashboard' && (
            <div>
              <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-4 lg:mb-6">Dashboard Overview</h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6 lg:mb-8">
                <button
                  onClick={() => setActiveSection('payments')}
                  className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3 lg:mb-4">
                    <div className="bg-white/20 p-2 lg:p-3 rounded-lg">
                      <DollarSign className="w-5 h-5 lg:w-6 lg:h-6" />
                    </div>
                    <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />
                  </div>
                  <p className="text-emerald-100 text-xs lg:text-sm font-medium mb-1">Total Revenue</p>
                  <p className="text-2xl lg:text-3xl font-bold">${stats.totalRevenue.toFixed(2)}</p>
                </button>

                <button
                  onClick={() => setActiveSection('orders')}
                  className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3 lg:mb-4">
                    <div className="bg-white/20 p-2 lg:p-3 rounded-lg">
                      <ShoppingBag className="w-5 h-5 lg:w-6 lg:h-6" />
                    </div>
                    <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />
                  </div>
                  <p className="text-blue-100 text-xs lg:text-sm font-medium mb-1">Total Orders</p>
                  <p className="text-2xl lg:text-3xl font-bold">{stats.totalOrders}</p>
                </button>

                <button
                  onClick={() => setActiveSection('product-list')}
                  className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3 lg:mb-4">
                    <div className="bg-white/20 p-2 lg:p-3 rounded-lg">
                      <Package className="w-5 h-5 lg:w-6 lg:h-6" />
                    </div>
                    <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />
                  </div>
                  <p className="text-purple-100 text-xs lg:text-sm font-medium mb-1">Total Products</p>
                  <p className="text-2xl lg:text-3xl font-bold">{stats.totalProducts}</p>
                </button>

                <button
                  onClick={() => setActiveSection('all-users')}
                  className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 lg:p-6 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3 lg:mb-4">
                    <div className="bg-white/20 p-2 lg:p-3 rounded-lg">
                      <Users className="w-5 h-5 lg:w-6 lg:h-6" />
                    </div>
                    <TrendingUp className="w-4 h-4 lg:w-5 lg:h-5" />
                  </div>
                  <p className="text-orange-100 text-xs lg:text-sm font-medium mb-1">Total Users</p>
                  <p className="text-2xl lg:text-3xl font-bold">{stats.totalUsers}</p>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6">
                <button
                  onClick={() => setActiveSection('product-submissions')}
                  className="bg-white rounded-xl p-4 lg:p-6 border-2 border-yellow-200 shadow-sm hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3 lg:mb-4">
                    <div className="bg-yellow-100 p-2 lg:p-3 rounded-lg">
                      <Clock className="w-5 h-5 lg:w-6 lg:h-6 text-yellow-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs lg:text-sm font-medium mb-1">Pending Submissions</p>
                  <p className="text-2xl lg:text-3xl font-bold text-yellow-600">{stats.pendingSubmissions}</p>
                  <p className="text-xs text-gray-500 mt-2">Awaiting review</p>
                </button>

                <button
                  onClick={() => setActiveSection('product-list')}
                  className="bg-white rounded-xl p-4 lg:p-6 border-2 border-green-200 shadow-sm hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3 lg:mb-4">
                    <div className="bg-green-100 p-2 lg:p-3 rounded-lg">
                      <Package className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs lg:text-sm font-medium mb-1">Approved Products</p>
                  <p className="text-2xl lg:text-3xl font-bold text-green-600">{stats.approvedProducts}</p>
                  <p className="text-xs text-gray-500 mt-2">Successfully published</p>
                </button>

                <button
                  onClick={() => setActiveSection('product-submissions')}
                  className="bg-white rounded-xl p-4 lg:p-6 border-2 border-red-200 shadow-sm hover:shadow-lg transform hover:scale-105 transition-all duration-200 text-left cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-3 lg:mb-4">
                    <div className="bg-red-100 p-2 lg:p-3 rounded-lg">
                      <TrendingDown className="w-5 h-5 lg:w-6 lg:h-6 text-red-600" />
                    </div>
                  </div>
                  <p className="text-gray-600 text-xs lg:text-sm font-medium mb-1">Rejected Submissions</p>
                  <p className="text-2xl lg:text-3xl font-bold text-red-600">{stats.rejectedSubmissions}</p>
                  <p className="text-xs text-gray-500 mt-2">Not approved</p>
                </button>
              </div>
            </div>
          )}

          {activeSection === 'category-list' && <CategoryManager searchQuery={searchQuery} />}

          {activeSection === 'new-category' && <CategoryManager searchQuery={searchQuery} />}

          {activeSection === 'add-product' && <AddProduct />}

          {activeSection === 'product-list' && <ProductList searchQuery={searchQuery} />}

          {activeSection === 'product-submissions' && <ProductSubmissions onSubmissionChange={fetchDashboardStats} searchQuery={searchQuery} />}

          {activeSection === 'orders' && <OrderManagement searchQuery={searchQuery} />}

          {activeSection === 'payments' && <PaymentManagement />}

          {activeSection === 'all-users' && <UserManagement searchQuery={searchQuery} />}
        </main>

        <footer className="mt-auto border-t border-gray-200 bg-white py-4 px-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-gray-600">
            <p>© 2024 Beckah Exchange Admin Panel. All rights reserved.</p>
            <div className="flex gap-4">
              <span>Version 1.0.0</span>
              <span>•</span>
              <a href="mailto:beckahex@beckah.org" className="hover:text-emerald-600 transition">Support</a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
