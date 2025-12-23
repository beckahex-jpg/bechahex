import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const getReviewRequestTemplate = (data: any) => {
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
        .product-item { display: flex; align-items: center; padding: 15px 0; }
        .product-image { width: 80px; height: 80px; object-fit: cover; border-radius: 6px; margin-right: 15px; }
        .unsubscribe { color: #6c757d; font-size: 12px; margin-top: 20px; }
        .unsubscribe a { color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Share Your Experience</h1>
        </div>
        <div class="content">
          <h2>How did we do?</h2>
          <p>Hi ${data.customerName},</p>
          <p>It's been a week since you received your order. We'd love to hear what you think!</p>
          <div class="order-details">
            <h3>Your Recent Purchase:</h3>
            <div class="product-item">
              <img src="${data.product.image_url}" alt="${data.product.title}" class="product-image" onerror="this.src='https://via.placeholder.com/80'">
              <div style="flex: 1;">
                <div><strong>${data.product.title}</strong></div>
                <div style="color: #6c757d;">Order #${data.orderId}</div>
              </div>
            </div>
          </div>
          <h3 style="text-align: center;">Rate Your Experience:</h3>
          <div style="text-align: center; font-size: 32px; margin: 20px 0;">
            <a href="${data.siteUrl}/buyer-orders" style="text-decoration: none; margin: 0 5px;">⭐</a>
            <a href="${data.siteUrl}/buyer-orders" style="text-decoration: none; margin: 0 5px;">⭐</a>
            <a href="${data.siteUrl}/buyer-orders" style="text-decoration: none; margin: 0 5px;">⭐</a>
            <a href="${data.siteUrl}/buyer-orders" style="text-decoration: none; margin: 0 5px;">⭐</a>
            <a href="${data.siteUrl}/buyer-orders" style="text-decoration: none; margin: 0 5px;">⭐</a>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/buyer-orders" class="button">Write a Review</a>
          </div>
          <p>Your feedback helps other shoppers and supports our sellers. Thank you!</p>
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

    const { orderId, productId } = await req.json();

    if (!orderId || !productId) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: orderId, productId" }),
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

    const { data: product, error: productError } = await supabase
      .from("products")
      .select("id, title, image_url")
      .eq("id", productId)
      .maybeSingle();

    if (productError || !product) {
      console.error("Product not found:", productError);
      return new Response(
        JSON.stringify({ error: "Product not found" }),
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

    if (!profile?.email_notifications_enabled || profile?.email_preferences?.review_requests === false) {
      console.log("Review request emails disabled for user", order.buyer_id);
      return new Response(
        JSON.stringify({ message: "Review request emails disabled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailData = {
      orderId: order.id,
      customerName: order.profiles.full_name || 'Customer',
      product: product,
      siteUrl: SITE_URL,
    };

    const emailHtml = getReviewRequestTemplate(emailData);

    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const sendEmailResponse = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: order.profiles.email,
        subject: "How was your recent purchase? ⭐",
        html: emailHtml,
        userId: order.buyer_id,
        emailType: "review_request",
        metadata: { orderId: order.id, productId: product.id },
      }),
    });

    if (!sendEmailResponse.ok) {
      const errorData = await sendEmailResponse.text();
      console.error("Failed to send review request:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await sendEmailResponse.json();

    await supabase.from("review_requests").insert({
      order_id: orderId,
      user_id: order.buyer_id,
      product_id: productId,
      request_sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Review request email sent successfully",
        result: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending review request:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send review request",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});