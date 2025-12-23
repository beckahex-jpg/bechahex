import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
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
            image_url,
            images,
            seller_id
          )
        ),
        profiles!orders_buyer_id_fkey(
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

    const sellerIds = [...new Set(order.order_items.map((item: any) => item.products.seller_id))];

    if (sellerIds.length === 0) {
      console.log("No sellers found for this order");
      return new Response(
        JSON.stringify({ message: "No sellers found" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: sellers, error: sellersError } = await supabase
      .from("profiles")
      .select("id, full_name, email, email_notifications_enabled, email_preferences")
      .in("id", sellerIds);

    if (sellersError || !sellers) {
      console.error("Sellers not found:", sellersError);
      return new Response(
        JSON.stringify({ error: "Sellers not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const orderDate = new Date(order.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const shippingAddress = [
      order.shipping_address_line1,
      order.shipping_address_line2,
      order.shipping_city,
      order.shipping_state,
      order.shipping_zip
    ].filter(Boolean).join(', ');

    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const emailPromises = sellers
      .filter(seller => seller.email_notifications_enabled !== false)
      .map(async (seller) => {
        const sellerItems = order.order_items.filter((item: any) => item.products.seller_id === seller.id);

        if (sellerItems.length === 0) return { seller: seller.email, success: true, skipped: true };

        const totalEarnings = sellerItems.reduce((sum: number, item: any) => {
          return sum + (parseFloat(item.price) * item.quantity);
        }, 0);

        const platformCommission = totalEarnings * 0.10;
        const sellerEarnings = totalEarnings - platformCommission;

        const firstItem = sellerItems[0];
        const emailData = {
          sellerName: seller.full_name || 'Seller',
          orderId: order.id,
          orderDate: orderDate,
          customerName: order.profiles?.full_name || 'Customer',
          productTitle: firstItem.products.title,
          productImage: firstItem.products.images && firstItem.products.images.length > 0
            ? firstItem.products.images[0]
            : firstItem.products.image_url || 'https://via.placeholder.com/80',
          quantity: firstItem.quantity,
          price: parseFloat(firstItem.price).toFixed(2),
          sellerEarnings: sellerEarnings.toFixed(2),
          shippingAddress: shippingAddress,
          siteUrl: SITE_URL,
        };

        try {
          const sendEmailResponse = await fetch(sendEmailUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              to: seller.email,
              subject: `New Order for Your Product - #${order.id}`,
              html: generateEmailTemplate(emailData),
              userId: seller.id,
              emailType: "new_order_to_seller",
              metadata: {
                orderId: order.id,
                sellerId: seller.id,
                itemCount: sellerItems.length
              },
            }),
          });

          if (!sendEmailResponse.ok) {
            const errorData = await sendEmailResponse.text();
            console.error(`Failed to send email to seller ${seller.email}:`, errorData);
            return { seller: seller.email, success: false, error: errorData };
          }

          return { seller: seller.email, success: true };
        } catch (error: any) {
          console.error(`Error sending email to seller ${seller.email}:`, error);
          return { seller: seller.email, success: false, error: error.message };
        }
      });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success && !r.skipped).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notified ${successCount} seller(s) about new order`,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending seller notification:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send seller notification",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateEmailTemplate(data: any): string {
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
      .product-item { display: flex; align-items: center; padding: 15px 0; border-bottom: 1px solid #dee2e6; }
      .product-item:last-child { border-bottom: none; }
      .product-image { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; margin-right: 15px; }
      .total { font-size: 20px; font-weight: bold; color: #667eea; margin-top: 15px; }
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
          <h1>New Order Received! 🎉</h1>
        </div>
        <div class="content">
          <h2>Great news! Someone purchased your product!</h2>
          <p>Hi ${data.sellerName},</p>
          <p>You have a new order for your product. Please prepare it for shipping as soon as possible.</p>
          <div class="order-details">
            <h3>Order Details</h3>
            <p><strong>Order ID:</strong> #${data.orderId}</p>
            <p><strong>Order Date:</strong> ${data.orderDate}</p>
            <p><strong>Customer:</strong> ${data.customerName}</p>
            <h3 style="margin-top: 20px;">Product Sold:</h3>
            <div class="product-item">
              <img src="${data.productImage}" alt="${data.productTitle}" class="product-image" onerror="this.src='https://via.placeholder.com/80'">
              <div style="flex: 1;">
                <div><strong>${data.productTitle}</strong></div>
                <div style="color: #6c757d;">Quantity: ${data.quantity}</div>
                <div style="color: #667eea; font-weight: 600;">$${data.price}</div>
              </div>
            </div>
            <div class="total">
              Your Earnings: $${data.sellerEarnings}
            </div>
            <h3 style="margin-top: 20px;">Shipping Address:</h3>
            <p>${data.shippingAddress}</p>
          </div>
          <div style="background-color: #fff3cd; border: 1px solid #ffc107; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #856404; font-size: 14px;">
              <strong>Action Required:</strong> Please process this order within 2-3 business days. Update the order status once it's shipped.
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/seller-orders" class="button">Manage Order</a>
          </div>
          <p>Thank you for being a valued seller on Beckah Marketplace!</p>
        </div>
        <div class="footer">
          <p><strong>Beckah Marketplace</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
}