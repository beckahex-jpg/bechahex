import { useState } from 'react';
import { Gavel, Package } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { Auction } from '../../types/auction';
import { auctionPrice } from '../../types/auction';
import AuctionCountdown from './AuctionCountdown';
import BidModal from './BidModal';

interface LiveAuctionCardProps {
  auction: Auction;
  onChanged?: () => void;
}

export default function LiveAuctionCard({ auction, onChanged }: LiveAuctionCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showBidModal, setShowBidModal] = useState(false);
  const image = auction.images?.[0];
  const isOwn = user?.id === auction.seller_id;
  const canQuickBid = auction.status === 'active' && !isOwn;

  const openDetails = () => {
    navigate(auction.product_id ? `/product/${auction.product_id}` : '/products?listing=auction');
  };

  return (
    <div
      onClick={openDetails}
      className="group w-[78vw] max-w-72 shrink-0 snap-start cursor-pointer overflow-hidden rounded-2xl border border-lime-300/70 bg-white text-left shadow-md transition hover:-translate-y-1 hover:shadow-2xl"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
        {image ? (
          <img src={image} alt={auction.title} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center"><Package className="h-12 w-12 text-gray-300" /></div>
        )}
        <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-[#062b1d] px-3 py-1 text-xs font-black text-lime-400 shadow-lg">
          <Gavel className="h-3.5 w-3.5" /> AUCTION
        </span>
        <span className="absolute bottom-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-bold text-white">
          {auction.bid_count} bids
        </span>
      </div>

      <div className="space-y-3 p-4">
        <h3 className="line-clamp-1 font-bold text-gray-900 group-hover:text-emerald-700">{auction.title}</h3>
        <div className="flex items-end justify-between gap-2">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
              {auction.bid_count > 0 ? 'Current bid' : 'Starting price'}
            </p>
            <p className="text-2xl font-black text-[#0b2e20]">${auctionPrice(auction).toFixed(2)}</p>
          </div>
          <span className="text-xs font-medium text-gray-500">{auction.categories?.name || auction.condition}</span>
        </div>
        <div className="rounded-xl bg-lime-50 p-3 text-sm">
          <AuctionCountdown startsAt={auction.starts_at} endsAt={auction.ends_at} status={auction.status} compact />
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (canQuickBid) setShowBidModal(true);
            else openDetails();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-lime-400 py-3 font-black text-[#062b1d] shadow-md transition hover:bg-lime-300 hover:shadow-lg"
        >
          <Gavel className="h-5 w-5" />
          {isOwn ? 'View Your Auction' : canQuickBid ? 'Place Bid' : 'View Auction'}
        </button>
      </div>

      {showBidModal && (
        <BidModal
          auction={auction}
          onClose={() => setShowBidModal(false)}
          onSuccess={() => onChanged?.()}
        />
      )}
    </div>
  );
}
