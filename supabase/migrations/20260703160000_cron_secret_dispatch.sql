/*
  Supabase API-key rotation broke every pg_net dispatch that stored the old
  service_role key in email_config: the edge functions compare the Bearer
  token against the (rotated) SUPABASE_SERVICE_ROLE_KEY env and returned 403
  — silently disabling auction notification emails and the auto-hold flow.

  Fix: dispatches now also send a shared x-cron-secret header, which all
  scheduler-gated functions accept and which survives key rotations. The
  secret value itself is set directly on the live DB and in function
  secrets (AUCTION_CRON_SECRET) — never committed to the repo.
*/

ALTER TABLE email_config ADD COLUMN IF NOT EXISTS cron_secret text;

CREATE OR REPLACE FUNCTION dispatch_auction_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_cron_secret text;
BEGIN
  IF NEW.type NOT LIKE 'auction_%' THEN
    RETURN NEW;
  END IF;

  SELECT supabase_url, service_role_key, cron_secret
  INTO v_supabase_url, v_service_role_key, v_cron_secret
  FROM email_config
  WHERE id = 1;

  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-auction-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key,
        'x-cron-secret', COALESCE(v_cron_secret, '')
      ),
      body := jsonb_build_object('notificationId', NEW.id)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auction email dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION stripe_auction_maintenance_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_cron_secret text;
BEGIN
  SELECT supabase_url, service_role_key, cron_secret
  INTO v_supabase_url, v_service_role_key, v_cron_secret
  FROM email_config
  WHERE id = 1;

  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/stripe-auction-maintenance',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key,
        'x-cron-secret', COALESCE(v_cron_secret, '')
      ),
      body := '{}'::jsonb
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Stripe maintenance dispatch failed: %', SQLERRM;
END;
$$;

REVOKE ALL ON FUNCTION stripe_auction_maintenance_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION stripe_auction_maintenance_tick() TO service_role;

CREATE OR REPLACE FUNCTION dispatch_auction_auto_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
  v_cron_secret text;
BEGIN
  IF NEW.status <> 'offered' THEN
    RETURN NEW;
  END IF;

  SELECT supabase_url, service_role_key, cron_secret
  INTO v_supabase_url, v_service_role_key, v_cron_secret
  FROM email_config
  WHERE id = 1;

  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/auto-hold-auction-payment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key,
        'x-cron-secret', COALESCE(v_cron_secret, '')
      ),
      body := jsonb_build_object('offerId', NEW.id)
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Auto-hold dispatch failed: %', SQLERRM;
  RETURN NEW;
END;
$$;
