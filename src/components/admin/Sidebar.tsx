import { useState } from 'react';
import { LayoutDashboard, ShoppingCart, Layers, Package, ShoppingBag, Users, UserCog, Image, ChevronDown } from 'lucide-react';

interface SidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  pendingSubmissions: number;
}

export default function Sidebar({ activeSection, onSectionChange, pendingSubmissions }: SidebarProps) {
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, group: 'main' },
    { id: 'ecommerce', label: 'Ecommerce', icon: ShoppingCart, group: 'all', hasSubmenu: true, submenu: [
      { id: 'add-product', label: 'Add Product' },
      { id: 'product-list', label: 'Product List' },
      { id: 'product-submissions', label: 'Product Submissions', badge: pendingSubmissions }
    ]},
    { id: 'category', label: 'Category', icon: Layers, group: 'all', hasSubmenu: true, submenu: [
      { id: 'category-list', label: 'Category List' },
      { id: 'new-category', label: 'New Category' }
    ]},
    { id: 'attributes', label: 'Attributes', icon: Package, group: 'all' },
    { id: 'orders', label: 'Orders', icon: ShoppingBag, group: 'all' },
    { id: 'user', label: 'User', icon: Users, group: 'all', hasSubmenu: true, submenu: [
      { id: 'all-users', label: 'All Users' }
    ]},
    { id: 'roles', label: 'Roles', icon: UserCog, group: 'all' },
    { id: 'gallery', label: 'Gallery', icon: Image, group: 'all' }
  ];

  const toggleMenu = (menuId: string) => {
    setOpenMenus(prev =>
      prev.includes(menuId)
        ? []
        : [menuId]
    );
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">B</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Beckah</h1>
            <p className="text-xs text-gray-500">Admin Panel</p>
          </div>
        </div>
      </div>

      <nav className="p-4">
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">MAIN HOME</p>
          {menuItems.filter(item => item.group === 'main').map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                activeSection === item.id
                  ? 'bg-emerald-50 text-emerald-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">ALL PAGE</p>
          {menuItems.filter(item => item.group === 'all').map((item) => (
            <div key={item.id} className="mb-2">
              <button
                onClick={() => item.hasSubmenu ? toggleMenu(item.id) : onSectionChange(item.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-lg text-sm font-medium transition ${
                  openMenus.includes(item.id) || activeSection === item.id
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </div>
                {item.hasSubmenu && (
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      openMenus.includes(item.id) ? 'rotate-180' : ''
                    }`}
                  />
                )}
              </button>
              {item.hasSubmenu && item.submenu && openMenus.includes(item.id) && (
                <div className="ml-8 mt-1 space-y-1">
                  {item.submenu.map((sub: any) => (
                    <button
                      key={sub.id}
                      onClick={() => onSectionChange(sub.id)}
                      className={`w-full text-left px-4 py-2 rounded text-sm transition flex items-center justify-between ${
                        activeSection === sub.id
                          ? 'text-emerald-600 font-medium'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      <span>{sub.label}</span>
                      {sub.badge !== undefined && sub.badge > 0 && (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {sub.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </nav>
    </aside>
  );
}
