import { Heart, ShoppingCart, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useState } from 'react';

interface ProductCardProps {
  id: string;
  title: string;
  price: string | number;
  originalPrice?: string | number;
  image: string;
  condition: string;
  submissionType?: 'donation' | 'symbolic_sale' | 'public_sale';
}

export default function ProductCard({ id, title, price, originalPrice, image, condition, submissionType }: ProductCardProps) {
  const priceNum = typeof price === 'string' ? parseFloat(price) : price;
  const originalPriceNum = originalPrice ? (typeof originalPrice === 'string' ? parseFloat(originalPrice) : originalPrice) : 0;
  const discount = originalPriceNum ? Math.round(((originalPriceNum - priceNum) / originalPriceNum) * 100) : 0;
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const { protectedAction } = useAuthGuard();
  const [isAdding, setIsAdding] = useState(false);
  const favorited = isFavorite(id);

  return (
    <div
      onClick={() => navigate(`/product/${id}`)}
      className="group bg-white rounded-xl shadow-md hover:shadow-2xl transition-all duration-300 overflow-hidden border border-gray-100 cursor-pointer"
    >
      <div className="relative overflow-hidden bg-gray-100">
        {image ? (
          <img
            src={image}
            alt={title}
            className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800';
            }}
          />
        ) : (
          <img
            src="https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800"
            alt={title}
            className="w-full h-64 object-cover group-hover:scale-105 transition-transform duration-300"
          />
        )}

        <div className="absolute top-3 left-3 flex flex-col gap-2">
          {submissionType === 'donation' && (
            <div className="bg-green-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg flex items-center gap-1">
              🎁 Donated
            </div>
          )}
          {discount > 0 && submissionType !== 'donation' && (
            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
              -{discount}%
            </div>
          )}
        </div>

        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => {
              e.stopPropagation();
              protectedAction(async () => {
                if (favorited) {
                  await removeFromFavorites(id);
                } else {
                  await addToFavorites(id);
                }
              }, 'Please sign in to add items to favorites');
            }}
            className={`p-2 rounded-full shadow-lg transition mb-2 block ${
              favorited
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-white hover:bg-red-50 hover:text-red-500'
            }`}
          >
            <Heart className={`w-5 h-5 ${favorited ? 'fill-current' : ''}`} />
          </button>
          <button className="bg-white p-2 rounded-full shadow-lg hover:bg-blue-50 hover:text-blue-500 transition block">
            <Eye className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-1 group-hover:text-blue-600 transition">
            {title}
          </h3>
          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 shrink-0">
            {condition}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">
            ${priceNum.toFixed(2)}
          </span>
          {originalPrice && submissionType !== 'donation' && (
            <span className="text-sm text-gray-400 line-through">
              ${originalPriceNum.toFixed(2)}
            </span>
          )}
          {submissionType === 'donation' && (
            <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded">
              100% to charity
            </span>
          )}
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            protectedAction(async () => {
              setIsAdding(true);
              await addToCart(id);
              setIsAdding(false);
            }, 'Please sign in to add items to cart');
          }}
          disabled={isAdding}
          className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-lg font-medium transition shadow-md hover:shadow-lg flex items-center justify-center gap-2 group"
        >
          <ShoppingCart className="w-5 h-5" />
          {isAdding ? 'Adding...' : 'Add to Cart'}
        </button>
      </div>
    </div>
  );
}
