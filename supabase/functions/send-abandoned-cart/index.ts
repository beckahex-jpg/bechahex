import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const getAbandonedCartTemplate = (data: any) => {
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
          <h1>Don't Miss Out!</h1>
        </div>
        <div class="content">
          <h2>You left some items behind...</h2>
          <p>Hi ${data.customerName},</p>
          <p>We noticed you left ${data.itemCount} item${data.itemCount > 1 ? 's' : ''} in your cart. They're still waiting for you!</p>
          <div class="order-details">
            <h3>Your Cart:</h3>
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
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/checkout" class="button">Complete Your Purchase</a>
          </div>
          <p>Complete your order now before these items are gone!</p>
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

    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: userId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: cart, error: cartError } = await supabase
      .from("cart_items")
      .select(`
        *,
        products(
          id,
          title,
          price,
          image_url
        )
      `)
      .eq("user_id", userId);

    if (cartError || !cart || cart.length === 0) {
      console.error("Cart not found or empty:", cartError);
      return new Response(
        JSON.stringify({ error: "Cart not found or empty" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email, email_notifications_enabled, email_preferences")
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "User profile not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!profile.email_notifications_enabled || profile.email_preferences?.abandoned_cart_reminders === false) {
      console.log("Abandoned cart emails disabled for user", userId);
      return new Response(
        JSON.stringify({ message: "Abandoned cart emails disabled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const items = cart.map((item: any) => ({
      title: item.products.title,
      quantity: item.quantity,
      price: item.products.price,
      image_url: item.products.image_url,
    }));

    const totalAmount = cart.reduce((sum: number, item: any) => {
      return sum + (parseFloat(item.products.price) * item.quantity);
    }, 0);

    const emailData = {
      customerName: profile.full_name || 'Customer',
      itemCount: cart.length,
      items: items,
      totalAmount: totalAmount,
      siteUrl: SITE_URL,
    };

    const emailHtml = getAbandonedCartTemplate(emailData);

    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const sendEmailResponse = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: profile.email,
        subject: "You left items in your cart! 🛒",
        html: emailHtml,
        userId: userId,
        emailType: "abandoned_cart",
        metadata: { itemCount: cart.length, totalAmount: totalAmount },
      }),
    });

    if (!sendEmailResponse.ok) {
      const errorData = await sendEmailResponse.text();
      console.error("Failed to send abandoned cart email:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await sendEmailResponse.json();

    const cartData = cart.map((item: any) => ({
      product_id: item.product_id,
      title: item.products.title,
      quantity: item.quantity,
      price: item.products.price,
    }));

    await supabase.from("cart_abandonment_tracking").insert({
      user_id: userId,
      cart_data: cartData,
      total_amount: totalAmount,
      abandoned_at: new Date().toISOString(),
      reminder_sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Abandoned cart email sent successfully",
        result: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending abandoned cart email:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send abandoned cart email",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});