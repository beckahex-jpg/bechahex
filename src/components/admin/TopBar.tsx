import { Search, Bell, MessageSquare, Maximize, Grid, Settings, Menu } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 lg:left-64 left-0 z-10">
      <div className="h-full px-4 lg:px-6 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <Menu className="w-6 h-6 text-gray-600" />
          </button>
          <div className="flex-1 max-w-xl hidden sm:block">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search here..."
                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 lg:gap-4">
          <button className="p-2 hover:bg-gray-50 rounded-lg transition relative">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <button className="hidden sm:block p-2 hover:bg-gray-50 rounded-lg transition relative">
            <MessageSquare className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <button className="hidden md:block p-2 hover:bg-gray-50 rounded-lg transition">
            <Maximize className="w-5 h-5 text-gray-600" />
          </button>

          <button className="hidden md:block p-2 hover:bg-gray-50 rounded-lg transition">
            <Grid className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-2 lg:gap-3 ml-2 lg:ml-4 pl-2 lg:pl-4 border-l border-gray-200">
            <div className="w-8 h-8 lg:w-10 lg:h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-xs lg:text-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="hidden md:block text-right">
              <p className="text-sm font-semibold text-gray-900">Admin</p>
              <p className="text-xs text-gray-500">{user?.email?.split('@')[0]}</p>
            </div>
            <button className="hidden sm:block p-2 hover:bg-gray-50 rounded-lg transition">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
