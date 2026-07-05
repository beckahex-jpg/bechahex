import { useMemo, useState } from 'react';
import { ArrowLeft, Check, ChevronRight, Gift, Heart, ShieldCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Auction, PublicAuctionBid } from '../../types/auction';
import AuctionProductGallery from './AuctionProductGallery';
import AuctionProductPanel from './AuctionProductPanel';
import AuctionRecentBids from './AuctionRecentBids';

interface AuctionProduct {
  id: string;
  title: string;
  description: string;
  condition: string;
  image_url: string;
  images?: string[];
  submission_type?: 'donation' | 'symbolic_sale' | 'public_sale';
  categories: { name: string } | null;
}

interface AuctionDetailPageProps {
  product: AuctionProduct;
  auction: Auction;
}

type ProductTab = 'about' | 'details' | 'shipping';

export default function AuctionDetailPage({ product, auction }: AuctionDetailPageProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ProductTab>('about');
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [bids, setBids] = useState<PublicAuctionBid[]>([]);
  const category = product.categories?.name || 'Marketplace';
  const isDonated = product.submission_type === 'donation';
  const isAiReviewed = auction.ai_moderation_status === 'approved';
  const images = useMemo(() => Array.from(new Set([
    ...(auction.images || []),
    ...(product.images || []),
    product.image_url,
  ].filter((image): image is string => Boolean(image)))), [auction.images, product.image_url, product.images]);
  const description = auction.description || product.description;
  const shouldShortenDescription = description.length > 240;
  const displayedDescription = shouldShortenDescription && !showFullDescription
    ? `${description.slice(0, 240).trimEnd()}…`
    : description;

  const tabs: Array<{ id: ProductTab; label: string }> = [
    { id: 'about', label: 'About' },
    { id: 'details', label: 'Details' },
    { id: 'shipping', label: 'Shipping' },
  ];

  return (
    <main className="min-h-screen bg-gray-50 pb-8">
      <div className="border-b border-gray-200 bg-white">
        <nav aria-label="Breadcrumb" className="mx-auto flex max-w-7xl items-center gap-1.5 overflow-hidden px-4 py-2 text-xs text-gray-500 sm:px-6 lg:px-8">
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="mr-2 rounded-full p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-gray-900">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => navigate('/')} className="hover:text-emerald-700">Home</button>
          <ChevronRight className="h-3 w-3 shrink-0 text-gray-300" />
          <button type="button" onClick={() => navigate('/products?listing=auction')} className="whitespace-nowrap hover:text-emerald-700">Live Auctions</button>
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
            <section className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-white px-4 py-3 shadow-sm">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                <Heart className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-bold text-gray-900">Every bid makes a difference</h2>
                <p className="mt-0.5 text-xs leading-4 text-gray-500">Each auction helps Beckah support individuals and families in need.</p>
              </div>
            </section>
          </div>

          <section className="order-2 space-y-4 lg:col-start-2 lg:row-start-1">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">{category}</p>
              <h1 className="mt-1.5 text-3xl font-bold leading-tight text-gray-900">{product.title}</h1>

              <div className="mt-3 flex flex-wrap gap-2">
                {isDonated && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1.5 text-xs font-bold text-green-800">
                    <Gift className="h-3.5 w-3.5" /> Donated Product
                  </span>
                )}
                {isAiReviewed && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5" /> AI reviewed
                  </span>
                )}
              </div>
            </div>

            {isDonated && (
              <aside className="rounded-2xl border border-green-200 bg-green-50 p-3">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
                    <Heart className="h-4 w-4 fill-current" />
                  </span>
                  <div>
                    <h2 className="text-sm font-bold text-green-900">100% Charitable Donation</h2>
                    <p className="mt-0.5 text-xs leading-4 text-green-800">This item was generously donated by the seller.</p>
                    <ul className="mt-2 space-y-1 text-xs text-green-800">
                      <li className="flex gap-2"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />You pay the winning price.</li>
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
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex-1 px-2 pb-2 text-xs font-semibold transition ${activeTab === tab.id ? 'text-emerald-700' : 'text-gray-500 hover:text-gray-900'}`}
                  >
                    {tab.label}
                    {activeTab === tab.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-emerald-600" />}
                  </button>
                ))}
              </div>

              <div className="pt-3 text-xs leading-5 text-gray-600">
                {activeTab === 'about' && (
                  <div role="tabpanel">
                    <p className="whitespace-pre-line">{displayedDescription || 'No description has been added yet.'}</p>
                    {shouldShortenDescription && (
                      <button type="button" onClick={() => setShowFullDescription((value) => !value)} className="mt-2 font-semibold text-emerald-700 hover:text-emerald-800">
                        {showFullDescription ? 'Show less' : 'Show more'}
                      </button>
                    )}
                  </div>
                )}

                {activeTab === 'details' && (
                  <dl role="tabpanel" className="space-y-3">
                    <div className="flex justify-between gap-4"><dt>Condition</dt><dd className="font-semibold text-gray-900">{auction.condition || product.condition}</dd></div>
                    <div className="flex justify-between gap-4"><dt>Category</dt><dd className="font-semibold text-gray-900">{category}</dd></div>
                    <div className="flex justify-between gap-4"><dt>Product ID</dt><dd className="font-mono text-xs text-gray-900">#{product.id.slice(0, 8).toUpperCase()}</dd></div>
                  </dl>
                )}

                {activeTab === 'shipping' && (
                  <div role="tabpanel">
                    <p>The winning buyer pays <strong className="text-gray-900">${Number(auction.shipping_cost).toFixed(2)}</strong> shipping.</p>
                    <p className="mt-2 text-xs text-gray-500">Tracking is provided after the order ships.</p>
                  </div>
                )}
              </div>
            </section>
          </section>

          <div className="order-3 lg:col-span-2 lg:col-start-1 lg:row-start-3 xl:col-span-1 xl:col-start-3 xl:row-span-2 xl:row-start-1">
            <AuctionProductPanel auction={auction} onBidsChange={setBids} />
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,.9fr)_minmax(0,1.1fr)]">
          <section className="flex min-h-24 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Trusted &amp; Protected</h2>
              <p className="mt-1 text-xs leading-4 text-gray-500">Payments use the protected checkout flow, with order tracking after the auction ends.</p>
              <a href="https://www.beckah.org" target="_blank" rel="noreferrer" className="mt-1.5 inline-block text-xs font-semibold text-emerald-700 hover:text-emerald-800">Learn how it works</a>
            </div>
          </section>

          <AuctionRecentBids bids={bids} />
        </div>
      </div>
    </main>
  );
}
