import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const getWelcomeEmailTemplate = (fullName: string, siteUrl: string) => {
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
        .unsubscribe { color: #6c757d; font-size: 12px; margin-top: 20px; }
        .unsubscribe a { color: #6c757d; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to Beckah!</h1>
        </div>
        <div class="content">
          <h2>Hi ${fullName || 'there'}! 👋</h2>
          <p>We're thrilled to have you join our marketplace community!</p>
          <p>Beckah is your destination for discovering unique, quality products from sellers around the world. Whether you're looking to buy or sell, we've got you covered.</p>
          <h3>Here's what you can do:</h3>
          <ul>
            <li><strong>Shop</strong> from a curated selection of products</li>
            <li><strong>Sell</strong> your own items and reach thousands of buyers</li>
            <li><strong>Track</strong> your orders in real-time</li>
            <li><strong>Connect</strong> with a vibrant community</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${siteUrl}" class="button">Start Shopping</a>
          </div>
          <p>Need help? Our support team is always here to assist you.</p>
          <p>Happy shopping!</p>
        </div>
        <div class="footer">
          <p><strong>Beckah Marketplace</strong></p>
          <p>Your trusted marketplace for quality products</p>
          <div class="unsubscribe">
            <p><a href="${siteUrl}/settings">Manage email preferences</a></p>
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

    const { userId, email, fullName } = await req.json();

    if (!userId || !email) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: userId, email" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email_notifications_enabled, email_preferences")
      .eq("id", userId)
      .maybeSingle();

    if (!profile?.email_notifications_enabled) {
      console.log("Email notifications disabled for user", userId);
      return new Response(
        JSON.stringify({ message: "Email notifications disabled" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const emailHtml = getWelcomeEmailTemplate(fullName, SITE_URL);

    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const sendEmailResponse = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: email,
        subject: "Welcome to Beckah Marketplace! 🎉",
        html: emailHtml,
        userId: userId,
        emailType: "welcome",
        metadata: { fullName: fullName },
      }),
    });

    if (!sendEmailResponse.ok) {
      const errorData = await sendEmailResponse.text();
      console.error("Failed to send welcome email:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await sendEmailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: "Welcome email sent successfully",
        result: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending welcome email:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send welcome email",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});