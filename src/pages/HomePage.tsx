import { useEffect, useState } from 'react';
import CategoryNav from '../components/CategoryNav';
import Hero from '../components/Hero';
import HomeMarketplaceFeed from '../components/HomeMarketplaceFeed';
import { useFilters } from '../contexts/FilterContext';

export default function HomePage() {
  const { resetCategoryTrigger } = useFilters();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  useEffect(() => {
    if (resetCategoryTrigger > 0) setSelectedCategoryId(null);
  }, [resetCategoryTrigger]);

  return (
    <main className="bg-white">
      <Hero />
      <CategoryNav selectedCategoryId={selectedCategoryId} onCategorySelect={setSelectedCategoryId} />
      <HomeMarketplaceFeed categoryId={selectedCategoryId} />
    </main>
  );
}
