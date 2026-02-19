import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Loader2, ArrowLeft, Heart, Share2, ShoppingCart, Plus, Minus, Check, Package, Truck, Shield, RotateCcw, Star } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';

interface Product {
  id: string;
  title: string;
  description: string;
  price: string | number;
  original_price: string | number | null;
  submission_type?: 'donation' | 'symbolic_sale' | 'public_sale';
  condition: string;
  image_url: string;
  images?: string[];
  created_at: string;
  categories: {
    name: string;
  } | null;
}

export default function ProductDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);
  const favorited = id ? isFavorite(id) : false;

  useEffect(() => {
    loadProduct();
  }, [id]);

  const loadProduct = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(name)
        `)
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      setProduct(data);
    } catch (error) {
      console.error('Error loading product:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = async () => {
    if (!product) return;

    setIsAdding(true);
    try {
      await addToCart(product.id, quantity);
      setAddedToCart(true);
      setTimeout(() => setAddedToCart(false), 2000);
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleFavorite = () => {
    if (!product) return;
    if (favorited) {
      removeFromFavorites(product.id);
    } else {
      addToFavorites(product.id);
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.title,
        text: product?.description,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard!');
    }
  };

  const price = typeof product?.price === 'string' ? parseFloat(product.price) : product?.price || 0;
  const originalPrice = product?.original_price
    ? typeof product.original_price === 'string'
      ? parseFloat(product.original_price)
      : product.original_price
    : null;
  const discount = originalPrice ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-red-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <Package className="w-20 h-20 text-gray-300 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Product Not Found</h2>
        <p className="text-gray-600 mb-6">This product may be unavailable or has been removed</p>
        <button
          onClick={() => navigate('/')}
          className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg font-semibold transition"
        >
          Back to Shop
        </button>
      </div>
    );
  }

  const isProductUnavailable = product.status !== 'available';

  return (
    <div className="min-h-screen bg-gray-50 pb-20 lg:pb-0">
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition active:scale-95"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="font-medium text-sm sm:text-base">Back</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-12">
          <div className="space-y-3 sm:space-y-4">
            <div className="bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-sm border border-gray-200 relative group">
              {discount > 0 && (
                <div className="absolute top-2 left-2 sm:top-4 sm:left-4 bg-red-600 text-white px-2 py-1 sm:px-3 sm:py-1 rounded-full text-xs sm:text-sm font-bold z-10">
                  -{discount}%
                </div>
              )}
              <div className="aspect-square">
                {(() => {
                  let images = product.images;
                  if (typeof images === 'string') {
                    try {
                      images = JSON.parse(images);
                    } catch {
                      images = [];
                    }
                  }
                  const imageUrl = (images && images.length > 0 ? images[0] : product.image_url) || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800';

                  return (
                    <img
                      src={imageUrl}
                      alt={product.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800';
                      }}
                    />
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white rounded-lg p-2 sm:p-3 lg:p-4 text-center border border-gray-200">
                <Truck className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 mx-auto mb-1 sm:mb-2" />
                <p className="text-[10px] sm:text-xs font-medium text-gray-900">Free Shipping</p>
                <p className="text-[9px] sm:text-xs text-gray-500 hidden sm:block">All orders</p>
              </div>
              <div className="bg-white rounded-lg p-2 sm:p-3 lg:p-4 text-center border border-gray-200">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 mx-auto mb-1 sm:mb-2" />
                <p className="text-[10px] sm:text-xs font-medium text-gray-900">Secure Payment</p>
                <p className="text-[9px] sm:text-xs text-gray-500 hidden sm:block">100% secure</p>
              </div>
              <div className="bg-white rounded-lg p-2 sm:p-3 lg:p-4 text-center border border-gray-200">
                <RotateCcw className="w-5 h-5 sm:w-6 sm:h-6 text-red-600 mx-auto mb-1 sm:mb-2" />
                <p className="text-[10px] sm:text-xs font-medium text-gray-900">Easy Returns</p>
                <p className="text-[9px] sm:text-xs text-gray-500 hidden sm:block">30 days</p>
              </div>
            </div>
          </div>

          <div className="space-y-4 sm:space-y-6">
            <div>
              {product.categories && (
                <p className="text-xs sm:text-sm font-semibold text-red-600 mb-2 uppercase tracking-wide">
                  {product.categories.name}
                </p>
              )}
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2 sm:mb-3 leading-tight">
                {product.title}
              </h1>

              <div className="flex items-center gap-3 sm:gap-4 mb-3 sm:mb-4">
                <div className="flex items-center gap-0.5 sm:gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-4 h-4 sm:w-5 sm:h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="text-xs sm:text-sm text-gray-600">(4.8)</span>
              </div>

              <div className="flex items-baseline gap-2 sm:gap-3 mb-4 sm:mb-6 flex-wrap">
                <span className="text-3xl sm:text-4xl font-bold text-gray-900">
                  ${price.toFixed(2)}
                </span>
                {originalPrice && product?.submission_type !== 'donation' && (
                  <span className="text-xl sm:text-2xl text-gray-400 line-through">
                    ${originalPrice.toFixed(2)}
                  </span>
                )}
                {product?.submission_type === 'donation' && (
                  <span className="bg-green-500 text-white px-3 py-1.5 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
                    🎁 Donated Product
                  </span>
                )}
                {discount > 0 && product?.submission_type !== 'donation' && (
                  <span className="bg-red-100 text-red-700 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-bold">
                    Save {discount}%
                  </span>
                )}
              </div>

              {product?.submission_type === 'donation' && (
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 mb-4 sm:mb-6">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💚</span>
                    <div className="flex-1">
                      <p className="font-bold text-green-900 text-sm sm:text-base mb-2">100% Charitable Donation</p>
                      <p className="text-xs sm:text-sm text-green-700 mb-2">
                        This product was generously donated by the seller. When you purchase it:
                      </p>
                      <ul className="text-xs sm:text-sm text-green-700 space-y-1 mr-4">
                        <li>• You pay the full price shown (${typeof product.price === 'string' ? parseFloat(product.price).toFixed(2) : product.price.toFixed(2)})</li>
                        <li>• The seller receives nothing</li>
                        <li>• 100% goes to charity to help those in need ❤️</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {isProductUnavailable ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <Package className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <p className="font-semibold text-xs sm:text-sm">This product is currently unavailable</p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-lg sm:rounded-xl p-3 sm:p-4 mb-4 sm:mb-6">
                  <div className="flex items-center gap-2 text-green-700">
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                    <p className="font-semibold text-xs sm:text-sm">In Stock - Ready to Ship</p>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg sm:rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-bold text-gray-900 mb-3 text-sm sm:text-base">Product Details</h3>
                <div className="space-y-2 text-xs sm:text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Condition</span>
                    <span className="font-semibold text-gray-900">{product.condition}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Category</span>
                    <span className="font-semibold text-gray-900">
                      {product.categories?.name || 'General'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Product ID</span>
                    <span className="font-mono text-[10px] sm:text-xs text-gray-900">
                      #{product.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg sm:rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 sm:mb-6">
                <h3 className="font-bold text-gray-900 mb-3 text-sm sm:text-base">Description</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line text-xs sm:text-sm">
                  {product.description}
                </p>
              </div>
            </div>

            <div className="fixed lg:sticky bottom-0 left-0 right-0 lg:bottom-auto bg-white border-t border-gray-200 rounded-t-xl lg:rounded-xl shadow-lg p-4 sm:p-6 space-y-3 sm:space-y-4 z-20">
              <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                <div className="flex items-center bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-2 sm:p-3 hover:bg-gray-200 transition rounded-l-lg active:scale-95"
                  >
                    <Minus className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                  <span className="px-3 sm:px-4 lg:px-6 py-2 sm:py-3 font-semibold text-base sm:text-lg">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-2 sm:p-3 hover:bg-gray-200 transition rounded-r-lg active:scale-95"
                  >
                    <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>

                <button
                  onClick={handleFavorite}
                  className={`p-2 sm:p-3 rounded-lg border-2 transition active:scale-95 ${
                    favorited
                      ? 'bg-red-50 border-red-600 text-red-600'
                      : 'border-gray-300 text-gray-600 hover:border-red-600 hover:text-red-600'
                  }`}
                >
                  <Heart className={`w-5 h-5 sm:w-6 sm:h-6 ${favorited ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={handleShare}
                  className="p-2 sm:p-3 rounded-lg border-2 border-gray-300 text-gray-600 hover:border-gray-400 transition active:scale-95"
                >
                  <Share2 className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isAdding || addedToCart || isProductUnavailable}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base lg:text-lg transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2 active:scale-95 lg:active:scale-100"
              >
                {addedToCart ? (
                  <>
                    <Check className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-sm sm:text-base lg:text-lg">Added to Cart!</span>
                  </>
                ) : isAdding ? (
                  <>
                    <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 animate-spin" />
                    <span className="text-sm sm:text-base lg:text-lg">Adding...</span>
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" />
                    <span className="text-sm sm:text-base lg:text-lg">Add to Cart - ${(price * quantity).toFixed(2)}</span>
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  handleAddToCart();
                  setTimeout(() => navigate('/checkout'), 1000);
                }}
                disabled={isProductUnavailable}
                className="w-full bg-gray-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-sm sm:text-base lg:text-lg transition shadow-lg hover:shadow-xl active:scale-95 lg:active:scale-100"
              >
                Buy Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
