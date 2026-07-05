import { useEffect, useMemo, useState } from 'react';
import { Ban, Eye, Gavel, Loader2, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import type { Auction } from '../../types/auction';

export default function AuctionManagement({ searchQuery = '' }: { searchQuery?: string }) {
  const navigate = useNavigate();
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [cancelling, setCancelling] = useState<Auction | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    const { data, error: fetchError } = await supabase.from('auctions').select('*, categories(name), auction_payments(status)').order('created_at', { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setAuctions((data || []) as unknown as Auction[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Live monitoring: refresh whenever any auction changes (new bid, status
  // flip, AI moderation result) — the auctions table is in the realtime
  // publication and admin RLS allows reading every row.
  useEffect(() => {
    const channel = supabase
      .channel('admin-auction-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => { load(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const visible = useMemo(() => auctions.filter((auction) => {
    if (filter !== 'all' && auction.status !== filter) return false;
    const query = searchQuery.trim().toLowerCase();
    return !query || `${auction.title} ${auction.description}`.toLowerCase().includes(query);
  }), [auctions, filter, searchQuery]);

  const cancelAuction = async () => {
    if (!cancelling || reason.trim().length < 3) return setError('Enter a clear cancellation reason.');
    try {
      setSaving(true);
      setError('');
      const { data, error: cancelError } = await supabase.functions.invoke('remove-auction', {
        body: { auctionId: cancelling.id, reason: reason.trim() },
      });
      if (cancelError) {
        // Non-2xx responses surface as a generic FunctionsHttpError; the
        // endpoint's actionable message (refund pending, hold changed state,
        // capture in review) is in the response body.
        let message = cancelError.message;
        const context = (cancelError as { context?: Response }).context;
        if (context && typeof context.json === 'function') {
          try {
            const body = await context.json();
            if (body?.error) message = String(body.error);
          } catch { /* non-JSON body; keep the generic message */ }
        }
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      setCancelling(null);
      setReason('');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Auction could not be cancelled.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-emerald-600" /></div>;

  return (
    <div>
      <div className="mb-6"><h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">Auction Management</h1><p className="mt-1 text-gray-600">AI-published auctions can be monitored and removed immediately.</p></div>
      <div className="mb-5 flex flex-wrap gap-2">{['all', 'pending_ai_review', 'active', 'scheduled', 'blocked', 'awaiting_payment', 'paid', 'ended_no_bids', 'closed', 'cancelled_by_admin', 'cancelled_by_seller'].map((status) => <button key={status} onClick={() => setFilter(status)} className={`rounded-full px-3 py-2 text-xs font-bold ${filter === status ? 'bg-emerald-600 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}>{status.replace(/_/g, ' ')}</button>)}</div>
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50"><tr>{['Auction', 'Status', 'Payment', 'Price', 'Bids', 'Ends', 'AI risk', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">{heading}</th>)}</tr></thead>
            <tbody className="divide-y divide-gray-100">{visible.map((auction) => { const paymentPriority = ['captured', 'review_required', 'authorized', 'approved', 'created', 'cancelled', 'refunded', 'failed']; const paymentStatus = (auction.auction_payments || []).map((p) => p.status).sort((a, b) => { const ai = paymentPriority.indexOf(a); const bi = paymentPriority.indexOf(b); return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi); })[0]; return <tr key={auction.id} className="hover:bg-gray-50"><td className="px-4 py-4"><div className="flex items-center gap-3">{auction.images?.[0] ? <img src={auction.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100"><Gavel className="h-5 w-5 text-gray-400" /></div>}<div><p className="max-w-xs truncate font-bold text-gray-900">{auction.title}</p><p className="text-xs text-gray-500">{auction.categories?.name || auction.condition}</p></div></div></td><td className="px-4 py-4"><span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700">{auction.status.replace(/_/g, ' ')}</span></td><td className="px-4 py-4"><span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${paymentStatus === 'review_required' ? 'bg-red-100 text-red-700' : paymentStatus === 'captured' ? 'bg-green-100 text-green-700' : paymentStatus === 'authorized' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{paymentStatus?.replace(/_/g, ' ') || '—'}</span></td><td className="px-4 py-4 font-bold">${Number(auction.current_price ?? auction.starting_price).toFixed(2)}</td><td className="px-4 py-4">{auction.bid_count}</td><td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">{new Date(auction.ends_at).toLocaleString()}</td><td className="px-4 py-4 text-sm">{auction.ai_risk_score === null ? '—' : Number(auction.ai_risk_score).toFixed(2)}</td><td className="px-4 py-4"><div className="flex gap-2"><button onClick={() => navigate(auction.product_id ? `/product/${auction.product_id}` : '/products?listing=auction')} className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100" title="View"><Eye className="h-4 w-4" /></button>{!['cancelled_by_admin', 'cancelled_by_seller'].includes(auction.status) && <button onClick={() => { setCancelling(auction); setError(''); }} className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50" title="Remove auction"><Ban className="h-4 w-4" /></button>}</div></td></tr>; })}</tbody>
          </table>
        </div>
        {visible.length === 0 && <div className="py-16 text-center text-gray-500"><Search className="mx-auto mb-2 h-9 w-9 text-gray-300" />No auctions match this filter.</div>}
      </div>

      {cancelling && <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-6"><h2 className="text-xl font-bold">Remove auction</h2><p className="mt-2 text-sm text-gray-600">“{cancelling.title}” will disappear immediately. Bids and audit records will be preserved.</p><textarea rows={4} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required reason" className="mt-4 w-full rounded-xl border border-gray-300 p-3" />{error && <p className="mt-2 text-sm text-red-600">{error}</p>}<div className="mt-5 grid grid-cols-2 gap-3"><button disabled={saving} onClick={() => { setCancelling(null); setReason(''); setError(''); }} className="rounded-xl border border-gray-300 py-3 font-bold">Keep auction</button><button disabled={saving} onClick={cancelAuction} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-60">{saving && <Loader2 className="h-4 w-4 animate-spin" />}Remove</button></div></div></div>}
    </div>
  );
}
