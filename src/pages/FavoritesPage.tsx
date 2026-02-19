import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { useFavorites } from '../contexts/FavoritesContext';
import { useCart } from '../contexts/CartContext';
import { supabase } from '../lib/supabase';

interface Product {
  id: string;
  title: string;
  price: number;
  original_price: number | null;
  image_url: string;
  images?: string[];
  condition: string;
  status: string;
}

export default function FavoritesPage() {
  const navigate = useNavigate();
  const { favorites, removeFromFavorites } = useFavorites();
  const { addToCart } = useCart();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFavoriteProducts();
  }, [favorites]);

  const loadFavoriteProducts = async () => {
    if (favorites.length === 0) {
      setProducts([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', favorites)
        .eq('status', 'available');

      if (error) throw error;

      setProducts(data || []);
    } catch (error) {
      console.error('Error loading favorite products:', error);
    } finally {
      setLoading(false);
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
          <div className="flex items-center gap-3 mb-2">
            <Heart className="w-8 h-8 text-red-500 fill-current" />
            <h1 className="text-3xl font-bold text-gray-900">My Favorites</h1>
          </div>
          <p className="text-gray-600">
            {products.length === 0
              ? 'You have no favorite items yet'
              : `${products.length} item${products.length !== 1 ? 's' : ''} in your favorites`}
          </p>
        </div>

        {products.length === 0 ? (
          <div className="bg-white rounded-xl shadow-sm p-12 text-center">
            <Heart className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No favorites yet</h2>
            <p className="text-gray-600 mb-6">Start adding products to your favorites to see them here</p>
            <button
              onClick={() => navigate('/')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition"
            >
              Browse Products
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.map((product) => {
              const priceNum = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
              const originalPriceNum = product.original_price
                ? typeof product.original_price === 'string'
                  ? parseFloat(product.original_price)
                  : product.original_price
                : null;
              const discount = originalPriceNum
                ? Math.round(((originalPriceNum - priceNum) / originalPriceNum) * 100)
                : 0;

              let images = product.images;
              if (typeof images === 'string') {
                try {
                  images = JSON.parse(images);
                } catch {
                  images = [];
                }
              }

              return (
                <div
                  key={product.id}
                  className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden border border-gray-100 group"
                >
                  <div
                    onClick={() => navigate(`/product/${product.id}`)}
                    className="relative overflow-hidden bg-gray-100 cursor-pointer"
                  >
                    <img
                      src={(images && images.length > 0 ? images[0] : product.image_url) || 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800'}
                      alt={product.title}
                      className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800';
                      }}
                    />

                    {discount > 0 && (
                      <div className="absolute top-3 left-3 bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
                        -{discount}%
                      </div>
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFromFavorites(product.id);
                      }}
                      className="absolute top-3 right-3 bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-4 space-y-3">
                    <div
                      onClick={() => navigate(`/product/${product.id}`)}
                      className="cursor-pointer"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1 group-hover:text-blue-600 transition">
                          {product.title}
                        </h3>
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 shrink-0">
                          {product.condition}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-2xl font-bold text-gray-900">
                          ${priceNum.toFixed(2)}
                        </span>
                        {originalPriceNum && (
                          <span className="text-sm text-gray-400 line-through">
                            ${originalPriceNum.toFixed(2)}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        await addToCart(product.id);
                      }}
                      className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-3 rounded-lg font-medium transition shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    >
                      <ShoppingCart className="w-5 h-5" />
                      Add to Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
