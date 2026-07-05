import { useState } from 'react';
import { ChevronRight, Gavel } from 'lucide-react';
import type { PublicAuctionBid } from '../../types/auction';

interface AuctionRecentBidsProps {
  bids: PublicAuctionBid[];
}

export default function AuctionRecentBids({ bids }: AuctionRecentBidsProps) {
  const [showAll, setShowAll] = useState(false);
  const acceptedBids = bids.filter((bid) => bid.status === 'accepted');
  const visibleBids = showAll ? acceptedBids : acceptedBids.slice(0, 1);

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex min-h-11 items-center justify-between border-b border-gray-200 px-4 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-900">
          <Gavel className="h-4 w-4 text-emerald-600" /> Recent bids
        </h2>
        {acceptedBids.length > 1 ? (
          <button type="button" onClick={() => setShowAll((value) => !value)} className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800">
            {showAll ? 'Show less' : 'View all bids'} <ChevronRight className={`h-3.5 w-3.5 transition ${showAll ? 'rotate-90' : ''}`} />
          </button>
        ) : (
          <span className="text-xs font-semibold text-emerald-700">{acceptedBids.length} total</span>
        )}
      </div>

      {visibleBids.length === 0 ? (
        <div className="flex min-h-16 items-center justify-center px-4 py-3 text-center">
          <p className="text-sm text-gray-500"><span className="font-semibold text-gray-700">No bids yet.</span> Be the first to bid!</p>
        </div>
      ) : (
        <div className={showAll ? 'max-h-64 overflow-y-auto' : ''}>
          <div className="hidden grid-cols-[1.4fr_.7fr_.8fr] gap-3 bg-gray-50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-400 sm:grid">
            <span>Bidder</span><span>Amount</span><span className="text-right">Time</span>
          </div>
          <div className="divide-y divide-gray-100">
            {visibleBids.map((bid, index) => (
              <div key={bid.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 text-xs sm:grid-cols-[1.4fr_.7fr_.8fr]">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-gray-900">{bid.bidder_alias}</p>
                  {index === 0 && <p className="text-[10px] font-semibold text-emerald-700">Top bidder</p>}
                </div>
                <p className="font-bold text-gray-900">${Number(bid.amount).toFixed(2)}</p>
                <p className="col-span-2 text-[10px] text-gray-500 sm:col-span-1 sm:text-right">{new Date(bid.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
