import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const getDeliveryConfirmationTemplate = (data: any) => {
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
        .unsubscribe { color: #6c757d; font-size: 12px; margin-top: 20px; }
        .unsubscribe a { color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Order Delivered! 🎉</h1>
        </div>
        <div class="content">
          <h2>Your order has been delivered!</h2>
          <p>Hi ${data.customerName},</p>
          <p>Your order has been successfully delivered. We hope you love your purchase!</p>
          <div class="order-details">
            <p><strong>Order ID:</strong> #${data.orderId}</p>
            <p><strong>Delivery Date:</strong> ${data.deliveryDate}</p>
          </div>
          <h3>How was your experience?</h3>
          <p>We'd love to hear your feedback! Taking a moment to review your purchase helps other shoppers and supports our sellers.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/buyer-orders" class="button">Leave a Review</a>
          </div>
          <p>Thank you for shopping with Beckah!</p>
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

    const deliveryDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const emailData = {
      orderId: order.id,
      customerName: order.profiles.full_name || 'Customer',
      deliveryDate: deliveryDate,
      siteUrl: SITE_URL,
    };

    const emailHtml = getDeliveryConfirmationTemplate(emailData);

    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const sendEmailResponse = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: order.profiles.email,
        subject: `Order Delivered! How was your experience? - #${order.id}`,
        html: emailHtml,
        userId: order.buyer_id,
        emailType: "delivery_confirmation",
        metadata: { orderId: order.id },
      }),
    });

    if (!sendEmailResponse.ok) {
      const errorData = await sendEmailResponse.text();
      console.error("Failed to send delivery confirmation:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await sendEmailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Delivery confirmation email sent successfully",
        result: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending delivery confirmation:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send delivery confirmation",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});