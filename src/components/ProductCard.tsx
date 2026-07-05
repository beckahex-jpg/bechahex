import { Gavel, Heart, Loader2, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuthGuard } from '../hooks/useAuthGuard';
import type { Auction } from '../types/auction';
import { auctionPrice } from '../types/auction';
import AuctionCountdown from './auction/AuctionCountdown';
import BidModal from './auction/BidModal';
import { StarRating } from './reviews/StarRating';

interface ProductCardProps {
  id: string;
  title: string;
  price: string | number;
  originalPrice?: string | number;
  image: string;
  condition: string;
  submissionType?: 'donation' | 'symbolic_sale' | 'public_sale';
  listingType?: 'fixed_price' | 'auction';
  auction?: Auction | null;
  palette?: 'default' | 'home';
  viewMode?: 'grid' | 'list';
  ratingAvg?: string | number | null;
  ratingCount?: number | null;
  variant?: 'catalog' | 'shelf';
}

export default function ProductCard({
  id,
  title,
  price,
  originalPrice,
  image,
  condition,
  submissionType,
  listingType = 'fixed_price',
  auction,
  viewMode = 'grid',
  ratingAvg,
  ratingCount,
  variant = 'catalog',
}: ProductCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const { protectedAction } = useAuthGuard();
  const [isAdding, setIsAdding] = useState(false);
  const [showBidModal, setShowBidModal] = useState(false);

  const isAuction = listingType === 'auction' && Boolean(auction);
  const displayedPrice = isAuction ? auctionPrice(auction!) : Number(price);
  const compareAtPrice = originalPrice ? Number(originalPrice) : null;
  const discount = compareAtPrice && compareAtPrice > displayedPrice
    ? Math.round(((compareAtPrice - displayedPrice) / compareAtPrice) * 100)
    : 0;
  const favorited = isFavorite(id);
  const isOwnAuction = isAuction && user?.id === auction?.seller_id;
  const canBid = isAuction && auction?.status === 'active' && !isOwnAuction;
  const fallbackImage = 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=800';
  const isShelf = variant === 'shelf';

  const openProduct = () => navigate(`/product/${id}`);

  const toggleFavorite = () => {
    protectedAction(async () => {
      if (favorited) await removeFromFavorites(id);
      else await addToFavorites(id);
    }, 'Please sign in to add items to your watchlist');
  };

  const primaryAction = () => {
    if (isAuction) {
      if (canBid) setShowBidModal(true);
      else openProduct();
      return;
    }

    protectedAction(async () => {
      setIsAdding(true);
      try {
        await addToCart(id);
      } finally {
        setIsAdding(false);
      }
    }, 'Please sign in to add items to your cart');
  };

  return (
    <article
      onClick={openProduct}
      className={`group relative cursor-pointer overflow-hidden bg-white transition duration-200 ${isShelf ? 'flex h-full flex-col rounded-xl border border-transparent hover:border-gray-200 hover:shadow-md' : `rounded-2xl border hover:border-gray-400 hover:shadow-lg ${isAuction ? 'border-emerald-300' : 'border-gray-200'} ${viewMode === 'list' ? 'sm:flex sm:min-h-56' : 'flex h-full flex-col'}`}`}
    >
      <div className={`relative overflow-hidden bg-gray-100 ${isShelf ? 'aspect-square rounded-xl' : viewMode === 'list' ? 'aspect-[4/3] sm:aspect-auto sm:w-64 sm:shrink-0' : 'aspect-square'}`}>
        <img
          src={image || fallbackImage}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          onError={(event) => { event.currentTarget.src = fallbackImage; }}
        />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          {isAuction && <span className="inline-flex items-center gap-1 rounded-full bg-[#032F24] px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-[#B9F45C]"><Gavel className="h-3 w-3" />Auction</span>}
          {submissionType === 'donation' && <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-white">Donated</span>}
          {discount > 0 && !isAuction && <span className="rounded-full bg-red-600 px-2.5 py-1 text-[10px] font-black text-white">-{discount}%</span>}
        </div>
        <button
          type="button"
          onClick={(event) => { event.stopPropagation(); toggleFavorite(); }}
          aria-label={favorited ? `Remove ${title} from watchlist` : `Add ${title} to watchlist`}
          className={`absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 shadow-sm transition ${favorited ? 'bg-red-50 text-red-600' : 'bg-white/95 text-gray-700 hover:text-red-600'}`}
        >
          <Heart className={`h-5 w-5 ${favorited ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className={`flex min-w-0 flex-1 flex-col ${isShelf ? 'px-1 pb-2 pt-3' : `p-3 ${viewMode === 'list' ? 'sm:p-5' : ''}`}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className={`font-semibold leading-5 text-gray-900 transition group-hover:underline ${viewMode === 'list' && !isShelf ? 'text-base sm:text-lg' : 'line-clamp-2 text-sm'}`}>{title}</h3>
            <p className="mt-1 text-xs text-gray-500">{condition}</p>
          </div>
          {viewMode === 'list' && submissionType === 'donation' && <span className="hidden shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 sm:block">Supports charity</span>}
        </div>

        {Boolean(ratingCount) && (
          <div className="mt-1.5">
            <StarRating value={Number(ratingAvg) || 0} count={ratingCount} size="sm" />
          </div>
        )}

        <div className="mt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">{isAuction ? (auction?.bid_count ? 'Current bid' : 'Starting bid') : 'Buy it now'}</p>
          <div className="mt-0.5 flex flex-wrap items-end gap-x-2 gap-y-1">
            <p className={`${!isShelf && viewMode === 'grid' ? 'text-xl' : 'text-2xl'} font-black tracking-tight text-gray-950`}>${displayedPrice.toFixed(2)}</p>
            {compareAtPrice && discount > 0 && !isAuction && <p className="pb-0.5 text-sm text-gray-400 line-through">${compareAtPrice.toFixed(2)}</p>}
          </div>
          {isAuction && auction && (
            <p className="mt-1 text-xs text-gray-600">
              {auction.bid_count} {auction.bid_count === 1 ? 'bid' : 'bids'} · {Number(auction.shipping_cost) === 0 ? 'Free shipping' : `$${Number(auction.shipping_cost).toFixed(2)} shipping`}
            </p>
          )}
          {!isAuction && submissionType === 'donation' && <p className="mt-1 text-xs font-semibold text-emerald-700">Proceeds support Beckah Foundation</p>}
        </div>

        {isAuction && auction && !isShelf && (
          <div className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-950">
            <AuctionCountdown startsAt={auction.starts_at} endsAt={auction.ends_at} status={auction.status} compact />
          </div>
        )}

        {isAuction && auction && isShelf && (
          <div className="mt-1 text-xs text-gray-600">
            <AuctionCountdown startsAt={auction.starts_at} endsAt={auction.ends_at} status={auction.status} compact />
          </div>
        )}

        {!isShelf && <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={(event) => { event.stopPropagation(); primaryAction(); }}
            disabled={isAdding}
            className={`flex min-h-10 w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${isAuction ? 'bg-[#9BEC2D] text-[#032F24] hover:bg-[#B9F45C]' : 'border border-gray-900 bg-white text-gray-900 hover:bg-gray-900 hover:text-white'}`}
          >
            {isAdding ? <Loader2 className="h-4 w-4 animate-spin" /> : isAuction ? <Gavel className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
            {isAuction ? (isOwnAuction ? 'View your auction' : canBid ? 'Place bid' : 'View auction') : isAdding ? 'Adding…' : 'Add to cart'}
          </button>
        </div>}
      </div>

      {showBidModal && auction && (
        <BidModal auction={auction} onClose={() => setShowBidModal(false)} onSuccess={() => { /* Realtime refresh is handled by the catalog. */ }} />
      )}
    </article>
  );
}
