import { Smartphone, Book, Shirt, Home, Watch, Gamepad2, Dumbbell, Grid3x3, ChevronLeft, ChevronRight } from 'lucide-react';
import { useCategories } from '../hooks/useProducts';
import { Loader2 } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';

interface CategoryNavProps {
  selectedCategoryId: string | null;
  onCategorySelect: (categoryId: string | null) => void;
}

const iconMap: Record<string, any> = {
  smartphone: Smartphone,
  book: Book,
  shirt: Shirt,
  home: Home,
  watch: Watch,
  gamepad: Gamepad2,
  dumbbell: Dumbbell,
  'toy-brick': Grid3x3,
};

const colorMap: Record<string, string> = {
  Electronics: 'from-blue-500 to-cyan-500',
  Fashion: 'from-pink-500 to-rose-500',
  'Home & Garden': 'from-green-500 to-emerald-500',
  Books: 'from-amber-500 to-orange-500',
  Watches: 'from-slate-600 to-gray-700',
  Gaming: 'from-red-500 to-orange-500',
  Sports: 'from-teal-500 to-cyan-500',
  Toys: 'from-yellow-500 to-amber-500',
};

export default function CategoryNav({ selectedCategoryId, onCategorySelect }: CategoryNavProps) {
  const { categories, loading } = useCategories();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const checkArrows = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setShowLeftArrow(scrollLeft > 0);
      setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  useEffect(() => {
    checkArrows();
    window.addEventListener('resize', checkArrows);
    return () => window.removeEventListener('resize', checkArrows);
  }, [categories]);

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  if (loading) {
    return (
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative group">
          {/* Left Arrow */}
          {showLeftArrow && (
            <button
              onClick={() => scroll('left')}
              className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-white shadow-lg rounded-full hover:bg-gray-50 transition opacity-0 group-hover:opacity-100"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-6 h-6 text-gray-700" />
            </button>
          )}

          {/* Categories Container */}
          <div
            ref={scrollContainerRef}
            onScroll={checkArrows}
            className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth py-2"
            style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            {categories.map((category) => {
              const Icon = iconMap[category.icon || 'smartphone'] || Smartphone;
              const color = colorMap[category.name] || 'from-gray-500 to-slate-500';
              const isActive = selectedCategoryId === category.id;

              return (
                <button
                  key={category.id}
                  onClick={() => onCategorySelect(category.id)}
                  className={`group/item flex-shrink-0 flex flex-col items-center gap-3 p-4 rounded-xl transition ${
                    isActive
                      ? 'bg-blue-50 ring-2 ring-blue-500'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`w-16 h-16 bg-gradient-to-br ${color} rounded-2xl flex items-center justify-center shadow-lg group-hover/item:scale-110 transition ${
                      isActive ? 'scale-110' : ''
                    }`}
                  >
                    <Icon className="w-8 h-8 text-white" />
                  </div>
                  <span className={`text-sm font-medium text-center leading-tight whitespace-nowrap ${
                    isActive ? 'text-blue-700' : 'text-gray-700'
                  }`}>
                    {category.name}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Arrow */}
          {showRightArrow && (
            <button
              onClick={() => scroll('right')}
              className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 items-center justify-center bg-white shadow-lg rounded-full hover:bg-gray-50 transition opacity-0 group-hover:opacity-100"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-6 h-6 text-gray-700" />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
