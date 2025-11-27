import { X, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../contexts/CartContext';
import { useNavigate } from 'react-router-dom';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CartDrawer({ isOpen, onClose }: CartDrawerProps) {
  const { items, itemCount, totalAmount, updateQuantity, removeFromCart, loading } = useCart();
  const navigate = useNavigate();

  const handleCheckout = () => {
    onClose();
    navigate('/checkout');
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity"
        onClick={onClose}
      />

      <div className="fixed top-0 right-0 h-full w-full sm:w-96 bg-white shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-gray-900">
              Shopping Cart ({itemCount})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-600 font-medium mb-2">Your cart is empty</p>
              <p className="text-sm text-gray-500 mb-4">Add some products to get started</p>
              <button
                onClick={() => {
                  onClose();
                  navigate('/');
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition"
              >
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => {
                const price = typeof item.products.price === 'string'
                  ? parseFloat(item.products.price)
                  : item.products.price;

                return (
                  <div
                    key={item.id}
                    className="flex gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200"
                  >
                    <div
                      className="w-20 h-20 bg-white rounded-lg overflow-hidden flex-shrink-0 cursor-pointer"
                      onClick={() => {
                        onClose();
                        navigate(`/product/${item.product_id}`);
                      }}
                    >
                      <img
                        src={item.products.image_url}
                        alt={item.products.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = 'https://images.pexels.com/photos/607812/pexels-photo-607812.jpeg?auto=compress&cs=tinysrgb&w=400';
                        }}
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <h3
                        className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2 cursor-pointer hover:text-blue-600"
                        onClick={() => {
                          onClose();
                          navigate(`/product/${item.product_id}`);
                        }}
                      >
                        {item.products.title}
                      </h3>
                      <p className="text-xs text-gray-500 mb-2">{item.products.condition}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg">
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity - 1)}
                            className="p-1.5 hover:bg-gray-100 rounded-l-lg transition"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-sm font-semibold px-2">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.product_id, item.quantity + 1)}
                            className="p-1.5 hover:bg-gray-100 rounded-r-lg transition"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <button
                          onClick={() => removeFromCart(item.product_id)}
                          className="p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-sm font-bold text-gray-900 mt-2">
                        ${(price * item.quantity).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t p-4 space-y-3">
            <div className="flex items-center justify-between text-lg font-bold">
              <span>Total:</span>
              <span className="text-blue-600">${totalAmount.toFixed(2)}</span>
            </div>
            <button
              onClick={handleCheckout}
              className="w-full bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white py-3 rounded-lg font-semibold transition shadow-md hover:shadow-lg"
            >
              Proceed to Checkout
            </button>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2.5 rounded-lg font-medium transition"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  );
}
