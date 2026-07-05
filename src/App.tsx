import { BrowserRouter, Navigate, Routes, Route, useLocation, useParams } from 'react-router-dom';
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
import SellerSettingsPage from './pages/SellerSettingsPage';
import SellerOrdersPage from './pages/SellerOrdersPage';
import BuyerOrdersPage from './pages/BuyerOrdersPage';
import ReviewOrderPage from './pages/ReviewOrderPage';
import MyAuctionsPage from './pages/MyAuctionsPage';
import AuctionPaymentPage from './pages/AuctionPaymentPage';
import SellerLayout from './components/seller/SellerLayout';
import { FilterProvider } from './contexts/FilterContext';

// The old /orders/:orderId deep links (notifications, emails) now land on the
// unified buyer orders page with the order auto-opened.
function LegacyOrderRedirect() {
  const { orderId } = useParams();
  return <Navigate to={orderId ? `/buyer-orders?order=${orderId}` : '/buyer-orders'} replace />;
}

const SELLER_PATHS = ['/dashboard', '/my-products', '/my-auctions', '/seller-orders', '/buyer-orders', '/submit-product', '/settings'];

function AppContent() {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');
  // Seller pages are a standalone workspace (SellerLayout brings its own
  // top bar), so the global chrome is hidden — same treatment as /admin.
  const isSellerPage = SELLER_PATHS.some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
  const hideChrome = isAdminPage || isSellerPage;

  return (
    <div className="min-h-screen bg-white">
      <AuthRedirect />
      {!hideChrome && <Header />}
      <div className={hideChrome ? '' : 'pb-16 lg:pb-0'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/products" element={<AllProductsPage />} />
          <Route path="/product/:id" element={<ProductDetailPage />} />
          <Route path="/auctions" element={<Navigate to="/products?listing=auction" replace />} />
          <Route path="/auction/:id" element={<Navigate to="/products?listing=auction" replace />} />
          <Route path="/create-auction" element={<Navigate to="/submit-product?listing=auction" replace />} />
          <Route path="/auction-payment/:offerId" element={<AuctionPaymentPage />} />
          <Route element={<SellerLayout />}>
            <Route path="/dashboard" element={<UserDashboard />} />
            <Route path="/my-products" element={<MyProductsPage />} />
            <Route path="/my-auctions" element={<MyAuctionsPage />} />
            <Route path="/seller-orders" element={<SellerOrdersPage />} />
            <Route path="/buyer-orders" element={<BuyerOrdersPage />} />
            <Route path="/submit-product" element={<SubmitProduct />} />
            <Route path="/settings" element={<SellerSettingsPage />} />
          </Route>
          <Route path="/admin" element={<NewAdminDashboard />} />
          <Route path="/admin-old" element={<AdminDashboard />} />
          <Route path="/checkout" element={<CheckoutPage />} />
          <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
          <Route path="/orders" element={<Navigate to="/buyer-orders" replace />} />
          <Route path="/orders/:orderId" element={<LegacyOrderRedirect />} />
          <Route path="/review/:orderId" element={<ReviewOrderPage />} />
          <Route path="/favorites" element={<FavoritesPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </div>
      {!hideChrome && <Footer />}
      {!hideChrome && <BottomNavBar />}
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
