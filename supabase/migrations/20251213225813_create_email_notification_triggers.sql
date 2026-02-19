/*
  # Create Email Notification Triggers

  1. New Functions & Triggers
    - Function to notify admin when new product submission is created
    - Function to notify seller when product status changes (approved/rejected)
    - Function to notify seller and buyer when new order is created
    - Triggers to automatically invoke these functions

  2. Implementation
    - Uses pg_net extension for async HTTP calls to Edge Functions
    - Triggers run AFTER INSERT or UPDATE
    - Non-blocking async execution

  3. Security
    - Functions run with SECURITY DEFINER for elevated privileges
    - Only triggers database events, not user actions
*/

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Function to notify admin about new product submission
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
  -- Get environment variables (these should be set in Supabase dashboard)
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  -- If environment variables are not set, use default (will be replaced at runtime)
  IF supabase_url IS NULL THEN
    supabase_url := 'https://placeholder.supabase.co';
  END IF;

  -- Make async HTTP request to Edge Function
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-product-submission-to-admin',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, 'placeholder')
    ),
    body := jsonb_build_object(
      'submissionId', NEW.id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail the transaction
  RAISE WARNING 'Failed to send admin notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger for new product submissions
DROP TRIGGER IF EXISTS trigger_notify_admin_new_submission ON product_submissions;
CREATE TRIGGER trigger_notify_admin_new_submission
  AFTER INSERT ON product_submissions
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION notify_admin_new_product_submission();

-- Function to notify seller about product status change
CREATE OR REPLACE FUNCTION notify_seller_product_status_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Only notify if status changed to approved or rejected
  IF NEW.status IN ('approved', 'rejected') AND (OLD.status IS NULL OR OLD.status != NEW.status) THEN
    supabase_url := current_setting('app.settings.supabase_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);

    IF supabase_url IS NULL THEN
      supabase_url := 'https://placeholder.supabase.co';
    END IF;

    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-product-status-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_role_key, 'placeholder')
      ),
      body := jsonb_build_object(
        'submissionId', NEW.id,
        'status', NEW.status,
        'rejectionReason', NEW.rejection_reason,
        'finalPrice', NEW.final_price,
        'productId', NEW.product_id
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send seller notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger for product submission status changes
DROP TRIGGER IF EXISTS trigger_notify_seller_status_change ON product_submissions;
CREATE TRIGGER trigger_notify_seller_status_change
  AFTER UPDATE ON product_submissions
  FOR EACH ROW
  EXECUTE FUNCTION notify_seller_product_status_change();

-- Function to notify seller and buyer about new order
CREATE OR REPLACE FUNCTION notify_order_created()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);

  IF supabase_url IS NULL THEN
    supabase_url := 'https://placeholder.supabase.co';
  END IF;

  -- Notify buyer with order confirmation
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-order-confirmation',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, 'placeholder')
    ),
    body := jsonb_build_object(
      'orderId', NEW.id
    )
  );

  -- Notify seller about new order
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-new-order-to-seller',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, 'placeholder')
    ),
    body := jsonb_build_object(
      'orderId', NEW.id
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send order notifications: %', SQLERRM;
  RETURN NEW;
END;
$$;

-- Trigger for new orders
DROP TRIGGER IF EXISTS trigger_notify_order_created ON orders;
CREATE TRIGGER trigger_notify_order_created
  AFTER INSERT ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_order_created();

-- Create a helper function to set app settings (run this manually with your actual values)
-- This is a convenience function for setting the required configuration
CREATE OR REPLACE FUNCTION set_email_notification_settings(
  p_supabase_url text,
  p_service_role_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Note: In production, these should be set via Supabase dashboard or environment
  -- This function is provided for convenience during development
  EXECUTE format('ALTER DATABASE %I SET app.settings.supabase_url = %L', current_database(), p_supabase_url);
  EXECUTE format('ALTER DATABASE %I SET app.settings.service_role_key = %L', current_database(), p_service_role_key);

  -- Reload configuration
  PERFORM pg_reload_conf();

  RAISE NOTICE 'Email notification settings configured successfully';
END;
$$;

COMMENT ON FUNCTION set_email_notification_settings IS 'Helper function to configure email notification settings. Run manually: SELECT set_email_notification_settings(''your_supabase_url'', ''your_service_role_key'');';