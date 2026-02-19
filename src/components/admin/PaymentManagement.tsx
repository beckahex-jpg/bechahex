import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { DollarSign, CheckCircle, Clock, User, Package, Building2 } from 'lucide-react';

interface OrderWithSeller {
  id: string;
  order_number?: string;
  total_amount: number;
  admin_commission?: number | null;
  seller_amount?: number | null;
  payment_released: boolean;
  payment_released_at: string | null;
  transfer_notes?: string | null;
  confirmed_by_buyer: boolean;
  delivered_at: string | null;
  created_at: string;
  seller_id: string | null;
  user_id: string;
  payment_status: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
  buyer_profile?: {
    full_name: string;
    email: string;
  } | null;
}

const getPaymentTransferredEmailTemplate = (data: any) => {
  const baseStyles = `
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
      .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
      .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
      .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
      .content { padding: 40px 30px; }
      .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
      .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; font-size: 14px; }
      .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
      .unsubscribe { color: #6c757d; font-size: 12px; margin-top: 20px; }
      .unsubscribe a { color: #6c757d; }
    </style>
  `;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      ${baseStyles}
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Payment Transferred!</h1>
        </div>
        <div class="content">
          <h2>Great news! Your payment has been transferred!</h2>
          <p>Hi ${data.sellerName},</p>
          <p>We're pleased to inform you that the payment for your order has been successfully transferred to your bank account.</p>

          <div class="order-details">
            <h3>Payment Details</h3>
            <p><strong>Order ID:</strong> #${data.orderId}</p>
            <p><strong>Transfer Date:</strong> ${data.transferDate}</p>

            <h3 style="margin-top: 20px;">Payment Breakdown:</h3>
            <div style="background-color: #ffffff; padding: 15px; border-radius: 6px; margin-top: 10px;">
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                <span style="color: #6c757d;">Order Total:</span>
                <span style="font-weight: 600; color: #212529;">$${data.totalAmount.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e9ecef;">
                <span style="color: #6c757d;">Platform Commission (${data.commissionRate}%):</span>
                <span style="font-weight: 600; color: #dc3545;">-$${data.commission.toFixed(2)}</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 12px 0; background-color: #d4edda; margin: 10px -15px -15px; padding-left: 15px; padding-right: 15px; border-radius: 0 0 6px 6px;">
                <span style="font-weight: 700; color: #155724;">Amount Transferred:</span>
                <span style="font-weight: 700; font-size: 20px; color: #155724;">$${data.sellerAmount.toFixed(2)}</span>
              </div>
            </div>

            ${data.transferNotes ? `
              <div style="margin-top: 20px; padding: 15px; background-color: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px;">
                <p style="margin: 0; font-weight: 600; color: #495057; margin-bottom: 8px;">Transfer Notes:</p>
                <p style="margin: 0; color: #6c757d;">${data.transferNotes}</p>
              </div>
            ` : ''}
          </div>

          <div style="background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #004085; font-size: 14px;">
              <strong>Important:</strong> The funds should appear in your registered bank account within 1-2 business days depending on your bank's processing time.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/seller-orders" class="button">View Order Details</a>
          </div>

          <p>Thank you for being a valued seller on Beckah Marketplace!</p>
          <p>If you have any questions about this payment, please don't hesitate to contact our support team.</p>
        </div>
        <div class="footer">
          <p><strong>Beckah Marketplace</strong></p>
          <p>Supporting sellers worldwide</p>
          <div class="unsubscribe">
            <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

export default function PaymentManagement() {
  const [orders, setOrders] = useState<OrderWithSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [commissionRate, setCommissionRate] = useState(10);
  const [transferNotes, setTransferNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    try {
      setLoading(true);

      const { data: ordersData, error } = await supabase
        .from('orders')
        .select('*')
        .eq('payment_status', 'paid')
        .order('created_at', { ascending: false });

      console.log('PaymentManagement - Orders fetched:', ordersData);

      if (error) throw error;

      if (!ordersData || ordersData.length === 0) {
        setOrders([]);
        return;
      }

      const buyerIds = [...new Set(ordersData.map(o => o.user_id).filter(Boolean))];
      const sellerIds = [...new Set(ordersData.map(o => o.seller_id).filter(Boolean))];

      let buyersMap = new Map();
      let sellersMap = new Map();

      const buyersPromise = buyerIds.length > 0
        ? supabase.from('profiles').select('id, full_name, email').in('id', buyerIds)
        : Promise.resolve({ data: [] });

      const sellersPromise = sellerIds.length > 0
        ? supabase.from('profiles').select('id, full_name, email').in('id', sellerIds)
        : Promise.resolve({ data: [] });

      const [buyersRes, sellersRes] = await Promise.all([buyersPromise, sellersPromise]);

      buyersMap = new Map((buyersRes.data || []).map(p => [p.id, p]));
      sellersMap = new Map((sellersRes.data || []).map(p => [p.id, p]));

      const ordersWithProfiles = ordersData.map(order => ({
        ...order,
        profiles: order.seller_id
          ? (sellersMap.get(order.seller_id) || null)
          : (buyersMap.get(order.user_id) || null),
        buyer_profile: buyersMap.get(order.user_id) || null,
      }));

      console.log('PaymentManagement - Orders with profiles:', ordersWithProfiles);
      setOrders(ordersWithProfiles);
    } catch (error) {
      console.error('PaymentManagement - Error loading orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAmounts = (totalAmount: number) => {
    const commission = (totalAmount * commissionRate) / 100;
    const sellerAmount = totalAmount - commission;
    return { commission, sellerAmount };
  };

  const handleTogglePaymentStatus = async (order: OrderWithSeller, newStatus: boolean) => {
    const { commission, sellerAmount } = calculateAmounts(order.total_amount);

    const confirmMessage = newStatus
      ? `Confirm that you have transferred $${sellerAmount.toFixed(2)} to the seller via bank transfer?`
      : `Are you sure you want to mark this payment as pending again?`;

    if (!confirm(confirmMessage)) return;

    try {
      setUpdating(order.id);

      const updateData: any = {
        payment_released: newStatus,
        admin_commission: commission,
        seller_amount: sellerAmount,
        status: newStatus ? 'completed' : 'paid'
      };

      if (newStatus) {
        updateData.payment_released_at = new Date().toISOString();
        updateData.transfer_notes = transferNotes[order.id] || null;
      } else {
        updateData.payment_released_at = null;
        updateData.transfer_notes = null;
      }

      const { error } = await supabase
        .from('orders')
        .update(updateData)
        .eq('id', order.id);

      if (error) throw error;

      if (newStatus && order.seller_id) {
        try {
          await supabase.from('notifications').insert({
            user_id: order.seller_id,
            type: 'payment_transferred',
            title: 'Payment Transferred',
            message: `Payment of $${sellerAmount.toFixed(2)} has been transferred to your account for order #${order.order_number || order.id.slice(0, 8)}`,
            data: {
              order_id: order.id,
              order_number: order.order_number,
              amount: sellerAmount,
              commission: commission,
              total_amount: order.total_amount
            }
          });
        } catch (notifError) {
          console.error('Error creating notification:', notifError);
        }
      }

      if (newStatus && order.profiles?.email) {
        try {
          const siteUrl = window.location.origin;

          const emailData = {
            orderId: order.order_number || order.id.slice(0, 8),
            sellerName: order.profiles.full_name || 'Seller',
            totalAmount: order.total_amount,
            commission: commission,
            commissionRate: commissionRate,
            sellerAmount: sellerAmount,
            transferDate: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }),
            transferNotes: transferNotes[order.id] || '',
            siteUrl: siteUrl
          };

          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

          const emailResponse = await fetch(
            `${supabaseUrl}/functions/v1/send-email`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
              },
              body: JSON.stringify({
                to: order.profiles.email,
                subject: `Payment Transferred - Order #${emailData.orderId}`,
                html: getPaymentTransferredEmailTemplate(emailData),
                userId: order.seller_id,
                emailType: 'payment_transferred_to_seller',
                metadata: {
                  orderId: order.id,
                  orderNumber: emailData.orderId,
                  amount: sellerAmount
                }
              })
            }
          );

          if (!emailResponse.ok) {
            console.error('Failed to send email to seller');
          } else {
            console.log('Payment notification email sent to seller');
          }
        } catch (emailError) {
          console.error('Error sending email:', emailError);
        }
      }

      const message = newStatus
        ? '✅ Payment status updated: Transferred to seller'
        : '⚠️ Payment status updated: Marked as pending';

      alert(message);
      await loadOrders();
    } catch (error) {
      console.error('Error updating payment status:', error);
      alert('Error updating payment status');
    } finally {
      setUpdating(null);
    }
  };

  const totalPendingAmount = orders
    .filter(o => !o.payment_released)
    .reduce((sum, o) => sum + Number(o.total_amount || 0), 0);

  const totalReleasedAmount = orders
    .filter(o => o.payment_released)
    .reduce((sum, o) => sum + Number(o.seller_amount || 0), 0);

  const totalCommission = orders
    .filter(o => o.payment_released)
    .reduce((sum, o) => sum + Number(o.admin_commission || 0), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 mb-2">Payment Management</h1>
        <p className="text-gray-600">Manage seller payments and commission rates</p>
      </div>

      <div className="mb-6">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 mt-6">
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

      <div className="space-y-4 mt-6">
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
                        <h4 className="text-lg font-bold text-gray-900">
                          #{order.order_number || order.id.slice(0, 8)}
                        </h4>
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
                        {order.profiles?.email && (
                          <>
                            <span className="text-gray-400">•</span>
                            <span>{order.profiles.email}</span>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        Ordered on: {new Date(order.created_at).toLocaleDateString('en-US')}
                      </p>
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

                  <div className="border-t border-gray-200 pt-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-5 h-5 text-blue-600" />
                        <p className="text-sm font-semibold text-blue-900">Bank Transfer Payment Status</p>
                      </div>
                      <p className="text-xs text-blue-700 mb-3">
                        Toggle this switch after you have manually transferred ${sellerAmount.toFixed(2)} to the seller via bank transfer
                      </p>

                      <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-blue-200">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-6 rounded-full transition-all duration-300 cursor-pointer ${
                            order.payment_released ? 'bg-green-500' : 'bg-gray-300'
                          }`} onClick={() => !updating && handleTogglePaymentStatus(order, !order.payment_released)}>
                            <div className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-all duration-300 mt-0.5 ${
                              order.payment_released ? 'translate-x-6' : 'translate-x-0.5'
                            }`}></div>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-gray-900">
                              {order.payment_released ? 'Payment Transferred' : 'Payment Pending'}
                            </p>
                            <p className="text-xs text-gray-600">
                              {order.payment_released
                                ? `Transferred on ${new Date(order.payment_released_at!).toLocaleDateString('en-US')}`
                                : 'Click toggle to confirm transfer'}
                            </p>
                          </div>
                        </div>
                        {order.payment_released ? (
                          <CheckCircle className="w-6 h-6 text-green-600" />
                        ) : (
                          <Clock className="w-6 h-6 text-yellow-600" />
                        )}
                      </div>
                    </div>

                    {!order.payment_released && (
                      <div className="mb-3">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Transfer Notes (Optional)
                        </label>
                        <textarea
                          value={transferNotes[order.id] || ''}
                          onChange={(e) => setTransferNotes({...transferNotes, [order.id]: e.target.value})}
                          placeholder="Add notes about the bank transfer (e.g., transaction ID, date, etc.)"
                          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          rows={2}
                        />
                      </div>
                    )}

                    {order.payment_released && order.transfer_notes && (
                      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Transfer Notes:</p>
                        <p className="text-sm text-gray-900">{order.transfer_notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
