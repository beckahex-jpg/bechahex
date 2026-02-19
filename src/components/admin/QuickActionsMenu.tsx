import { useEffect, useRef } from 'react';
import {
  Plus,
  Package,
  ShoppingBag,
  FileCheck,
  Tags,
  Users,
  BarChart3,
  X,
} from 'lucide-react';

interface QuickActionsMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onActionSelect: (section: string) => void;
}

export default function QuickActionsMenu({
  isOpen,
  onClose,
  onActionSelect,
}: QuickActionsMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const actions = [
    {
      id: 'add-product',
      icon: Plus,
      label: 'Add New Product',
      description: 'Create a new product listing',
      color: 'text-emerald-600 bg-emerald-50',
    },
    {
      id: 'product-submissions',
      icon: FileCheck,
      label: 'Review Submissions',
      description: 'Check pending product submissions',
      color: 'text-yellow-600 bg-yellow-50',
    },
    {
      id: 'orders',
      icon: ShoppingBag,
      label: 'View Orders',
      description: 'Manage customer orders',
      color: 'text-blue-600 bg-blue-50',
    },
    {
      id: 'product-list',
      icon: Package,
      label: 'Manage Products',
      description: 'View and edit all products',
      color: 'text-purple-600 bg-purple-50',
    },
    {
      id: 'category-list',
      icon: Tags,
      label: 'Manage Categories',
      description: 'Organize product categories',
      color: 'text-pink-600 bg-pink-50',
    },
    {
      id: 'all-users',
      icon: Users,
      label: 'View Users',
      description: 'Manage user accounts',
      color: 'text-orange-600 bg-orange-50',
    },
    {
      id: 'dashboard',
      icon: BarChart3,
      label: 'Dashboard',
      description: 'View statistics and overview',
      color: 'text-teal-600 bg-teal-50',
    },
  ];

  return (
    <div className="fixed inset-0 bg-black/20 z-50 flex items-start justify-center pt-20">
      <div
        ref={menuRef}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 animate-in fade-in slide-in-from-top-4 duration-200"
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Quick Actions</h3>
            <p className="text-sm text-gray-500">Navigate to common admin tasks</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        <div className="p-2 max-h-96 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={() => {
                    onActionSelect(action.id);
                    onClose();
                  }}
                  className="flex items-start gap-3 p-4 rounded-lg hover:bg-gray-50 transition text-left group"
                >
                  <div className={`p-2 rounded-lg ${action.color} group-hover:scale-110 transition`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 group-hover:text-emerald-600 transition">
                      {action.label}
                    </p>
                    <p className="text-sm text-gray-500 truncate">{action.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-3 border-t border-gray-200 bg-gray-50 rounded-b-xl">
          <p className="text-xs text-center text-gray-500">
            Press <kbd className="px-2 py-1 bg-white rounded border border-gray-300 text-gray-700 font-mono">ESC</kbd> to close
            or <kbd className="px-2 py-1 bg-white rounded border border-gray-300 text-gray-700 font-mono">Ctrl + /</kbd> to reopen
          </p>
        </div>
      </div>
    </div>
  );
}
