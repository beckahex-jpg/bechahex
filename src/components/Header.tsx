import {
  Bell,
  ChevronDown,
  Gavel,
  Heart,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  Shield,
  ShoppingCart,
  SlidersHorizontal,
  Store,
  Tag,
  User,
  X,
} from 'lucide-react';
import { FormEvent, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useNotifications } from '../contexts/NotificationContext';
import { useAuthGuard } from '../hooks/useAuthGuard';
import { useCategories } from '../hooks/useProducts';
import { supabase } from '../lib/supabase';
import AuthModal from './AuthModal';
import CartDrawer from './CartDrawer';
import NotificationDropdown from './NotificationDropdown';

interface HeaderProps {
  onToggleFilters?: () => void;
  showFiltersButton?: boolean;
}

interface HeaderProfile {
  full_name: string | null;
  email: string | null;
  role?: string | null;
}

export default function Header({ onToggleFilters, showFiltersButton = false }: HeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut, isAdmin, openAuthModal } = useAuth();
  const { protectedAction } = useAuthGuard();
  const { itemCount } = useCart();
  const { favorites } = useFavorites();
  const { unreadCount } = useNotifications();
  const { categories } = useCategories();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [profile, setProfile] = useState<HeaderProfile | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    setSearchInput(params.get('search') || '');
    setCategoryId(params.get('category') || '');
    setIsMenuOpen(false);
  }, [location.pathname, location.search]);

  useEffect(() => {
    const openCart = () => setIsCartOpen(true);
    window.addEventListener('open-market-cart', openCart);
    return () => window.removeEventListener('open-market-cart', openCart);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      if (!user) {
        setProfile(null);
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, role')
        .eq('id', user.id)
        .maybeSingle();

      if (!cancelled) setProfile((data as HeaderProfile | null) || null);
    }

    void loadProfile();
    return () => { cancelled = true; };
  }, [user]);

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (searchInput.trim()) params.set('search', searchInput.trim());
    if (categoryId) params.set('category', categoryId);
    const query = params.toString();
    navigate(query ? `/products?${query}` : '/products');
  };

  const goToSell = () => {
    protectedAction(() => navigate('/submit-product'), 'Please sign in to sell an item');
  };

  const initial = (profile?.full_name || profile?.email || user?.email || 'U').charAt(0).toUpperCase();
  const displayName = profile?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Account';
  const canOpenAdmin = isAdmin || profile?.role === 'admin';
  const quickCategories = categories.slice(0, 8);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white shadow-sm">
      <div className="hidden border-b border-gray-200 bg-gray-50 lg:block">
        <div className="market-container flex h-8 items-center justify-between text-xs text-gray-700">
          <div className="flex items-center gap-4">
            {user ? (
              <span>Hi, <strong>{displayName}</strong></span>
            ) : (
              <span>
                Hi!{' '}
                <button type="button" onClick={() => openAuthModal()} className="font-semibold text-[#07513B] underline-offset-2 hover:underline">Sign in</button>
                {' '}or{' '}
                <button type="button" onClick={() => openAuthModal()} className="font-semibold text-[#07513B] underline-offset-2 hover:underline">register</button>
              </span>
            )}
            <a href="https://www.beckah.org/programs" className="hover:underline">Programs</a>
            <a href="https://www.beckah.org/community-services" className="hover:underline">Community services</a>
          </div>
          <nav className="flex items-center gap-5" aria-label="Utility navigation">
            <button type="button" onClick={goToSell} className="font-semibold hover:text-[#07513B]">Sell</button>
            <button type="button" onClick={() => protectedAction(() => navigate('/favorites'), 'Please sign in to view your watchlist')} className="hover:text-[#07513B]">Watchlist</button>
            <button type="button" onClick={() => protectedAction(() => navigate('/buyer-orders'), 'Please sign in to view your purchases')} className="hover:text-[#07513B]">Purchases</button>
          </nav>
        </div>
      </div>

      <div className="market-container">
        <div className="flex h-14 items-center justify-between gap-2 lg:h-[72px] lg:gap-5">
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={isMenuOpen}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 lg:hidden"
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>

          <button type="button" onClick={() => navigate('/')} className="shrink-0 text-left" aria-label="Beckah Exchange home">
            <span className="block text-lg font-black leading-none tracking-tight text-black lg:text-xl">BECKAH</span>
            <span className="mt-0.5 block text-[10px] font-bold leading-none text-[#B8860B] lg:text-xs">EXCHANGE</span>
          </button>

          <form onSubmit={submitSearch} className="hidden min-w-0 flex-1 items-stretch lg:flex" role="search">
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              aria-label="Search category"
              className="max-w-44 rounded-l-full border-2 border-r border-gray-900 bg-white px-4 text-sm text-gray-700 outline-none focus:border-[#07513B]"
            >
              <option value="">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
              <input
                type="search"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Search for anything"
                className="h-12 w-full border-y-2 border-gray-900 pl-12 pr-4 text-sm outline-none placeholder:text-gray-500 focus:border-[#07513B]"
              />
            </div>
            <button type="submit" className="min-w-28 rounded-r-full bg-[#07513B] px-7 text-sm font-bold text-white transition hover:bg-[#032F24]">Search</button>
          </form>

          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationOpen((open) => !open)}
                  aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
                  aria-expanded={isNotificationOpen}
                  className="relative flex h-10 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 sm:w-10"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{unreadCount}</span>}
                </button>
                {isNotificationOpen && (
                  <>
                    <button type="button" aria-label="Close notifications" className="fixed inset-0 z-30 cursor-default" onClick={() => setIsNotificationOpen(false)} />
                    <div className="fixed left-3 right-3 top-16 z-40 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96"><NotificationDropdown /></div>
                  </>
                )}
              </div>
            )}

            <button
              type="button"
              onClick={() => protectedAction(() => navigate('/favorites'), 'Please sign in to view your watchlist')}
              aria-label={`Watchlist${favorites.length ? `, ${favorites.length} items` : ''}`}
              className="relative hidden h-10 w-10 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 sm:flex"
            >
              <Heart className="h-5 w-5" />
              {favorites.length > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">{favorites.length}</span>}
            </button>

            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              aria-label={`Shopping cart${itemCount ? `, ${itemCount} items` : ''}`}
              className="relative flex h-10 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 sm:w-10"
            >
              <ShoppingCart className="h-5 w-5" />
              {itemCount > 0 && <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#07513B] px-1 text-[10px] font-bold text-white">{itemCount}</span>}
            </button>

            {user ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAccountOpen((open) => !open)}
                  aria-label="Open account menu"
                  aria-expanded={isAccountOpen}
                  className="flex items-center gap-1 rounded-full p-0.5 hover:bg-gray-100"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#07513B] text-sm font-bold text-white">{initial}</span>
                  <ChevronDown className="hidden h-4 w-4 text-gray-500 sm:block" />
                </button>
                {isAccountOpen && (
                  <>
                    <button type="button" aria-label="Close account menu" className="fixed inset-0 z-30 cursor-default" onClick={() => setIsAccountOpen(false)} />
                    <div className="absolute right-0 z-40 mt-2 w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                      <div className="border-b border-gray-100 p-4">
                        <p className="font-bold text-gray-900">{profile?.full_name || 'My account'}</p>
                        <p className="truncate text-xs text-gray-500">{profile?.email || user.email}</p>
                      </div>
                      <div className="p-2">
                        {canOpenAdmin && <AccountLink icon={Shield} label="Admin dashboard" onClick={() => { navigate('/admin'); setIsAccountOpen(false); }} accent />}
                        <AccountLink icon={Package} label="Purchases" onClick={() => { navigate('/buyer-orders'); setIsAccountOpen(false); }} />
                        <AccountLink icon={Heart} label="Watchlist" onClick={() => { navigate('/favorites'); setIsAccountOpen(false); }} />
                        <AccountLink icon={LayoutDashboard} label="Seller Hub" onClick={() => { navigate('/dashboard'); setIsAccountOpen(false); }} />
                        <AccountLink icon={Gavel} label="My auctions" onClick={() => { navigate('/my-auctions'); setIsAccountOpen(false); }} />
                        <AccountLink icon={Settings} label="Settings" onClick={() => { navigate('/settings'); setIsAccountOpen(false); }} />
                      </div>
                      <div className="border-t border-gray-100 p-2">
                        <AccountLink icon={LogOut} label="Sign out" danger onClick={() => { void signOut(); setIsAccountOpen(false); navigate('/'); }} />
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button type="button" onClick={() => openAuthModal()} aria-label="Sign in" className="flex h-10 w-9 items-center justify-center rounded-full text-gray-700 hover:bg-gray-100 sm:w-auto sm:gap-2 sm:px-2">
                <User className="h-5 w-5" /><span className="hidden text-sm font-semibold sm:inline">Sign in</span>
              </button>
            )}
          </div>
        </div>

        <form onSubmit={submitSearch} className="flex min-w-0 gap-2 pb-3 lg:hidden" role="search">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search for anything"
              className="h-11 w-full rounded-full border-2 border-gray-900 bg-white pl-10 pr-12 text-sm outline-none focus:border-[#07513B]"
            />
            <button type="submit" aria-label="Search" className="absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-[#07513B] text-white"><Search className="h-4 w-4" /></button>
          </div>
          {showFiltersButton && onToggleFilters && (
            <button type="button" onClick={onToggleFilters} aria-label="Open filters" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-800"><SlidersHorizontal className="h-5 w-5" /></button>
          )}
        </form>
      </div>

      <nav className="hidden border-t border-gray-100 lg:block" aria-label="Shop navigation">
        <div className="market-container flex h-10 items-center gap-6 overflow-x-auto whitespace-nowrap text-sm">
          <button type="button" onClick={() => navigate('/products')} className="flex items-center gap-1.5 font-bold text-gray-900 hover:text-[#07513B]"><Store className="h-4 w-4" />Shop all</button>
          {quickCategories.map((category) => (
            <button type="button" key={category.id} onClick={() => navigate(`/products?category=${category.id}`)} className="text-gray-600 hover:text-[#07513B]">{category.name}</button>
          ))}
          <button type="button" onClick={() => navigate('/products?listing=auction')} className="ml-auto flex items-center gap-1.5 font-bold text-[#07513B]"><Gavel className="h-4 w-4" />Auctions</button>
        </div>
      </nav>

      {isMenuOpen && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setIsMenuOpen(false)} className="fixed inset-0 top-[112px] z-30 bg-black/40 lg:hidden" />
          <div className="absolute left-0 right-0 z-40 max-h-[calc(100vh-7rem)] overflow-y-auto border-t border-gray-200 bg-white p-4 shadow-xl lg:hidden">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => navigate('/products')} className="flex items-center gap-2 rounded-xl bg-gray-100 p-3 text-left text-sm font-bold"><Store className="h-4 w-4" />Shop all</button>
              <button type="button" onClick={() => navigate('/products?listing=auction')} className="flex items-center gap-2 rounded-xl bg-lime-100 p-3 text-left text-sm font-bold text-[#032F24]"><Gavel className="h-4 w-4" />Auctions</button>
              <button type="button" onClick={goToSell} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#07513B] p-3 text-sm font-bold text-white"><Tag className="h-4 w-4" />Sell an item</button>
            </div>
            <p className="mb-2 mt-5 text-xs font-black uppercase tracking-wider text-gray-400">Categories</p>
            <div className="grid grid-cols-2 gap-x-4">
              {categories.map((category) => <button type="button" key={category.id} onClick={() => navigate(`/products?category=${category.id}`)} className="border-b border-gray-100 py-3 text-left text-sm text-gray-700">{category.name}</button>)}
            </div>
            <div className="mt-5 space-y-1 border-t border-gray-200 pt-3">
              <a href="https://www.beckah.org/programs" className="block rounded-lg px-2 py-2 text-sm text-gray-700">Programs</a>
              <a href="https://www.beckah.org/community-services" className="block rounded-lg px-2 py-2 text-sm text-gray-700">Community services</a>
            </div>
          </div>
        </>
      )}

      <AuthModal />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </header>
  );
}

interface AccountLinkProps {
  icon: typeof User;
  label: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
}

function AccountLink({ icon: Icon, label, onClick, accent = false, danger = false }: AccountLinkProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
        accent ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100' : danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4 w-4" />{label}
    </button>
  );
}
