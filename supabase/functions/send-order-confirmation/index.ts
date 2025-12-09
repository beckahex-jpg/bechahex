import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const getOrderConfirmationTemplate = (data: any) => {
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
        .button { display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { background-color: #f8f9fa; padding: 30px; text-align: center; color: #6c757d; font-size: 14px; }
        .order-details { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .product-item { display: flex; align-items: center; padding: 15px 0; border-bottom: 1px solid #dee2e6; }
        .product-item:last-child { border-bottom: none; }
        .product-image { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; margin-right: 15px; }
        .total { font-size: 20px; font-weight: bold; color: #667eea; margin-top: 15px; }
        .unsubscribe { color: #6c757d; font-size: 12px; margin-top: 20px; }
        .unsubscribe a { color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Confirmed! ✓</h1>
        </div>
        <div class="content">
          <h2>Thank you for your order!</h2>
          <p>Hi ${data.customerName},</p>
          <p>We've received your order and it's being processed. You'll receive another email when your items are shipped.</p>
          <div class="order-details">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> #${data.orderId}</p>
            <p><strong>Order Date:</strong> ${data.orderDate}</p>
            <p><strong>Payment Method:</strong> ${data.paymentMethod}</p>
            <h3 style="margin-top: 20px;">Items:</h3>
            ${data.items.map((item: any) => `
              <div class="product-item">
                <img src="${item.image_url}" alt="${item.title}" class="product-image" onerror="this.src='https://via.placeholder.com/80'">
                <div style="flex: 1;">
                  <div><strong>${item.title}</strong></div>
                  <div style="color: #6c757d;">Quantity: ${item.quantity}</div>
                  <div style="color: #667eea; font-weight: 600;">$${parseFloat(item.price).toFixed(2)}</div>
                </div>
              </div>
            `).join('')}
            <div class="total">
              Total: $${data.totalAmount.toFixed(2)}
            </div>
            <h3 style="margin-top: 20px;">Shipping Address:</h3>
            <p>${data.shippingAddress}</p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/buyer-orders" class="button">Track Order</a>
          </div>
          <p>Questions? Contact our support team anytime.</p>
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
    const SITE_URL = Deno.env.get("SITE_URL") || "https://beckah.com";

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

    const { orderId } = await req.json();

    if (!orderId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: orderId" }),
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
            image_url
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
      .eq("id", order.buyer_id)
      .maybeSingle();

    if (!profile?.email_notifications_enabled || profile?.email_preferences?.order_updates === false) {
      console.log("Order update emails disabled for user", order.buyer_id);
      return new Response(
        JSON.stringify({ message: "Order update emails disabled" }),
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
      image_url: item.products.image_url,
    }));

    const shippingAddress = `${order.shipping_address_line1 || ''}${order.shipping_address_line2 ? ', ' + order.shipping_address_line2 : ''}${order.shipping_city ? ', ' + order.shipping_city : ''}${order.shipping_state ? ', ' + order.shipping_state : ''}${order.shipping_zip ? ' ' + order.shipping_zip : ''}`;

    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailData = {
      orderId: order.id,
      customerName: order.profiles.full_name || 'Customer',
      orderDate: orderDate,
      paymentMethod: order.payment_method || 'Online Payment',
      items: items,
      totalAmount: parseFloat(order.total_amount),
      shippingAddress: shippingAddress,
      siteUrl: SITE_URL,
    };

    const emailHtml = getOrderConfirmationTemplate(emailData);

    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const sendEmailResponse = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: order.profiles.email,
        subject: `Order Confirmed - #${order.id}`,
        html: emailHtml,
        userId: order.buyer_id,
        emailType: "order_confirmation",
        metadata: { orderId: order.id },
      }),
    });

    if (!sendEmailResponse.ok) {
      const errorData = await sendEmailResponse.text();
      console.error("Failed to send order confirmation:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await sendEmailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Order confirmation email sent successfully",
        result: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending order confirmation:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send order confirmation",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});