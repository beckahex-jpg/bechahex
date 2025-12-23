import { Home, LayoutDashboard, Heart, ShoppingCart, User } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useAuthGuard } from '../hooks/useAuthGuard';

export default function BottomNavBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { itemCount } = useCart();
  const { favorites } = useFavorites();
  const { protectedAction } = useAuthGuard();

  const handleNavigation = (path: string, requiresAuth: boolean = false, message?: string) => {
    if (requiresAuth && !user) {
      protectedAction(() => navigate(path), message || 'Please sign in to continue');
      return;
    }
    navigate(path);
  };

  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    {
      icon: Home,
      label: 'Home',
      path: '/',
      requiresAuth: false,
      badge: null,
    },
    {
      icon: LayoutDashboard,
      label: 'Dashboard',
      path: '/dashboard',
      requiresAuth: true,
      badge: null,
    },
    {
      icon: Heart,
      label: 'Favorites',
      path: '/favorites',
      requiresAuth: true,
      badge: favorites.length > 0 ? favorites.length : null,
    },
    {
      icon: ShoppingCart,
      label: 'Cart',
      path: '/checkout',
      requiresAuth: true,
      badge: itemCount > 0 ? itemCount : null,
    },
    {
      icon: User,
      label: 'Account',
      path: '/profile',
      requiresAuth: true,
      badge: null,
    },
  ];

  const getAuthMessage = (path: string) => {
    switch (path) {
      case '/dashboard':
        return 'Please sign in to view your dashboard';
      case '/favorites':
        return 'Please sign in to view your favorites';
      case '/checkout':
        return 'Please sign in to complete your purchase';
      case '/profile':
        return 'Please sign in to view your profile';
      default:
        return 'Please sign in to continue';
    }
  };

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg z-50">
        <div className="flex items-center justify-around h-16 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <button
                key={item.path}
                onClick={() => handleNavigation(item.path, item.requiresAuth, getAuthMessage(item.path))}
                className="flex flex-col items-center justify-center flex-1 h-full relative group"
              >
                <div className="relative">
                  <Icon
                    className={`w-6 h-6 transition-colors ${
                      active
                        ? 'text-red-600'
                        : 'text-gray-600 group-hover:text-red-500'
                    }`}
                  />
                  {item.badge !== null && (
                    <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-semibold px-1">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span
                  className={`text-xs mt-1 transition-colors ${
                    active
                      ? 'text-red-600 font-semibold'
                      : 'text-gray-600 group-hover:text-red-500'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
