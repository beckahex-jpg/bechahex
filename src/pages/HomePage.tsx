import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import Hero from '../components/Hero';
import CategoryNav from '../components/CategoryNav';
import ProductGrid from '../components/ProductGrid';
import ImpactSection from '../components/ImpactSection';
import { useFilters } from '../contexts/FilterContext';

export default function HomePage() {
  const [searchParams] = useSearchParams();
  const { showFilters, toggleFilters, resetCategoryTrigger } = useFilters();
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

  useEffect(() => {
    if (resetCategoryTrigger > 0) {
      setSelectedCategoryId(null);
    }
  }, [resetCategoryTrigger]);

  return (
    <main>
      <Hero />
      <CategoryNav
        selectedCategoryId={selectedCategoryId}
        onCategorySelect={setSelectedCategoryId}
      />

      {showFilters && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            onClick={toggleFilters}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[90%] max-w-lg">
            <div className="bg-white rounded-2xl shadow-2xl p-6 border border-gray-200">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold text-gray-900">Filters</h3>
                <button
                  onClick={toggleFilters}
                  className="text-gray-400 hover:text-gray-600 transition"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                <div>
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
                <div>
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
                <button
                  onClick={() => {
                    setMinPrice('');
                    setMaxPrice('');
                    setSearchQuery('');
                  }}
                  className="w-full px-6 py-3 text-sm text-gray-600 hover:text-gray-900 transition font-medium border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </>
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
