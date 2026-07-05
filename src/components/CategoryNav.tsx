import { ChevronLeft, ChevronRight, LayoutGrid, Loader2, type LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCategories } from '../hooks/useProducts';

interface CategoryNavProps {
  selectedCategoryId: string | null;
  onCategorySelect: (categoryId: string | null) => void;
}

const CATEGORY_ART = [
  { terms: ['automotive'], src: '/category-images/automotive.jpg' },
  { terms: ['books', 'media'], src: '/category-images/books-media.jpg' },
  { terms: ['electronics'], src: '/category-images/electronics.jpg' },
  { terms: ['fashion'], src: '/category-images/fashion.jpg' },
  { terms: ['home', 'garden'], src: '/category-images/home-garden.jpg' },
  { terms: ['sports', 'outdoors'], src: '/category-images/sports-outdoors.jpg' },
  { terms: ['tools', 'hardware'], src: '/category-images/tools-hardware.jpg' },
  { terms: ['toys', 'games'], src: '/category-images/toys-games.jpg' },
] as const;

const ALL_CATEGORY_ART = CATEGORY_ART.slice(0, 4).map((item) => item.src);

const getIconComponent = (iconName: string) => {
  if (!iconName) return Icons.Package;
  const capitalized = iconName.charAt(0).toUpperCase() + iconName.slice(1);
  const library = Icons as unknown as Record<string, LucideIcon>;
  return library[iconName] || library[capitalized] || Icons.Package;
};

export default function CategoryNav({ selectedCategoryId, onCategorySelect }: CategoryNavProps) {
  const navigate = useNavigate();
  const { categories, loading } = useCategories();
  const containerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateArrows = () => {
    const element = containerRef.current;
    if (!element) return;
    setCanScrollLeft(element.scrollLeft > 8);
    setCanScrollRight(element.scrollLeft < element.scrollWidth - element.clientWidth - 8);
  };

  useEffect(() => {
    updateArrows();
    window.addEventListener('resize', updateArrows);
    return () => window.removeEventListener('resize', updateArrows);
  }, [categories]);

  const scroll = (direction: -1 | 1) => containerRef.current?.scrollBy({ left: direction * 650, behavior: 'smooth' });

  return (
    <section className="bg-white py-8 sm:py-10">
      <div className="market-container">
        <div className="mb-5 flex items-end justify-between gap-4">
          <h2 className="text-2xl font-black tracking-tight text-gray-900 sm:text-3xl">Explore popular categories</h2>
          <button type="button" onClick={() => navigate('/products')} className="hidden shrink-0 text-sm font-bold text-gray-900 hover:underline sm:block">See all categories</button>
        </div>

        {loading ? (
          <div className="flex h-44 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-[#07513B]" /></div>
        ) : (
          <div className="group relative">
            {canScrollLeft && <ScrollButton direction="left" onClick={() => scroll(-1)} />}
            <div ref={containerRef} onScroll={updateArrows} className="scrollbar-hide -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 pt-1 sm:mx-0 sm:gap-5 sm:px-0">
              <CategoryButton
                active={selectedCategoryId === null}
                icon={LayoutGrid}
                collage={ALL_CATEGORY_ART}
                label="All categories"
                onClick={() => onCategorySelect(null)}
              />
              {categories.map((category) => (
                <CategoryButton
                  key={category.id}
                  active={selectedCategoryId === category.id}
                  icon={getIconComponent(category.icon || 'Package')}
                  image={getCategoryArt(category.name, category.slug)}
                  label={category.name}
                  onClick={() => onCategorySelect(category.id)}
                />
              ))}
            </div>
            {canScrollRight && <ScrollButton direction="right" onClick={() => scroll(1)} />}
          </div>
        )}
      </div>
    </section>
  );
}

interface CategoryButtonProps {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  image?: string;
  collage?: string[];
}

function CategoryButton({ active, icon: Icon, label, onClick, image, collage = [] }: CategoryButtonProps) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className="group/item flex w-[112px] shrink-0 snap-start flex-col items-center gap-3 text-center sm:w-[136px]">
      <span className={`relative flex h-[106px] w-[106px] overflow-hidden rounded-full bg-[#F2F2F2] transition duration-200 sm:h-32 sm:w-32 ${active ? 'ring-[3px] ring-[#07513B] ring-offset-2' : 'group-hover/item:ring-2 group-hover/item:ring-gray-900 group-hover/item:ring-offset-2'}`}>
        {image ? (
          <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover/item:scale-105" />
        ) : collage.length >= 2 ? (
          <span className="grid h-full w-full grid-cols-2 grid-rows-2 gap-px bg-white">
            {Array.from({ length: 4 }).map((_, index) => collage[index] ? <img key={collage[index]} src={collage[index]} alt="" loading="lazy" className="h-full w-full object-cover" /> : <span key={index} className="bg-gray-100" />)}
          </span>
        ) : (
          <span className={`flex h-full w-full items-center justify-center ${active ? 'bg-[#07513B] text-white' : 'text-gray-700'}`}><Icon className="h-10 w-10" strokeWidth={1.5} /></span>
        )}
        {active && <span className="absolute inset-0 rounded-full border-[3px] border-white/80" />}
      </span>
      <span className={`line-clamp-2 max-w-[148px] text-sm font-bold leading-5 text-gray-900 group-hover/item:underline ${active ? 'underline decoration-2 underline-offset-4' : ''}`}>{label}</span>
    </button>
  );
}

function ScrollButton({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  const Icon = direction === 'left' ? ChevronLeft : ChevronRight;
  return (
    <button type="button" onClick={onClick} aria-label={`Scroll categories ${direction}`} className={`absolute ${direction === 'left' ? '-left-5' : '-right-5'} top-[45px] z-10 hidden h-12 w-12 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-900 shadow-lg transition hover:bg-gray-50 lg:flex`}>
      <Icon className="h-5 w-5" />
    </button>
  );
}

function getCategoryArt(name: string, slug: string): string | undefined {
  const value = `${name} ${slug}`.toLowerCase();
  return CATEGORY_ART.find((item) => item.terms.every((term) => value.includes(term)))?.src;
}
