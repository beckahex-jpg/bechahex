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

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { submissionId } = await req.json();

    if (!submissionId) {
      return new Response(
        JSON.stringify({ error: "Missing required field: submissionId" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: submission, error: submissionError } = await supabase
      .from("product_submissions")
      .select("*")
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError || !submission) {
      console.error("Submission not found:", submissionError);
      return new Response(
        JSON.stringify({ error: "Submission not found", details: submissionError }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", submission.user_id)
      .maybeSingle();

    const { data: category } = await supabase
      .from("categories")
      .select("name")
      .eq("id", submission.category_id)
      .maybeSingle();

    const { data: admins, error: adminsError } = await supabase
      .from("profiles")
      .select("id, email, full_name, email_notifications_enabled, email_preferences")
      .eq("role", "admin");

    if (adminsError || !admins || admins.length === 0) {
      console.error("No admins found:", adminsError);
      return new Response(
        JSON.stringify({ error: "No admin users found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const submittedDate = new Date(submission.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const submissionTypeLabels = {
      donation: 'Donation',
      symbolic_sale: 'Symbolic Sale',
      public_sale: 'Public Sale'
    };

    const emailData = {
      submissionId: submission.id,
      productTitle: submission.title,
      sellerName: profile?.full_name || 'Unknown Seller',
      sellerEmail: profile?.email || '',
      price: submission.price ? parseFloat(submission.price).toFixed(2) : '0.00',
      submissionType: submissionTypeLabels[submission.submission_type as keyof typeof submissionTypeLabels] || submission.submission_type,
      description: submission.description || '',
      images: submission.images || [],
      submittedDate: submittedDate,
      siteUrl: SITE_URL,
    };

    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const emailPromises = admins
      .filter(admin => admin.email_notifications_enabled !== false)
      .map(async (admin) => {
        try {
          const sendEmailResponse = await fetch(sendEmailUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
            },
            body: JSON.stringify({
              to: admin.email,
              subject: `New Product Submission - ${submission.title}`,
              html: generateEmailTemplate(emailData),
              userId: admin.id,
              emailType: "product_submission_to_admin",
              metadata: { submissionId: submission.id },
            }),
          });

          if (!sendEmailResponse.ok) {
            const errorData = await sendEmailResponse.text();
            console.error(`Failed to send email to admin ${admin.email}:`, errorData);
            return { admin: admin.email, success: false, error: errorData };
          }

          return { admin: admin.email, success: true };
        } catch (error: any) {
          console.error(`Error sending email to admin ${admin.email}:`, error);
          return { admin: admin.email, success: false, error: error.message };
        }
      });

    const results = await Promise.all(emailPromises);
    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Notified ${successCount} admin(s) about new product submission`,
        results: results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending admin notification:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send admin notification",
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
          <h1>New Product Submission 📦</h1>
        </div>
        <div class="content">
          <h2>A new product requires your review</h2>
          <p>Hi Admin,</p>
          <p>A seller has submitted a new product for approval. Please review it at your earliest convenience.</p>
          <div class="order-details">
            <h3>Product Details</h3>
            <p><strong>Submission ID:</strong> #${data.submissionId}</p>
            <p><strong>Product Title:</strong> ${data.productTitle}</p>
            <p><strong>Seller:</strong> ${data.sellerName}</p>
            <p><strong>Seller Email:</strong> ${data.sellerEmail}</p>
            <p><strong>Price:</strong> $${data.price}</p>
            <p><strong>Submission Type:</strong> ${data.submissionType}</p>
            <p><strong>Submitted:</strong> ${data.submittedDate}</p>
            ${data.description ? `
              <h3 style="margin-top: 20px;">Description:</h3>
              <p style="color: #6c757d;">${data.description}</p>
            ` : ''}
            ${data.images && data.images.length > 0 ? `
              <h3 style="margin-top: 20px;">Product Images:</h3>
              <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
                ${data.images.slice(0, 3).map((img: string) => `
                  <img src="${img}" alt="Product" style="width: 150px; height: 150px; object-fit: cover; border-radius: 8px;">
                `).join('')}
              </div>
            ` : ''}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/admin/dashboard" class="button">Review Submission</a>
          </div>
          <p>Please approve or reject this submission as soon as possible.</p>
        </div>
        <div class="footer">
          <p><strong>Beckah Marketplace</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
}