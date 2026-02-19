import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import BottomNavBar from './components/BottomNavBar';
import AuthRedirect from './components/AuthRedirect';
import CookieConsentBanner from './components/CookieConsentBanner';
import CookiePreferencesModal from './components/CookiePreferencesModal';
import ToastContainer from './components/ToastContainer';
import HomePage from './pages/HomePage';
import AllProductsPage from './pages/AllProductsPage';
import ProductDetailPage from './pages/ProductDetailPage';
import UserDashboard from './pages/UserDashboard';
import SubmitProduct from './pages/SubmitProduct';
import MyProductsPage from './pages/MyProductsPage';
import AdminDashboard from './pages/AdminDashboard';
import NewAdminDashboard from './pages/NewAdminDashboard';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import FavoritesPage from './pages/FavoritesPage';
import ProfilePage from './pages/ProfilePage';
import OrderHistoryPage from './pages/OrderHistoryPage';
import SettingsPage from './pages/SettingsPage';
import SellerOrdersPage from './pages/SellerOrdersPage';
import BuyerOrdersPage from './pages/BuyerOrdersPage';
import { FilterProvider, useFilters } from './contexts/FilterContext';

function AppContent() {
  const location = useLocation();
  const { toggleFilters } = useFilters();
  const isHomePage = location.pathname === '/';
  const isAdminPage = location.pathname.startsWith('/admin');

  return (
    <div className="min-h-screen bg-white">
      <AuthRedirect />
      {!isAdminPage && (
        <Header
          onToggleFilters={toggleFilters}
          showFiltersButton={isHomePage}
        />
      )}
      <div className={isAdminPage ? '' : 'pb-16 lg:pb-0'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<AllProductsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/dashboard" element={<UserDashboard />} />
          <Route path="/my-products" element={<MyProductsPage />} />
          <Route path="/submit-product" element={<SubmitProduct />} />
          <Route path="/admin" element={<NewAdminDashboard />} />
          <Route path="/admin-old" element={<AdminDashboard />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
          <Route path="/orders" element={<OrderHistoryPage />} />
          <Route path="/orders/:orderId" element={<OrderHistoryPage />} />
          <Route path="/seller-orders" element={<SellerOrdersPage />} />
          <Route path="/buyer-orders" element={<BuyerOrdersPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
      {!isAdminPage && <Footer />}
      {!isAdminPage && <BottomNavBar />}
      <CookieConsentBanner />
      <CookiePreferencesModal />
      <ToastContainer />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <FilterProvider>
        <AppContent />
      </FilterProvider>
    </BrowserRouter>
  );
}

export default App;
