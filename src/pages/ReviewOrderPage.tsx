import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Star, Package, CheckCircle, AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { StarRatingInput } from '../components/reviews/StarRating';

interface OrderItem {
  product_id: string;
  seller_id: string | null;
  quantity: number;
  price: number;
  products: {
    id: string;
    title: string;
    image_url: string;
    condition: string;
  } | null;
}

interface ReviewableOrder {
  id: string;
  order_number?: string | null;
  status: string;
  confirmed_by_buyer: boolean;
  created_at: string;
  order_items: OrderItem[];
}

interface ExistingReview {
  id: string;
  product_id: string;
  rating: number;
  title: string | null;
  comment: string;
  status: string;
}

interface DraftReview {
  rating: number;
  title: string;
  comment: string;
  submitting: boolean;
  error: string | null;
}

export default function ReviewOrderPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, openAuthModal } = useAuth();

  const prefillRating = Math.min(5, Math.max(0, parseInt(searchParams.get('rating') || '0', 10) || 0));

  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<ReviewableOrder | null>(null);
  const [reviews, setReviews] = useState<Record<string, ExistingReview>>({});
  const [drafts, setDrafts] = useState<Record<string, DraftReview>>({});

  useEffect(() => {
    if (!user || !orderId) {
      setLoading(false);
      return;
    }
    loadOrder();
  }, [user, orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);

      const [orderRes, reviewsRes] = await Promise.all([
        supabase
          .from('orders')
          // '*' instead of an explicit column list: the live DB may not have
          // order_number yet, and naming a missing column fails the whole query
          .select(`
            *,
            order_items (
              product_id,
              seller_id,
              quantity,
              price,
              products (
                id,
                title,
                image_url,
                condition
              )
            )
          `)
          .eq('id', orderId)
          .eq('user_id', user?.id)
          .maybeSingle(),
        supabase
          .from('product_reviews')
          .select('id, product_id, rating, title, comment, status')
          .eq('order_id', orderId)
          .eq('reviewer_id', user?.id)
      ]);

      if (orderRes.error) throw orderRes.error;
      if (reviewsRes.error) throw reviewsRes.error;

      const loadedOrder = orderRes.data as ReviewableOrder | null;
      setOrder(loadedOrder);

      const reviewMap: Record<string, ExistingReview> = {};
      (reviewsRes.data || []).forEach((review) => {
        reviewMap[review.product_id] = review as ExistingReview;
      });
      setReviews(reviewMap);

      const draftMap: Record<string, DraftReview> = {};
      (loadedOrder?.order_items || []).forEach((item) => {
        if (!reviewMap[item.product_id]) {
          draftMap[item.product_id] = {
            rating: prefillRating,
            title: '',
            comment: '',
            submitting: false,
            error: null
          };
        }
      });
      setDrafts(draftMap);
    } catch (error) {
      console.error('Error loading order for review:', error);
      setOrder(null);
    } finally {
      setLoading(false);
    }
  };

  const updateDraft = (productId: string, patch: Partial<DraftReview>) => {
    setDrafts((prev) => ({
      ...prev,
      [productId]: { ...prev[productId], ...patch }
    }));
  };

  const handleSubmit = async (productId: string) => {
    const draft = drafts[productId];
    if (!draft) return;

    if (draft.rating < 1) {
      updateDraft(productId, { error: 'Please select a star rating first.' });
      return;
    }

    try {
      updateDraft(productId, { submitting: true, error: null });

      const { data, error } = await supabase.rpc('submit_product_review', {
        p_order_id: orderId,
        p_product_id: productId,
        p_rating: draft.rating,
        p_title: draft.title.trim() || null,
        p_comment: draft.comment.trim()
      });

      if (error) throw error;

      setReviews((prev) => ({
        ...prev,
        [productId]: {
          id: data?.review_id,
          product_id: productId,
          rating: data?.duplicate ? data.rating : draft.rating,
          title: draft.title.trim() || null,
          comment: draft.comment.trim(),
          status: 'published'
        }
      }));
    } catch (error: any) {
      console.error('Error submitting review:', error);
      updateDraft(productId, {
        submitting: false,
        error: error?.message || 'Failed to submit review. Please try again.'
      });
      return;
    }
  };

  const deliveryConfirmed = order ? order.status === 'delivered' || order.confirmed_by_buyer : false;

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-100">
            <Star className="w-6 h-6 text-teal-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Sign in to write your review</h1>
          <p className="text-gray-600 mb-6">Reviews can only be written from the account that placed the order.</p>
          <button
            onClick={() => openAuthModal('Please sign in to write your review')}
            className="w-full px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-teal-700 hover:to-emerald-700 transition"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-teal-600 animate-spin mx-auto" />
          <p className="mt-4 text-gray-600">Loading your order...</p>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-100">
            <Package className="w-6 h-6 text-gray-400" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Order not found</h1>
          <p className="text-gray-600 mb-6">We couldn't find this order in your account.</p>
          <button
            onClick={() => navigate('/buyer-orders')}
            className="w-full px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-teal-700 hover:to-emerald-700 transition"
          >
            View My Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <button
          onClick={() => navigate('/buyer-orders')}
          className="flex items-center gap-2 text-gray-600 hover:text-teal-700 font-medium mb-6 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to My Orders
        </button>

        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Rate Your Purchase</h1>
          <p className="text-gray-600">
            Order #{order.order_number || order.id.slice(0, 8).toUpperCase()} · {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {!deliveryConfirmed ? (
          <div className="bg-amber-50 border-l-4 border-amber-500 rounded-xl p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-bold text-amber-900 mb-1">Reviews open after delivery</p>
                <p className="text-sm text-amber-800 mb-4">
                  You can review the items in this order once it has been delivered and you have confirmed delivery.
                </p>
                <button
                  onClick={() => navigate('/buyer-orders')}
                  className="px-5 py-2.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition text-sm"
                >
                  Go to My Orders
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {order.order_items.map((item) => {
              const product = item.products;
              const submitted = reviews[item.product_id];
              const draft = drafts[item.product_id];

              return (
                <div key={item.product_id} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="p-5 border-b border-gray-100 flex items-center gap-4">
                    <img
                      src={product?.image_url || '/placeholder.png'}
                      alt={product?.title || 'Product'}
                      className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <h2 className="font-bold text-gray-900 truncate">{product?.title || 'Product no longer available'}</h2>
                      <p className="text-sm text-gray-500">
                        {product?.condition ? `${product.condition} · ` : ''}${item.price.toFixed(2)}
                        {item.quantity > 1 ? ` × ${item.quantity}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="p-5">
                    {submitted ? (
                      <div className="bg-green-50 border border-green-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle className="w-5 h-5 text-green-600" />
                          <p className="font-bold text-green-900">Review submitted</p>
                        </div>
                        <div className="flex items-center gap-0.5 mb-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-4 h-4 ${
                                star <= submitted.rating ? 'fill-yellow-400 text-yellow-400' : 'fill-gray-200 text-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        {submitted.title && <p className="text-sm font-semibold text-green-900">{submitted.title}</p>}
                        {submitted.comment && <p className="text-sm text-green-800">{submitted.comment}</p>}
                        <p className="text-xs text-green-700 mt-2">Thank you for helping other shoppers!</p>
                      </div>
                    ) : draft ? (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                            Your Rating <span className="text-red-500">*</span>
                          </label>
                          <StarRatingInput
                            value={draft.rating}
                            onChange={(rating) => updateDraft(item.product_id, { rating, error: null })}
                            disabled={draft.submitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                            Title <span className="text-gray-400 normal-case font-medium">(optional)</span>
                          </label>
                          <input
                            type="text"
                            value={draft.title}
                            maxLength={120}
                            onChange={(e) => updateDraft(item.product_id, { title: e.target.value })}
                            placeholder="Sum up your experience"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm"
                            disabled={draft.submitting}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
                            Your Review <span className="text-gray-400 normal-case font-medium">(optional)</span>
                          </label>
                          <textarea
                            value={draft.comment}
                            maxLength={2000}
                            rows={4}
                            onChange={(e) => updateDraft(item.product_id, { comment: e.target.value })}
                            placeholder="What did you like or dislike? How was the quality and the seller?"
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 text-sm resize-none"
                            disabled={draft.submitting}
                          />
                        </div>
                        {draft.error && (
                          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                            <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-red-700">{draft.error}</p>
                          </div>
                        )}
                        <button
                          onClick={() => handleSubmit(item.product_id)}
                          disabled={draft.submitting}
                          className="w-full sm:w-auto px-8 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-xl font-semibold hover:from-teal-700 hover:to-emerald-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                          {draft.submitting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Submitting...
                            </>
                          ) : (
                            <>
                              <Star className="w-4 h-4" />
                              Submit Review
                            </>
                          )}
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
