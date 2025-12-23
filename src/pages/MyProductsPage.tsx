import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Trash2, Eye, AlertCircle, CheckCircle, Clock, XCircle,
  ArrowLeft, Search, MoreVertical, User, Mail, Phone, MapPin,
  Calendar, TrendingUp, ShoppingBag, X, Plus, DollarSign, Upload, Save
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  original_price?: number;
  condition: string;
  images: string[];
  category_id: string;
  status: 'pending' | 'approved' | 'rejected';
  submission_type: string;
  created_at: string;
  updated_at: string;
  rejection_reason?: string;
  product_id?: string;
  user_id: string;
  final_price?: number | null;
  ai_validation_status?: string | null;
  ai_suggested_price?: number | null;
  ai_validation_notes?: string | null;
  requires_manual_review?: boolean;
  auto_published?: boolean;
  categories?: {
    name: string;
  };
  profiles?: {
    full_name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
}

interface Stats {
  total: number;
  published: number;
  pending: number;
  rejected: number;
  totalSales: number;
}

export default function MyProductsPage() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    published: 0,
    pending: 0,
    rejected: 0,
    totalSales: 0
  });
  const [categories, setCategories] = useState<any[]>([]);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedCondition, setEditedCondition] = useState('');
  const [editedCategoryId, setEditedCategoryId] = useState('');
  const [editedImages, setEditedImages] = useState<string[]>([]);
  const [editedPrice, setEditedPrice] = useState('');
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) {
      openAuthModal('Please sign in to view your products');
      navigate('/');
      return;
    }
    loadProducts();
    fetchCategories();
  }, [user, navigate]);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('product_submissions')
        .select('*, categories(name)')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedData = await Promise.all(
        (data || []).map(async (product) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, phone, address, city, country')
            .eq('id', product.user_id)
            .maybeSingle();

          return {
            ...product,
            profiles: profile
          };
        })
      );

      setProducts(enrichedData);

      const statsData = {
        total: enrichedData.length,
        published: enrichedData.filter(p => p.status === 'approved').length,
        pending: enrichedData.filter(p => p.status === 'pending').length,
        rejected: enrichedData.filter(p => p.status === 'rejected').length,
        totalSales: 0
      };

      const { data: salesData } = await supabase
        .from('order_items')
        .select('quantity, price')
        .eq('seller_id', user?.id);

      if (salesData) {
        statsData.totalSales = salesData.reduce((sum, item) =>
          sum + (item.quantity * item.price), 0
        );
      }

      setStats(statsData);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (product: Product) => {
    setViewingProduct(product);
    setEditedTitle(product.title);
    setEditedDescription(product.description);
    setEditedCondition(product.condition);
    setEditedCategoryId(product.category_id);
    setEditedImages(product.images || []);
    setEditedPrice(product.price.toString());
    setShowViewModal(true);
    setActiveDropdown(null);
  };

  const handleAddImage = () => {
    if (newImageUrl && newImageUrl.trim()) {
      setEditedImages([...editedImages, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setEditedImages(editedImages.filter((_, i) => i !== index));
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Image size must be less than 5MB');
      return;
    }

    try {
      setUploadingImage(true);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setEditedImages([...editedImages, publicUrl]);
      alert('✅ Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image. Please try again.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveChanges = async () => {
    if (!viewingProduct) return;

    if (!editedTitle || !editedPrice || !editedCategoryId) {
      alert('Please fill in all required fields (Title, Price, Category)');
      return;
    }

    try {
      setSaving(true);

      const updateData = {
        title: editedTitle,
        description: editedDescription,
        condition: editedCondition,
        category_id: editedCategoryId,
        images: editedImages,
        price: parseFloat(editedPrice),
        updated_at: new Date().toISOString()
      };

      console.log('Updating product submission:', viewingProduct.id, updateData);

      const { data: submissionData, error: updateError } = await supabase
        .from('product_submissions')
        .update(updateData)
        .eq('id', viewingProduct.id)
        .select()
        .single();

      if (updateError) {
        console.error('Error updating submission:', updateError);
        throw updateError;
      }

      console.log('Submission updated successfully:', submissionData);

      if (viewingProduct.status === 'approved' && viewingProduct.product_id) {
        const productUpdateData = {
          title: editedTitle,
          description: editedDescription,
          condition: editedCondition,
          category_id: editedCategoryId,
          image_url: editedImages && editedImages.length > 0 ? editedImages[0] : '',
          images: editedImages,
          price: parseFloat(editedPrice),
          updated_at: new Date().toISOString()
        };

        console.log('Updating product:', viewingProduct.product_id, productUpdateData);

        const { data: productData, error: productError } = await supabase
          .from('products')
          .update(productUpdateData)
          .eq('id', viewingProduct.product_id)
          .select()
          .single();

        if (productError) {
          console.error('Error updating product:', productError);
          throw productError;
        }

        console.log('Product updated successfully:', productData);
      }

      alert('✅ Changes saved successfully!');
      setShowViewModal(false);
      await loadProducts();

      window.dispatchEvent(new CustomEvent('products-updated'));
    } catch (error: any) {
      console.error('Error saving changes:', error);
      alert(`Failed to save changes: ${error.message || 'Please try again.'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      const product = products.find(p => p.id === productId);

      if (product?.status === 'approved' && product.product_id) {
        const { count, error: countError } = await supabase
          .from('order_items')
          .select('*', { count: 'exact', head: true })
          .eq('product_id', product.product_id);

        if (countError) {
          console.error('Error checking sales:', countError);
          throw new Error('Failed to check if product has sales');
        }

        if (count && count > 0) {
          alert(`⚠️ Cannot delete this product!\n\nThis product has ${count} sale(s) and must be kept for sales history.\n\nProducts with sales cannot be deleted to maintain order records and sales data.`);
          setActiveDropdown(null);
          return;
        }
      }

      if (!confirm('Are you sure you want to delete this product? This action cannot be undone.')) {
        setActiveDropdown(null);
        return;
      }

      if (product?.status === 'approved' && product.product_id) {
        console.log('Deleting product from products table:', product.product_id);
        const { error: productError } = await supabase
          .from('products')
          .delete()
          .eq('id', product.product_id);

        if (productError) {
          console.error('Error deleting product from products table:', productError);
          throw new Error(`Failed to delete product: ${productError.message}`);
        }
        console.log('Product deleted from products table successfully');
      }

      console.log('Deleting submission:', productId);
      const { error } = await supabase
        .from('product_submissions')
        .delete()
        .eq('id', productId);

      if (error) throw error;
      console.log('Submission deleted successfully');

      alert('✅ Product deleted successfully!');
      await loadProducts();

      window.dispatchEvent(new CustomEvent('products-updated'));
    } catch (error: any) {
      console.error('Error deleting product:', error);
      alert(`❌ Failed to delete product: ${error.message || 'Please try again.'}`);
    }
    setActiveDropdown(null);
  };

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="px-3 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full flex items-center gap-1">
            <CheckCircle className="w-3 h-3" /> Published
          </span>
        );
      case 'pending':
        return (
          <span className="px-3 py-1 text-xs font-semibold bg-yellow-100 text-yellow-800 rounded-full flex items-center gap-1">
            <Clock className="w-3 h-3" /> Pending Review
          </span>
        );
      case 'rejected':
        return (
          <span className="px-3 py-1 text-xs font-semibold bg-red-100 text-red-800 rounded-full flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Rejected
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            Back to Dashboard
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">My Products</h1>
              <p className="text-gray-600">Manage your product listings and submissions</p>
            </div>
            <button
              onClick={() => navigate('/submit-product')}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-800 transition shadow-lg hover:shadow-xl font-semibold"
            >
              <Plus className="w-5 h-5" />
              Add New Product
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Products</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.total}</p>
              </div>
              <div className="p-3 bg-blue-100 rounded-lg">
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Published</p>
                <p className="text-3xl font-bold text-green-600 mt-1">{stats.published}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Pending</p>
                <p className="text-3xl font-bold text-yellow-600 mt-1">{stats.pending}</p>
              </div>
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Clock className="w-8 h-8 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Sales</p>
                <p className="text-3xl font-bold text-emerald-600 mt-1">${stats.totalSales.toFixed(2)}</p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-lg">
                <TrendingUp className="w-8 h-8 text-emerald-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading products...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Products Yet</h3>
              <p className="text-gray-600 mb-6">Start by submitting your first product!</p>
              <button
                onClick={() => navigate('/submit-product')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-medium"
              >
                <Plus className="w-5 h-5" />
                Submit Product
              </button>
            </div>
          ) : (
            <div className="p-2 md:p-3 space-y-2">
              {filteredProducts.map((product) => (
                <div key={product.id} className="bg-white rounded-xl md:rounded-2xl p-3 md:p-4 hover:shadow-md transition-all duration-200 relative">
                  <div className="flex items-start gap-2.5 md:gap-3">
                    <div className="relative flex-shrink-0">
                      <img
                        src={product.images[0] || '/placeholder.png'}
                        alt={product.title}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-lg md:rounded-xl object-cover"
                      />
                      {product.final_price && (
                        <div className="absolute -top-1 -left-1 bg-emerald-500 text-white text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded-md">
                          ${product.final_price}
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between mb-1.5 md:mb-2">
                        <div className="flex-1 pr-1.5 md:pr-2">
                          <h3 className="font-bold text-sm md:text-base text-gray-900 line-clamp-2 md:line-clamp-1 mb-1 leading-tight">{product.title}</h3>
                          <span className={`inline-flex items-center gap-1 text-[10px] md:text-[11px] font-medium ${
                            product.status === 'available'
                              ? 'text-emerald-600'
                              : product.status === 'sold'
                              ? 'text-gray-600'
                              : product.status === 'pending'
                              ? 'text-yellow-600'
                              : 'text-blue-600'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              product.status === 'available'
                                ? 'bg-emerald-600'
                                : product.status === 'sold'
                                ? 'bg-gray-600'
                                : product.status === 'pending'
                                ? 'bg-yellow-600'
                                : 'bg-blue-600'
                            }`}></span>
                            {product.status === 'available' ? 'Published' : product.status}
                          </span>
                        </div>
                        <button
                          onClick={() => setActiveDropdown(activeDropdown === product.id ? null : product.id)}
                          className="p-1 md:p-1.5 hover:bg-gray-100 rounded-lg transition relative flex-shrink-0"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-600" />
                          {activeDropdown === product.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() => setActiveDropdown(null)}
                              ></div>
                              <div className="absolute right-0 top-full mt-1 w-36 md:w-40 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-20">
                                <button
                                  onClick={() => handleDelete(product.id)}
                                  className="w-full px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  Delete
                                </button>
                              </div>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-end justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] md:text-xs text-gray-500 mb-0.5 truncate">{product.categories?.name || 'N/A'}</p>
                          <div className="flex items-baseline gap-1.5 md:gap-2 flex-wrap">
                            <p className="text-xl md:text-2xl font-bold text-gray-900">${product.price}</p>
                            <span className="text-[9px] md:text-[10px] text-gray-400 whitespace-nowrap">
                              {new Date(product.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: '2-digit'
                              })}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleViewDetails(product)}
                          className="flex items-center gap-1 md:gap-1.5 px-4 md:px-6 py-1.5 md:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium text-xs md:text-sm flex-shrink-0"
                        >
                          <Eye className="w-3.5 h-3.5 md:w-4 md:h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showViewModal && viewingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-[60] overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-6xl w-full my-8 flex flex-col shadow-2xl" style={{maxHeight: 'calc(100vh - 8rem)'}}>
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-6 py-5 rounded-t-2xl flex-shrink-0">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Product Details</h2>
                  <p className="text-emerald-100 text-sm">ID: {viewingProduct.id.slice(0, 8)}</p>
                </div>
                <div className="text-right">
                  {getStatusBadge(viewingProduct.status)}
                  <p className="text-emerald-100 text-sm mt-2 flex items-center gap-2 justify-end">
                    <Calendar className="w-4 h-4" />
                    {new Date(viewingProduct.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 overflow-y-auto flex-1 pb-20 lg:pb-6" style={{maxHeight: 'calc(100vh - 20rem)'}}>
              {viewingProduct.auto_published && (
                <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-l-4 border-purple-500 p-4 rounded-lg shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-purple-900 mb-1">🤖 AI Auto-Published</p>
                      <p className="text-sm text-purple-700">This product was automatically validated and published by AI</p>
                      {viewingProduct.ai_suggested_price && (
                        <div className="mt-3 bg-white bg-opacity-70 rounded-lg p-3 border border-purple-200">
                          <p className="text-xs font-semibold text-purple-800 uppercase mb-1">AI Suggested Price</p>
                          <p className="text-2xl font-bold text-purple-600 mb-2">${viewingProduct.ai_suggested_price}</p>
                          {viewingProduct.ai_validation_notes && (
                            <p className="text-xs text-purple-700 italic">"{viewingProduct.ai_validation_notes}"</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {viewingProduct.requires_manual_review && viewingProduct.status === 'pending' && (
                <div className="bg-gradient-to-r from-yellow-50 to-orange-50 border-l-4 border-yellow-500 p-4 rounded-lg shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-yellow-900 mb-1">⚠️ Pending Manual Review</p>
                      <p className="text-sm text-yellow-700">This product is awaiting admin approval</p>
                      {viewingProduct.ai_validation_notes && (
                        <div className="mt-3 bg-white bg-opacity-70 rounded-lg p-3 border border-yellow-200">
                          <p className="text-xs font-semibold text-yellow-800 uppercase mb-1">AI Review Notes</p>
                          <p className="text-sm text-yellow-900">{viewingProduct.ai_validation_notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {viewingProduct.status === 'rejected' && viewingProduct.rejection_reason && (
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-base font-bold text-red-900 mb-1">Rejection Reason</p>
                      <p className="text-sm text-red-800 italic">{viewingProduct.rejection_reason}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-600" />
                      Product Details
                    </h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Title</label>
                        <input
                          type="text"
                          value={editedTitle}
                          onChange={(e) => setEditedTitle(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Category</label>
                          <select
                            value={editedCategoryId}
                            onChange={(e) => setEditedCategoryId(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          >
                            {categories.map((cat) => (
                              <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Condition</label>
                          <select
                            value={editedCondition}
                            onChange={(e) => setEditedCondition(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          >
                            <option value="New">New</option>
                            <option value="Like New">Like New</option>
                            <option value="Good">Good</option>
                            <option value="Fair">Fair</option>
                            <option value="Poor">Poor</option>
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                          <DollarSign className="w-4 h-4 inline mr-1" />
                          Price
                        </label>
                        <input
                          type="number"
                          value={editedPrice}
                          onChange={(e) => setEditedPrice(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                          min="0"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">Description</label>
                        <textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm resize-none"
                          placeholder="Enter product description..."
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Upload className="w-5 h-5 text-emerald-600" />
                      Product Images
                    </h3>
                    {editedImages && editedImages.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          {editedImages.map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img
                                src={img}
                                alt={`Product ${idx + 1}`}
                                className="w-full h-40 object-cover rounded-lg border-2 border-gray-200 shadow-sm"
                              />
                              <div className="absolute top-2 right-2 bg-black bg-opacity-70 text-white text-xs font-bold px-2 py-1 rounded">
                                {idx + 1}/{editedImages.length}
                              </div>
                              <button
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute top-2 left-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition shadow-lg"
                                title="Remove image"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-3 pt-3 border-t border-gray-300">
                          <div className="bg-white border-2 border-dashed border-emerald-300 rounded-lg p-3">
                            <label className="block text-xs font-bold text-emerald-700 uppercase mb-2">Upload Image</label>
                            <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-semibold cursor-pointer">
                              <Upload className="w-4 h-4" />
                              {uploadingImage ? 'Uploading...' : 'Choose File'}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageFileSelect}
                                disabled={uploadingImage}
                              />
                            </label>
                          </div>
                          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Add Image URL</label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={newImageUrl}
                                onChange={(e) => setNewImageUrl(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                placeholder="https://example.com/image.jpg"
                              />
                              <button
                                onClick={handleAddImage}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-100 rounded-lg p-6 text-center">
                        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600 font-semibold mb-4">No images added yet</p>
                        <div className="space-y-3">
                          <div className="bg-white border-2 border-dashed border-emerald-300 rounded-lg p-3">
                            <label className="block text-xs font-bold text-emerald-700 uppercase mb-2">Upload Image</label>
                            <label className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-semibold cursor-pointer">
                              <Upload className="w-4 h-4" />
                              {uploadingImage ? 'Uploading...' : 'Choose File'}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageFileSelect}
                                disabled={uploadingImage}
                              />
                            </label>
                          </div>
                          <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-3">
                            <label className="block text-xs font-bold text-gray-700 uppercase mb-2">Add Image URL</label>
                            <div className="flex gap-2">
                              <input
                                type="url"
                                value={newImageUrl}
                                onChange={(e) => setNewImageUrl(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                placeholder="https://example.com/image.jpg"
                              />
                              <button
                                onClick={handleAddImage}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-semibold"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="fixed lg:relative bottom-0 left-0 right-0 px-4 md:px-6 py-4 md:py-5 bg-gray-50 border-t border-gray-200 lg:rounded-b-2xl flex flex-col sm:flex-row gap-3 sm:gap-4 sm:justify-end shadow-inner flex-shrink-0 z-10">
              <button
                onClick={() => setShowViewModal(false)}
                className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-3.5 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-semibold text-base flex items-center justify-center gap-2"
                disabled={saving}
              >
                <X className="w-5 h-5" />
                Close
              </button>
              <button
                onClick={handleSaveChanges}
                disabled={saving}
                className="w-full sm:w-auto px-6 md:px-8 py-3 md:py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white rounded-lg hover:from-emerald-700 hover:to-emerald-800 transition disabled:opacity-50 flex items-center justify-center gap-2 font-semibold text-base shadow-lg"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
