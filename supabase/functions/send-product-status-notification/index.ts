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

    const { submissionId, status, rejectionReason, adminNotes, finalPrice, productId } = await req.json();

    if (!submissionId || !status) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: submissionId, status" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!['approved', 'rejected'].includes(status)) {
      return new Response(
        JSON.stringify({ error: "Status must be 'approved' or 'rejected'" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: submission, error: submissionError } = await supabase
      .from("product_submissions")
      .select(`
        *,
        profiles(
          full_name,
          email,
          email_notifications_enabled,
          email_preferences
        )
      `)
      .eq("id", submissionId)
      .maybeSingle();

    if (submissionError || !submission) {
      console.error("Submission not found:", submissionError);
      return new Response(
        JSON.stringify({ error: "Submission not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!submission.profiles?.email_notifications_enabled) {
      console.log("Email notifications disabled for seller", submission.user_id);
      return new Response(
        JSON.stringify({ message: "Email notifications disabled for this user" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const submittedDate = new Date(submission.created_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const reviewedDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    let emailData;
    let emailType;
    let subject;

    if (status === 'approved') {
      emailData = {
        sellerName: submission.profiles?.full_name || 'Seller',
        productTitle: submission.title,
        finalPrice: finalPrice ? parseFloat(finalPrice).toFixed(2) : parseFloat(submission.price || 0).toFixed(2),
        approvedDate: reviewedDate,
        adminNotes: adminNotes || '',
        siteUrl: SITE_URL,
        productId: productId,
      };
      emailType = 'product_approved';
      subject = `Product Approved - ${submission.title}`;
    } else {
      emailData = {
        sellerName: submission.profiles?.full_name || 'Seller',
        productTitle: submission.title,
        submittedDate: submittedDate,
        reviewedDate: reviewedDate,
        rejectionReason: rejectionReason || 'The product does not meet our marketplace standards at this time.',
        siteUrl: SITE_URL,
      };
      emailType = 'product_rejected';
      subject = `Product Submission Update - ${submission.title}`;
    }

    const emailHtml = status === 'approved'
      ? generateApprovedEmailTemplate(emailData)
      : generateRejectedEmailTemplate(emailData);

    const sendEmailUrl = `${SUPABASE_URL}/functions/v1/send-email`;
    const sendEmailResponse = await fetch(sendEmailUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({
        to: submission.profiles.email,
        subject: subject,
        html: emailHtml,
        userId: submission.user_id,
        emailType: emailType,
        metadata: {
          submissionId: submission.id,
          productId: productId || null,
          status: status
        },
      }),
    });

    if (!sendEmailResponse.ok) {
      const errorData = await sendEmailResponse.text();
      console.error("Failed to send email:", errorData);
      throw new Error(`Failed to send email: ${errorData}`);
    }

    const result = await sendEmailResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        message: `${status === 'approved' ? 'Approval' : 'Rejection'} notification sent successfully`,
        result: result,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: any) {
    console.error("Error sending product status notification:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send product status notification",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

function generateApprovedEmailTemplate(data: any): string {
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
          <h1>Product Approved! ✅</h1>
        </div>
        <div class="content">
          <h2>Great news! Your product has been approved!</h2>
          <p>Hi ${data.sellerName},</p>
          <p>We're excited to let you know that your product submission has been approved and is now live on the marketplace!</p>
          <div class="order-details">
            <h3>Product Details</h3>
            <p><strong>Product Title:</strong> ${data.productTitle}</p>
            <p><strong>Final Price:</strong> $${data.finalPrice}</p>
            <p><strong>Approved Date:</strong> ${data.approvedDate}</p>
            ${data.adminNotes ? `
              <div style="margin-top: 20px; padding: 15px; background-color: #d4edda; border-left: 4px solid #28a745; border-radius: 4px;">
                <p style="margin: 0; font-weight: 600; color: #155724; margin-bottom: 8px;">Admin Notes:</p>
                <p style="margin: 0; color: #155724;">${data.adminNotes}</p>
              </div>
            ` : ''}
          </div>
          <div style="background-color: #d4edda; border: 1px solid #c3e6cb; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #155724; font-size: 14px;">
              <strong>What's Next?</strong> Your product is now visible to customers. You'll receive an email notification whenever someone purchases your item.
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            ${data.productId
              ? `<a href="${data.siteUrl}/product/${data.productId}" class="button">View Your Product</a>`
              : `<a href="${data.siteUrl}/my-products" class="button">View My Products</a>`
            }
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

function generateRejectedEmailTemplate(data: any): string {
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
          <h1>Product Submission Update ℹ️</h1>
        </div>
        <div class="content">
          <h2>Update on your product submission</h2>
          <p>Hi ${data.sellerName},</p>
          <p>Thank you for submitting your product. After careful review, we're unable to approve it at this time.</p>
          <div class="order-details">
            <h3>Submission Details</h3>
            <p><strong>Product Title:</strong> ${data.productTitle}</p>
            <p><strong>Submission Date:</strong> ${data.submittedDate}</p>
            <p><strong>Review Date:</strong> ${data.reviewedDate}</p>
            ${data.rejectionReason ? `
              <div style="margin-top: 20px; padding: 15px; background-color: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <p style="margin: 0; font-weight: 600; color: #856404; margin-bottom: 8px;">Reason for Update:</p>
                <p style="margin: 0; color: #856404;">${data.rejectionReason}</p>
              </div>
            ` : ''}
          </div>
          <div style="background-color: #e7f3ff; border: 1px solid #b3d9ff; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="margin: 0; color: #004085; font-size: 14px;">
              <strong>What can you do?</strong> You can resubmit your product with the necessary changes. Please review our product guidelines and make sure your listing meets all requirements.
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.siteUrl}/submit-product" class="button">Submit Another Product</a>
          </div>
          <p>If you have any questions about this decision, please don't hesitate to contact our support team.</p>
        </div>
        <div class="footer">
          <p><strong>Beckah Marketplace</strong></p>
        </div>
      </div>
    </body>
    </html>
  `;
}
