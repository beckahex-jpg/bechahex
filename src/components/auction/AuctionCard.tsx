import { Gavel, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Auction } from '../../types/auction';
import { auctionPrice } from '../../types/auction';
import AuctionCountdown from './AuctionCountdown';

export default function AuctionCard({ auction }: { auction: Auction }) {
  const navigate = useNavigate();
  const image = auction.images?.[0];

  return (
    <button
      onClick={() => navigate(auction.product_id ? `/product/${auction.product_id}` : '/products?listing=auction')}
      className="group overflow-hidden rounded-2xl border border-gray-200 bg-white text-left shadow-sm transition hover:-translate-y-1 hover:shadow-xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {image ? (
          <img src={image} alt={auction.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center"><Package className="h-12 w-12 text-gray-300" /></div>
        )}
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-gray-900/90 px-3 py-1 text-xs font-bold text-white">
          <Gavel className="h-3.5 w-3.5" /> Auction
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h3 className="line-clamp-2 font-bold text-gray-900 group-hover:text-emerald-700">{auction.title}</h3>
          <p className="mt-1 text-xs text-gray-500">{auction.categories?.name || auction.condition}</p>
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-gray-500">{auction.bid_count > 0 ? 'Current bid' : 'Starting price'}</p>
            <p className="text-2xl font-black text-gray-900">${auctionPrice(auction).toFixed(2)}</p>
          </div>
          <span className="text-xs font-medium text-gray-500">{auction.bid_count} bids</span>
        </div>
        <div className="border-t border-gray-100 pt-3 text-sm">
          <AuctionCountdown startsAt={auction.starts_at} endsAt={auction.ends_at} status={auction.status} compact />
        </div>
      </div>
    </button>
  );
}
