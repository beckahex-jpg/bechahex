import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Package,
  ShoppingBag,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  TrendingUp,
  LayoutDashboard,
  FileCheck,
  Box,
  Tags,
  Settings,
  BarChart3,
  Search,
  Filter,
  Edit,
  Trash2,
  Plus,
  Mail,
  Phone,
  MapPin,
  Calendar,
  ChevronRight,
  Eye,
  X,
  TrendingDown,
  Home,
  LogOut,
  ChevronDown,
  User,
  Bell
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import PaymentsSection from '../components/admin/PaymentsSection';

interface AdminStats {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingSubmissions: number;
  completedOrders: number;
  newUsersThisMonth: number;
  revenueThisMonth: number;
}

interface Submission {
  id: string;
  title: string;
  submission_type: string;
  price: number;
  final_price?: number | null;
  status: string;
  created_at: string;
  images: string[];
  description: string;
  condition: string;
  category_id: string;
  user_id: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

interface Order {
  id: string;
  user_id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method?: string;
  shipping_method?: string;
  tracking_number?: string;
  created_at: string;
  shipping_address: string;
  profiles: {
    full_name: string;
    email: string;
    phone?: string;
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

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  created_at: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  status: string;
  image_url: string;
  created_at: string;
  condition: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
}

type TabType = 'overview' | 'submissions' | 'orders' | 'payments' | 'users' | 'products' | 'categories';

export default function AdminDashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalProducts: 0,
    totalOrders: 0,
    totalRevenue: 0,
    pendingSubmissions: 0,
    completedOrders: 0,
    newUsersThisMonth: 0,
    revenueThisMonth: 0,
  });

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [finalPrice, setFinalPrice] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editProductForm, setEditProductForm] = useState({
    title: '',
    description: '',
    price: '',
    condition: '',
    status: 'available'
  });
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    slug: '',
    description: '',
    icon: ''
  });

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    checkAdminAndLoadData();
  }, [user, navigate]);

  useEffect(() => {
    setSearchQuery('');
  }, [activeTab]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'b' || e.key === 'B') {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          setShowProfileMenu(prev => !prev);
        }
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('#profile-menu-container')) {
        setShowProfileMenu(false);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleKeyPress);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const checkAdminAndLoadData = async () => {
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
      await loadAdminData();
    } catch (error) {
      console.error('Error checking admin status:', error);
      navigate('/');
    } finally {
      setLoading(false);
    }
  };

  const loadAdminData = async () => {
    try {
      const [usersRes, productsRes, ordersRes, submissionsRes, categoriesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('products').select('*').order('created_at', { ascending: false }),
        supabase.from('orders').select('*').order('created_at', { ascending: false }),
        supabase.from('product_submissions').select('*').order('created_at', { ascending: false }),
        supabase.from('categories').select('*').order('name', { ascending: true })
      ]);

      const usersData = usersRes.data || [];
      const productsData = productsRes.data || [];
      const ordersRaw = ordersRes.data || [];
      const submissionsRaw = submissionsRes.data || [];
      const categoriesData = categoriesRes.data || [];

      const ordersData = ordersRaw.map(order => {
        const userProfile = usersData.find(u => u.id === order.user_id);
        return {
          ...order,
          profiles: userProfile ? { full_name: userProfile.full_name, email: userProfile.email } : null
        };
      });

      const submissionsData = submissionsRaw.map(submission => {
        const userProfile = usersData.find(u => u.id === submission.user_id);
        return {
          ...submission,
          profiles: userProfile ? { full_name: userProfile.full_name, email: userProfile.email } : null
        };
      });

      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      const newUsersThisMonth = usersData.filter(
        u => new Date(u.created_at) >= firstDayOfMonth
      ).length;

      const ordersThisMonth = ordersData.filter(
        o => new Date(o.created_at) >= firstDayOfMonth
      );

      const revenueThisMonth = ordersThisMonth.reduce(
        (sum, o) => sum + parseFloat(o.total_amount.toString()),
        0
      );

      setStats({
        totalUsers: usersData.length,
        totalProducts: productsData.length,
        totalOrders: ordersData.length,
        totalRevenue: ordersData.reduce((sum, o) => sum + parseFloat(o.total_amount.toString()), 0),
        pendingSubmissions: submissionsData.filter(s => s.status === 'pending').length,
        completedOrders: ordersData.filter(o => o.status === 'completed').length,
        newUsersThisMonth,
        revenueThisMonth,
      });

      setSubmissions(submissionsData);
      setOrders(ordersData);
      setUsers(usersData);
      setProducts(productsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('Error loading admin data:', error);
    }
  };

  const handleApproveClick = (submission: Submission) => {
    setSelectedSubmission(submission);
    setFinalPrice(submission.price.toString());
    setShowPriceModal(true);
  };

  const handleSubmissionApprove = async () => {
    if (!selectedSubmission || !finalPrice) return;

    try {
      const finalPriceNum = parseFloat(finalPrice);
      if (isNaN(finalPriceNum) || finalPriceNum <= 0) {
        alert('Please enter a valid price');
        return;
      }

      const productData = {
        title: selectedSubmission.title,
        description: selectedSubmission.description || '',
        price: finalPriceNum,
        original_price: parseFloat(selectedSubmission.price.toString()),
        condition: selectedSubmission.condition || 'Like New',
        category_id: selectedSubmission.category_id,
        seller_id: selectedSubmission.user_id,
        image_url: (selectedSubmission.images && selectedSubmission.images.length > 0) ? selectedSubmission.images[0] : '',
        status: 'available',
      };

      const { error: insertError } = await supabase
        .from('products')
        .insert(productData);

      if (insertError) {
        console.error('Error inserting product:', insertError);
        throw insertError;
      }

      const { error: updateError } = await supabase
        .from('product_submissions')
        .update({
          status: 'approved',
          final_price: finalPriceNum,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', selectedSubmission.id);

      if (updateError) {
        console.error('Error updating submission status:', updateError);
        throw updateError;
      }

      await supabase
        .from('notifications')
        .insert({
          user_id: selectedSubmission.user_id,
          title: 'Product Approved',
          message: `Your product "${selectedSubmission.title}" has been approved and is now live!`,
          type: 'success'
        });

      await loadAdminData();
      setShowPriceModal(false);
      setSelectedSubmission(null);
      setFinalPrice('');
    } catch (error) {
      console.error('Error approving submission:', error);
      alert('Failed to approve submission. Please try again.');
    }
  };

  const handleSubmissionAction = async (submissionId: string, action: 'rejected') => {
    try {
      const submission = submissions.find(s => s.id === submissionId);
      if (!submission) return;

      const { error: updateError } = await supabase
        .from('product_submissions')
        .update({
          status: action,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id
        })
        .eq('id', submissionId);

      if (updateError) {
        console.error('Error updating submission status:', updateError);
        throw updateError;
      }

      const submissionToNotify = submissions.find(s => s.id === submissionId);
      if (submissionToNotify) {
        await supabase
          .from('notifications')
          .insert({
            user_id: submissionToNotify.user_id,
            type: action === 'approved' ? 'submission_approved' : 'submission_rejected',
            title: action === 'approved' ? 'Product Approved!' : 'Product Rejected',
            message: action === 'approved'
              ? `Your product "${submissionToNotify.title}" has been approved and is now live on the marketplace.`
              : `Your product submission "${submissionToNotify.title}" was not approved. Please review our guidelines and try again.`,
            data: { submission_id: submissionId }
          });
      }

      setSelectedSubmission(null);
      await loadAdminData();
      alert(`Product ${action === 'approved' ? 'approved and published' : 'rejected'} successfully!`);
    } catch (error) {
      console.error('Error processing submission:', error);
      alert('Error processing submission. Please try again.');
    }
  };

  const handleViewOrderDetails = async (order: Order) => {
    try {
      setSelectedOrder(order);
      setShowOrderModal(true);

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

  const handleEditProductClick = (product: Product) => {
    setSelectedProduct(product);
    setEditProductForm({
      title: product.title,
      description: '',
      price: product.price.toString(),
      condition: product.condition,
      status: product.status
    });
    setShowEditProductModal(true);
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct || !editProductForm.title || !editProductForm.price) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const priceNum = parseFloat(editProductForm.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        alert('Please enter a valid price');
        return;
      }

      const { error } = await supabase
        .from('products')
        .update({
          title: editProductForm.title,
          price: priceNum,
          condition: editProductForm.condition,
          status: editProductForm.status
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      await loadAdminData();
      setShowEditProductModal(false);
      setSelectedProduct(null);
      alert('Product updated successfully!');
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update product. Please try again.');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      await loadAdminData();
      alert('Product deleted successfully!');
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product. Please try again.');
    }
  };

  const handleAddCategory = () => {
    setSelectedCategory(null);
    setCategoryForm({ name: '', slug: '', description: '', icon: '' });
    setShowCategoryModal(true);
  };

  const handleEditCategory = (category: Category) => {
    setSelectedCategory(category);
    setCategoryForm({
      name: category.name,
      slug: category.slug,
      description: category.description,
      icon: category.icon
    });
    setShowCategoryModal(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name || !categoryForm.slug || !categoryForm.icon) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      if (selectedCategory) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: categoryForm.name,
            slug: categoryForm.slug,
            description: categoryForm.description,
            icon: categoryForm.icon
          })
          .eq('id', selectedCategory.id);

        if (error) throw error;
        alert('Category updated successfully!');
      } else {
        const { error } = await supabase
          .from('categories')
          .insert({
            name: categoryForm.name,
            slug: categoryForm.slug,
            description: categoryForm.description,
            icon: categoryForm.icon
          });

        if (error) throw error;
        alert('Category added successfully!');
      }

      await loadAdminData();
      setShowCategoryModal(false);
      setSelectedCategory(null);
    } catch (error) {
      console.error('Error saving category:', error);
      alert('Failed to save category. Please try again.');
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const { data: productsCount } = await supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('category_id', categoryId);

    if (productsCount && productsCount.length > 0) {
      alert('Cannot delete category. There are products using this category.');
      return;
    }

    if (!confirm('Are you sure you want to delete this category?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) throw error;

      await loadAdminData();
      alert('Category deleted successfully!');
    } catch (error) {
      console.error('Error deleting category:', error);
      alert('Failed to delete category. Please try again.');
    }
  };

  const handleOrderStatusUpdate = async (orderId: string, status: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) return;

      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;

      const statusMessages: Record<string, string> = {
        'processing': 'Your order is now being processed and will be shipped soon.',
        'completed': 'Your order has been completed and delivered successfully!',
        'cancelled': 'Your order has been cancelled. If you have any questions, please contact support.'
      };

      await supabase
        .from('notifications')
        .insert({
          user_id: order.user_id,
          type: 'order_update',
          title: 'Order Status Updated',
          message: statusMessages[status] || `Your order status has been updated to ${status}.`,
          data: { order_id: orderId, new_status: status }
        });

      await loadAdminData();
    } catch (error) {
      console.error('Error updating order:', error);
    }
  };

  const handleToggleUserAdmin = async (userId: string, currentIsAdmin: boolean) => {
    try {
      setUpdatingUserId(userId);
      const newRole = currentIsAdmin ? 'user' : 'admin';

      const { error } = await supabase
        .from('profiles')
        .update({
          role: newRole
        })
        .eq('id', userId);

      if (error) throw error;

      await loadAdminData();
      alert(`User role successfully updated to ${newRole}!`);
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user role. Please try again.');
    } finally {
      setUpdatingUserId(null);
    }
  };

  const navItems = [
    { id: 'overview', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'submissions', label: 'Product Submissions', icon: FileCheck, badge: stats.pendingSubmissions },
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'payments', label: 'Payments', icon: DollarSign },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'products', label: 'Products', icon: Box },
    { id: 'categories', label: 'Categories', icon: Tags },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const filteredSubmissions = submissions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredOrders = orders.filter(o =>
    o.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u =>
    u.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="fixed top-0 right-0 left-72 h-16 bg-white border-b border-gray-200 z-20 flex items-center justify-between px-6">
        <div className="flex-1 max-w-2xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search here... (Ctrl+K)"
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              readOnly
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <Bell className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <div id="profile-menu-container" className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-3 px-4 py-2 hover:bg-gray-100 rounded-lg transition"
            >
              <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                B
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-gray-900">Admin</p>
                <p className="text-xs text-gray-600">beckahex</p>
              </div>
              <ChevronDown className={`w-5 h-5 text-gray-600 transition-transform ${showProfileMenu ? 'rotate-180' : ''}`} />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-30">
                <button
                  onClick={() => {
                    navigate('/');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                >
                  <Home className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Home</p>
                    <p className="text-xs text-gray-500">Back to main site</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    navigate('/settings');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                >
                  <Settings className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Settings</p>
                    <p className="text-xs text-gray-500">Account preferences</p>
                  </div>
                </button>

                <div className="border-t border-gray-200 my-2"></div>

                <button
                  onClick={async () => {
                    await signOut();
                    navigate('/');
                    setShowProfileMenu(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition text-left text-red-600"
                >
                  <LogOut className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Sign Out</p>
                    <p className="text-xs text-red-500">Logout from admin panel</p>
                  </div>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className="w-72 bg-white border-r border-gray-200 flex flex-col fixed h-screen z-10">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
          <p className="text-sm text-gray-600 mt-1">Comprehensive Management</p>
        </div>

        <nav className="flex-1 p-4 overflow-y-auto">
          <button
            onClick={() => navigate('/')}
            className="w-full flex items-center gap-3 px-4 py-3 mb-4 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition border-2 border-gray-200"
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </button>

          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id as TabType)}
              className={`w-full flex items-center justify-between px-4 py-3 mb-2 rounded-lg font-medium transition ${
                activeTab === item.id
                  ? 'bg-green-600 text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  activeTab === item.id ? 'bg-white text-green-600' : 'bg-red-100 text-red-600'
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-200 space-y-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-600">Logged in as</p>
            <p className="font-semibold text-gray-900 text-sm">{user?.email}</p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              navigate('/');
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium text-white bg-red-600 hover:bg-red-700 transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-72 mt-16 flex flex-col">
        <div className="flex-1 p-8 pb-12">
          {activeTab === 'overview' && (
            <div>
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Dashboard Overview</h1>
                <p className="text-gray-600">Welcome back! Here's what's happening today.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <DollarSign className="w-6 h-6 text-blue-600" />
                    </div>
                    <TrendingUp className="w-5 h-5 text-green-500" />
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Total Revenue</h3>
                  <p className="text-3xl font-bold text-gray-900">${stats.totalRevenue.toFixed(2)}</p>
                  <p className="text-xs text-green-600 mt-2">+${stats.revenueThisMonth.toFixed(2)} this month</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-orange-100 rounded-lg">
                      <ShoppingBag className="w-6 h-6 text-orange-600" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Total Orders</h3>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalOrders}</p>
                  <p className="text-xs text-gray-600 mt-2">{stats.completedOrders} completed</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <Package className="w-6 h-6 text-green-600" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Total Products</h3>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalProducts}</p>
                  <p className="text-xs text-yellow-600 mt-2">{stats.pendingSubmissions} pending approval</p>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-3 bg-purple-100 rounded-lg">
                      <Users className="w-6 h-6 text-purple-600" />
                    </div>
                  </div>
                  <h3 className="text-sm font-medium text-gray-600 mb-1">Total Users</h3>
                  <p className="text-3xl font-bold text-gray-900">{stats.totalUsers}</p>
                  <p className="text-xs text-green-600 mt-2">+{stats.newUsersThisMonth} this month</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Recent Activities</h3>
                  <div className="space-y-4">
                    {submissions.filter(s => s.status === 'pending').slice(0, 5).map((submission) => (
                      <div key={submission.id} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                        <Clock className="w-5 h-5 text-yellow-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">{submission.title}</p>
                          <p className="text-xs text-gray-600">Submitted by {submission.profiles?.full_name}</p>
                        </div>
                        <button
                          onClick={() => setActiveTab('submissions')}
                          className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Review
                        </button>
                      </div>
                    ))}
                    {submissions.filter(s => s.status === 'pending').length === 0 && (
                      <p className="text-sm text-gray-500 text-center py-4">No pending submissions</p>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Stats</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">New Users</span>
                      <span className="text-lg font-bold text-gray-900">+{stats.newUsersThisMonth}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Active Orders</span>
                      <span className="text-lg font-bold text-gray-900">{orders.filter(o => o.status === 'pending').length}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <span className="text-sm text-gray-600">Revenue (Month)</span>
                      <span className="text-lg font-bold text-gray-900">${stats.revenueThisMonth.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'submissions' && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Product Submissions</h1>
                  <p className="text-gray-600">Review and approve submitted products</p>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search submissions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      />
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-yellow-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{submissions.filter(s => s.status === 'pending').length}</p>
                      <p className="text-sm text-gray-600">Pending</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{submissions.filter(s => s.status === 'approved').length}</p>
                      <p className="text-sm text-gray-600">Approved</p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{submissions.filter(s => s.status === 'rejected').length}</p>
                      <p className="text-sm text-gray-600">Rejected</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{submissions.length}</p>
                      <p className="text-sm text-gray-600">Total</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {filteredSubmissions.filter(s => s.status === 'pending').map((submission) => (
                      <div key={submission.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                        <div className="flex gap-4">
                          <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                            {submission.images?.[0] ? (
                              <img src={submission.images[0]} alt={submission.title} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="w-10 h-10 text-gray-400" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-bold text-gray-900 text-lg">{submission.title}</h4>
                                <p className="text-sm text-gray-600 line-clamp-2">{submission.description}</p>
                              </div>
                              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                                Pending
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                              <span className="flex items-center gap-1">
                                <DollarSign className="w-4 h-4" />
                                ${parseFloat(submission.price.toString()).toFixed(2)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                {new Date(submission.created_at).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                {submission.profiles?.full_name || 'Unknown'}
                              </span>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleApproveClick(submission)}
                                className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Set Price & Approve
                              </button>
                              <button
                                onClick={() => handleSubmissionAction(submission.id, 'rejected')}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition"
                              >
                                <XCircle className="w-4 h-4" />
                                Reject
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredSubmissions.filter(s => s.status === 'pending').length === 0 && (
                      <div className="text-center py-12">
                        <FileCheck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No pending submissions</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div>
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Orders Management</h1>
                <p className="text-gray-600">Track and manage all customer orders</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search orders..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">#{order.id.slice(0, 8)}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{order.profiles?.full_name || 'N/A'}</td>
                          <td className="px-6 py-4 text-sm font-semibold text-gray-900">${parseFloat(order.total_amount.toString()).toFixed(2)}</td>
                          <td className="px-6 py-4">
                            <select
                              value={order.status}
                              onChange={(e) => handleOrderStatusUpdate(order.id, e.target.value)}
                              className={`text-xs font-medium px-3 py-1 rounded-full border-0 ${
                                order.status === 'completed' ? 'bg-green-100 text-green-800' :
                                order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                                order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}
                            >
                              <option value="pending">Pending</option>
                              <option value="processing">Processing</option>
                              <option value="completed">Completed</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                              {order.payment_status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{new Date(order.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleViewOrderDetails(order)}
                              className="text-blue-600 hover:text-blue-800 transition"
                              title="View Order Details"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredOrders.length === 0 && (
                    <div className="text-center py-12">
                      <ShoppingBag className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No orders found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && (
            <PaymentsSection />
          )}

          {activeTab === 'users' && (
            <div>
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Users Management</h1>
                <p className="text-gray-600">Manage all platform users</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {filteredUsers.map((userItem) => (
                        <tr key={userItem.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 text-sm font-medium text-gray-900">{userItem.full_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">{userItem.email}</td>
                          <td className="px-6 py-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              userItem.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {userItem.role === 'admin' ? 'Admin' : 'User'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{new Date(userItem.created_at).toLocaleDateString()}</td>
                          <td className="px-6 py-4">
                            <button
                              onClick={() => handleToggleUserAdmin(userItem.id, userItem.role === 'admin')}
                              className={`px-3 py-1 rounded text-xs font-medium transition ${
                                userItem.role === 'admin'
                                  ? 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                                  : 'bg-green-600 text-white hover:bg-green-700'
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              disabled={userItem.id === user?.id || updatingUserId === userItem.id}
                            >
                              {updatingUserId === userItem.id ? 'Updating...' : userItem.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                      <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No users found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div>
              <div className="mb-6">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Products Management</h1>
                <p className="text-gray-600">Manage all products in the marketplace</p>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="p-4 border-b border-gray-200">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    />
                  </div>
                </div>

                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredProducts.map((product) => (
                      <div key={product.id} className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition">
                        <div className="h-48 bg-gray-100">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-16 h-16 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h3 className="font-bold text-gray-900 mb-2">{product.title}</h3>
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-lg font-bold text-green-600">${parseFloat(product.price.toString()).toFixed(2)}</span>
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              product.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {product.status}
                            </span>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEditProductClick(product)}
                              className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition"
                            >
                              <Edit className="w-4 h-4" />
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {filteredProducts.length === 0 && (
                    <div className="text-center py-12">
                      <Box className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-600">No products found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'categories' && (
            <div>
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 mb-2">Categories Management</h1>
                  <p className="text-gray-600">Manage product categories</p>
                </div>
                <button
                  onClick={handleAddCategory}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-semibold transition"
                >
                  <Plus className="w-5 h-5" />
                  Add Category
                </button>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {categories.map((category) => (
                    <div key={category.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition">
                      <div className="text-4xl mb-4">{category.icon}</div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">{category.name}</h3>
                      <p className="text-sm text-gray-600 mb-4">{category.description}</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditCategory(category)}
                          className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded text-sm font-medium transition"
                        >
                          <Edit className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.id)}
                          className="flex items-center justify-center gap-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded text-sm font-medium transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {categories.length === 0 && (
                  <div className="text-center py-12">
                    <Tags className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No categories found</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <footer className="mt-auto border-t border-gray-200 bg-white py-4 px-8">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 text-sm text-gray-600">
            <p>© 2024 Beckah Exchange Admin Panel. All rights reserved.</p>
            <div className="flex gap-4">
              <span>Version 1.0.0</span>
              <span>•</span>
              <a href="mailto:beckahex@beckah.org" className="hover:text-green-600 transition">Support</a>
            </div>
          </div>
        </footer>
      </main>

      {showPriceModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Set Final Price</h2>
              <button
                onClick={() => {
                  setShowPriceModal(false);
                  setSelectedSubmission(null);
                  setFinalPrice('');
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="flex gap-4">
                  <div className="w-32 h-32 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {selectedSubmission.images?.[0] ? (
                      <img
                        src={selectedSubmission.images[0]}
                        alt={selectedSubmission.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-12 h-12 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{selectedSubmission.title}</h3>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-3">{selectedSubmission.description}</p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className="px-2 py-1 bg-gray-100 rounded">
                        {selectedSubmission.condition}
                      </span>
                      <span>•</span>
                      <span>Submitted by {selectedSubmission.profiles?.full_name}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-blue-900">
                    <p className="font-semibold mb-1">Charity Platform Pricing</p>
                    <p>Sellers offer products at low prices for charity. Set the final customer price to include a markup that goes to support the charitable cause.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="text-sm font-medium text-gray-600 mb-2 flex items-center gap-2">
                    <TrendingDown className="w-4 h-4" />
                    Seller's Price
                  </label>
                  <div className="text-3xl font-bold text-gray-900">
                    ${parseFloat(selectedSubmission.price.toString()).toFixed(2)}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Original asking price</p>
                </div>

                <div className="bg-green-50 rounded-lg p-4 border-2 border-green-200">
                  <label className="text-sm font-medium text-green-700 mb-2 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    Final Customer Price
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-2xl font-bold text-gray-700">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={finalPrice}
                      onChange={(e) => setFinalPrice(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-2xl font-bold border-2 border-green-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                  <p className="text-xs text-green-700 mt-1">Price customers will pay</p>
                </div>
              </div>

              {finalPrice && parseFloat(finalPrice) > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 mb-6 border border-green-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Charity Contribution</span>
                    <span className="text-2xl font-bold text-green-600">
                      ${(parseFloat(finalPrice) - parseFloat(selectedSubmission.price.toString())).toFixed(2)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600">
                    This amount will support the charitable mission
                  </div>
                  <div className="mt-3 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-blue-500 transition-all duration-300"
                      style={{
                        width: `${Math.min((parseFloat(finalPrice) / (parseFloat(selectedSubmission.price.toString()) * 2)) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowPriceModal(false);
                    setSelectedSubmission(null);
                    setFinalPrice('');
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmissionApprove}
                  disabled={!finalPrice || parseFloat(finalPrice) <= 0}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Approve & Publish Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showEditProductModal && selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-2xl font-bold text-gray-900">Edit Product</h2>
              <button
                onClick={() => {
                  setShowEditProductModal(false);
                  setSelectedProduct(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="mb-6">
                <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden mb-4">
                  {selectedProduct.image_url ? (
                    <img
                      src={selectedProduct.image_url}
                      alt={selectedProduct.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product Title *
                  </label>
                  <input
                    type="text"
                    value={editProductForm.title}
                    onChange={(e) => setEditProductForm({ ...editProductForm, title: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter product title"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price ($) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editProductForm.price}
                    onChange={(e) => setEditProductForm({ ...editProductForm, price: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Condition *
                  </label>
                  <select
                    value={editProductForm.condition}
                    onChange={(e) => setEditProductForm({ ...editProductForm, condition: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="New">New</option>
                    <option value="Like New">Like New</option>
                    <option value="Good">Good</option>
                    <option value="Fair">Fair</option>
                    <option value="Used">Used</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Status *
                  </label>
                  <select
                    value={editProductForm.status}
                    onChange={(e) => setEditProductForm({ ...editProductForm, status: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="available">Available</option>
                    <option value="sold">Sold</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowEditProductModal(false);
                    setSelectedProduct(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateProduct}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  Update Product
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showOrderModal && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Order Details</h2>
                <p className="text-sm text-gray-600">Order ID: #{selectedOrder.id.slice(0, 8)}</p>
              </div>
              <button
                onClick={() => {
                  setShowOrderModal(false);
                  setSelectedOrder(null);
                  setOrderItems([]);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Customer Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 w-20">Name:</span>
                      <span className="font-medium text-gray-900">{selectedOrder.profiles?.full_name || 'N/A'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-900">{selectedOrder.profiles?.email || 'N/A'}</span>
                    </div>
                    {selectedOrder.profiles?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{selectedOrder.profiles.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <ShoppingBag className="w-5 h-5" />
                    Order Information
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Status:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        selectedOrder.status === 'completed' ? 'bg-green-100 text-green-800' :
                        selectedOrder.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                        selectedOrder.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {selectedOrder.status}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Payment:</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        selectedOrder.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {selectedOrder.payment_status}
                      </span>
                    </div>
                    {selectedOrder.payment_method && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Method:</span>
                        <span className="font-medium text-gray-900">{selectedOrder.payment_method}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium text-gray-900">
                        {new Date(selectedOrder.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {selectedOrder.shipping_address && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-blue-600" />
                    Shipping Address
                  </h3>
                  <p className="text-sm text-gray-700 whitespace-pre-line">{selectedOrder.shipping_address}</p>
                </div>
              )}

              <div className="mb-6">
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
                        <h4 className="font-semibold text-gray-900 mb-1">{item.products?.title || 'Unknown Product'}</h4>
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>Quantity: {item.quantity}</span>
                          <span>•</span>
                          <span className="font-semibold text-gray-900">${parseFloat(item.price.toString()).toFixed(2)} each</span>
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

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-xl font-bold text-gray-900">Total Amount</span>
                  <span className="text-3xl font-bold text-green-600">
                    ${parseFloat(selectedOrder.total_amount.toString()).toFixed(2)}
                  </span>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowOrderModal(false);
                      setSelectedOrder(null);
                      setOrderItems([]);
                    }}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCategoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedCategory ? 'Edit Category' : 'Add New Category'}
              </h2>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  setSelectedCategory(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category Name *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., Electronics"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Slug (URL-friendly name) *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.slug}
                    onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="e.g., electronics"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Icon (Emoji) *
                  </label>
                  <input
                    type="text"
                    value={categoryForm.icon}
                    onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-4xl text-center"
                    placeholder="📱"
                    maxLength={2}
                  />
                  <p className="text-xs text-gray-500 mt-1">Choose an emoji to represent this category</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                    placeholder="Brief description of this category"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setSelectedCategory(null);
                  }}
                  className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  {selectedCategory ? 'Update' : 'Create'} Category
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
