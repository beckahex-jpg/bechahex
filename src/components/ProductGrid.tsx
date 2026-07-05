import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getProductAuction, useProducts } from '../hooks/useProducts';
import ProductCard from './ProductCard';

interface ProductGridProps {
  categoryId: string | null;
  searchQuery?: string;
  minPrice?: string;
  maxPrice?: string;
  limitRows?: number;
}

export default function ProductGrid({ categoryId, searchQuery = '', minPrice = '', maxPrice = '', limitRows }: ProductGridProps) {
  const navigate = useNavigate();
  const { products: allProducts, loading, error } = useProducts(categoryId || undefined);

  const { products, totalCount } = useMemo(() => {
    let filtered = allProducts.filter((product) => (product.listing_type || 'fixed_price') !== 'auction');

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((product) =>
        product.title.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query) ||
        product.condition.toLowerCase().includes(query)
      );
    }

    if (minPrice) filtered = filtered.filter((product) => Number(product.price) >= Number(minPrice));
    if (maxPrice) filtered = filtered.filter((product) => Number(product.price) <= Number(maxPrice));

    const total = filtered.length;
    if (limitRows) filtered = filtered.slice(0, limitRows * 5);
    return { products: filtered, totalCount: total };
  }, [allProducts, searchQuery, minPrice, maxPrice, limitRows]);

  if (loading) {
    return (
      <section className="bg-gray-50 py-12">
        <div className="market-container flex min-h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-[#07513B]" /></div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="bg-gray-50 py-12">
        <div className="market-container"><div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center"><p className="font-bold text-red-800">We couldn't load these items.</p><p className="mt-1 text-sm text-red-600">{error}</p></div></div>
      </section>
    );
  }

  return (
    <section className="bg-gray-50 py-10 sm:py-12">
      <div className="market-container">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">Fresh finds</h2>
            <p className="mt-1 text-sm text-gray-500">Newly listed items ready to shop</p>
          </div>
          {limitRows && totalCount > products.length && <button type="button" onClick={() => navigate('/products')} className="hidden text-sm font-bold text-[#07513B] hover:underline sm:block">See all items</button>}
        </div>

        {products.length === 0 ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
            <p className="font-semibold text-gray-800">No items match these filters.</p>
            <button type="button" onClick={() => navigate('/products')} className="mt-4 rounded-full border border-gray-900 px-5 py-2 text-sm font-bold">Browse all items</button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {products.map((product) => {
              let images = product.images;
              if (typeof images === 'string') {
                try { images = JSON.parse(images); } catch { images = []; }
              }
              const image = Array.isArray(images) && images.length > 0 ? images[0] : product.image_url || '';

              return (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  title={product.title}
                  price={product.price}
                  originalPrice={product.original_price || undefined}
                  image={image}
                  condition={product.condition}
                  submissionType={product.submission_type}
                  listingType={product.listing_type}
                  auction={getProductAuction(product)}
                  palette="home"
                  ratingAvg={product.rating_avg}
                  ratingCount={product.rating_count}
                />
              );
            })}
          </div>
        )}

        {limitRows && totalCount > products.length && (
          <div className="mt-8 text-center sm:hidden">
            <button type="button" onClick={() => navigate('/products')} className="rounded-full border border-gray-900 bg-white px-7 py-3 text-sm font-bold text-gray-900">See all items</button>
          </div>
        )}
      </div>
    </section>
  );
}
