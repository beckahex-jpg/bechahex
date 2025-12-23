import { useState, useEffect, useRef } from 'react';
import { Search, Bell, Maximize, Minimize, Grid, Settings, Menu, X, Home, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import NotificationDropdown from '../NotificationDropdown';
import AdminSettingsModal from './AdminSettingsModal';
import QuickActionsMenu from './QuickActionsMenu';

interface TopBarProps {
  onMenuClick: () => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  onSectionChange?: (section: string) => void;
}

export default function TopBar({
  onMenuClick,
  searchQuery = '',
  onSearchChange,
  onSectionChange
}: TopBarProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showQuickActions, setShowQuickActions] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false);
        setShowQuickActions(false);
        setShowUserMenu(false);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === '/') {
        event.preventDefault();
        setShowQuickActions(!showQuickActions);
      }
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
        event.preventDefault();
        const searchInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };

    if (showNotifications || showUserMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    document.addEventListener('keydown', handleKeyPress);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [showNotifications, showQuickActions, showUserMenu]);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error('Error toggling fullscreen:', error);
    }
  };

  const handleClearSearch = () => {
    if (onSearchChange) {
      onSearchChange('');
    }
  };

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 lg:left-64 left-0 z-30">
        <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            <button
              onClick={onMenuClick}
              className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition"
              title="Toggle menu"
            >
              <Menu className="w-6 h-6 text-gray-600" />
            </button>
            <div className="flex-1 max-w-xl hidden sm:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search here... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => onSearchChange?.(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-200 rounded transition"
                    title="Clear search"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 lg:gap-4">
            <div ref={notificationRef} className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 hover:bg-gray-50 rounded-lg transition relative"
                title="Notifications"
              >
                <Bell className="w-5 h-5 text-gray-600" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
                )}
              </button>
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 z-50">
                  <NotificationDropdown />
                </div>
              )}
            </div>

            <button
              onClick={toggleFullscreen}
              className="hidden md:block p-2 hover:bg-gray-50 rounded-lg transition"
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            >
              {isFullscreen ? (
                <Minimize className="w-5 h-5 text-gray-600" />
              ) : (
                <Maximize className="w-5 h-5 text-gray-600" />
              )}
            </button>

            <button
              onClick={() => setShowQuickActions(!showQuickActions)}
              className="hidden md:block p-2 hover:bg-gray-50 rounded-lg transition"
              title="Quick actions (Ctrl+/)"
            >
              <Grid className="w-5 h-5 text-gray-600" />
            </button>

            <div ref={userMenuRef} className="relative flex items-center gap-2 lg:gap-3 ml-2 lg:ml-4 pl-2 lg:pl-4 border-l border-gray-200">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 lg:gap-3 hover:bg-gray-50 rounded-lg p-1 lg:p-2 transition"
              >
                <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
                  <span className="text-white font-semibold text-xs lg:text-sm">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="hidden md:block text-right">
                  <p className="text-sm font-semibold text-gray-900">Admin</p>
                  <p className="text-xs text-gray-500">{user?.email?.split('@')[0]}</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-600 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </button>

              {showUserMenu && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                  <button
                    onClick={() => {
                      navigate('/');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition text-left"
                  >
                    <Home className="w-5 h-5 text-gray-600" />
                    <div>
                      <p className="font-medium text-gray-900">Home</p>
                      <p className="text-xs text-gray-500">Back to main site</p>
                    </div>
                  </button>

                  <div className="border-t border-gray-200 my-2"></div>

                  <button
                    onClick={async () => {
                      await signOut();
                      navigate('/');
                      setShowUserMenu(false);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-red-50 transition text-left text-red-600"
                  >
                    <LogOut className="w-5 h-5" />
                    <div>
                      <p className="font-medium">Sign Out</p>
                      <p className="text-xs text-red-500">Logout from admin panel</p>
                    </div>
                  </button>
                </div>
              )}

              <button
                onClick={() => setShowSettings(true)}
                className="hidden sm:block p-2 hover:bg-gray-50 rounded-lg transition"
                title="Settings"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <AdminSettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      <QuickActionsMenu
        isOpen={showQuickActions}
        onClose={() => setShowQuickActions(false)}
        onActionSelect={(section) => {
          if (onSectionChange) {
            onSectionChange(section);
          }
        }}
      />
    </>
  );
}
