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
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 sticky top-16 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-medium">Back</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12">
          <div className="space-y-4">
            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-200 relative group">
              {discount > 0 && (
                <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-sm font-bold z-10">
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

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
                <Truck className="w-6 h-6 text-red-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-900">Free Shipping</p>
                <p className="text-xs text-gray-500">On all orders</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
                <Shield className="w-6 h-6 text-red-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-900">Secure Payment</p>
                <p className="text-xs text-gray-500">100% secure</p>
              </div>
              <div className="bg-white rounded-lg p-4 text-center border border-gray-200">
                <RotateCcw className="w-6 h-6 text-red-600 mx-auto mb-2" />
                <p className="text-xs font-medium text-gray-900">Easy Returns</p>
                <p className="text-xs text-gray-500">30 days</p>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              {product.categories && (
                <p className="text-sm font-semibold text-red-600 mb-2 uppercase tracking-wide">
                  {product.categories.name}
                </p>
              )}
              <h1 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
                {product.title}
              </h1>

              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star key={star} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <span className="text-sm text-gray-600">(4.8 rating)</span>
              </div>

              <div className="flex items-baseline gap-3 mb-6">
                <span className="text-4xl font-bold text-gray-900">
                  ${price.toFixed(2)}
                </span>
                {originalPrice && (
                  <span className="text-2xl text-gray-400 line-through">
                    ${originalPrice.toFixed(2)}
                  </span>
                )}
                {discount > 0 && (
                  <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-bold">
                    Save {discount}%
                  </span>
                )}
              </div>

              {isProductUnavailable ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 text-yellow-700">
                    <Package className="w-5 h-5" />
                    <p className="font-semibold">This product is currently unavailable</p>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center gap-2 text-green-700">
                    <Check className="w-5 h-5" />
                    <p className="font-semibold">In Stock - Ready to Ship</p>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-xl p-6 mb-6">
                <h3 className="font-bold text-gray-900 mb-3">Product Details</h3>
                <div className="space-y-2 text-sm">
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
                    <span className="font-mono text-xs text-gray-900">
                      #{product.id.slice(0, 8)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
                <h3 className="font-bold text-gray-900 mb-3">Description</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-xl shadow-lg p-6 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center bg-gray-100 rounded-lg">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-3 hover:bg-gray-200 transition rounded-l-lg"
                  >
                    <Minus className="w-5 h-5" />
                  </button>
                  <span className="px-6 py-3 font-semibold text-lg">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-3 hover:bg-gray-200 transition rounded-r-lg"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>

                <button
                  onClick={handleFavorite}
                  className={`p-3 rounded-lg border-2 transition ${
                    favorited
                      ? 'bg-red-50 border-red-600 text-red-600'
                      : 'border-gray-300 text-gray-600 hover:border-red-600 hover:text-red-600'
                  }`}
                >
                  <Heart className={`w-6 h-6 ${favorited ? 'fill-current' : ''}`} />
                </button>

                <button
                  onClick={handleShare}
                  className="p-3 rounded-lg border-2 border-gray-300 text-gray-600 hover:border-gray-400 transition"
                >
                  <Share2 className="w-6 h-6" />
                </button>
              </div>

              <button
                onClick={handleAddToCart}
                disabled={isAdding || addedToCart || isProductUnavailable}
                className="w-full bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
              >
                {addedToCart ? (
                  <>
                    <Check className="w-6 h-6" />
                    Added to Cart!
                  </>
                ) : isAdding ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-6 h-6" />
                    Add to Cart - ${(price * quantity).toFixed(2)}
                  </>
                )}
              </button>

              <button
                onClick={() => {
                  handleAddToCart();
                  setTimeout(() => navigate('/checkout'), 1000);
                }}
                disabled={isProductUnavailable}
                className="w-full bg-gray-900 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg transition shadow-lg hover:shadow-xl"
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
