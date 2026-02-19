import { useState, useEffect } from 'react';
import { Search, Edit2, Trash2, Package, Eye, Upload, X, MoreVertical, User, Mail, Phone, MapPin, DollarSign, Save, Calendar } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  original_price: number | null;
  condition: string;
  image_url: string;
  images: string[];
  status: string;
  category_id: string | null;
  seller_id: string | null;
  created_at: string;
  categories: {
    id: string;
    name: string;
  } | null;
  profiles?: {
    full_name: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
}

interface Category {
  id: string;
  name: string;
}

interface ProductListProps {
  searchQuery?: string;
}

export default function ProductList({ searchQuery = '' }: ProductListProps) {
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [editedImages, setEditedImages] = useState<string[]>([]);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [uploadingNewImage, setUploadingNewImage] = useState(false);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const enrichedData = await Promise.all(
        (data || []).map(async (product) => {
          if (product.seller_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name, email, phone, address, city, country')
              .eq('id', product.seller_id)
              .maybeSingle();

            return { ...product, profiles: profile };
          }
          return product;
        })
      );

      setProducts(enrichedData || []);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadProducts();

      window.dispatchEvent(new CustomEvent('products-updated'));
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setImagePreview(product.image_url);
    setImageFile(null);
    setShowEditModal(true);
  };

  const handleViewDetails = async (product: Product) => {
    setViewingProduct(product);
    setEditedImages(product.images && product.images.length > 0 ? product.images : [product.image_url]);
    setShowViewModal(true);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImageToStorage = async (file: File): Promise<string> => {
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

    return publicUrl;
  };

  const handleUpdateProduct = async () => {
    if (!editingProduct) return;

    try {
      setUploading(true);

      let imageUrl = editingProduct.image_url;

      if (imageFile) {
        imageUrl = await uploadImageToStorage(imageFile);
      }

      const { error } = await supabase
        .from('products')
        .update({
          title: editingProduct.title,
          description: editingProduct.description,
          price: editingProduct.price,
          original_price: editingProduct.original_price,
          condition: editingProduct.condition,
          status: editingProduct.status,
          category_id: editingProduct.category_id,
          image_url: imageUrl
        })
        .eq('id', editingProduct.id);

      if (error) throw error;

      alert('✅ Product updated successfully!');
      await loadProducts();
      setShowEditModal(false);
      setEditingProduct(null);
      setImageFile(null);
      setImagePreview('');

      window.dispatchEvent(new CustomEvent('products-updated'));
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update product. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleAddImage = () => {
    if (newImageUrl && newImageUrl.trim()) {
      setEditedImages([...editedImages, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setEditedImages(editedImages.filter((_, idx) => idx !== index));
  };

  const handleImageFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingNewImage(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `products/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      setEditedImages([...editedImages, publicUrl]);
      alert('✅ Image uploaded successfully!');
    } catch (error) {
      console.error('Error uploading image:', error);
      alert('Failed to upload image');
    } finally {
      setUploadingNewImage(false);
    }
  };

  const handleSaveProductChanges = async () => {
    if (!viewingProduct) return;

    try {
      setUploading(true);

      const { error } = await supabase
        .from('products')
        .update({
          images: editedImages,
          image_url: editedImages && editedImages.length > 0 ? editedImages[0] : viewingProduct.image_url
        })
        .eq('id', viewingProduct.id);

      if (error) throw error;

      alert('✅ Product images updated successfully!');
      await loadProducts();
      setShowViewModal(false);

      window.dispatchEvent(new CustomEvent('products-updated'));
    } catch (error) {
      console.error('Error updating product:', error);
      alert('Failed to update product');
    } finally {
      setUploading(false);
    }
  };

  const filteredProducts = products.filter(product =>
    product.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getProductImage = (product: Product) => {
    if (product.images && product.images.length > 0) {
      return product.images[0];
    }
    return product.image_url;
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Product Catalog</h1>
        <p className="text-gray-600">View and manage all products in the store</p>
      </div>

      <div className="max-w-[1800px] mx-auto">
        <div className="bg-gray-50 rounded-lg overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="text-center py-16">
              <Package className="w-20 h-20 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 text-lg font-medium">No products found</p>
              <p className="text-gray-500 text-sm mt-2">Try adjusting your search</p>
            </div>
          ) : (
            <div className="p-2 md:p-3 space-y-2">
              {filteredProducts.map((product) => {
                const productImage = getProductImage(product);
                return (
                  <div key={product.id} className="bg-white rounded-xl md:rounded-2xl p-3 md:p-4 hover:shadow-md transition-all duration-200 relative">
                    <div className="flex items-start gap-2.5 md:gap-3">
                      <div className="relative flex-shrink-0">
                        <div
                          onClick={() => handleViewDetails(product)}
                          className="w-16 h-16 md:w-20 md:h-20 bg-gray-100 rounded-lg md:rounded-xl overflow-hidden cursor-pointer hover:opacity-90 transition"
                        >
                          {productImage ? (
                            <img
                              src={productImage}
                              alt={product.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-5 h-5 md:w-6 md:h-6 text-gray-400" />
                            </div>
                          )}
                        </div>
                        {product.original_price && product.original_price > product.price && (
                          <div className="absolute -top-1 -left-1 bg-emerald-500 text-white text-[9px] md:text-[10px] font-bold px-1.5 md:px-2 py-0.5 rounded-md">
                            ${parseFloat(product.price.toString()).toFixed(0)}
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
                                : 'text-blue-600'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                product.status === 'available'
                                  ? 'bg-emerald-600'
                                  : product.status === 'sold'
                                  ? 'bg-gray-600'
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
                                    onClick={() => {
                                      handleEdit(product);
                                      setActiveDropdown(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                    Edit
                                  </button>
                                  <div className="border-t border-gray-200 my-0.5"></div>
                                  <button
                                    onClick={() => {
                                      handleDelete(product.id);
                                      setActiveDropdown(null);
                                    }}
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
                            <p className="text-[10px] md:text-xs text-gray-500 mb-0.5 truncate">{product.categories?.name || 'Uncategorized'}</p>
                            <div className="flex items-baseline gap-1.5 md:gap-2 flex-wrap">
                              <p className="text-xl md:text-2xl font-bold text-gray-900">${parseFloat(product.price.toString()).toFixed(0)}</p>
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
                            <span className="hidden sm:inline">View</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showEditModal && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl max-w-3xl w-full max-h-[96vh] sm:max-h-[90vh] flex flex-col shadow-2xl">
            <div className="px-3 py-2.5 sm:p-4 md:p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600 flex-shrink-0 rounded-t-lg sm:rounded-t-xl">
              <h2 className="text-base sm:text-xl md:text-2xl font-bold text-white">Edit Product</h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setImageFile(null);
                  setImagePreview('');
                }}
                className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1.5 sm:p-2 transition"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" />
              </button>
            </div>

            <div className="px-3 py-3 sm:p-4 md:p-6 space-y-3 sm:space-y-4 md:space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">Product Image</label>
                <div className="flex items-start gap-2 sm:gap-4">
                  {imagePreview && (
                    <div className="w-20 h-20 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-lg sm:rounded-xl border-2 border-gray-200 overflow-hidden flex-shrink-0 shadow-sm">
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <label className="flex flex-col items-center justify-center w-full h-20 sm:h-28 md:h-32 border-2 border-dashed border-gray-300 rounded-lg sm:rounded-xl cursor-pointer hover:bg-gray-50 transition bg-white">
                      <div className="flex flex-col items-center justify-center py-2">
                        <Upload className="w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8 text-emerald-500 mb-1" />
                        <p className="text-xs sm:text-sm text-gray-700 font-medium px-2 text-center">Upload image</p>
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5">PNG, JPG, WEBP</p>
                      </div>
                      <input
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleImageSelect}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Product Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={editingProduct.title}
                  onChange={(e) => setEditingProduct({ ...editingProduct, title: e.target.value })}
                  className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-white border-2 border-gray-300 text-gray-900 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  placeholder="Enter product title"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Description</label>
                <textarea
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-white border-2 border-gray-300 text-gray-900 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition resize-none"
                  placeholder="Enter product description"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Category <span className="text-red-500">*</span></label>
                  <select
                    value={editingProduct.category_id || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category_id: e.target.value })}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-white border-2 border-gray-300 text-gray-900 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  >
                    <option value="">Select</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Condition <span className="text-red-500">*</span></label>
                  <select
                    value={editingProduct.condition}
                    onChange={(e) => setEditingProduct({ ...editingProduct, condition: e.target.value })}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-white border-2 border-gray-300 text-gray-900 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  >
                    <option value="new">New</option>
                    <option value="like-new">Like New</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 md:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Price ($) <span className="text-red-500">*</span></label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.price}
                    onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-white border-2 border-gray-300 text-gray-900 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Original ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.original_price || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, original_price: e.target.value ? parseFloat(e.target.value) : null })}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-white border-2 border-gray-300 text-gray-900 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                    placeholder="Optional"
                  />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5 sm:mb-2">Status <span className="text-red-500">*</span></label>
                  <select
                    value={editingProduct.status}
                    onChange={(e) => setEditingProduct({ ...editingProduct, status: e.target.value })}
                    className="w-full px-3 py-2 sm:px-4 sm:py-2.5 md:py-3 bg-white border-2 border-gray-300 text-gray-900 text-sm sm:text-base rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition"
                  >
                    <option value="available">Available</option>
                    <option value="sold">Sold</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="px-3 py-2.5 sm:p-4 md:p-6 border-t border-gray-200 flex gap-2 sm:gap-3 bg-gray-50 flex-shrink-0 rounded-b-lg sm:rounded-b-xl">
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setEditingProduct(null);
                  setImageFile(null);
                  setImagePreview('');
                }}
                disabled={uploading}
                className="flex-1 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-semibold disabled:opacity-50 text-xs sm:text-sm md:text-base"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateProduct}
                disabled={uploading}
                className="flex-1 px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20 text-xs sm:text-sm md:text-base"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    <span className="hidden sm:inline">Updating...</span>
                    <span className="sm:hidden">Saving...</span>
                  </>
                ) : (
                  <>
                    <span className="hidden sm:inline">Update Product</span>
                    <span className="sm:hidden">Save</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showViewModal && viewingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 md:p-4">
          <div className="bg-white rounded-xl md:rounded-2xl max-w-7xl w-full max-h-[95vh] flex flex-col shadow-2xl">
            <div className="p-4 md:p-6 bg-gradient-to-r from-emerald-600 to-teal-600 border-b border-emerald-700 flex items-center justify-between rounded-t-xl md:rounded-t-2xl flex-shrink-0">
              <div className="flex-1 min-w-0 mr-2">
                <h2 className="text-lg md:text-2xl font-bold text-white truncate">Product Details</h2>
                <p className="text-emerald-100 text-xs md:text-sm mt-1 truncate">ID: {viewingProduct.id.slice(0, 8).toUpperCase()}</p>
              </div>
              <div className="flex items-center gap-2 md:gap-4 flex-shrink-0">
                <div className="hidden sm:flex items-center gap-2 bg-white bg-opacity-20 px-3 md:px-4 py-1.5 md:py-2 rounded-lg">
                  <Calendar className="w-4 h-4 md:w-5 md:h-5 text-white" />
                  <span className="text-white font-medium text-xs md:text-sm">
                    {new Date(viewingProduct.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setShowViewModal(false);
                    setViewingProduct(null);
                    setEditedImages([]);
                    setNewImageUrl('');
                  }}
                  className="text-white hover:bg-white hover:bg-opacity-20 rounded-lg p-1.5 md:p-2 transition"
                >
                  <X className="w-5 h-5 md:w-6 md:h-6" />
                </button>
              </div>
            </div>

            <div className="p-3 md:p-6 space-y-4 md:space-y-6 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-600" />
                      Product Details
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Title</label>
                        <p className="font-semibold text-lg text-gray-900 mt-1">{viewingProduct.title}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</label>
                          <p className="font-medium text-gray-900 mt-1">{viewingProduct.categories?.name || 'Uncategorized'}</p>
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Condition</label>
                          <p className="font-medium text-gray-900 mt-1">{viewingProduct.condition}</p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Current Price</label>
                          <p className="font-bold text-emerald-600 mt-1 text-xl flex items-center gap-1">
                            <DollarSign className="w-5 h-5" />
                            ${viewingProduct.price.toFixed(2)}
                          </p>
                        </div>
                        {viewingProduct.original_price && viewingProduct.original_price > viewingProduct.price && (
                          <div>
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Original Price</label>
                            <p className="font-bold text-gray-400 mt-1 text-xl flex items-center gap-1 line-through">
                              <DollarSign className="w-5 h-5" />
                              ${viewingProduct.original_price.toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Description</label>
                        <p className="text-gray-700 mt-1 leading-relaxed">{viewingProduct.description || 'No description provided'}</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</label>
                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold mt-1 ${
                          viewingProduct.status === 'available'
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                            : viewingProduct.status === 'sold'
                            ? 'bg-gray-100 text-gray-700 border border-gray-200'
                            : viewingProduct.status === 'pending'
                            ? 'bg-blue-100 text-blue-700 border border-blue-200'
                            : 'bg-red-100 text-red-700 border border-red-200'
                        }`}>
                          {viewingProduct.status === 'available' ? 'Published' : viewingProduct.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <Package className="w-5 h-5 text-emerald-600" />
                      Product Images <span className="text-xs text-blue-600 font-normal">(Editable)</span>
                    </h3>
                    {editedImages && editedImages.length > 0 ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 gap-3">
                          {editedImages.map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img
                                src={img}
                                alt={`Product ${idx + 1}`}
                                className="w-full h-48 object-cover rounded-lg border-2 border-gray-200 group-hover:border-emerald-500 transition"
                              />
                              <div className="absolute top-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                                {idx + 1}/{editedImages.length}
                              </div>
                              <button
                                onClick={() => handleRemoveImage(idx)}
                                className="absolute top-2 left-2 bg-red-600 hover:bg-red-700 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition"
                                title="Remove image"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                        <div className="mt-4 space-y-3">
                          <div className="p-3 bg-white border-2 border-dashed border-emerald-300 rounded-lg">
                            <label className="text-xs font-semibold text-emerald-700 uppercase mb-2 block">📁 Upload from Device</label>
                            <label className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition text-sm font-medium cursor-pointer">
                              <Upload className="w-4 h-4" />
                              {uploadingNewImage ? 'Uploading...' : 'Choose Image File'}
                              <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={handleImageFileSelect}
                                disabled={uploadingNewImage}
                              />
                            </label>
                            <p className="text-xs text-gray-500 mt-2 text-center">PNG, JPG, WEBP (MAX. 5MB)</p>
                          </div>
                          <div className="p-3 bg-white border-2 border-dashed border-gray-300 rounded-lg">
                            <label className="text-xs font-semibold text-gray-600 uppercase">🔗 Or Add Image URL</label>
                            <div className="flex gap-2 mt-2">
                              <input
                                type="url"
                                value={newImageUrl}
                                onChange={(e) => setNewImageUrl(e.target.value)}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
                                placeholder="https://example.com/image.jpg"
                              />
                              <button
                                onClick={handleAddImage}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-100 rounded-lg p-8 text-center">
                        <Package className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 mb-3">No images available</p>
                      </div>
                    )}
                  </div>

                  {viewingProduct.profiles && (
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-5 border border-blue-200">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-600" />
                        Seller Information
                      </h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <User className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Full Name</label>
                            <p className="font-semibold text-gray-900">{viewingProduct.profiles.full_name || 'Not provided'}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
                          <div>
                            <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Email</label>
                            <p className="font-medium text-gray-900 text-sm break-all">{viewingProduct.profiles.email || 'Not provided'}</p>
                          </div>
                        </div>
                        {viewingProduct.profiles.phone && (
                          <div className="flex items-start gap-3">
                            <Phone className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                              <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Phone</label>
                              <p className="font-medium text-gray-900">{viewingProduct.profiles.phone}</p>
                            </div>
                          </div>
                        )}
                        {(viewingProduct.profiles.address || viewingProduct.profiles.city) && (
                          <div className="flex items-start gap-3">
                            <MapPin className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div>
                              <label className="text-xs font-semibold text-blue-700 uppercase tracking-wide">Location</label>
                              <p className="font-medium text-gray-900 text-sm">
                                {viewingProduct.profiles.address && <span>{viewingProduct.profiles.address}<br /></span>}
                                {viewingProduct.profiles.city && <span>{viewingProduct.profiles.city}</span>}
                                {viewingProduct.profiles.country && <span>, {viewingProduct.profiles.country}</span>}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-3 md:p-6 bg-gray-50 border-t border-gray-200 flex gap-2 md:gap-3 justify-between rounded-b-xl md:rounded-b-2xl flex-shrink-0">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  setViewingProduct(null);
                  setEditedImages([]);
                  setNewImageUrl('');
                }}
                className="flex-1 px-4 md:px-8 py-2.5 md:py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition font-medium text-sm md:text-base"
                disabled={uploading}
              >
                Close
              </button>
              <button
                onClick={handleSaveProductChanges}
                disabled={uploading}
                className="flex-1 px-4 md:px-8 py-2.5 md:py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition font-semibold disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg text-sm md:text-base"
              >
                {uploading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
