import { useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, Loader2, Search, Star, Trash2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AdminReview {
  id: string;
  product_id: string;
  seller_id: string;
  order_id: string;
  reviewer_id: string;
  rating: number;
  title: string | null;
  comment: string;
  status: 'published' | 'hidden';
  created_at: string;
  products: { title: string; image_url: string | null } | null;
  profiles: { full_name: string | null; email: string | null } | null;
}

export default function ReviewsManagement({ searchQuery = '' }: { searchQuery?: string }) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'published' | 'hidden'>('all');
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminReview | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = async () => {
    const { data, error: fetchError } = await supabase
      .from('product_reviews')
      .select('*, products(title, image_url), profiles!product_reviews_reviewer_id_fkey(full_name, email)')
      .order('created_at', { ascending: false });
    if (fetchError) setError(fetchError.message);
    else setReviews((data || []) as unknown as AdminReview[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => reviews.filter((review) => {
    if (filter !== 'all' && review.status !== filter) return false;
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return `${review.products?.title || ''} ${review.profiles?.full_name || ''} ${review.profiles?.email || ''} ${review.title || ''} ${review.comment}`
      .toLowerCase()
      .includes(query);
  }), [reviews, filter, searchQuery]);

  const toggleVisibility = async (review: AdminReview) => {
    try {
      setUpdating(review.id);
      setError('');
      const nextStatus = review.status === 'published' ? 'hidden' : 'published';
      const { error: updateError } = await supabase
        .from('product_reviews')
        .update({ status: nextStatus })
        .eq('id', review.id);
      if (updateError) throw updateError;
      setReviews((prev) => prev.map((r) => (r.id === review.id ? { ...r, status: nextStatus } : r)));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to update review.');
    } finally {
      setUpdating(null);
    }
  };

  const deleteReview = async () => {
    if (!deleting) return;
    try {
      setSaving(true);
      setError('');
      const { error: deleteError } = await supabase
        .from('product_reviews')
        .delete()
        .eq('id', deleting.id);
      if (deleteError) throw deleteError;
      setReviews((prev) => prev.filter((r) => r.id !== deleting.id));
      setDeleting(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed to delete review.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex h-64 items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-emerald-600" /></div>;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 lg:text-3xl">Reviews Management</h1>
        <p className="mt-1 text-gray-600">Moderate customer reviews. Hidden reviews leave the product pages and rating averages immediately.</p>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {(['all', 'published', 'hidden'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`rounded-full px-3 py-2 text-xs font-bold capitalize ${filter === status ? 'bg-emerald-600 text-white' : 'border border-gray-200 bg-white text-gray-600'}`}
          >
            {status}
          </button>
        ))}
      </div>

      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {['Product', 'Reviewer', 'Rating', 'Review', 'Date', 'Status', 'Actions'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left text-xs font-bold uppercase text-gray-500">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visible.map((review) => (
                <tr key={review.id} className="hover:bg-gray-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      {review.products?.image_url ? (
                        <img src={review.products.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100"><Star className="h-5 w-5 text-gray-400" /></div>
                      )}
                      <p className="max-w-[180px] truncate font-bold text-gray-900">{review.products?.title || 'Deleted product'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-gray-900">{review.profiles?.full_name || '—'}</p>
                    <p className="text-xs text-gray-500">{review.profiles?.email || ''}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star key={star} className={`h-3.5 w-3.5 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="max-w-xs">
                      {review.title && <p className="truncate text-sm font-semibold text-gray-900">{review.title}</p>}
                      <p className={`text-sm text-gray-600 ${expanded === review.id ? 'whitespace-pre-line' : 'truncate'}`}>{review.comment || '—'}</p>
                      {review.comment.length > 60 && (
                        <button
                          onClick={() => setExpanded(expanded === review.id ? null : review.id)}
                          className="text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          {expanded === review.id ? 'Show less' : 'Show more'}
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                    {new Date(review.created_at).toLocaleDateString('en-US')}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${review.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'}`}>
                      {review.status}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleVisibility(review)}
                        disabled={updating === review.id}
                        className="rounded-lg border border-gray-200 p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50"
                        title={review.status === 'published' ? 'Hide review' : 'Unhide review'}
                      >
                        {updating === review.id ? <Loader2 className="h-4 w-4 animate-spin" /> : review.status === 'published' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => { setDeleting(review); setError(''); }}
                        className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                        title="Delete review"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {visible.length === 0 && (
          <div className="py-16 text-center text-gray-500">
            <Search className="mx-auto mb-2 h-9 w-9 text-gray-300" />
            No reviews match this filter.
          </div>
        )}
      </div>

      {deleting && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6">
            <h2 className="text-xl font-bold">Delete review</h2>
            <p className="mt-2 text-sm text-gray-600">
              This review of “{deleting.products?.title || 'a deleted product'}” will be permanently removed and the product's rating will be recalculated. Consider hiding it instead if you may need it later.
            </p>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button disabled={saving} onClick={() => setDeleting(null)} className="rounded-xl border border-gray-300 py-3 font-bold">Keep review</button>
              <button disabled={saving} onClick={deleteReview} className="flex items-center justify-center gap-2 rounded-xl bg-red-600 py-3 font-bold text-white disabled:opacity-60">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
