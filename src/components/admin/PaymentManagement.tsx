import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, CheckCircle, Clock, User, Package } from 'lucide-react';

interface OrderWithSeller {
  id: string;
  order_number: string;
  total_amount: number;
  admin_commission: number;
  seller_amount: number;
  payment_released: boolean;
  payment_released_at: string | null;
  confirmed_by_buyer: boolean;
  delivered_at: string | null;
  created_at: string;
  seller_id: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
}

export default function PaymentManagement() {
  const [orders, setOrders] = useState<OrderWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [releasing, setReleasing] = useState<string | null>(null);
  const [commissionRate, setCommissionRate] = useState(10);

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles:seller_id (
            full_name,
            email
          )
        `)
        .eq('confirmed_by_buyer', true)
        .order('delivered_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAmounts = (totalAmount: number) => {
    const commission = (totalAmount * commissionRate) / 100;
    const sellerAmount = totalAmount - commission;
    return { commission, sellerAmount };
  };

  const handleReleasePayment = async (order: OrderWithSeller) => {
    if (!confirm(`Are you sure you want to transfer $${order.seller_amount.toFixed(2)} to the seller?`)) return;

    try {
      setReleasing(order.id);

      const { commission, sellerAmount } = calculateAmounts(order.total_amount);

      const { error } = await supabase
        .from('orders')
        .update({
          payment_released: true,
          payment_released_at: new Date().toISOString(),
          admin_commission: commission,
          seller_amount: sellerAmount,
          status: 'completed'
        })
        .eq('id', order.id);

      if (error) throw error;

      alert('✅ Payment transferred to seller successfully!');
      await loadOrders();
    } catch (error) {
      console.error('Error releasing payment:', error);
      alert('Error transferring payment');
    } finally {
      setReleasing(null);
    }
  };

  const totalPendingAmount = orders
    .filter(o => !o.payment_released)
    .reduce((sum, o) => sum + o.total_amount, 0);

  const totalReleasedAmount = orders
    .filter(o => o.payment_released)
    .reduce((sum, o) => sum + o.seller_amount, 0);

  const totalCommission = orders
    .filter(o => o.payment_released)
    .reduce((sum, o) => sum + o.admin_commission, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Payment Management</h2>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm text-yellow-600 font-medium">Pending</p>
                <p className="text-2xl font-bold text-yellow-900">${totalPendingAmount.toFixed(0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-green-600 font-medium">Transferred</p>
                <p className="text-2xl font-bold text-green-900">${totalReleasedAmount.toFixed(0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-blue-600 font-medium">Commission</p>
                <p className="text-2xl font-bold text-blue-900">${totalCommission.toFixed(0)}</p>
              </div>
            </div>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-purple-600 font-medium">Total Orders</p>
                <p className="text-2xl font-bold text-purple-900">{orders.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Commission Rate (%)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            value={commissionRate}
            onChange={(e) => setCommissionRate(parseFloat(e.target.value) || 0)}
            className="w-full max-w-xs px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <p className="text-xs text-gray-500 mt-1">
            This rate will be applied when transferring payments to sellers
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900">Received Orders</h3>

        {orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No received orders</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {orders.map((order) => {
              const { commission, sellerAmount } = calculateAmounts(order.total_amount);

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-lg border-2 p-6 ${
                    order.payment_released
                      ? 'border-green-200 bg-green-50'
                      : 'border-gray-200 hover:border-emerald-300'
                  } transition`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="text-lg font-bold text-gray-900">#{order.order_number}</h4>
                        {order.payment_released ? (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">
                            <CheckCircle className="w-3 h-3" />
                            Transferred
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                            <Clock className="w-3 h-3" />
                            Pending
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <User className="w-4 h-4" />
                        <span className="font-medium">{order.profiles?.full_name || 'Unknown'}</span>
                        <span className="text-gray-400">•</span>
                        <span>{order.profiles?.email}</span>
                      </div>
                      {order.delivered_at && (
                        <p className="text-xs text-gray-500 mt-1">
                          Delivered on: {new Date(order.delivered_at).toLocaleDateString('en-US')}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-600 mb-1">Order Total</p>
                      <p className="text-2xl font-bold text-gray-900">${order.total_amount.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4 mb-4">
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-600 mb-1">Order Total</p>
                        <p className="font-bold text-gray-900">${order.total_amount.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-1">Commission ({commissionRate}%)</p>
                        <p className="font-bold text-blue-600">-${commission.toFixed(2)}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 mb-1">Seller Amount</p>
                        <p className="font-bold text-emerald-600">${sellerAmount.toFixed(2)}</p>
                      </div>
                    </div>
                  </div>

                  {order.payment_released ? (
                    <div className="bg-green-100 border border-green-200 rounded-lg p-3">
                      <p className="text-sm text-green-800 font-semibold flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" />
                        Payment transferred on: {new Date(order.payment_released_at!).toLocaleDateString('en-US')}
                      </p>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleReleasePayment(order)}
                      disabled={releasing === order.id}
                      className="w-full px-4 py-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <DollarSign className="w-5 h-5" />
                      {releasing === order.id ? 'Transferring...' : `Transfer $${sellerAmount.toFixed(2)} to Seller`}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
