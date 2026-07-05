import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Clock, DollarSign, Eye, Gavel,
  Package, ShoppingBag, Tag, Timer, Truck, XCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import AuctionCountdown from '../components/auction/AuctionCountdown';

interface SellerStats {
  activeListings: number;
  liveAuctions: number;
  pendingReview: number;
  salesRevenue: number;
}

interface AttentionItems {
  ordersToShip: number;
  auctionsAwaitingPayment: number;
  rejectedSubmissions: number;
}

interface Submission {
  id: string;
  title: string;
  submission_type: string;
  price: number;
  status: string;
  created_at: string;
  images: string[];
  product_id?: string | null;
}

interface SellerAuction {
  id: string;
  title: string;
  status: string;
  starting_price: number;
  current_price: number | null;
  bid_count: number;
  starts_at: string;
  ends_at: string;
  images: string[];
  product_id: string | null;
}

export default function UserDashboard() {
  const { user, openAuthModal } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<SellerStats>({ activeListings: 0, liveAuctions: 0, pendingReview: 0, salesRevenue: 0 });
  const [attention, setAttention] = useState<AttentionItems>({ ordersToShip: 0, auctionsAwaitingPayment: 0, rejectedSubmissions: 0 });
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [liveAuctions, setLiveAuctions] = useState<SellerAuction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      openAuthModal('Please sign in to view your dashboard');
      navigate('/');
      return;
    }
    loadDashboardData();
  }, [user, navigate]);

  const loadDashboardData = async () => {
    if (!user) return;
    try {
      setLoading(true);

      const [statusesRes, recentRes, auctionsRes, salesRes, toShipRes] = await Promise.all([
        // Tiny payload: statuses only, for exact counts
        supabase.from('product_submissions').select('status').eq('user_id', user.id),
        supabase
          .from('product_submissions')
          .select('id, title, submission_type, price, status, created_at, images, product_id')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('auctions')
          .select('id, title, status, starting_price, current_price, bid_count, starts_at, ends_at, images, product_id')
          .eq('seller_id', user.id)
          .is('removed_at', null)
          .order('created_at', { ascending: false }),
        // Real money: only items from orders that were actually paid
        supabase.from('order_items').select('price, quantity, orders!inner(payment_status)').eq('seller_id', user.id).eq('orders.payment_status', 'paid'),
        // Paid orders not yet shipped (status values vary across legacy
        // flows, so decide by payment + tracking instead)
        supabase.from('order_items').select('order_id, orders!inner(status, tracking_number, confirmed_by_buyer)').eq('seller_id', user.id).eq('orders.payment_status', 'paid'),
      ]);

      const statuses = (statusesRes.data || []) as { status: string }[];
      const auctions = (auctionsRes.data || []) as SellerAuction[];
      const pendingSubmissions = statuses.filter((s) => s.status === 'pending').length;
      const approvedSubmissions = statuses.filter((s) => s.status === 'approved').length;
      const rejectedSubmissions = statuses.filter((s) => s.status === 'rejected').length;
      const live = auctions.filter((a) => ['active', 'scheduled'].includes(a.status));
      const pendingAuctions = auctions.filter((a) => a.status === 'pending_ai_review').length;
      const awaitingPayment = auctions.filter((a) => a.status === 'awaiting_payment').length;
      const revenue = ((salesRes.data || []) as { price: number; quantity: number }[])
        .reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
      interface ToShipOrder { status: string; tracking_number: string | null; confirmed_by_buyer: boolean }
      const toShipRows = (toShipRes.data || []) as unknown as { order_id: string; orders: ToShipOrder | ToShipOrder[] }[];
      const ordersToShip = new Set(
        toShipRows
          .filter((r) => {
            // many-to-one embed: PostgREST returns an object, but the
            // generated types say array — handle both
            const order = Array.isArray(r.orders) ? r.orders[0] : r.orders;
            return order && !order.tracking_number
              && !order.confirmed_by_buyer
              && !['delivered', 'cancelled'].includes(order.status);
          })
          .map((r) => r.order_id)
      ).size;

      setStats({
        activeListings: approvedSubmissions,
        liveAuctions: live.length,
        pendingReview: pendingSubmissions + pendingAuctions,
        salesRevenue: revenue,
      });
      setAttention({ ordersToShip, auctionsAwaitingPayment: awaitingPayment, rejectedSubmissions });
      setRecentSubmissions((recentRes.data || []) as Submission[]);
      setLiveAuctions(live.slice(0, 5));
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-[#FFF4CC] text-[#735400]';
      case 'approved':
        return 'bg-[#E4F7C9] text-[#07513B]';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');

  const getSubmissionTypeText = (type: string) => {
    switch (type) {
      case 'donation': return 'Donation';
      case 'symbolic_sale': return 'Symbolic Sale';
      case 'public_sale': return 'Public Sale';
      default: return type;
    }
  };

  const formatDate = (value: string) =>
    new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

  const attentionCount = attention.ordersToShip + attention.auctionsAwaitingPayment + attention.rejectedSubmissions;

  if (loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-gray-50">
        <div className="h-11 w-11 animate-spin rounded-full border-2 border-gray-200 border-t-[#07513B]" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24 lg:pb-12">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#07513B]">Seller center</p>
              <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">Seller dashboard</h1>
              <p className="mt-2 truncate text-sm text-gray-500">Welcome back, {user?.user_metadata?.full_name || user?.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:justify-end">
              <button
                onClick={() => navigate('/buyer-orders')}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#CFE8AC] bg-[#F2FAE8] px-4 text-sm font-bold text-[#07513B] transition hover:bg-[#E4F7C9]"
              >
                <ShoppingBag className="w-4 h-4" />
                My purchases
              </button>
              <button
                onClick={() => navigate('/submit-product')}
                className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#9BEC2D] bg-[#E4F7C9] px-4 text-sm font-bold text-[#07513B] transition hover:bg-[#D6F4AA]"
              >
                <Tag className="w-4 h-4" />
                Sell an item
              </button>
            </div>
          </div>
        </div>

        {/* Stats — one honest source each */}
        <section aria-label="Seller statistics" className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => navigate('/my-products?tab=approved')}
            className="flex items-center gap-3 rounded-2xl border border-[#CFE8AC] bg-[#F2FAE8] p-4 text-left transition hover:border-[#9BEC2D] hover:shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#07513B]"><Package className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-[#07513B]/70">Active listings</span>
              <span className="mt-0.5 block text-2xl font-black text-[#032F24]">{stats.activeListings}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/my-auctions')}
            className="flex items-center gap-3 rounded-2xl border border-[#BFE89A] bg-[#E4F7C9] p-4 text-left transition hover:border-[#9BEC2D] hover:shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#07513B]"><Gavel className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-[#07513B]/70">Live auctions</span>
              <span className="mt-0.5 block text-2xl font-black text-[#032F24]">{stats.liveAuctions}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/my-products?tab=pending')}
            className="flex items-center gap-3 rounded-2xl border border-[#E7D185] bg-[#FFF4CC] p-4 text-left transition hover:border-[#D8B94B] hover:shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/80 text-[#8A6500]"><Clock className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-[#735400]/75">Pending review</span>
              <span className="mt-0.5 block text-2xl font-black text-[#5A4300]">{stats.pendingReview}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => navigate('/seller-orders')}
            className="flex items-center gap-3 rounded-2xl border border-[#C7E5D8] bg-[#EEF8F4] p-4 text-left transition hover:border-[#8FCDB8] hover:shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-[#07513B]"><DollarSign className="h-5 w-5" /></span>
            <span className="min-w-0">
              <span className="block text-xs font-bold text-[#07513B]/70">Sales</span>
              <span className="mt-0.5 block truncate text-2xl font-black text-[#032F24]">${stats.salesRevenue.toFixed(0)}</span>
            </span>
          </button>
        </section>

        {/* Needs your attention */}
        <section className="mb-8 lg:mb-10" aria-labelledby="attention-heading">
          {attentionCount > 0 ? (
            <div className="rounded-2xl border border-[#CFE8AC] bg-[#F2FAE8] p-4 sm:p-5">
              <h2 id="attention-heading" className="mb-4 flex items-center gap-2 text-lg font-black text-[#032F24]">
                <AlertTriangle className="h-5 w-5 text-[#9A6B00]" />
                Needs your attention
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {attention.ordersToShip > 0 && (
                  <button
                    onClick={() => navigate('/seller-orders')}
                    className="flex items-center gap-3 rounded-2xl border border-[#CFE8AC] bg-white p-4 text-left transition hover:border-[#9BEC2D]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFF4CC] text-[#735400]"><Truck className="h-5 w-5" /></span>
                    <span>
                      <span className="block text-sm font-bold text-gray-900">{attention.ordersToShip} order{attention.ordersToShip > 1 ? 's' : ''} to ship</span>
                      <span className="block text-xs text-gray-500">Paid and waiting for shipment</span>
                    </span>
                  </button>
                )}
                {attention.auctionsAwaitingPayment > 0 && (
                  <button
                    onClick={() => navigate('/my-auctions')}
                    className="flex items-center gap-3 rounded-2xl border border-[#CFE8AC] bg-white p-4 text-left transition hover:border-[#9BEC2D]"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#F2FAE8] text-[#07513B]"><Timer className="h-5 w-5" /></span>
                    <span>
                      <span className="block text-sm font-bold text-gray-900">{attention.auctionsAwaitingPayment} auction{attention.auctionsAwaitingPayment > 1 ? 's' : ''} sold</span>
                      <span className="block text-xs text-gray-500">Waiting for the winner's payment</span>
                    </span>
                  </button>
                )}
                {attention.rejectedSubmissions > 0 && (
                  <button
                    onClick={() => navigate('/my-products?tab=rejected')}
                    className="flex items-center gap-3 rounded-2xl border border-red-200 bg-white p-4 text-left transition hover:border-red-400"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"><XCircle className="h-5 w-5" /></span>
                    <span>
                      <span className="block text-sm font-bold text-gray-900">{attention.rejectedSubmissions} rejected listing{attention.rejectedSubmissions > 1 ? 's' : ''}</span>
                      <span className="block text-xs text-gray-500">Review and resubmit</span>
                    </span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-2xl border border-[#CFE8AC] bg-[#F2FAE8] p-4 text-[#07513B]">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <p className="text-sm font-bold">All caught up — nothing needs your attention right now.</p>
            </div>
          )}
        </section>

        {/* Two columns: recent submissions + live auctions */}
        <section aria-labelledby="activity-heading">
          <div className="mb-5">
            <h2 id="activity-heading" className="text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">Recent activity</h2>
            <p className="mt-1 text-sm text-gray-500">Manage your latest listings and live auctions.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg font-black text-gray-950">
                <Package className="h-5 w-5 text-[#07513B]" />
                Recent listings
              </h3>
              <button onClick={() => navigate('/my-products')} className="text-sm font-bold text-gray-900 hover:underline">
                See all
              </button>
            </div>
            <div className="p-3 sm:p-4">
              {recentSubmissions.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#F2FAE8]"><Package className="h-5 w-5 text-[#07513B]" /></div>
                  <p className="mb-1 text-sm font-bold text-gray-950">No submitted products yet</p>
                  <p className="mb-4 text-xs text-gray-500">Start by selling your first item.</p>
                  <button
                    onClick={() => navigate('/submit-product')}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#9BEC2D] bg-[#E4F7C9] px-5 text-sm font-bold text-[#07513B] transition hover:bg-[#D6F4AA]"
                  >
                    <Tag className="h-4 w-4" />
                    Sell an item
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {recentSubmissions.slice(0, 4).map((submission) => (
                    <div key={submission.id} className="rounded-xl p-3 transition hover:bg-[#F2FAE8]/70">
                      <div className="flex gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                          {submission.images?.length ? (
                            <img src={submission.images[0]} alt={submission.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center"><Package className="h-5 w-5 text-gray-400" /></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h4 className="mb-1 truncate text-sm font-bold text-gray-950">{submission.title}</h4>
                              <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                                <span className="rounded bg-gray-100 px-1.5 py-0.5 whitespace-nowrap">{getSubmissionTypeText(submission.submission_type)}</span>
                                <span>${Number(submission.price).toFixed(2)}</span>
                                <span className="text-gray-400">•</span>
                                <span className="whitespace-nowrap">{formatDate(submission.created_at)}</span>
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold whitespace-nowrap ${getStatusColor(submission.status)}`}>
                              {getStatusText(submission.status)}
                            </span>
                          </div>
                          {submission.status === 'approved' && submission.product_id && (
                            <button
                              onClick={() => navigate(`/product/${submission.product_id}`)}
                              className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-[#07513B] hover:underline"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View product
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-lg font-black text-gray-950">
                <Gavel className="h-5 w-5 text-[#07513B]" />
                Live auctions
              </h3>
              <button onClick={() => navigate('/my-auctions')} className="text-sm font-bold text-gray-900 hover:underline">
                See all
              </button>
            </div>
            <div className="p-3 sm:p-4">
              {liveAuctions.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-[#F2FAE8]"><Gavel className="h-5 w-5 text-[#07513B]" /></div>
                  <p className="mb-1 text-sm font-bold text-gray-950">No live auctions</p>
                  <p className="mb-4 text-xs text-gray-500">Auctions can bring better prices for sought-after items.</p>
                  <button
                    onClick={() => navigate('/submit-product?listing=auction')}
                    className="inline-flex min-h-10 items-center gap-2 rounded-full border border-[#9BEC2D] bg-[#E4F7C9] px-5 text-sm font-bold text-[#07513B] transition hover:bg-[#D6F4AA]"
                  >
                    <Gavel className="h-4 w-4" />
                    Create Auction
                  </button>
                </div>
              ) : (
                <div className="space-y-1">
                  {liveAuctions.slice(0, 4).map((auction) => (
                    <div
                      key={auction.id}
                      onClick={() => auction.product_id && navigate(`/product/${auction.product_id}`)}
                      className={`rounded-xl p-3 transition hover:bg-[#F2FAE8]/70 ${auction.product_id ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                          {auction.images?.length ? (
                            <img src={auction.images[0]} alt={auction.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center"><Gavel className="h-5 w-5 text-gray-400" /></div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="truncate text-sm font-bold text-gray-950">{auction.title}</h4>
                            <span className="shrink-0 rounded-full bg-[#E4F7C9] px-2.5 py-1 text-[11px] font-black text-[#07513B] whitespace-nowrap">
                              {auction.bid_count} bid{auction.bid_count === 1 ? '' : 's'}
                            </span>
                          </div>
                          <p className="mt-1 text-base font-black text-gray-950">
                            ${Number(auction.current_price ?? auction.starting_price).toFixed(2)}
                            <span className="ml-1 text-xs font-medium text-gray-500">{auction.bid_count > 0 ? 'current bid' : 'starting price'}</span>
                          </p>
                          <div className="mt-1 text-xs">
                            <AuctionCountdown startsAt={auction.starts_at} endsAt={auction.ends_at} status={auction.status} compact palette="brand" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        </section>
      </div>
    </main>
  );
}
