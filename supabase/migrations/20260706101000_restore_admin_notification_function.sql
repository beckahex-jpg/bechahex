/*
  # Restore notify_admin_new_product_submission to its intended purpose

  The live version of this function had been edited (outside migrations) to
  POST to /functions/v1/process-new-submission instead of sending the admin
  email. That made it a hidden AI-validation dispatcher with pg_net's 5s
  default timeout, and it double-invoked the Edge Function once
  trigger_auto_process_new_submission (20260706100000) was added — causing
  duplicate published products.

  AI validation is now dispatched exclusively by auto_process_new_submission;
  this function goes back to notifying admins by email, exactly as defined in
  20251218134504_create_email_config_table.sql.
*/

CREATE OR REPLACE FUNCTION notify_admin_new_product_submission()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  SELECT ec.supabase_url, ec.service_role_key
  INTO supabase_url, service_role_key
  FROM email_config ec
  WHERE ec.id = 1;

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-product-submission-to-admin',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'submissionId', NEW.id
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send admin notification: %', SQLERRM;
  RETURN NEW;
END;
$$;
