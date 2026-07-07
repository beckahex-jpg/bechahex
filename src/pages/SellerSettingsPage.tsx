import SettingsPanel from '../components/settings/SettingsPanel';
import { useProtectedRoute } from '../hooks/useProtectedRoute';

export default function SellerSettingsPage() {
  const { user, authLoading } = useProtectedRoute('Please sign in to view settings');

  if (authLoading || !user) return null;

  return (
    <main className="min-h-screen bg-white pb-24 lg:pb-12">
      <div className="market-container py-6 sm:py-8 lg:py-10">
        <div className="mb-8 lg:mb-10">
          <p className="text-xs font-black uppercase tracking-[0.16em] text-[#07513B]">Seller center</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-gray-950 sm:text-4xl">Settings</h1>
          <p className="mt-2 text-sm text-gray-500">Manage your account preferences and notifications</p>
        </div>
        <div className="max-w-4xl">
          <SettingsPanel />
        </div>
      </div>
    </main>
  );
}
