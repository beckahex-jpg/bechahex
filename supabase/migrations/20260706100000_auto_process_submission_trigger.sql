/*
  # Automatically run AI validation on new product submissions

  Fixed-price submissions were inserted with status 'pending' but nothing
  invoked the process-new-submission Edge Function (the old auto-validation
  trigger was dropped in 20251126200051), so listings were never AI-validated
  automatically. This trigger posts the submission id to the Edge Function
  asynchronously (pg_net), reusing the email_config credentials pattern used
  by the notification triggers.

  Safe to re-run: CREATE OR REPLACE + DROP TRIGGER IF EXISTS.
*/

CREATE OR REPLACE FUNCTION auto_process_new_submission()
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
    -- Generous timeout: the function downloads every product image and calls
    -- Gemini before answering, which can take well over pg_net's 5s default.
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/process-new-submission',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object('submission_id', NEW.id),
      timeout_milliseconds := 60000
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to queue AI validation for submission %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_process_new_submission ON product_submissions;
CREATE TRIGGER trigger_auto_process_new_submission
  AFTER INSERT ON product_submissions
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION auto_process_new_submission();
