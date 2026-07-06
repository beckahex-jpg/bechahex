import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Gift, Heart, Loader2, Minus, PackageCheck, Plus, Share2, ShieldCheck, ShoppingCart, Tag, Truck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import AuctionProductGallery from './auction/AuctionProductGallery';
import ProductReviewsSection from './reviews/ProductReviewsSection';
import { StarRating } from './reviews/StarRating';

export interface FixedPriceProduct {
  id: string;
  title: string;
  description: string;
  price: string | number;
  original_price: string | number | null;
  submission_type?: 'donation' | 'symbolic_sale' | 'public_sale';
  condition: string;
  image_url: string;
  images?: string[];
  status: string;
  stock?: number | string | null;
  seller_id?: string | null;
  rating_avg?: string | number;
  rating_count?: number;
  categories: { name: string } | null;
}

type ProductTab = 'about' | 'details' | 'shipping';

export default function FixedPriceDetailPage({ product }: { product: FixedPriceProduct }) {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { addToFavorites, removeFromFavorites, isFavorite } = useFavorites();
  const [activeTab, setActiveTab] = useState<ProductTab>('about');
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [activeAction, setActiveAction] = useState<'cart' | 'buy' | null>(null);
  const [addedToCart, setAddedToCart] = useState(false);
  const category = product.categories?.name || 'Marketplace';
  const isDonated = product.submission_type === 'donation';
  const stockCount = Math.max(0, Math.floor(Number(product.stock ?? 1)) || 0);
  const isSoldOut = product.status === 'sold' || stockCount <= 0;
  const isUnavailable = product.status !== 'available' || isSoldOut;
  const favorited = isFavorite(product.id);
  const price = typeof product.price === 'string' ? Number(product.price) : product.price;
  const originalPrice = product.original_price
    ? typeof product.original_price === 'string' ? Number(product.original_price) : product.original_price
    : null;
  const discount = originalPrice && originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const images = useMemo(() => Array.from(new Set([
    ...(product.images || []),
    product.image_url,
  ].filter((image): image is string => Boolean(image)))), [product.image_url, product.images]);
  const shouldShortenDescription = product.description.length > 240;
  const displayedDescription = shouldShortenDescription && !showFullDescription
    ? `${product.description.slice(0, 240).trimEnd()}…`
    : product.description;

  const tabs: Array<{ id: ProductTab; label: string }> = [
    { id: 'about', label: 'About' },
    { id: 'details', label: 'Details' },
    { id: 'shipping', label: 'Shipping' },
  ];

  const handleCartAction = async (buyNow: boolean) => {
    if (isUnavailable) return;
    try {
      setActiveAction(buyNow ? 'buy' : 'cart');
      await addToCart(product.id, quantity);
      if (buyNow) {
        navigate('/checkout');
      } else {
        setAddedToCart(true);
        window.setTimeout(() => setAddedToCart(false), 2000);
      }
    } catch (error) {
      console.error('Error adding product to cart:', error);
    } finally {
      setActiveAction(null);
    }
  };

  const handleFavorite = () => {
    if (favorited) removeFromFavorites(product.id);
    else addToFavorites(product.id);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({ title: product.title, text: product.description, url: window.location.href });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      window.alert('Link copied to clipboard!');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 pb-8">
      <div className="border-b border-gray-200 bg-white">
        <nav aria-label="Breadcrumb" className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-hidden px-4 py-2 text-xs text-gray-500 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="mr-2 rounded-full p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900"><ArrowLeft className="h-4 w-4" /></button>
          <button type="button" onClick={() => navigate('/')} className="hover:text-emerald-700">Home</button>
          <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
          <button type="button" onClick={() => navigate('/products')} className="whitespace-nowrap hover:text-emerald-700">Products</button>
          <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
          <span className="whitespace-nowrap">{category}</span>
          <ChevronRight className="hidden h-3 w-3 shrink-0 text-gray-300 sm:block" />
          <span className="hidden truncate font-medium text-gray-900 sm:block" aria-current="page">{product.title}</span>
        </nav>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
        <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.12fr)_minmax(280px,.88fr)_minmax(330px,.9fr)]">
          <div className="order-1 space-y-3 lg:col-start-1 lg:row-span-2 lg:row-start-1">
            <AuctionProductGallery images={images} title={product.title} />
            <section className="flex items-center gap-3 rounded-2xl border border-green-200 bg-white px-4 py-3 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700"><Heart className="h-4 w-4" /></span>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Every purchase makes a difference</h2>
                <p className="mt-0.5 text-xs leading-4 text-gray-500">Your purchase supports a more sustainable, community-minded marketplace.</p>
              </div>
            </section>
          </div>

          <section className="order-2 space-y-4 lg:col-start-2 lg:row-start-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{category}</p>
              <h1 className="mt-1.5 text-3xl font-bold leading-tight text-gray-900">{product.title}</h1>
              <div className="mt-2">
                <StarRating
                  value={Number(product.rating_avg) || 0}
                  count={product.rating_count}
                  size="md"
                  emptyLabel="No reviews yet"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {isDonated && <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800"><Gift className="h-3.5 w-3.5" />Donated Product</span>}
                {discount > 0 && <span className="inline-flex items-center rounded-full bg-red-100 px-3 py-1.5 text-xs font-bold text-red-700">Save {discount}%</span>}
              </div>
            </div>

            {isDonated && (
              <aside className="rounded-2xl border border-green-200 bg-green-50 p-3">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700"><Heart className="h-4 w-4 fill-current" /></span>
                  <div>
                    <h2 className="text-sm font-bold text-green-900">100% Charitable Donation</h2>
                    <p className="mt-0.5 text-xs leading-4 text-green-800">This product was generously donated by the seller.</p>
                    <ul className="mt-2 space-y-1 text-xs text-green-800">
                      <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />You pay the displayed price.</li>
                      <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />The seller receives nothing.</li>
                      <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />The proceeds support people in need.</li>
                    </ul>
                  </div>
                </div>
              </aside>
            )}

            <section className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm">
              <div role="tablist" aria-label="Product information" className="flex border-b border-gray-200">
                {tabs.map((tab) => (
                  <button key={tab.id} type="button" role="tab" aria-selected={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} className={`relative flex-1 px-2 pb-2 text-xs font-semibold transition ${activeTab === tab.id ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-900'}`}>
                    {tab.label}{activeTab === tab.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-600" />}
                  </button>
                ))}
              </div>
              <div className="pt-3 text-xs leading-5 text-gray-600">
                {activeTab === 'about' && <div role="tabpanel"><p className="whitespace-pre-line">{displayedDescription || 'No description has been added yet.'}</p>{shouldShortenDescription && <button type="button" onClick={() => setShowFullDescription((value) => !value)} className="mt-2 font-semibold text-emerald-700 hover:text-emerald-800">{showFullDescription ? 'Show less' : 'Show more'}</button>}</div>}
                {activeTab === 'details' && <dl role="tabpanel" className="space-y-3"><div className="flex justify-between gap-4"><dt>Condition</dt><dd className="font-semibold text-gray-900">{product.condition}</dd></div><div className="flex justify-between gap-4"><dt>Category</dt><dd className="font-semibold text-gray-900">{category}</dd></div><div className="flex justify-between gap-4"><dt>Product ID</dt><dd className="font-mono text-xs text-gray-900">#{product.id.slice(0, 8).toUpperCase()}</dd></div></dl>}
                {activeTab === 'shipping' && <div role="tabpanel"><p><strong className="text-gray-900">Free shipping</strong> is included with this product.</p><p className="mt-2 text-gray-500">Tracking is provided after the order ships.</p></div>}
              </div>
            </section>
          </section>

          <aside className="order-3 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-lg lg:col-span-2 lg:col-start-1 lg:row-start-3 xl:sticky xl:top-20 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1">
            <div className="flex items-center justify-between bg-gray-900 px-4 py-3 text-white">
              <span className="flex items-center gap-2 text-sm font-black uppercase tracking-wide"><Tag className="h-4 w-4" />Fixed price</span>
              <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${isUnavailable ? 'bg-red-500/20 text-red-100' : 'bg-green-500/20 text-green-100'}`}>{isSoldOut ? 'Sold out' : isUnavailable ? 'Unavailable' : 'Available'}</span>
            </div>
            <div className="space-y-4 p-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Price</p>
                <div className="mt-1 flex flex-wrap items-end gap-3"><p className="text-3xl font-black tracking-tight text-gray-900">${price.toFixed(2)}</p>{originalPrice && !isDonated && <p className="pb-1 text-base font-semibold text-gray-400 line-through">${originalPrice.toFixed(2)}</p>}</div>
              </div>

              <div className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold ${isUnavailable ? 'bg-yellow-50 text-yellow-800' : 'bg-green-50 text-green-800'}`}>
                {isUnavailable ? <Tag className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                {isSoldOut
                  ? 'This product is sold out.'
                  : isUnavailable
                    ? 'This product is currently unavailable.'
                    : stockCount <= 5
                      ? `Only ${stockCount} left in stock — order soon.`
                      : 'In stock and ready to ship.'}
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-gray-600">Quantity</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 flex-1 items-center justify-between overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} disabled={quantity === 1} aria-label="Decrease quantity" className="flex h-full w-11 items-center justify-center text-gray-600 transition hover:bg-gray-100 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
                    <span className="font-bold text-gray-900">{quantity}</span>
                    <button type="button" onClick={() => setQuantity((value) => Math.min(Math.max(stockCount, 1), value + 1))} disabled={quantity >= stockCount} aria-label="Increase quantity" className="flex h-full w-11 items-center justify-center text-gray-600 transition hover:bg-gray-100 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
                  </div>
                  <button type="button" onClick={handleFavorite} aria-label={favorited ? 'Remove from favorites' : 'Add to favorites'} className={`flex h-11 w-11 items-center justify-center rounded-xl border transition ${favorited ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 text-gray-600 hover:border-red-300 hover:text-red-600'}`}><Heart className={`h-5 w-5 ${favorited ? 'fill-current' : ''}`} /></button>
                  <button type="button" onClick={() => { void handleShare(); }} aria-label="Share product" className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 text-gray-600 transition hover:border-gray-400 hover:text-gray-900"><Share2 className="h-5 w-5" /></button>
                </div>
              </div>

              <button type="button" onClick={() => { void handleCartAction(false); }} disabled={isUnavailable || activeAction !== null || addedToCart} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#07513B] py-3 text-sm font-bold text-white shadow-md transition hover:bg-[#032F24] disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500 disabled:shadow-none">
                {activeAction === 'cart' ? <Loader2 className="h-4 w-4 animate-spin" /> : addedToCart ? <Check className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}{activeAction === 'cart' ? 'Adding…' : addedToCart ? 'Added to cart' : `Add to cart · $${(price * quantity).toFixed(2)}`}
              </button>
              <button type="button" onClick={() => { void handleCartAction(true); }} disabled={isUnavailable || activeAction !== null} className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-900 bg-white py-3 text-sm font-bold text-gray-900 transition hover:bg-gray-900 hover:text-white disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-200 disabled:text-gray-500">
                {activeAction === 'buy' && <Loader2 className="h-4 w-4 animate-spin" />}{activeAction === 'buy' ? 'Preparing checkout…' : 'Buy now'}
              </button>

              <div className="grid grid-cols-3 gap-2 border-t border-gray-100 pt-3">
                <div className="text-center"><ShieldCheck className="mx-auto h-4 w-4 text-emerald-700" /><p className="mt-1 text-[9px] font-semibold text-gray-700">Secure payment</p></div>
                <div className="text-center"><Truck className="mx-auto h-4 w-4 text-emerald-700" /><p className="mt-1 text-[9px] font-semibold text-gray-700">Free shipping</p></div>
                <div className="text-center"><PackageCheck className="mx-auto h-4 w-4 text-emerald-700" /><p className="mt-1 text-[9px] font-semibold text-gray-700">Order support</p></div>
              </div>
            </div>
          </aside>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <section className="flex min-h-24 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700"><ShieldCheck className="h-5 w-5" /></span>
            <div><h2 className="text-sm font-bold text-gray-900">Trusted &amp; Protected</h2><p className="mt-1 text-xs leading-4 text-gray-500">Payments use Beckah’s protected checkout flow and order tracking.</p></div>
          </section>
          <section className="flex min-h-24 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600"><Truck className="h-5 w-5" /></span>
            <div><h2 className="text-sm font-bold text-gray-900">Delivery &amp; Returns</h2><p className="mt-1 text-xs leading-4 text-gray-500">Free tracked shipping with straightforward returns within the marketplace policy.</p></div>
          </section>
        </div>

        <ProductReviewsSection
          productId={product.id}
          sellerId={product.seller_id}
          ratingAvg={product.rating_avg}
          ratingCount={product.rating_count}
        />
      </div>
    </main>
  );
}
