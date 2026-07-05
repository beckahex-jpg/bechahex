import { ArrowLeft, ArrowRight, Heart } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProductAuction, type Product, useProducts } from '../hooks/useProducts';
import ProductCard from './ProductCard';

interface HomeMarketplaceFeedProps {
  categoryId: string | null;
}

export default function HomeMarketplaceFeed({ categoryId }: HomeMarketplaceFeedProps) {
  const navigate = useNavigate();
  const { products, loading, error } = useProducts(categoryId || undefined);

  const { todaysPicks, auctions, buyNow } = useMemo(() => {
    const auctionItems = products
      .filter((product) => product.listing_type === 'auction' && getProductAuction(product))
      .sort((first, second) => {
        const firstAuction = getProductAuction(first);
        const secondAuction = getProductAuction(second);
        return new Date(firstAuction?.ends_at || 0).getTime() - new Date(secondAuction?.ends_at || 0).getTime();
      });
    const fixedItems = products.filter((product) => (product.listing_type || 'fixed_price') !== 'auction');
    const mixed = interleave(fixedItems, auctionItems).slice(0, 12);

    return {
      todaysPicks: mixed,
      auctions: auctionItems.slice(0, 12),
      buyNow: fixedItems.slice(0, 12),
    };
  }, [products]);

  if (loading) return <HomeFeedSkeleton />;

  if (error) {
    return (
      <section className="py-10">
        <div className="market-container rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="font-bold text-red-800">We couldn't load marketplace items.</p>
          <button type="button" onClick={() => navigate('/products')} className="mt-4 rounded-full bg-gray-900 px-5 py-2.5 text-sm font-bold text-white">Browse all items</button>
        </div>
      </section>
    );
  }

  return (
    <div className="pb-8">
      <ProductShelf
        title={categoryId ? 'Top picks in this category' : "Today's picks"}
        description="A mix of newly listed items and auctions"
        products={todaysPicks}
        seeAllHref={categoryId ? `/products?category=${categoryId}` : '/products'}
      />

      <MissionPromo />

      <ProductShelf
        title="Auctions ending soon"
        description="Keep an eye on the clock and place your best bid"
        products={auctions}
        seeAllHref={categoryId ? `/products?listing=auction&category=${categoryId}` : '/products?listing=auction'}
        emptyMessage="No live auctions in this category right now."
      />

      <ProductShelf
        title="Buy it now"
        description="Shop instantly at the listed price"
        products={buyNow}
        seeAllHref={categoryId ? `/products?listing=fixed_price&category=${categoryId}` : '/products?listing=fixed_price'}
        muted
      />
    </div>
  );
}

interface ProductShelfProps {
  title: string;
  description: string;
  products: Product[];
  seeAllHref: string;
  emptyMessage?: string;
  muted?: boolean;
}

function ProductShelf({ title, description, products, seeAllHref, emptyMessage, muted = false }: ProductShelfProps) {
  const navigate = useNavigate();
  const railRef = useRef<HTMLDivElement>(null);
  const scroll = (direction: -1 | 1) => railRef.current?.scrollBy({ left: direction * 920, behavior: 'smooth' });

  if (products.length === 0 && !emptyMessage) return null;

  return (
    <section className={muted ? 'bg-gray-50 py-8 sm:py-10' : 'bg-white py-8 sm:py-10'}>
      <div className="market-container">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-950 sm:text-3xl">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
          </div>
          <button type="button" onClick={() => navigate(seeAllHref)} className="flex shrink-0 items-center gap-1 text-sm font-bold text-gray-900 hover:underline">
            See all <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">{emptyMessage}</div>
        ) : (
          <div className="group/rail relative">
            <RailButton direction="left" onClick={() => scroll(-1)} />
            <div ref={railRef} className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:gap-4 sm:px-0">
              {products.map((product) => (
                <div key={product.id} className="w-[46vw] min-w-[168px] max-w-[220px] shrink-0 snap-start sm:w-[220px]">
                  <ShelfProduct product={product} />
                </div>
              ))}
            </div>
            <RailButton direction="right" onClick={() => scroll(1)} />
          </div>
        )}
      </div>
    </section>
  );
}

function ShelfProduct({ product }: { product: Product }) {
  let images = product.images;
  if (typeof images === 'string') {
    try { images = JSON.parse(images); } catch { images = []; }
  }
  const image = Array.isArray(images) && images.length ? images[0] : product.image_url || '';

  return (
    <ProductCard
      id={product.id}
      title={product.title}
      price={product.price}
      originalPrice={product.original_price || undefined}
      image={image}
      condition={product.condition}
      submissionType={product.submission_type}
      listingType={product.listing_type}
      auction={getProductAuction(product)}
      ratingAvg={product.rating_avg}
      ratingCount={product.rating_count}
      variant="shelf"
    />
  );
}

function RailButton({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  const Icon = direction === 'left' ? ArrowLeft : ArrowRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Scroll products ${direction}`}
      className={`absolute ${direction === 'left' ? '-left-5' : '-right-5'} top-[34%] z-10 hidden h-12 w-12 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-900 shadow-lg opacity-0 transition hover:bg-gray-50 group-hover/rail:opacity-100 lg:flex`}
    >
      <Icon className="h-5 w-5" />
    </button>
  );
}

function MissionPromo() {
  const navigate = useNavigate();
  return (
    <section className="bg-white py-4 sm:py-6">
      <div className="market-container">
        <div className="relative overflow-hidden rounded-3xl bg-[#DDF7B2] px-6 py-7 text-[#032F24] sm:px-10 sm:py-9">
          <div aria-hidden="true" className="absolute -right-8 -top-16 h-48 w-48 rounded-full border-[28px] border-white/35" />
          <div aria-hidden="true" className="absolute right-24 top-8 hidden h-24 w-24 rotate-12 items-center justify-center rounded-3xl bg-[#9BEC2D] lg:flex"><Heart className="h-11 w-11 fill-current" /></div>
          <div className="relative max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-800">Shopping with purpose</p>
            <h2 className="mt-2 text-balance text-2xl font-black sm:text-3xl">Give useful items a second life—and help the community.</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-emerald-950/80">Every purchase supports Beckah Foundation's charitable mission.</p>
            <button type="button" onClick={() => navigate('/submit-product')} className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#032F24] px-6 py-3 text-sm font-bold text-white transition hover:bg-[#07513B]">
              Sell an item <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeFeedSkeleton() {
  return (
    <div className="market-container space-y-10 py-10">
      {[1, 2, 3].map((section) => (
        <div key={section}>
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-5 flex gap-4 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="h-72 w-52 shrink-0 animate-pulse rounded-2xl bg-gray-100" />)}
          </div>
        </div>
      ))}
    </div>
  );
}

function interleave(first: Product[], second: Product[]): Product[] {
  const result: Product[] = [];
  const maxLength = Math.max(first.length, second.length);
  for (let index = 0; index < maxLength; index += 1) {
    if (first[index]) result.push(first[index]);
    if (second[index]) result.push(second[index]);
  }
  return result;
}
