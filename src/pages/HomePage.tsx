import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Hero from '../components/Hero';
import CategoryNav from '../components/CategoryNav';
import ProductGrid from '../components/ProductGrid';
import ImpactSection from '../components/ImpactSection';
import { useFilters } from '../contexts/FilterContext';

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const { showFilters } = useFilters();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    const search = searchParams.get('search');
    if (search) {
      setSearchQuery(search);
    }
  }, [searchParams]);

  return (
    <main>
      <Hero />
      <CategoryNav
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={setSelectedCategoryId}
      />

      {showFilters && (
        <section className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Min Price ($)
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Max Price ($)
                  </label>
                  <input
                    type="number"
                    placeholder="1000"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => {
                      setMinPrice('');
                      setMaxPrice('');
                      setSearchQuery('');
                    }}
                    className="px-6 py-3 text-sm text-gray-600 hover:text-gray-900 transition font-medium"
                  >
                    Clear All
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      <ProductGrid
        categoryId={selectedCategoryId}
        searchQuery={searchQuery}
        minPrice={minPrice}
        maxPrice={maxPrice}
        limitRows={2}
      />
      <ImpactSection />
    </main>
  );
}
