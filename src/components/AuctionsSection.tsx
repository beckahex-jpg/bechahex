import { useCallback, useEffect, useState } from 'react';
import { Gavel } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Auction } from '../types/auction';
import LiveAuctionCard from './auction/LiveAuctionCard';

export default function AuctionsSection() {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAuctions = useCallback(async () => {
    const { data, error } = await supabase
      .from('auctions')
      .select('*, categories(name)')
      .in('status', ['active', 'scheduled'])
      .order('ends_at', { ascending: true })
      .limit(12);
    if (!error) setAuctions((data || []) as Auction[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAuctions();

    const channel = supabase
      .channel('live-auctions-section')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, fetchAuctions)
      .subscribe();

    window.addEventListener('products-updated', fetchAuctions);
    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener('products-updated', fetchAuctions);
    };
  }, [fetchAuctions]);

  if (loading || auctions.length === 0) return null;

  return (
    <section className="relative overflow-hidden bg-[#032F24] py-10 sm:py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: [
            'radial-gradient(circle at 84% 18%, rgba(155, 236, 45, 0.15), transparent 25%)',
            'radial-gradient(circle at 18% 92%, rgba(11, 118, 84, 0.28), transparent 34%)',
            'linear-gradient(115deg, #032F24 0%, #043A2C 48%, #021F18 100%)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.45) 1px, transparent 1px)',
          backgroundSize: '46px 46px',
          maskImage: 'linear-gradient(to left, black, transparent 82%)',
        }}
      />

      <div aria-hidden="true" className="pointer-events-none absolute right-[9%] top-1/2 hidden -translate-y-1/2 lg:block">
        <div className="absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9BEC2D]/10" />
        <div className="absolute left-1/2 top-1/2 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#9BEC2D]/15" />
        <div className="absolute left-1/2 top-1/2 h-40 w-40 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9BEC2D]/5 blur-xl" />
        <Gavel className="h-52 w-52 -rotate-12 text-[#9BEC2D] opacity-[0.07]" strokeWidth={1.2} />
      </div>

      <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#9BEC2D]/10 blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-[#9BEC2D]/40 to-transparent" />

      <div className="market-container relative z-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="flex items-center gap-3 text-2xl font-black text-white sm:text-3xl">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-lime-400 text-[#062b1d]"><Gavel className="h-5 w-5" /></span>
              Auctions ending soon
            </h2>
            <p className="mt-2 text-sm text-emerald-100">Bid on distinctive finds before time runs out</p>
          </div>
          <button
            onClick={() => navigate('/products?listing=auction')}
            className="shrink-0 rounded-full border border-lime-400 px-4 py-2 text-xs font-bold text-lime-400 transition hover:bg-lime-400 hover:text-[#062b1d] sm:px-5 sm:py-2.5 sm:text-sm"
          >
            View All →
          </button>
        </div>

        <div className="scrollbar-hide -mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-3 [-webkit-overflow-scrolling:touch] sm:mx-0 sm:px-0">
          {auctions.map((auction) => (
            <LiveAuctionCard key={auction.id} auction={auction} onChanged={fetchAuctions} />
          ))}
        </div>
      </div>
    </section>
  );
}
