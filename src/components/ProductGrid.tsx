import ProductCard from './ProductCard';
import { useProducts } from '../hooks/useProducts';
import { Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

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

  const products = useMemo(() => {
    let filtered = [...allProducts];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (product) =>
          product.title.toLowerCase().includes(query) ||
          product.description?.toLowerCase().includes(query) ||
          product.condition.toLowerCase().includes(query)
      );
    }

    if (minPrice) {
      const min = parseFloat(minPrice);
      filtered = filtered.filter((product) => {
        const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
        return price >= min;
      });
    }

    if (maxPrice) {
      const max = parseFloat(maxPrice);
      filtered = filtered.filter((product) => {
        const price = typeof product.price === 'string' ? parseFloat(product.price) : product.price;
        return price <= max;
      });
    }

    if (limitRows) {
      const limit = limitRows * 4;
      filtered = filtered.slice(0, limit);
    }

    return filtered;
  }, [allProducts, searchQuery, minPrice, maxPrice, limitRows]);

  if (loading) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 font-medium">Failed to load products</p>
            <p className="text-red-600 text-sm mt-1">{error}</p>
          </div>
        </div>
      </section>
    );
  }

  if (products.length === 0) {
    return (
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
            <p className="text-gray-600 text-lg">No products available at the moment</p>
            <p className="text-gray-500 text-sm mt-2">Check back soon for new items!</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Featured Items</h2>
            <p className="text-gray-600">Discover amazing deals on quality products</p>
          </div>
          {limitRows && allProducts.length > limitRows * 4 && (
            <button
              onClick={() => navigate('/products')}
              className="hidden sm:block text-blue-600 font-semibold hover:text-blue-700 transition"
            >
              View All →
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            // Parse images if it's a string (shouldn't happen with Supabase but just in case)
            let images = product.images;
            if (typeof images === 'string') {
              try {
                images = JSON.parse(images);
              } catch {
                images = [];
              }
            }

            const imageUrl = images && Array.isArray(images) && images.length > 0
              ? images[0]
              : product.image_url || '';

            return (
              <ProductCard
                key={product.id}
                id={product.id}
                title={product.title}
                price={product.price}
                originalPrice={product.original_price || undefined}
                image={imageUrl}
                condition={product.condition}
              />
            );
          })}
        </div>

        {limitRows && allProducts.length > limitRows * 4 && (
          <div className="text-center mt-12">
            <button
              onClick={() => navigate('/products')}
              className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-8 py-4 rounded-lg font-semibold transition shadow-lg hover:shadow-xl"
            >
              View All Products
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
