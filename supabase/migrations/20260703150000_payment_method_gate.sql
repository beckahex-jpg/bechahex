/*
  Card-on-file before bidding (eBay model):
  - payment_profiles stores each user's Stripe customer + saved card
  - place_auction_bid / set_auction_auto_bid refuse callers without an
    active saved card (server-side gate; the UI collects the card first)
  - when a winner offer is created, a trigger dispatches the
    auto-hold-auction-payment edge function which places the Stripe hold
    on the saved card automatically — the winner does not need to return
    and pay manually (the manual payment page remains as fallback).
*/

CREATE TABLE IF NOT EXISTS payment_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL UNIQUE,
  payment_method_id text,
  card_brand text,
  card_last4 text,
  status text NOT NULL DEFAULT 'incomplete' CHECK (status IN ('incomplete', 'active')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own payment profile" ON payment_profiles;
CREATE POLICY "Users read own payment profile"
  ON payment_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON payment_profiles TO authenticated;

CREATE OR REPLACE FUNCTION has_active_payment_method(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM payment_profiles
    WHERE user_id = p_user_id AND status = 'active' AND payment_method_id IS NOT NULL
  );
$$;

REVOKE ALL ON FUNCTION has_active_payment_method(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION has_active_payment_method(uuid) TO authenticated, service_role;

/* Service-side twin of prepare_auction_payment for the auto-hold flow
   (prepare_auction_payment relies on auth.uid(), which is not the winner
   when the scheduler calls). */
CREATE OR REPLACE FUNCTION service_prepare_auction_payment(p_winner_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer auction_winner_offers%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_payment auction_payments%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_offer FROM auction_winner_offers WHERE id = p_winner_offer_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Winner offer not found' USING ERRCODE = 'P0002';
  END IF;
  IF v_offer.status NOT IN ('offered', 'payment_started') OR v_offer.expires_at <= v_now THEN
    RAISE EXCEPTION 'Winner payment offer is no longer active' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO STRICT v_auction FROM auctions WHERE id = v_offer.auction_id FOR UPDATE;
  IF v_auction.status <> 'awaiting_payment' OR v_auction.winner_id <> v_offer.bidder_id THEN
    RAISE EXCEPTION 'Auction is not awaiting this winner payment' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_payment FROM auction_payments WHERE winner_offer_id = v_offer.id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO auction_payments (auction_id, winner_offer_id, user_id, item_amount, shipping_amount, total_amount)
    VALUES (v_auction.id, v_offer.id, v_offer.bidder_id, v_offer.amount, v_auction.shipping_cost, v_offer.amount + v_auction.shipping_cost)
    RETURNING * INTO v_payment;
  ELSIF v_payment.status NOT IN ('created', 'approved') THEN
    RETURN jsonb_build_object('payment_id', v_payment.id, 'status', v_payment.status, 'skip', true);
  END IF;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'auction_id', v_auction.id,
    'offer_id', v_offer.id,
    'user_id', v_offer.bidder_id,
    'title', v_auction.title,
    'total_amount', v_payment.total_amount,
    'skip', false
  );
END;
$$;

REVOKE ALL ON FUNCTION service_prepare_auction_payment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION service_prepare_auction_payment(uuid) TO service_role;

/* Auto-hold dispatch: whenever a winner offer is created, ask the edge
   function to place the hold on the winner's saved card. */
CREATE OR REPLACE FUNCTION dispatch_auction_auto_hold()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  IF NEW.status <> 'offered' THEN
    RETURN NEW;
  END IF;

  SELECT supabase_url, service_role_key
  INTO v_supabase_url, v_service_role_key
  FROM email_config
  WHERE id = 1;

  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/auto-hold-auction-payment',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
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

DROP TRIGGER IF EXISTS trigger_dispatch_auction_auto_hold ON auction_winner_offers;
CREATE TRIGGER trigger_dispatch_auction_auto_hold
  AFTER INSERT ON auction_winner_offers
  FOR EACH ROW
  EXECUTE FUNCTION dispatch_auction_auto_hold();
