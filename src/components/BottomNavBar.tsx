import { Heart, Home, PlusCircle, Search, ShoppingCart } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuthGuard } from '../hooks/useAuthGuard';

export default function BottomNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount } = useCart();
  const { favorites } = useFavorites();
  const { protectedAction } = useAuthGuard();

  const items = [
    { label: 'Home', icon: Home, active: location.pathname === '/', action: () => navigate('/') },
    { label: 'Shop', icon: Search, active: location.pathname === '/products' || location.pathname.startsWith('/product/'), action: () => navigate('/products') },
    { label: 'Sell', icon: PlusCircle, active: location.pathname === '/submit-product', action: () => protectedAction(() => navigate('/submit-product'), 'Please sign in to sell an item') },
    { label: 'Watchlist', icon: Heart, active: location.pathname === '/favorites', badge: favorites.length, action: () => protectedAction(() => navigate('/favorites'), 'Please sign in to view your watchlist') },
    { label: 'Cart', icon: ShoppingCart, active: location.pathname === '/checkout', badge: itemCount, action: () => window.dispatchEvent(new Event('open-market-cart')) },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white/95 shadow-[0_-6px_18px_rgba(0,0,0,0.08)] backdrop-blur lg:hidden" aria-label="Mobile navigation">
      <div className="grid h-16 grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
        {items.map(({ label, icon: Icon, active, badge, action }) => (
          <button key={label} type="button" onClick={action} aria-current={active ? 'page' : undefined} className={`relative flex min-w-0 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition ${active ? 'text-[#07513B]' : 'text-gray-600'}`}>
            <span className="relative">
              <Icon className={`h-5 w-5 ${label === 'Sell' ? 'h-6 w-6' : ''}`} strokeWidth={active ? 2.4 : 1.8} />
              {Boolean(badge) && <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-bold text-white">{badge}</span>}
            </span>
            <span className="truncate">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
