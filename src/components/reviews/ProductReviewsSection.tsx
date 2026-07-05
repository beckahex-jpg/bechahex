import { useEffect, useState } from 'react';
import { BadgeCheck, Loader2, Star, UserRound } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { StarRating } from './StarRating';

const PAGE_SIZE = 10;

interface PublicReview {
  id: string;
  product_id: string;
  seller_id: string;
  rating: number;
  title: string | null;
  comment: string;
  created_at: string;
  reviewer_name: string;
}

interface SellerStats {
  rating_avg: number;
  rating_count: number;
}

interface ProductReviewsSectionProps {
  productId: string;
  sellerId?: string | null;
  ratingAvg?: string | number | null;
  ratingCount?: number | null;
}

export default function ProductReviewsSection({ productId, sellerId, ratingAvg, ratingCount }: ProductReviewsSectionProps) {
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [sellerStats, setSellerStats] = useState<SellerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const avg = Number(ratingAvg) || 0;
  const count = ratingCount || 0;

  useEffect(() => {
    loadReviews(0);
    if (sellerId) loadSellerStats();
  }, [productId, sellerId]);

  const loadReviews = async (from: number) => {
    try {
      if (from === 0) setLoading(true);
      else setLoadingMore(true);

      const { data, error } = await supabase
        .from('public_product_reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

      if (error) throw error;

      const rows = (data || []) as PublicReview[];
      setReviews((prev) => (from === 0 ? rows : [...prev, ...rows]));
      setHasMore(rows.length === PAGE_SIZE);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadSellerStats = async () => {
    try {
      const { data, error } = await supabase
        .from('seller_review_stats')
        .select('rating_avg, rating_count')
        .eq('seller_id', sellerId)
        .maybeSingle();

      if (error) throw error;
      setSellerStats(data as SellerStats | null);
    } catch (error) {
      console.error('Error loading seller stats:', error);
    }
  };

  return (
    <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
      <h2 className="flex items-center gap-2 text-lg font-bold text-gray-900">
        <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
        Customer Reviews
      </h2>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {count > 0 ? (
          <div className="flex items-center gap-3">
            <p className="text-4xl font-black tracking-tight text-gray-900">{avg.toFixed(1)}</p>
            <div>
              <StarRating value={avg} count={count} showCount={false} size="md" />
              <p className="mt-0.5 text-xs text-gray-500">
                Based on {count} verified {count === 1 ? 'purchase' : 'purchases'}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No reviews yet — be the first to review this product after your purchase.</p>
        )}

        {sellerStats && sellerStats.rating_count > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-gray-50 px-3 py-2">
            <UserRound className="h-4 w-4 text-gray-500" />
            <p className="text-xs text-gray-700">
              Seller rating:{' '}
              <span className="font-bold text-gray-900">★ {Number(sellerStats.rating_avg).toFixed(1)}</span>
              {' '}· {sellerStats.rating_count} {sellerStats.rating_count === 1 ? 'review' : 'reviews'} across their listings
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
        </div>
      ) : reviews.length > 0 ? (
        <div className="mt-5 space-y-4">
          {reviews.map((review) => (
            <article key={review.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-800">
                    {review.reviewer_name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{review.reviewer_name}</p>
                    <p className="text-[11px] text-gray-500">
                      {new Date(review.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-[10px] font-bold text-green-700">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  Verified Purchase
                </span>
              </div>
              <div className="mt-2 flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-3.5 w-3.5 ${star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'}`}
                  />
                ))}
              </div>
              {review.title && <p className="mt-2 text-sm font-bold text-gray-900">{review.title}</p>}
              {review.comment && <p className="mt-1 whitespace-pre-line text-sm leading-6 text-gray-600">{review.comment}</p>}
            </article>
          ))}

          {hasMore && (
            <button
              type="button"
              onClick={() => loadReviews(reviews.length)}
              disabled={loadingMore}
              className="w-full rounded-full border border-gray-300 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-emerald-400 hover:text-emerald-700 disabled:opacity-50"
            >
              {loadingMore ? 'Loading…' : 'Show more reviews'}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
