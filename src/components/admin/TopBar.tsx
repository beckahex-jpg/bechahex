import { Search, Bell, MessageSquare, Maximize, Grid, Settings } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function TopBar() {
  const { user } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 fixed top-0 right-0 left-64 z-10">
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex-1 max-w-xl">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search here..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="p-2 hover:bg-gray-50 rounded-lg transition">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute -mt-6 ml-3 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <button className="p-2 hover:bg-gray-50 rounded-lg transition">
            <MessageSquare className="w-5 h-5 text-gray-600" />
            <span className="absolute -mt-6 ml-3 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>

          <button className="p-2 hover:bg-gray-50 rounded-lg transition">
            <Maximize className="w-5 h-5 text-gray-600" />
          </button>

          <button className="p-2 hover:bg-gray-50 rounded-lg transition">
            <Grid className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-200">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center">
              <span className="text-white font-semibold text-sm">
                {user?.email?.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-gray-900">Admin</p>
              <p className="text-xs text-gray-500">{user?.email?.split('@')[0]}</p>
            </div>
            <button className="p-2 hover:bg-gray-50 rounded-lg transition">
              <Settings className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
