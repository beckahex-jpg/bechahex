import {
  Check,
  ChevronRight,
  Grid2X2,
  List,
  Loader2,
  PackageSearch,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { FormEvent, useCallback, useEffect, useId, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ProductCard from '../components/ProductCard';
import { supabase } from '../lib/supabase';
import type { Auction } from '../types/auction';
import { auctionPrice } from '../types/auction';

interface Product {
  id: string;
  title: string;
  price: number;
  original_price?: number;
  image_url: string;
  condition: string;
  description?: string;
  category_id: string;
  created_at: string;
  images?: string[] | string;
  listing_type?: 'fixed_price' | 'auction';
  submission_type?: 'donation' | 'symbolic_sale' | 'public_sale';
  rating_avg?: string | number;
  rating_count?: number;
  auctions?: Auction | Auction[] | null;
}

interface Category {
  id: string;
  name: string;
}

type SortOption = 'newest' | 'ending-soon' | 'price-low' | 'price-high';
type ListingFilter = 'all' | 'fixed_price' | 'auction';
type ViewMode = 'grid' | 'list';

const PAGE_SIZE = 24;

export default function AllProductsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [searchDraft, setSearchDraft] = useState(searchParams.get('search') || '');

  const searchQuery = searchParams.get('search') || '';
  const selectedCategories = readListParam(searchParams.get('category'));
  const selectedConditions = readListParam(searchParams.get('condition'));
  const listingFilter = readEnum<ListingFilter>(searchParams.get('listing'), ['all', 'fixed_price', 'auction'], 'all');
  const sortBy = readEnum<SortOption>(searchParams.get('sort'), ['newest', 'ending-soon', 'price-low', 'price-high'], 'newest');
  const viewMode = readEnum<ViewMode>(searchParams.get('view'), ['grid', 'list'], 'grid');
  const minPrice = searchParams.get('min') || '';
  const maxPrice = searchParams.get('max') || '';
  const paramsKey = searchParams.toString();

  const updateParams = useCallback((changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (!value || value === 'all' || (key === 'sort' && value === 'newest') || (key === 'view' && value === 'grid')) next.delete(key);
      else next.set(key, value);
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const loadProducts = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      setError('');
      const { data, error: productsError } = await supabase
        .from('products')
        .select('*, auctions(*)')
        .eq('status', 'available')
        .order('created_at', { ascending: false });
      if (productsError) throw productsError;
      setProducts((data || []) as Product[]);
    } catch (loadError) {
      console.error('Error fetching products:', loadError);
      setError('We could not load the marketplace. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function loadCategories() {
      const { data } = await supabase.from('categories').select('id, name').order('name');
      setCategories((data || []) as Category[]);
    }

    void loadCategories();
    void loadProducts();

    const channel = supabase
      .channel('catalog-products')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => { void loadProducts(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'auctions' }, () => { void loadProducts(true); })
      .subscribe();
    const refresh = () => { void loadProducts(true); };
    window.addEventListener('products-updated', refresh);

    return () => {
      void supabase.removeChannel(channel);
      window.removeEventListener('products-updated', refresh);
    };
  }, [loadProducts]);

  useEffect(() => {
    setSearchDraft(searchQuery);
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, paramsKey]);

  useEffect(() => {
    if (!showMobileFilters) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [showMobileFilters]);

  const conditions = useMemo(() => Array.from(new Set(products.map((product) => product.condition).filter(Boolean))).sort(), [products]);

  const filteredProducts = useMemo(() => {
    const filtered = products.filter((product) => {
      const auction = getAuction(product);
      const type = product.listing_type || 'fixed_price';

      if (type === 'auction' && (!auction || !['active', 'scheduled'].includes(auction.status))) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!product.title.toLowerCase().includes(query) && !product.description?.toLowerCase().includes(query) && !product.condition.toLowerCase().includes(query)) return false;
      }
      if (selectedCategories.length && !selectedCategories.includes(product.category_id)) return false;
      if (selectedConditions.length && !selectedConditions.includes(product.condition)) return false;
      if (listingFilter !== 'all' && type !== listingFilter) return false;

      const price = type === 'auction' && auction ? auctionPrice(auction) : Number(product.price);
      if (minPrice && price < Number(minPrice)) return false;
      if (maxPrice && price > Number(maxPrice)) return false;
      return true;
    });

    return filtered.sort((first, second) => {
      const firstAuction = getAuction(first);
      const secondAuction = getAuction(second);
      const firstPrice = first.listing_type === 'auction' && firstAuction ? auctionPrice(firstAuction) : Number(first.price);
      const secondPrice = second.listing_type === 'auction' && secondAuction ? auctionPrice(secondAuction) : Number(second.price);

      if (sortBy === 'price-low') return firstPrice - secondPrice;
      if (sortBy === 'price-high') return secondPrice - firstPrice;
      if (sortBy === 'ending-soon') {
        const firstEnd = firstAuction ? new Date(firstAuction.ends_at).getTime() : Number.MAX_SAFE_INTEGER;
        const secondEnd = secondAuction ? new Date(secondAuction.ends_at).getTime() : Number.MAX_SAFE_INTEGER;
        return firstEnd - secondEnd;
      }
      return new Date(second.created_at).getTime() - new Date(first.created_at).getTime();
    });
  }, [products, searchQuery, selectedCategories, selectedConditions, listingFilter, minPrice, maxPrice, sortBy]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);
  const activeFilterCount = selectedCategories.length + selectedConditions.length + Number(listingFilter !== 'all') + Number(Boolean(minPrice)) + Number(Boolean(maxPrice));
  const categoryMap = useMemo(() => new Map(categories.map((category) => [category.id, category.name])), [categories]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    updateParams({ search: searchDraft.trim() || null });
  };

  const toggleListValue = (key: 'category' | 'condition', current: string[], value: string) => {
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    updateParams({ [key]: next.length ? next.join(',') : null });
  };

  const clearFilters = () => {
    const next = new URLSearchParams();
    if (searchQuery) next.set('search', searchQuery);
    setSearchParams(next, { replace: true });
  };

  const clearEverything = () => {
    setSearchDraft('');
    setSearchParams({}, { replace: true });
  };

  const filterPanelProps: FilterPanelProps = {
    categories,
    conditions,
    selectedCategories,
    selectedConditions,
    listingFilter,
    minPrice,
    maxPrice,
    onToggleCategory: (id) => toggleListValue('category', selectedCategories, id),
    onToggleCondition: (condition) => toggleListValue('condition', selectedConditions, condition),
    onListingChange: (listing) => updateParams({ listing }),
    onMinChange: (value) => updateParams({ min: value || null }),
    onMaxChange: (value) => updateParams({ max: value || null }),
  };

  return (
    <main className="min-h-screen bg-white pb-24 lg:pb-12">
      {showMobileFilters && (
        <div className="fixed inset-0 z-[70] lg:hidden">
          <button type="button" aria-label="Close filters" onClick={() => setShowMobileFilters(false)} className="absolute inset-0 bg-black/50" />
           <aside className="scrollbar-hide absolute inset-x-0 bottom-0 max-h-[92vh] overflow-y-auto rounded-t-3xl bg-white shadow-2xl">
             <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4">
               <div><h2 className="text-lg font-black">Filters</h2><p className="text-xs text-gray-500">{filteredProducts.length} items</p></div>
               <div className="flex items-center gap-2">
                 {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="px-2 py-2 text-sm font-bold text-[#07513B]">Clear</button>}
                 <button type="button" onClick={() => setShowMobileFilters(false)} aria-label="Close filters" className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100"><X className="h-5 w-5" /></button>
               </div>
            </div>
            <div className="p-5"><FilterPanel {...filterPanelProps} /></div>
            <div className="sticky bottom-0 border-t border-gray-200 bg-white p-4">
              <button type="button" onClick={() => setShowMobileFilters(false)} className="w-full rounded-full bg-[#07513B] py-3 text-sm font-bold text-white">Show {filteredProducts.length} items</button>
            </div>
          </aside>
        </div>
      )}

      <div className="market-container py-5 sm:py-7">
        <nav aria-label="Breadcrumb" className="mb-4 flex items-center gap-1.5 text-xs text-gray-500">
          <button type="button" onClick={() => navigate('/')} className="hover:underline">Home</button>
          <ChevronRight className="h-3 w-3" />
          <span className="text-gray-800" aria-current="page">All items</span>
        </nav>

        <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-balance text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">{searchQuery ? `Results for “${searchQuery}”` : 'Explore the marketplace'}</h1>
            <p className="mt-2 text-sm text-gray-500">{filteredProducts.length} {filteredProducts.length === 1 ? 'item' : 'items'} found</p>
          </div>
          <form onSubmit={submitSearch} className="flex w-full max-w-xl" role="search">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <input type="search" value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} placeholder="Search within results" className="h-11 w-full rounded-l-full border border-r-0 border-gray-300 pl-10 pr-3 text-sm outline-none focus:border-[#07513B]" />
            </div>
            <button type="submit" className="rounded-r-full bg-gray-900 px-5 text-sm font-bold text-white hover:bg-black">Search</button>
          </form>
        </div>

        <div className="grid items-start gap-7 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="scrollbar-hide sticky top-40 hidden max-h-[calc(100vh-11rem)] overflow-y-auto pr-2 lg:block">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white py-3">
              <h2 className="text-lg font-black">Filter</h2>
              {activeFilterCount > 0 && <button type="button" onClick={clearFilters} className="text-xs font-bold text-[#07513B] hover:underline">Clear</button>}
            </div>
            <FilterPanel {...filterPanelProps} />
          </aside>

          <section className="min-w-0">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setShowMobileFilters(true)} className="market-pill gap-2 lg:hidden"><SlidersHorizontal className="h-4 w-4" />Filters{activeFilterCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#07513B] px-1 text-[10px] text-white">{activeFilterCount}</span>}</button>
              <div className="ml-auto flex items-center gap-2">
                <label htmlFor="catalog-sort" className="hidden text-xs font-semibold text-gray-500 sm:block">Sort:</label>
                <select id="catalog-sort" value={sortBy} onChange={(event) => updateParams({ sort: event.target.value })} className="h-10 rounded-full border border-gray-300 bg-white px-3 text-xs font-semibold text-gray-800 outline-none focus:border-[#07513B] sm:text-sm">
                  <option value="newest">Newly listed</option>
                  <option value="ending-soon">Ending soonest</option>
                  <option value="price-low">Price + shipping: lowest</option>
                  <option value="price-high">Price + shipping: highest</option>
                </select>
                <div className="hidden rounded-full border border-gray-300 p-1 sm:flex">
                  <ViewButton icon={Grid2X2} active={viewMode === 'grid'} label="Grid view" onClick={() => updateParams({ view: 'grid' })} />
                  <ViewButton icon={List} active={viewMode === 'list'} label="List view" onClick={() => updateParams({ view: 'list' })} />
                </div>
              </div>
            </div>

            {(activeFilterCount > 0 || searchQuery) && (
              <div className="scrollbar-hide mb-5 flex gap-2 overflow-x-auto pb-1">
                {searchQuery && <FilterChip label={`Search: ${searchQuery}`} onRemove={() => { setSearchDraft(''); updateParams({ search: null }); }} />}
                {selectedCategories.map((id) => <FilterChip key={id} label={categoryMap.get(id) || 'Category'} onRemove={() => toggleListValue('category', selectedCategories, id)} />)}
                {selectedConditions.map((condition) => <FilterChip key={condition} label={condition} onRemove={() => toggleListValue('condition', selectedConditions, condition)} />)}
                {listingFilter !== 'all' && <FilterChip label={listingFilter === 'auction' ? 'Auction' : 'Buy it now'} onRemove={() => updateParams({ listing: null })} />}
                {minPrice && <FilterChip label={`From $${minPrice}`} onRemove={() => updateParams({ min: null })} />}
                {maxPrice && <FilterChip label={`Up to $${maxPrice}`} onRemove={() => updateParams({ max: null })} />}
              </div>
            )}

            {loading ? (
              <div className="flex min-h-96 items-center justify-center"><Loader2 className="h-9 w-9 animate-spin text-[#07513B]" /></div>
            ) : error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-10 text-center"><p className="font-bold text-red-800">{error}</p><button type="button" onClick={() => void loadProducts()} className="mt-4 rounded-full bg-red-700 px-5 py-2 text-sm font-bold text-white">Try again</button></div>
            ) : visibleProducts.length === 0 ? (
              <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center sm:p-16">
                <PackageSearch className="mx-auto h-12 w-12 text-gray-300" />
                <h2 className="mt-4 text-xl font-black text-gray-900">No exact matches</h2>
                <p className="mt-2 text-sm text-gray-500">Try fewer filters or a different search term.</p>
                <button type="button" onClick={clearEverything} className="mt-5 rounded-full bg-gray-900 px-6 py-3 text-sm font-bold text-white">Clear all</button>
              </div>
            ) : (
              <>
                <div className={viewMode === 'grid' ? 'grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'space-y-4'}>
                  {visibleProducts.map((product) => {
                    const images = parseImages(product.images);
                    return (
                      <ProductCard
                        key={product.id}
                        id={product.id}
                        title={product.title}
                        price={product.price}
                        originalPrice={product.original_price}
                        image={images[0] || product.image_url || ''}
                        condition={product.condition}
                        submissionType={product.submission_type}
                        listingType={product.listing_type}
                        auction={getAuction(product)}
                        viewMode={viewMode}
                        ratingAvg={product.rating_avg}
                        ratingCount={product.rating_count}
                      />
                    );
                  })}
                </div>
                {visibleProducts.length < filteredProducts.length && (
                  <div className="mt-8 flex flex-col items-center gap-2">
                    <p className="text-xs text-gray-500">Showing {visibleProducts.length} of {filteredProducts.length}</p>
                    <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="rounded-full border border-gray-900 bg-white px-8 py-3 text-sm font-bold text-gray-900 transition hover:bg-gray-900 hover:text-white">Load more</button>
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

interface FilterPanelProps {
  categories: Category[];
  conditions: string[];
  selectedCategories: string[];
  selectedConditions: string[];
  listingFilter: ListingFilter;
  minPrice: string;
  maxPrice: string;
  onToggleCategory: (id: string) => void;
  onToggleCondition: (condition: string) => void;
  onListingChange: (listing: ListingFilter) => void;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
}

function FilterPanel(props: FilterPanelProps) {
  const [openGroups, setOpenGroups] = useState({
    format: true,
    category: true,
    condition: false,
    price: false,
  });

  const toggleGroup = (group: keyof typeof openGroups) => {
    setOpenGroups((current) => ({ ...current, [group]: !current[group] }));
  };

  return (
    <div>
      <FilterGroup title="Buying format" open={openGroups.format} activeCount={props.listingFilter === 'all' ? 0 : 1} onToggle={() => toggleGroup('format')}>
        <div role="radiogroup" aria-label="Buying format" className="space-y-0.5">
          {([['all', 'All listings'], ['fixed_price', 'Buy it now'], ['auction', 'Auction']] as const).map(([value, label]) => (
            <label key={value} className="flex min-h-9 cursor-pointer items-center gap-3 py-1.5 text-sm text-gray-700 hover:text-gray-950">
              <input type="radio" name="listing-format" checked={props.listingFilter === value} onChange={() => props.onListingChange(value)} className="h-4 w-4 accent-[#07513B]" />{label}
            </label>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup title="Category" open={openGroups.category} activeCount={props.selectedCategories.length} onToggle={() => toggleGroup('category')}>
        <div className="space-y-0.5">
          {props.categories.map((category) => <FilterCheckbox key={category.id} label={category.name} checked={props.selectedCategories.includes(category.id)} onChange={() => props.onToggleCategory(category.id)} />)}
        </div>
      </FilterGroup>

      <FilterGroup title="Condition" open={openGroups.condition} activeCount={props.selectedConditions.length} onToggle={() => toggleGroup('condition')}>
        <div className="space-y-0.5">
          {props.conditions.map((condition) => <FilterCheckbox key={condition} label={condition} checked={props.selectedConditions.includes(condition)} onChange={() => props.onToggleCondition(condition)} />)}
        </div>
      </FilterGroup>

      <FilterGroup title="Price" open={openGroups.price} activeCount={props.minPrice || props.maxPrice ? 1 : 0} onToggle={() => toggleGroup('price')}>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
          <label><span className="sr-only">Minimum price</span><input type="number" min="0" value={props.minPrice} onChange={(event) => props.onMinChange(event.target.value)} placeholder="Min" className="h-10 w-full min-w-0 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#07513B]" /></label>
          <span className="text-gray-400">to</span>
          <label><span className="sr-only">Maximum price</span><input type="number" min="0" value={props.maxPrice} onChange={(event) => props.onMaxChange(event.target.value)} placeholder="Max" className="h-10 w-full min-w-0 rounded-lg border border-gray-300 px-3 text-sm outline-none focus:border-[#07513B]" /></label>
        </div>
      </FilterGroup>
    </div>
  );
}

function FilterGroup({ title, open, activeCount, onToggle, children }: { title: string; open: boolean; activeCount: number; onToggle: () => void; children: React.ReactNode }) {
  const contentId = useId();

  return (
    <section className="border-b border-gray-200">
      <button type="button" onClick={onToggle} aria-expanded={open} aria-controls={contentId} className="flex w-full items-center justify-between gap-3 py-3.5 text-left">
        <span className="flex items-center gap-2 text-sm font-black text-gray-900">
          {title}
          {activeCount > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E4F7C9] px-1.5 text-[10px] font-black text-[#07513B]">{activeCount}</span>}
        </span>
        <ChevronRight className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && <div id={contentId} className="pb-3">{children}</div>}
    </section>
  );
}

function FilterCheckbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-3 py-1.5 text-sm text-gray-700 hover:text-gray-950">
      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? 'border-[#07513B] bg-[#07513B] text-white' : 'border-gray-400 bg-white'}`}>{checked && <Check className="h-3 w-3" />}</span>
      <input type="checkbox" checked={checked} onChange={onChange} className="sr-only" />
      <span>{label}</span>
    </label>
  );
}

function ViewButton({ icon: Icon, active, label, onClick }: { icon: typeof Grid2X2; active: boolean; label: string; onClick: () => void }) {
  return <button type="button" onClick={onClick} aria-label={label} aria-pressed={active} className={`flex h-8 w-8 items-center justify-center rounded-full ${active ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'}`}><Icon className="h-4 w-4" /></button>;
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return <button type="button" onClick={onRemove} className="flex shrink-0 items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-200">{label}<X className="h-3 w-3" /></button>;
}

function getAuction(product: Product): Auction | null {
  return Array.isArray(product.auctions) ? product.auctions[0] || null : product.auctions || null;
}

function parseImages(images: Product['images']): string[] {
  if (Array.isArray(images)) return images;
  if (typeof images === 'string') {
    try { return JSON.parse(images) as string[]; } catch { return []; }
  }
  return [];
}

function readListParam(value: string | null): string[] {
  return value ? value.split(',').filter(Boolean) : [];
}

function readEnum<T extends string>(value: string | null, values: readonly T[], fallback: T): T {
  return value && values.includes(value as T) ? value as T : fallback;
}
