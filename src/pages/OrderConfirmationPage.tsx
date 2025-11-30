import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, Package, MapPin, CreditCard, Loader2, Home } from 'lucide-react';

interface Order {
  id: string;
  total_amount: number;
  status: string;
  payment_status: string;
  payment_method: string;
  shipping_address: any;
  created_at: string;
  order_items: {
    quantity: number;
    price: number;
    products: {
      title: string;
      image_url: string;
      images?: string[];
    };
  }[];
}

export default function OrderConfirmationPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadOrder();
  }, [orderId]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      console.log('Loading order:', orderId);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            price,
            products (
              title,
              image_url,
              images
            )
          )
        `)
        .eq('id', orderId)
        .maybeSingle();

      if (error) {
        console.error('Error loading order:', error);
        throw error;
      }
      console.log('Order loaded:', data);
      setOrder(data);
    } catch (error) {
      console.error('Error loading order:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
        <p className="text-gray-600 text-lg">Order not found</p>
        <button
          onClick={() => navigate('/')}
          className="text-blue-600 hover:text-blue-700 font-medium"
        >
          Back to Home
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-200 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-32 h-32 flex items-center justify-center">
              <svg viewBox="0 0 100 100" className="w-full h-full">
                <path
                  d="M20 50 L40 70 L80 20"
                  fill="none"
                  stroke="#FF8C00"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2" dir="rtl">تم إرسال طلبك بنجاح</h1>
          <p className="text-gray-600 mb-8" dir="rtl">
            برجى انتظار رسالة تأكيد استلام طلبك
          </p>

          <div className="mt-8 flex flex-col gap-4">
            <button
              onClick={() => navigate('/')}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-full font-bold text-lg transition shadow-md" dir="rtl"
            >
              تم
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-4 rounded-full font-bold text-lg transition shadow-md" dir="rtl"
            >
              عرض الطلب
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
