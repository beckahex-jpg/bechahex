import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell, ChevronDown, Gavel, LayoutDashboard, LogOut, Package,
  PlusCircle, Receipt, Settings, ShoppingBag, Store, User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import AuthModal from '../AuthModal';
import NotificationDropdown from '../NotificationDropdown';

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { path: '/my-products', label: 'My Products', icon: Package },
  { path: '/my-auctions', label: 'My Auctions', icon: Gavel },
  { path: '/seller-orders', label: 'My Sales', icon: Receipt },
  { path: '/buyer-orders', label: 'My Orders', icon: ShoppingBag },
  { path: '/submit-product', label: 'Sell an Item', icon: PlusCircle },
] as const;

export default function SellerLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, openAuthModal } = useAuth();
  const { unreadCount } = useNotifications();
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;
  const initial = (user?.user_metadata?.full_name || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Dedicated seller top bar — the global Header/Footer are hidden on
          seller routes, so notifications and account actions live here. */}
      <header className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 sm:px-6">
          <button onClick={() => navigate('/')} className="flex items-center gap-3 text-left">
            <div className="flex flex-col leading-none">
              <span className="text-lg font-bold text-black">BECKAH</span>
              <span className="text-xs font-semibold" style={{ color: '#B8860B' }}>EXCHANGE</span>
            </div>
            <span className="hidden rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase tracking-widest text-emerald-700 sm:inline">
              Seller Hub
            </span>
          </button>

          <div className="flex items-center gap-2 sm:gap-3">
            {user && (
              <div className="relative">
                <button
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative p-2 text-gray-700 transition hover:text-emerald-700"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-600 px-1 text-xs font-semibold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                {isNotificationOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsNotificationOpen(false)} />
                    <div className="fixed left-4 right-4 top-20 z-40 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2">
                      <NotificationDropdown />
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={() => navigate('/')}
              className="hidden items-center gap-2 rounded-full border border-emerald-200 px-4 py-2 text-sm font-bold text-emerald-700 transition hover:bg-emerald-50 sm:flex"
            >
              <Store className="h-4 w-4" />
              Back to Store
            </button>
            <button
              onClick={() => navigate('/')}
              className="p-2 text-emerald-700 transition hover:text-emerald-800 sm:hidden"
            >
              <Store className="h-5 w-5" />
            </button>

            {user ? (
              <div className="relative">
                <button onClick={() => setIsAccountOpen(!isAccountOpen)} className="flex items-center gap-1">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-teal-600 text-base font-bold text-white shadow-md">
                    {initial}
                  </div>
                  <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform ${isAccountOpen ? 'rotate-180' : ''}`} />
                </button>
                {isAccountOpen && (
                  <>
                    <div className="fixed inset-0 z-30" onClick={() => setIsAccountOpen(false)} />
                    <div className="absolute right-0 z-40 mt-2 w-56 rounded-xl border border-gray-100 bg-white py-1 shadow-xl">
                      {([
                        ['/profile', 'Profile', User],
                        ['/buyer-orders', 'My Purchases', ShoppingBag],
                        ['/settings', 'Settings', Settings],
                      ] as const).map(([path, label, Icon]) => (
                        <button
                          key={path}
                          onClick={() => {
                            navigate(path);
                            setIsAccountOpen(false);
                          }}
                          className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                        >
                          <Icon className="h-4 w-4 text-gray-500" />
                          {label}
                        </button>
                      ))}
                      <div className="my-1 border-t border-gray-100" />
                      <button
                        onClick={() => {
                          signOut();
                          setIsAccountOpen(false);
                          navigate('/');
                        }}
                        className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-red-600 transition hover:bg-red-50"
                      >
                        <LogOut className="h-4 w-4" />
                        Sign Out
                      </button>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <button
                onClick={() => openAuthModal()}
                className="flex items-center gap-2 text-sm font-semibold text-gray-700 transition hover:text-emerald-700"
              >
                <User className="h-5 w-5" />
                Sign In
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile: horizontal tab strip under the top bar */}
      <div className="sticky top-16 z-20 border-b border-gray-200 bg-white lg:hidden">
        <nav className="flex gap-2 overflow-x-auto px-3 py-2 [-webkit-overflow-scrolling:touch]">
          {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition ${
                isActive(path)
                  ? 'bg-emerald-700 text-white shadow'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
          <button
            onClick={() => navigate('/settings')}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-bold transition ${
              isActive('/settings')
                ? 'bg-emerald-700 text-white shadow'
                : 'border border-gray-200 bg-white text-gray-600 hover:border-emerald-300 hover:text-emerald-700'
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </button>
        </nav>
      </div>

      <div className="mx-auto flex w-full max-w-[1600px]">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-gray-200 bg-white lg:block">
          <div className="sticky top-16 flex h-[calc(100vh-4rem)] flex-col px-4 py-6">
            <p className="mb-4 px-3 text-xs font-black uppercase tracking-widest text-gray-400">Seller Hub</p>
            <nav className="space-y-1">
              {NAV_ITEMS.map(({ path, label, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                    isActive(path)
                      ? 'bg-emerald-700 text-white shadow-md'
                      : 'text-gray-600 hover:bg-emerald-50 hover:text-emerald-800'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {label}
                </button>
              ))}
            </nav>
            <div className="mt-auto space-y-1 border-t border-gray-100 pt-4">
              <button
                onClick={() => navigate('/settings')}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  isActive('/settings')
                    ? 'bg-emerald-700 text-white shadow-md'
                    : 'text-gray-500 hover:bg-emerald-50 hover:text-emerald-800'
                }`}
              >
                <Settings className="h-5 w-5" />
                Settings
              </button>
              <button
                onClick={() => navigate('/')}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
              >
                <Store className="h-5 w-5" />
                Back to Store
              </button>
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      {/* The global Header (which normally hosts AuthModal) is hidden on
          seller routes, so openAuthModal needs a mount point here. */}
      <AuthModal />
    </div>
  );
}
