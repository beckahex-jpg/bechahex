/*
  # Email Configuration Table

  1. New Table
    - `email_config` - Stores email system configuration
      - `id` (integer, primary key) - Always 1 (singleton)
      - `supabase_url` (text) - Supabase project URL
      - `service_role_key` (text) - Service role key for authentication
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS
    - Only service_role can access this table
    - No public access allowed

  3. Purpose
    - Store email notification configuration
    - Alternative to ALTER DATABASE settings
    - Works with Supabase managed environment
*/

-- Create email_config table
CREATE TABLE IF NOT EXISTS email_config (
  id integer PRIMARY KEY DEFAULT 1,
  supabase_url text NOT NULL,
  service_role_key text NOT NULL,
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

-- Enable RLS
ALTER TABLE email_config ENABLE ROW LEVEL SECURITY;

-- No policies = only service_role can access
-- This is intentional for security

-- Create or update helper function to use table instead of ALTER DATABASE
CREATE OR REPLACE FUNCTION set_email_notification_settings(
  p_supabase_url text,
  p_service_role_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Insert or update configuration
  INSERT INTO email_config (id, supabase_url, service_role_key, updated_at)
  VALUES (1, p_supabase_url, p_service_role_key, now())
  ON CONFLICT (id)
  DO UPDATE SET
    supabase_url = EXCLUDED.supabase_url,
    service_role_key = EXCLUDED.service_role_key,
    updated_at = now();

  RAISE NOTICE 'Email notification settings configured successfully in email_config table';
END;
$$;

-- Update the notification functions to read from table
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
  -- Get configuration from table
  SELECT ec.supabase_url, ec.service_role_key
  INTO supabase_url, service_role_key
  FROM email_config ec
  WHERE ec.id = 1;

  -- Make async HTTP request to Edge Function
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
    -- Get configuration from table
    SELECT ec.supabase_url, ec.service_role_key
    INTO supabase_url, service_role_key
    FROM email_config ec
    WHERE ec.id = 1;

    IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-product-status-notification',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || service_role_key
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
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send seller notification: %', SQLERRM;
  RETURN NEW;
END;
$$;

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
  -- Get configuration from table
  SELECT ec.supabase_url, ec.service_role_key
  INTO supabase_url, service_role_key
  FROM email_config ec
  WHERE ec.id = 1;

  IF supabase_url IS NOT NULL AND service_role_key IS NOT NULL THEN
    -- Notify buyer with order confirmation
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-order-confirmation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
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
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'orderId', NEW.id
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed to send order notifications: %', SQLERRM;
  RETURN NEW;
END;
$$;