/* Scheduled auction closure and email dispatch. */

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION auction_scheduler_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- The core functions only accept service-role/admin callers. The wrapper is
  -- executable only by postgres/service_role and is scheduled by pg_cron.
  PERFORM set_config('app.auction_scheduler', 'on', true);
  PERFORM close_expired_auctions(NULL);
  PERFORM advance_expired_auction_offers();
END;
$$;

REVOKE ALL ON FUNCTION auction_scheduler_tick() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION auction_scheduler_tick() TO service_role;

-- The legacy setup helper is SECURITY DEFINER. Restrict it so public callers
-- cannot replace the email dispatch credentials stored by the project owner.
REVOKE ALL ON FUNCTION set_email_notification_settings(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION set_email_notification_settings(text, text) TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'beckah-auction-scheduler') THEN
    PERFORM cron.schedule(
      'beckah-auction-scheduler',
      '* * * * *',
      'SELECT public.auction_scheduler_tick();'
    );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION dispatch_auction_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  IF NEW.type NOT LIKE 'auction_%' THEN
    RETURN NEW;
  END IF;

  SELECT supabase_url, service_role_key
  INTO v_supabase_url, v_service_role_key
  FROM email_config
  WHERE id = 1;

  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/send-auction-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
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

DROP TRIGGER IF EXISTS trigger_dispatch_auction_notification_email ON notifications;
CREATE TRIGGER trigger_dispatch_auction_notification_email
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.type LIKE 'auction_%')
  EXECUTE FUNCTION dispatch_auction_notification_email();
