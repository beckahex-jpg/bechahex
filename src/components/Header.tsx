import { ShoppingCart, User, Heart, Menu, LogOut, LayoutDashboard, Shield, ChevronDown, Search, SlidersHorizontal, Bell, Package, Settings } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useCart } from '../contexts/CartContext';
import { useFavorites } from '../contexts/FavoritesContext';
import { useNotifications } from '../contexts/NotificationContext';
import { supabase } from '../lib/supabase';
import AuthModal from './AuthModal';
import CartDrawer from './CartDrawer';
import NotificationDropdown from './NotificationDropdown';

interface HeaderProps {
  onToggleFilters?: () => void;
  showFiltersButton?: boolean;
}

export default function Header({ onToggleFilters, showFiltersButton = false }: HeaderProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<{ full_name: string; email: string; role?: string } | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const { user, signOut, isAdmin } = useAuth();
  const [localIsAdmin, setLocalIsAdmin] = useState(false);
  const { itemCount } = useCart();
  const { favorites } = useFavorites();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) {
      loadUserProfile();
    }
  }, [user]);

  const loadUserProfile = async () => {
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('full_name, email, role')
      .eq('id', user.id)
      .maybeSingle();

    console.log('📋 Loaded user profile in Header:', data);

    if (data) {
      setUserProfile(data);
      setLocalIsAdmin(data.role === 'admin');
      console.log('🔑 Local admin status set to:', data.role === 'admin');
    }
  };

  const getInitial = () => {
    if (userProfile?.full_name) {
      return userProfile.full_name.charAt(0).toUpperCase();
    }
    if (userProfile?.email) {
      return userProfile.email.charAt(0).toUpperCase();
    }
    if (user?.email) {
      return user.email.charAt(0).toUpperCase();
    }
    return 'U';
  };

  useEffect(() => {
    console.log('🎯 Header - isAdmin from context:', isAdmin, 'localIsAdmin:', localIsAdmin, 'user:', user?.email);
  }, [isAdmin, localIsAdmin, user]);

  const shouldShowAdminButton = isAdmin || localIsAdmin;

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Mobile Menu Button - Left */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="lg:hidden p-2 rounded-md text-gray-600 hover:bg-gray-100"
            >
              <Menu className="w-6 h-6" />
            </button>

            {/* Logo - Center on mobile, Left on desktop */}
            <div className="absolute left-1/2 -translate-x-1/2 lg:static lg:translate-x-0 flex items-center gap-8">
              <div className="flex flex-col leading-none">
                <span className="text-xl font-bold text-black">BECKAH</span>
                <span className="text-sm font-semibold" style={{ color: '#B8860B' }}>EXCHANGE</span>
              </div>

              <nav className="hidden lg:flex items-center gap-6">
                <button
                  onClick={() => navigate('/')}
                  className="text-sm font-medium text-gray-700 hover:text-emerald-700 transition"
                >
                  Home
                </button>
                <a href="https://www.beckah.org/programs" className="text-sm font-medium text-gray-700 hover:text-emerald-700 transition">
                  programs
                </a>
                <a href="https://www.beckah.org/community-services" className="text-sm font-medium text-gray-700 hover:text-emerald-700 transition">
                  community services
                </a>
              </nav>
            </div>

            {/* Right side icons */}

            <div className="flex items-center gap-3">
              {user && (
                <div className="relative">
                  <button
                    onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                    className="relative p-2 text-gray-700 hover:text-blue-600 transition"
                  >
                    <Bell className="w-6 h-6" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-600 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-semibold px-1">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {isNotificationOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsNotificationOpen(false)}
                      />
                      <div className="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 mt-2 z-40">
                        <NotificationDropdown />
                      </div>
                    </>
                  )}
                </div>
              )}

              <button
                onClick={() => navigate('/favorites')}
                className="relative p-2 text-gray-700 hover:text-red-500 transition hidden lg:flex"
              >
                <Heart className="w-6 h-6" />
                {favorites.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-semibold px-1">
                    {favorites.length}
                  </span>
                )}
              </button>

              <button
                onClick={() => setIsCartOpen(true)}
                className="relative p-2 text-gray-700 hover:text-emerald-700 transition hidden lg:flex"
              >
                <ShoppingCart className="w-6 h-6" />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
                    {itemCount}
                  </span>
                )}
              </button>

              {user ? (
                <div className="relative">
                  <button
                    onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                    className="flex items-center gap-1 group"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-white font-bold text-lg shadow-md hover:shadow-lg transition-shadow">
                      {getInitial()}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${isProfileDropdownOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isProfileDropdownOpen && (
                    <>
                      <div
                        className="fixed inset-0 z-30"
                        onClick={() => setIsProfileDropdownOpen(false)}
                      />
                      <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-40">
                        <div className="px-4 py-3 border-b border-gray-100">
                          <p className="font-semibold text-gray-900">{userProfile?.full_name || 'User'}</p>
                          <p className="text-sm text-gray-600">{userProfile?.email || user?.email}</p>
                        </div>

                        <div className="py-1">
                          {shouldShowAdminButton && (
                            <button
                              onClick={() => {
                                console.log('🚀 Navigating to admin dashboard');
                                navigate('/admin');
                                setIsProfileDropdownOpen(false);
                              }}
                              className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gradient-to-r hover:from-emerald-50 hover:to-green-50 transition bg-gradient-to-r from-emerald-600 to-green-600"
                            >
                              <Shield className="w-5 h-5 text-white" />
                              <span className="text-white font-semibold">Admin Dashboard</span>
                            </button>
                          )}

                          <button
                            onClick={() => {
                              navigate('/profile');
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition"
                          >
                            <User className="w-5 h-5 text-gray-600" />
                            <span className="text-gray-700">Profile</span>
                          </button>

                          <button
                            onClick={() => {
                              navigate('/orders');
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition"
                          >
                            <Package className="w-5 h-5 text-gray-600" />
                            <span className="text-gray-700">My Orders</span>
                          </button>

                          <button
                            onClick={() => {
                              navigate('/dashboard');
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition"
                          >
                            <LayoutDashboard className="w-5 h-5 text-gray-600" />
                            <span className="text-gray-700">Dashboard</span>
                          </button>

                          <button
                            onClick={() => {
                              navigate('/settings');
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 transition"
                          >
                            <Settings className="w-5 h-5 text-gray-600" />
                            <span className="text-gray-700">Settings</span>
                          </button>
                        </div>

                        <div className="border-t border-gray-100 mt-1 pt-1">
                          <button
                            onClick={() => {
                              signOut();
                              setIsProfileDropdownOpen(false);
                            }}
                            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-50 transition text-red-600"
                          >
                            <LogOut className="w-5 h-5" />
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-emerald-700 transition"
                >
                  <User className="w-5 h-5" />
                  <span className="hidden md:inline">Sign In</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {showFiltersButton && (
        <div className="bg-gradient-to-r from-gray-50 to-emerald-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  placeholder="Search for sustainable products..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      navigate(`/?search=${encodeURIComponent(searchInput)}`);
                    }
                  }}
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-200 outline-none transition"
                />
                <button
                  onClick={() => {
                    navigate(`/?search=${encodeURIComponent(searchInput)}`);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-emerald-700 hover:bg-emerald-800 text-white p-2 rounded-md transition"
                >
                  <Search className="w-5 h-5" />
                </button>
              </div>
              <button
                onClick={onToggleFilters}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white px-6 py-3 rounded-lg font-medium transition shadow-md hover:shadow-lg whitespace-nowrap"
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span>Filters</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white">
          <nav className="px-4 py-3 space-y-2">
            <a href="#" className="block py-2 text-sm font-medium text-gray-700 hover:text-emerald-700">
              Daily Deals
            </a>
            <a href="#" className="block py-2 text-sm font-medium text-gray-700 hover:text-emerald-700">
              Categories
            </a>
            <a href="#" className="block py-2 text-sm font-medium text-gray-700 hover:text-emerald-700">
              Support Our Cause
            </a>
          </nav>
        </div>
      )}

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </header>
  );
}
