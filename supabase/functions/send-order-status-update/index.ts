import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const getStatusUpdateTemplate = (data: any) => {
  const statusMessages = {
    processing: {
      title: "Order is Being Processed",
      emoji: "⚙️",
      message: "Good news! We've started processing your order.",
      description: "Your order is currently being prepared for shipment. We'll notify you once it's on its way.",
    },
    completed: {
      title: "Order Completed",
      emoji: "✅",
      message: "Your order has been completed!",
      description: "Thank you for your purchase. We hope you enjoy your items!",
    },
    cancelled: {
      title: "Order Cancelled",
      emoji: "❌",
      message: "Your order has been cancelled.",
      description: "Your order has been cancelled. If you didn't request this, please contact us immediately.",
    },
  };

  const statusInfo = statusMessages[data.newStatus as keyof typeof statusMessages] || {
    title: "Order Status Updated",
    emoji: "📦",
    message: "Your order status has been updated.",
    description: `Your order status is now: ${data.newStatus}`,
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
        .content { padding: 40px 30px; }
        .status-badge { display: inline-block; padding: 12px 24px; background-color: ${data.newStatus === 'completed' ? '#10b981' : data.newStatus === 'cancelled' ? '#ef4444' : '#3b82f6'}; color: white; border-radius: 8px; font-weight: 600; margin: 20px 0; font-size: 16px; }
        .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; font-size: 14px; }
        .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .product-item { display: flex; align-items: center; padding: 15px 0; border-bottom: 1px solid #dee2e6; }
        .product-item:last-child { border-bottom: none; }
        .product-image { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; margin-right: 15px; }
        .unsubscribe { color: #6c757d; font-size: 12px; margin-top: 20px; }
        .unsubscribe a { color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusInfo.emoji} ${statusInfo.title}</h1>
        </div>
        <div class="content">
          <h2>${statusInfo.message}</h2>
          <p>Hi ${data.customerName},</p>
          <p>${statusInfo.description}</p>
          <div class="order-details">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> #${data.orderId}</p>
            <p><strong>Order Date:</strong> ${new Date(data.orderDate).toLocaleDateString()}</p>
            <p><strong>Total Amount:</strong> $${data.totalAmount}</p>
            <div class="status-badge">Status: ${data.newStatus.toUpperCase()}</div>
            <h3 style="margin-top: 20px;">Order Items:</h3>
            ${data.items.map((item: any) => `
              <div class="product-item">
                <img src="${item.image_url}" alt="${item.title}" class="product-image" onerror="this.src='https://via.placeholder.com/80'">
                <div style="flex: 1;">
                  <div><strong>${item.title}</strong></div>
                  <div style="color: #6c757d;">Quantity: ${item.quantity} × $${item.price}</div>
                </div>
              </div>
            `).join('')}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/buyer-orders" class="button">View Order Details</a>
          </div>
          ${data.newStatus === 'cancelled' ? '<p style="color: #ef4444;"><strong>Note:</strong> If you have any questions about this cancellation, please contact our support team.</p>' : ''}
        </div>
        <div class="footer">
          <p><strong>Beckah Marketplace</strong></p>
          <p>Thank you for shopping with us!</p>
          <div class="unsubscribe">
            <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

const getPaymentStatusTemplate = (data: any) => {
  const statusMessages = {
    paid: {
      title: "Payment Confirmed",
      emoji: "✅",
      message: "Your payment has been confirmed!",
      description: "We've received your payment successfully. Your order will be processed shortly.",
      color: "#10b981",
    },
    failed: {
      title: "Payment Failed",
      emoji: "❌",
      message: "Payment could not be processed.",
      description: "Unfortunately, we couldn't process your payment. Please update your payment method or try again.",
      color: "#ef4444",
    },
    pending: {
      title: "Payment Pending",
      emoji: "⏳",
      message: "Your payment is being processed.",
      description: "We're currently processing your payment. We'll notify you once it's confirmed.",
      color: "#f59e0b",
    },
  };

  const statusInfo = statusMessages[data.newPaymentStatus as keyof typeof statusMessages] || statusMessages.pending;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 0; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 28px; }
        .content { padding: 40px 30px; }
        .status-badge { display: inline-block; padding: 12px 24px; background-color: ${statusInfo.color}; color: white; border-radius: 8px; font-weight: 600; margin: 20px 0; font-size: 16px; }
        .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; font-size: 14px; }
        .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .unsubscribe { color: #6c757d; font-size: 12px; margin-top: 20px; }
        .unsubscribe a { color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>${statusInfo.emoji} ${statusInfo.title}</h1>
        </div>
        <div class="content">
          <h2>${statusInfo.message}</h2>
          <p>Hi ${data.customerName},</p>
          <p>${statusInfo.description}</p>
          <div class="order-details">
            <h3>Payment Details</h3>
            <p><strong>Order ID:</strong> #${data.orderId}</p>
            <p><strong>Amount:</strong> $${data.totalAmount}</p>
            <div class="status-badge">Payment Status: ${data.newPaymentStatus.toUpperCase()}</div>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/buyer-orders" class="button">View Order</a>
          </div>
          ${data.newPaymentStatus === 'failed' ? '<p style="color: #ef4444;"><strong>Action Required:</strong> Please update your payment method to complete your order.</p>' : ''}
        </div>
        <div class="footer">
          <p><strong>Beckah Marketplace</strong></p>
          <div class="unsubscribe">
            <p><a href="${data.siteUrl}/settings">Manage email preferences</a></p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const SITE_URL = Deno.env.get("SITE_URL") || "https://beckahex.org";

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Supabase credentials not configured");
      return new Response(
        JSON.stringify({ error: "Database connection not configured" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { orderId, updateType, newStatus, newPaymentStatus } = await req.json();

    if (!orderId || !updateType) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: orderId, updateType" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(`
        *,
        order_items(
          *,
          products(
            id,
            title,
            price,
            image_url,
            images
          )
        ),
        profiles(
          full_name,
          email
        )
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (orderError || !order) {
      console.error("Order not found:", orderError);
      return new Response(
        JSON.stringify({ error: "Order not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email_notifications_enabled, email_preferences")
      .eq("id", order.user_id)
      .maybeSingle();

    if (!profile?.email_notifications_enabled) {
      console.log("Email notifications disabled for user", order.user_id);
      return new Response(
        JSON.stringify({ message: "Email notifications disabled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const items = order.order_items.map((item: any) => ({
      title: item.products.title,
      quantity: item.quantity,
      price: item.price,
      image_url: item.products.images && item.products.images.length > 0
        ? item.products.images[0]
        : item.products.image_url || 'https://via.placeholder.com/80',
    }));

    let emailHtml = "";
    let emailSubject = "";
    let emailType = "";

    if (updateType === "order_status" && newStatus) {
      if (profile?.email_preferences?.order_updates === false) {
        console.log("Order update emails disabled for user", order.user_id);
        return new Response(
          JSON.stringify({ message: "Order update emails disabled" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const emailData = {
        orderId: order.id,
        customerName: order.profiles.full_name || 'Customer',
        newStatus: newStatus,
        orderDate: order.created_at,
        totalAmount: Number(order.total_amount).toFixed(2),
        items: items,
        siteUrl: SITE_URL,
      };

      emailHtml = getStatusUpdateTemplate(emailData);
      emailSubject = `Order ${newStatus === 'completed' ? 'Completed' : newStatus === 'cancelled' ? 'Cancelled' : 'Update'} - #${order.id}`;
      emailType = "order_status_update";
    } else if (updateType === "payment_status" && newPaymentStatus) {
      if (profile?.email_preferences?.order_updates === false) {
        console.log("Payment update emails disabled for user", order.user_id);
        return new Response(
          JSON.stringify({ message: "Payment update emails disabled" }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      const emailData = {
        orderId: order.id,
        customerName: order.profiles.full_name || 'Customer',
        newPaymentStatus: newPaymentStatus,
        totalAmount: Number(order.total_amount).toFixed(2),
        siteUrl: SITE_URL,
      };

      emailHtml = getPaymentStatusTemplate(emailData);
      emailSubject = `Payment ${newPaymentStatus === 'paid' ? 'Confirmed' : newPaymentStatus === 'failed' ? 'Failed' : 'Update'} - Order #${order.id}`;
      emailType = "payment_status_update";
    } else {
      return new Response(
        JSON.stringify({ error: "Invalid update type or missing status" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const sendEmailResponse = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: order.profiles.email,
        subject: emailSubject,
        html: emailHtml,
        userId: order.user_id,
        emailType: emailType,
        metadata: {
          orderId: order.id,
          updateType: updateType,
          newStatus: newStatus || newPaymentStatus,
        },
      }),
    });

    if (!sendEmailResponse.ok) {
      const errorData = await sendEmailResponse.text();
      console.error("Failed to send status update email:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await sendEmailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Status update email sent successfully",
        result: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending status update email:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send status update email",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});