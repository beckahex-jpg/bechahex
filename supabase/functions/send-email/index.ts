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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const FROM_EMAIL = Deno.env.get("FROM_EMAIL") || "onboarding@resend.dev";
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) {
      console.error("RESEND_API_KEY is not configured");
      return new Response(
        JSON.stringify({
          error: "Email service not configured. Please add RESEND_API_KEY to Supabase Edge Functions Secrets."
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

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

    const { to, subject, html, userId, emailType, metadata } = await req.json();

    if (!to || !subject || !html) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: to, subject, html" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const logId = crypto.randomUUID();

    await supabase.from("email_logs").insert({
      id: logId,
      user_id: userId || null,
      email_type: emailType || "unknown",
      recipient_email: to,
      subject: subject,
      status: "pending",
      metadata: metadata || {},
      created_at: new Date().toISOString(),
    });

    try {
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: `BECKAH EXCHANGE <${FROM_EMAIL}>`,
          to: [to],
          subject: subject,
          html: html,
        }),
      });

      if (!resendResponse.ok) {
        const errorData = await resendResponse.text();
        console.error("Resend API error:", errorData);
        throw new Error(`Resend API error: ${resendResponse.status} - ${errorData}`);
      }

      const resendData = await resendResponse.json();

      await supabase.from("email_logs").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        metadata: { ...metadata, resend_id: resendData.id },
      }).eq("id", logId);

      return new Response(
        JSON.stringify({
          success: true,
          message: "Email sent successfully",
          logId: logId,
          resendId: resendData.id,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } catch (emailError: any) {
      console.error("Error sending email:", emailError);

      await supabase.from("email_logs").update({
        status: "failed",
        error_message: emailError.message,
      }).eq("id", logId);

      return new Response(
        JSON.stringify({
          error: "Failed to send email",
          details: emailError.message,
          logId: logId,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({
        error: "An unexpected error occurred",
        details: error.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});