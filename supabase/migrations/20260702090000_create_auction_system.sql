/*
  Beckah auction foundation

  Important design rules:
  - Sellers do not wait for admin approval. New auctions enter pending_ai_review.
  - Only the trusted moderation service can publish an auction.
  - Bids can only be created through place_auction_bid(), which locks the auction row.
  - Admin removal is a soft cancellation so bids, payments, and audit history survive.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'listing_type'
  ) THEN
    ALTER TABLE products
      ADD COLUMN listing_type text NOT NULL DEFAULT 'fixed_price'
      CHECK (listing_type IN ('fixed_price', 'auction'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auctions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 3 AND 160),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 5000),
  condition text NOT NULL DEFAULT 'Good' CHECK (char_length(btrim(condition)) BETWEEN 1 AND 50),
  review_image_paths jsonb NOT NULL DEFAULT '[]'::jsonb,
  images jsonb NOT NULL DEFAULT '[]'::jsonb,
  submission_type text NOT NULL DEFAULT 'public_sale'
    CHECK (submission_type IN ('donation', 'symbolic_sale', 'public_sale')),
  original_price numeric(12,2) CHECK (original_price IS NULL OR original_price >= 0),
  seller_symbolic_price numeric(12,2) CHECK (seller_symbolic_price IS NULL OR seller_symbolic_price >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  starting_price numeric(12,2) NOT NULL CHECK (starting_price > 0),
  current_price numeric(12,2),
  minimum_bid_increment numeric(12,2) NOT NULL CHECK (minimum_bid_increment > 0),
  shipping_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_cost >= 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  winner_payment_window_hours integer NOT NULL DEFAULT 24
    CHECK (winner_payment_window_hours BETWEEN 1 AND 168),
  payment_due_at timestamptz,
  status text NOT NULL DEFAULT 'pending_ai_review' CHECK (status IN (
    'draft',
    'pending_ai_review',
    'scheduled',
    'active',
    'blocked',
    'awaiting_payment',
    'paid',
    'ended_no_bids',
    'cancelled_by_admin',
    'closed'
  )),
  bid_count integer NOT NULL DEFAULT 0 CHECK (bid_count >= 0),
  highest_bid_id uuid,
  highest_bidder_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ai_moderation_status text NOT NULL DEFAULT 'pending' CHECK (ai_moderation_status IN (
    'pending', 'approved', 'blocked', 'error'
  )),
  ai_risk_score numeric(5,4),
  ai_moderation_reason text,
  ai_model text,
  moderated_at timestamptz,
  cancellation_reason text,
  removed_at timestamptz,
  version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  CHECK (current_price IS NULL OR current_price >= starting_price),
  CHECK (ai_risk_score IS NULL OR (ai_risk_score >= 0 AND ai_risk_score <= 1))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_auctions_unique_product
  ON auctions(product_id) WHERE product_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_submissions' AND column_name = 'listing_type'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN listing_type text NOT NULL DEFAULT 'fixed_price'
      CHECK (listing_type IN ('fixed_price', 'auction'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_submissions' AND column_name = 'auction_id'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN auction_id uuid REFERENCES auctions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auction_bids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
  bidder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'accepted' CHECK (status IN ('accepted', 'invalidated')),
  idempotency_key uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (bidder_id, idempotency_key)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'auctions_highest_bid_id_fkey'
  ) THEN
    ALTER TABLE auctions
      ADD CONSTRAINT auctions_highest_bid_id_fkey
      FOREIGN KEY (highest_bid_id) REFERENCES auction_bids(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS auction_winner_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
  bid_id uuid NOT NULL REFERENCES auction_bids(id) ON DELETE RESTRICT,
  bidder_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  rank integer NOT NULL CHECK (rank > 0),
  amount numeric(12,2) NOT NULL CHECK (amount > 0),
  status text NOT NULL DEFAULT 'offered' CHECK (status IN (
    'offered', 'payment_started', 'paid', 'expired', 'declined', 'cancelled'
  )),
  offered_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (auction_id, rank),
  UNIQUE (auction_id, bidder_id)
);

CREATE TABLE IF NOT EXISTS auction_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
  winner_offer_id uuid NOT NULL REFERENCES auction_winner_offers(id) ON DELETE RESTRICT,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  provider text NOT NULL DEFAULT 'paypal' CHECK (provider = 'paypal'),
  provider_order_id text UNIQUE,
  provider_capture_id text UNIQUE,
  provider_refund_id text UNIQUE,
  item_amount numeric(12,2) NOT NULL CHECK (item_amount > 0),
  shipping_amount numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_amount >= 0),
  total_amount numeric(12,2) NOT NULL CHECK (total_amount > 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency = 'USD'),
  status text NOT NULL DEFAULT 'created' CHECK (status IN (
    'created', 'approved', 'captured', 'review_required', 'failed', 'cancelled', 'refunded'
  )),
  failure_reason text,
  provider_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  refund_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (winner_offer_id)
);

CREATE TABLE IF NOT EXISTS auction_moderation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
  content_hash text NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('approved', 'blocked', 'error')),
  risk_score numeric(5,4),
  reason text NOT NULL DEFAULT '',
  matched_categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL,
  model_version text,
  raw_response jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (risk_score IS NULL OR (risk_score >= 0 AND risk_score <= 1))
);

CREATE TABLE IF NOT EXISTS auction_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  auction_id uuid NOT NULL REFERENCES auctions(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'auction_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN auction_id uuid REFERENCES auctions(id) ON DELETE SET NULL;
    CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_auction
      ON orders(auction_id) WHERE auction_id IS NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'order_type'
  ) THEN
    ALTER TABLE orders ADD COLUMN order_type text NOT NULL DEFAULT 'fixed_price'
      CHECK (order_type IN ('fixed_price', 'auction'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'payment_due_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_due_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'refunded_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN refunded_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'auction_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN auction_id uuid REFERENCES auctions(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_auctions_public_status_end
  ON auctions(status, ends_at) WHERE removed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_auctions_seller_created
  ON auctions(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auctions_category_status
  ON auctions(category_id, status);
CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_amount
  ON auction_bids(auction_id, amount DESC, created_at ASC)
  WHERE status = 'accepted';
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_created
  ON auction_bids(bidder_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auction_offers_expiry
  ON auction_winner_offers(status, expires_at) WHERE status = 'offered';
CREATE INDEX IF NOT EXISTS idx_auction_events_auction_created
  ON auction_events(auction_id, created_at DESC);

ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_winner_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_moderation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION auction_current_user_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION auction_current_user_is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auction_current_user_is_admin() TO authenticated, service_role;

DROP POLICY IF EXISTS "Public reads published auctions" ON auctions;
CREATE POLICY "Public reads published auctions"
  ON auctions FOR SELECT TO anon, authenticated
  USING (
    removed_at IS NULL
    AND status IN ('scheduled', 'active', 'awaiting_payment', 'paid', 'ended_no_bids', 'closed')
  );

DROP POLICY IF EXISTS "Sellers read own auctions" ON auctions;
CREATE POLICY "Sellers read own auctions"
  ON auctions FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all auctions" ON auctions;
CREATE POLICY "Admins read all auctions"
  ON auctions FOR SELECT TO authenticated
  USING (auction_current_user_is_admin());

DROP POLICY IF EXISTS "Bidders read own bids" ON auction_bids;
CREATE POLICY "Bidders read own bids"
  ON auction_bids FOR SELECT TO authenticated
  USING (bidder_id = auth.uid() OR auction_current_user_is_admin());

DROP POLICY IF EXISTS "Users read related winner offers" ON auction_winner_offers;
CREATE POLICY "Users read related winner offers"
  ON auction_winner_offers FOR SELECT TO authenticated
  USING (
    bidder_id = auth.uid()
    OR auction_current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM auctions a
      WHERE a.id = auction_winner_offers.auction_id AND a.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read own auction payments" ON auction_payments;
CREATE POLICY "Users read own auction payments"
  ON auction_payments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR auction_current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM auctions a
      WHERE a.id = auction_payments.auction_id AND a.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Sellers read own moderation results" ON auction_moderation_results;
CREATE POLICY "Sellers read own moderation results"
  ON auction_moderation_results FOR SELECT TO authenticated
  USING (
    auction_current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM auctions a
      WHERE a.id = auction_moderation_results.auction_id AND a.seller_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users read related auction events" ON auction_events;
CREATE POLICY "Users read related auction events"
  ON auction_events FOR SELECT TO authenticated
  USING (
    auction_current_user_is_admin()
    OR EXISTS (
      SELECT 1 FROM auctions a
      WHERE a.id = auction_events.auction_id AND a.seller_id = auth.uid()
    )
  );

-- Public history deliberately omits bidder_id. A stable masked alias is scoped
-- to one auction so it cannot be used to track a person across the site.
CREATE OR REPLACE VIEW public_auction_bid_history
AS
SELECT
  b.id,
  b.auction_id,
  b.amount,
  b.status,
  b.created_at,
  'Bidder-' || upper(substr(encode(extensions.digest(b.bidder_id::text || ':' || b.auction_id::text, 'sha256'), 'hex'), 1, 4))
    AS bidder_alias
FROM auction_bids b
JOIN auctions a ON a.id = b.auction_id
WHERE a.removed_at IS NULL
  AND a.status IN ('scheduled', 'active', 'awaiting_payment', 'paid', 'ended_no_bids', 'closed');

REVOKE ALL ON auctions, auction_bids, auction_winner_offers,
  auction_payments, auction_moderation_results, auction_events FROM anon, authenticated;
GRANT SELECT ON auctions TO anon, authenticated;
GRANT SELECT ON auction_bids, auction_winner_offers, auction_payments,
  auction_moderation_results, auction_events TO authenticated;
GRANT SELECT ON public_auction_bid_history TO anon, authenticated;

-- Existing project code creates several non-auction notifications from the
-- browser. Preserve that behavior, but reserve auction_* events for trusted
-- database functions and service-role Edge Functions.
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users insert non auction notifications" ON notifications;
CREATE POLICY "Authenticated users insert non auction notifications"
  ON notifications FOR INSERT TO authenticated
  WITH CHECK (left(type, 8) <> 'auction_');

CREATE OR REPLACE FUNCTION place_auction_bid(
  p_auction_id uuid,
  p_amount numeric,
  p_idempotency_key uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_auction auctions%ROWTYPE;
  v_bid auction_bids%ROWTYPE;
  v_existing auction_bids%ROWTYPE;
  v_minimum numeric(12,2);
  v_previous_bidder uuid;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'Idempotency key is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_existing
  FROM auction_bids
  WHERE bidder_id = v_user_id AND idempotency_key = p_idempotency_key;

  IF FOUND THEN
    IF v_existing.auction_id <> p_auction_id OR v_existing.amount <> round(p_amount, 2) THEN
      RAISE EXCEPTION 'Idempotency key was already used for another bid' USING ERRCODE = '23505';
    END IF;

    RETURN jsonb_build_object(
      'bid_id', v_existing.id,
      'auction_id', v_existing.auction_id,
      'amount', v_existing.amount,
      'duplicate', true
    );
  END IF;

  SELECT * INTO v_auction
  FROM auctions
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND OR v_auction.removed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Auction not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_auction.seller_id = v_user_id THEN
    RAISE EXCEPTION 'A seller cannot bid on their own auction' USING ERRCODE = '42501';
  END IF;

  IF v_auction.status = 'scheduled' AND v_auction.starts_at <= v_now AND v_auction.ends_at > v_now THEN
    UPDATE auctions SET status = 'active', updated_at = v_now, version = version + 1
    WHERE id = v_auction.id;
    v_auction.status := 'active';
  END IF;

  IF v_auction.status <> 'active' OR v_now < v_auction.starts_at OR v_now >= v_auction.ends_at THEN
    RAISE EXCEPTION 'Auction is not open for bidding' USING ERRCODE = '55000';
  END IF;

  v_minimum := CASE
    WHEN v_auction.bid_count = 0 THEN v_auction.starting_price
    ELSE v_auction.current_price + v_auction.minimum_bid_increment
  END;

  IF p_amount IS NULL OR round(p_amount, 2) <> p_amount OR p_amount < v_minimum THEN
    RAISE EXCEPTION 'Bid must be at least % USD', v_minimum USING ERRCODE = '22023';
  END IF;

  v_previous_bidder := v_auction.highest_bidder_id;

  INSERT INTO auction_bids (auction_id, bidder_id, amount, idempotency_key)
  VALUES (p_auction_id, v_user_id, p_amount, p_idempotency_key)
  RETURNING * INTO v_bid;

  UPDATE auctions SET
    current_price = v_bid.amount,
    highest_bid_id = v_bid.id,
    highest_bidder_id = v_user_id,
    bid_count = bid_count + 1,
    version = version + 1,
    updated_at = v_now
  WHERE id = p_auction_id;

  UPDATE products
  SET price = v_bid.amount, updated_at = v_now
  WHERE id = v_auction.product_id;

  INSERT INTO auction_events (auction_id, actor_id, event_type, data)
  VALUES (
    p_auction_id,
    v_user_id,
    'bid_accepted',
    jsonb_build_object('bid_id', v_bid.id, 'amount', v_bid.amount)
  );

  IF v_previous_bidder IS NOT NULL AND v_previous_bidder <> v_user_id THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_previous_bidder,
      'auction_outbid',
      'You have been outbid',
      'Another bidder placed a higher bid on "' || v_auction.title || '".',
      jsonb_build_object('auction_id', p_auction_id, 'product_id', v_auction.product_id, 'current_price', v_bid.amount)
    );
  END IF;

  RETURN jsonb_build_object(
    'bid_id', v_bid.id,
    'auction_id', p_auction_id,
    'amount', v_bid.amount,
    'current_price', v_bid.amount,
    'bid_count', v_auction.bid_count + 1,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION place_auction_bid(uuid, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_auction_bid(uuid, numeric, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION close_expired_auctions(p_auction_id uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction auctions%ROWTYPE;
  v_bid auction_bids%ROWTYPE;
  v_offer auction_winner_offers%ROWTYPE;
  v_closed integer := 0;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND COALESCE(current_setting('app.auction_scheduler', true), '') <> 'on'
    AND NOT auction_current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin or service role required' USING ERRCODE = '42501';
  END IF;

  UPDATE auctions
  SET status = 'active', updated_at = v_now, version = version + 1
  WHERE status = 'scheduled'
    AND starts_at <= v_now
    AND ends_at > v_now
    AND removed_at IS NULL
    AND (p_auction_id IS NULL OR id = p_auction_id);

  FOR v_auction IN
    SELECT * FROM auctions
    WHERE status IN ('scheduled', 'active')
      AND ends_at <= v_now
      AND removed_at IS NULL
      AND (p_auction_id IS NULL OR id = p_auction_id)
    ORDER BY ends_at
    FOR UPDATE SKIP LOCKED
  LOOP
    IF v_auction.highest_bid_id IS NULL THEN
      UPDATE auctions SET
        status = 'ended_no_bids',
        updated_at = v_now,
        version = version + 1
      WHERE id = v_auction.id;

      UPDATE products
      SET status = 'pending', updated_at = v_now
      WHERE id = v_auction.product_id;

      INSERT INTO auction_events (auction_id, event_type, data)
      VALUES (v_auction.id, 'auction_closed_no_bids', '{}'::jsonb);
    ELSE
      SELECT * INTO STRICT v_bid
      FROM auction_bids
      WHERE id = v_auction.highest_bid_id AND status = 'accepted';

      INSERT INTO auction_winner_offers (
        auction_id, bid_id, bidder_id, rank, amount, expires_at
      ) VALUES (
        v_auction.id,
        v_bid.id,
        v_bid.bidder_id,
        1,
        v_bid.amount,
        v_now + make_interval(hours => v_auction.winner_payment_window_hours)
      )
      ON CONFLICT (auction_id, rank) DO NOTHING
      RETURNING * INTO v_offer;

      UPDATE auctions SET
        status = 'awaiting_payment',
        winner_id = v_bid.bidder_id,
        payment_due_at = v_now + make_interval(hours => winner_payment_window_hours),
        updated_at = v_now,
        version = version + 1
      WHERE id = v_auction.id;

      INSERT INTO notifications (user_id, type, title, message, data)
      VALUES (
        v_bid.bidder_id,
        'auction_won',
        'You won the auction',
        'You won "' || v_auction.title || '". Complete payment before the deadline.',
        jsonb_build_object(
          'auction_id', v_auction.id,
          'product_id', v_auction.product_id,
          'amount', v_bid.amount,
          'winner_offer_id', v_offer.id,
          'payment_due_at', v_now + make_interval(hours => v_auction.winner_payment_window_hours)
        )
      );

      INSERT INTO notifications (user_id, type, title, message, data)
      SELECT DISTINCT
        b.bidder_id,
        'auction_lost',
        'Auction ended',
        'The auction "' || v_auction.title || '" ended with another bidder in first place.',
        jsonb_build_object('auction_id', v_auction.id, 'product_id', v_auction.product_id, 'winning_amount', v_bid.amount)
      FROM auction_bids b
      WHERE b.auction_id = v_auction.id
        AND b.status = 'accepted'
        AND b.bidder_id <> v_bid.bidder_id;

      INSERT INTO auction_events (auction_id, actor_id, event_type, data)
      VALUES (
        v_auction.id,
        v_bid.bidder_id,
        'winner_selected',
        jsonb_build_object('bid_id', v_bid.id, 'amount', v_bid.amount, 'rank', 1)
      );
    END IF;

    v_closed := v_closed + 1;
  END LOOP;

  RETURN v_closed;
END;
$$;

REVOKE ALL ON FUNCTION close_expired_auctions(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION close_expired_auctions(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION advance_expired_auction_offers()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_offer auction_winner_offers%ROWTYPE;
  v_next_bid auction_bids%ROWTYPE;
  v_next_rank integer;
  v_window integer;
  v_next_offer_id uuid;
  v_now timestamptz := clock_timestamp();
  v_advanced integer := 0;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role'
    AND COALESCE(current_setting('app.auction_scheduler', true), '') <> 'on'
    AND NOT auction_current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin or service role required' USING ERRCODE = '42501';
  END IF;

  -- If a worker stopped after claiming a PayPal capture, never promote another
  -- bidder automatically: the payment may have reached PayPal. Hold it for
  -- manual reconciliation instead of risking two buyers for one item.
  UPDATE auction_payments
  SET status = 'review_required',
      failure_reason = COALESCE(failure_reason, 'Capture claim timed out and requires reconciliation'),
      updated_at = v_now
  WHERE status = 'approved'
    AND updated_at <= v_now - interval '10 minutes';

  FOR v_offer IN
    SELECT * FROM auction_winner_offers o
    WHERE status IN ('offered', 'payment_started')
      AND expires_at <= v_now
      AND NOT EXISTS (
        SELECT 1 FROM auction_payments p
        WHERE p.winner_offer_id = o.id
          AND (
            p.status = 'review_required'
            OR p.status = 'approved'
          )
      )
    ORDER BY expires_at
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE auction_winner_offers
    SET status = 'expired', responded_at = v_now
    WHERE id = v_offer.id;

    UPDATE auction_bids
    SET status = 'invalidated'
    WHERE auction_id = v_offer.auction_id
      AND bidder_id = v_offer.bidder_id
      AND status = 'accepted';

    SELECT b.* INTO v_next_bid
    FROM auction_bids b
    WHERE b.auction_id = v_offer.auction_id
      AND b.status = 'accepted'
      AND NOT EXISTS (
        SELECT 1 FROM auction_winner_offers o
        WHERE o.auction_id = b.auction_id AND o.bidder_id = b.bidder_id
      )
    ORDER BY b.amount DESC, b.created_at ASC
    LIMIT 1;

    IF FOUND THEN
      SELECT COALESCE(max(rank), 0) + 1 INTO v_next_rank
      FROM auction_winner_offers
      WHERE auction_id = v_offer.auction_id;

      SELECT winner_payment_window_hours INTO v_window
      FROM auctions WHERE id = v_offer.auction_id FOR UPDATE;

      INSERT INTO auction_winner_offers (
        auction_id, bid_id, bidder_id, rank, amount, expires_at
      ) VALUES (
        v_offer.auction_id,
        v_next_bid.id,
        v_next_bid.bidder_id,
        v_next_rank,
        v_next_bid.amount,
        v_now + make_interval(hours => v_window)
      )
      RETURNING id INTO v_next_offer_id;

      UPDATE auctions SET
        winner_id = v_next_bid.bidder_id,
        current_price = v_next_bid.amount,
        highest_bid_id = v_next_bid.id,
        highest_bidder_id = v_next_bid.bidder_id,
        payment_due_at = v_now + make_interval(hours => v_window),
        version = version + 1,
        updated_at = v_now
      WHERE id = v_offer.auction_id;

      UPDATE products
      SET price = v_next_bid.amount, updated_at = v_now
      WHERE id = (SELECT product_id FROM auctions WHERE id = v_offer.auction_id);

      INSERT INTO notifications (user_id, type, title, message, data)
      SELECT
        v_next_bid.bidder_id,
        'auction_second_chance',
        'The auction is now available to you',
        'The previous winner did not pay. You can now complete the purchase.',
        jsonb_build_object(
          'auction_id', v_offer.auction_id,
          'product_id', (SELECT product_id FROM auctions WHERE id = v_offer.auction_id),
          'amount', v_next_bid.amount,
          'winner_offer_id', v_next_offer_id,
          'payment_due_at', v_now + make_interval(hours => v_window)
        );

      INSERT INTO auction_events (auction_id, actor_id, event_type, data)
      VALUES (
        v_offer.auction_id,
        v_next_bid.bidder_id,
        'winner_offer_advanced',
        jsonb_build_object('rank', v_next_rank, 'amount', v_next_bid.amount)
      );
    ELSE
      UPDATE auctions SET
        status = 'closed',
        winner_id = NULL,
        current_price = NULL,
        highest_bid_id = NULL,
        highest_bidder_id = NULL,
        payment_due_at = NULL,
        version = version + 1,
        updated_at = v_now
      WHERE id = v_offer.auction_id;

      UPDATE products
      SET status = 'pending', updated_at = v_now
      WHERE id = (SELECT product_id FROM auctions WHERE id = v_offer.auction_id);

      INSERT INTO auction_events (auction_id, event_type, data)
      VALUES (v_offer.auction_id, 'winner_list_exhausted', '{}'::jsonb);
    END IF;

    v_advanced := v_advanced + 1;
  END LOOP;

  RETURN v_advanced;
END;
$$;

REVOKE ALL ON FUNCTION advance_expired_auction_offers() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION advance_expired_auction_offers() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION admin_cancel_auction(p_auction_id uuid, p_reason text)
RETURNS auctions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction auctions%ROWTYPE;
BEGIN
  IF NOT auction_current_user_is_admin() THEN
    RAISE EXCEPTION 'Admin role required' USING ERRCODE = '42501';
  END IF;

  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'Cancellation reason is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found' USING ERRCODE = 'P0002';
  END IF;

  IF EXISTS (
    SELECT 1 FROM auction_payments
    WHERE auction_id = p_auction_id AND status = 'captured'
  ) THEN
    RAISE EXCEPTION 'A captured auction must be refunded before it can be removed'
      USING ERRCODE = '55000';
  END IF;

  IF EXISTS (
    SELECT 1 FROM auction_payments
    WHERE auction_id = p_auction_id AND status IN ('approved', 'review_required')
  ) THEN
    RAISE EXCEPTION 'This auction has a payment capture in progress or awaiting manual review'
      USING ERRCODE = '55000';
  END IF;

  UPDATE auctions SET
    status = 'cancelled_by_admin',
    cancellation_reason = btrim(p_reason),
    removed_at = clock_timestamp(),
    updated_at = clock_timestamp(),
    version = version + 1
  WHERE id = p_auction_id
  RETURNING * INTO v_auction;

  UPDATE auction_winner_offers
  SET status = 'cancelled', responded_at = clock_timestamp()
  WHERE auction_id = p_auction_id AND status IN ('offered', 'payment_started');

  UPDATE products
  SET status = 'pending', updated_at = clock_timestamp()
  WHERE id = v_auction.product_id;

  UPDATE orders
  SET status = 'cancelled', refunded_at = clock_timestamp(), updated_at = clock_timestamp()
  WHERE auction_id = p_auction_id
    AND EXISTS (
      SELECT 1 FROM auction_payments p
      WHERE p.auction_id = p_auction_id AND p.status = 'refunded'
    );

  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT DISTINCT
    recipient,
    'auction_cancelled',
    'Auction cancelled',
    'The auction "' || v_auction.title || '" was removed by an administrator.',
    jsonb_build_object('auction_id', p_auction_id, 'product_id', v_auction.product_id, 'reason', btrim(p_reason))
  FROM (
    SELECT seller_id AS recipient FROM auctions WHERE id = p_auction_id
    UNION
    SELECT bidder_id FROM auction_bids WHERE auction_id = p_auction_id
  ) recipients;

  INSERT INTO auction_events (auction_id, actor_id, event_type, data)
  VALUES (
    p_auction_id,
    auth.uid(),
    'cancelled_by_admin',
    jsonb_build_object('reason', btrim(p_reason))
  );

  RETURN v_auction;
END;
$$;

REVOKE ALL ON FUNCTION admin_cancel_auction(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_cancel_auction(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION set_auction_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auctions_updated_at ON auctions;
CREATE TRIGGER trigger_auctions_updated_at
  BEFORE UPDATE ON auctions
  FOR EACH ROW EXECUTE FUNCTION set_auction_updated_at();

DROP TRIGGER IF EXISTS trigger_auction_payments_updated_at ON auction_payments;
CREATE TRIGGER trigger_auction_payments_updated_at
  BEFORE UPDATE ON auction_payments
  FOR EACH ROW EXECUTE FUNCTION set_auction_updated_at();

CREATE OR REPLACE FUNCTION publish_ai_approved_auction(
  p_auction_id uuid,
  p_images jsonb,
  p_publication_status text,
  p_risk_score numeric,
  p_reason text,
  p_model text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction auctions%ROWTYPE;
  v_product_id uuid;
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  IF p_publication_status NOT IN ('scheduled', 'active') THEN
    RAISE EXCEPTION 'Invalid auction publication status' USING ERRCODE = '22023';
  END IF;

  IF jsonb_typeof(COALESCE(p_images, '[]'::jsonb)) <> 'array'
    OR jsonb_array_length(COALESCE(p_images, '[]'::jsonb)) < 1 THEN
    RAISE EXCEPTION 'At least one public product image is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_auction
  FROM auctions
  WHERE id = p_auction_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_auction.status <> 'pending_ai_review' THEN
    IF v_auction.ai_moderation_status = 'approved' AND v_auction.product_id IS NOT NULL THEN
      RETURN v_auction.product_id;
    END IF;
    RAISE EXCEPTION 'Auction is not awaiting AI review' USING ERRCODE = '55000';
  END IF;

  v_product_id := v_auction.product_id;
  IF v_product_id IS NULL THEN
    INSERT INTO products (
      title, description, price, original_price, condition, category_id,
      image_url, images, status, seller_id, listing_type, submission_type
    ) VALUES (
      v_auction.title,
      v_auction.description,
      v_auction.starting_price,
      v_auction.original_price,
      v_auction.condition,
      v_auction.category_id,
      COALESCE(p_images->>0, ''),
      p_images,
      'available',
      v_auction.seller_id,
      'auction',
      v_auction.submission_type
    )
    RETURNING id INTO v_product_id;
  ELSE
    UPDATE products SET
      title = v_auction.title,
      description = v_auction.description,
      price = v_auction.starting_price,
      original_price = v_auction.original_price,
      condition = v_auction.condition,
      category_id = v_auction.category_id,
      image_url = COALESCE(p_images->>0, ''),
      images = p_images,
      status = 'available',
      seller_id = v_auction.seller_id,
      listing_type = 'auction',
      submission_type = v_auction.submission_type,
      updated_at = clock_timestamp()
    WHERE id = v_product_id;
  END IF;

  UPDATE auctions SET
    product_id = v_product_id,
    images = p_images,
    review_image_paths = '[]'::jsonb,
    status = p_publication_status,
    ai_moderation_status = 'approved',
    ai_risk_score = p_risk_score,
    ai_moderation_reason = p_reason,
    ai_model = p_model,
    moderated_at = clock_timestamp(),
    version = version + 1
  WHERE id = p_auction_id;

  RETURN v_product_id;
END;
$$;

REVOKE ALL ON FUNCTION publish_ai_approved_auction(uuid, jsonb, text, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION publish_ai_approved_auction(uuid, jsonb, text, numeric, text, text) TO service_role;

-- Quarantine bucket: only the owner and service role can read pending images.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'auction-review-images',
  'auction-review-images',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Auction owners upload review images" ON storage.objects;
CREATE POLICY "Auction owners upload review images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'auction-review-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Auction owners read review images" ON storage.objects;
CREATE POLICY "Auction owners read review images"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'auction-review-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Auction owners delete review images" ON storage.objects;
CREATE POLICY "Auction owners delete review images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'auction-review-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

COMMENT ON TABLE auctions IS 'AI-moderated auction listings. Publication is performed only by the moderation service.';
COMMENT ON FUNCTION place_auction_bid(uuid, numeric, uuid) IS 'Atomically validates and records a bid using a row lock and server time.';
COMMENT ON FUNCTION admin_cancel_auction(uuid, text) IS 'Soft-removes any auction while preserving its bids, payments, and audit trail.';
COMMENT ON FUNCTION publish_ai_approved_auction(uuid, jsonb, text, numeric, text, text) IS 'Atomically publishes an AI-approved auction and its marketplace product.';

CREATE OR REPLACE FUNCTION prepare_auction_payment(p_winner_offer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_offer auction_winner_offers%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_payment auction_payments%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_offer
  FROM auction_winner_offers
  WHERE id = p_winner_offer_id
  FOR UPDATE;

  IF NOT FOUND OR v_offer.bidder_id <> v_user_id THEN
    RAISE EXCEPTION 'Winner offer not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_offer.status NOT IN ('offered', 'payment_started') OR v_offer.expires_at <= v_now THEN
    RAISE EXCEPTION 'Winner payment offer is no longer active' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO STRICT v_auction
  FROM auctions
  WHERE id = v_offer.auction_id
  FOR UPDATE;

  IF v_auction.status <> 'awaiting_payment' OR v_auction.winner_id <> v_user_id THEN
    RAISE EXCEPTION 'Auction is not awaiting this winner payment' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_payment
  FROM auction_payments
  WHERE winner_offer_id = v_offer.id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO auction_payments (
      auction_id,
      winner_offer_id,
      user_id,
      item_amount,
      shipping_amount,
      total_amount
    ) VALUES (
      v_auction.id,
      v_offer.id,
      v_user_id,
      v_offer.amount,
      v_auction.shipping_cost,
      v_offer.amount + v_auction.shipping_cost
    )
    RETURNING * INTO v_payment;
  ELSIF v_payment.status = 'captured' THEN
    RETURN jsonb_build_object(
      'payment_id', v_payment.id,
      'auction_id', v_auction.id,
      'already_paid', true,
      'total_amount', v_payment.total_amount,
      'currency', v_payment.currency
    );
  ELSIF v_payment.status = 'review_required' THEN
    RAISE EXCEPTION 'Payment requires manual reconciliation before it can be retried'
      USING ERRCODE = '55000';
  ELSIF v_payment.status NOT IN ('created', 'approved') THEN
    RAISE EXCEPTION 'Payment is not available for checkout' USING ERRCODE = '55000';
  END IF;

  UPDATE auction_winner_offers
  SET status = 'payment_started', responded_at = COALESCE(responded_at, v_now)
  WHERE id = v_offer.id;

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'auction_id', v_auction.id,
    'offer_id', v_offer.id,
    'title', v_auction.title,
    'item_amount', v_payment.item_amount,
    'shipping_amount', v_payment.shipping_amount,
    'total_amount', v_payment.total_amount,
    'currency', v_payment.currency,
    'already_paid', false
  );
END;
$$;

REVOKE ALL ON FUNCTION prepare_auction_payment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION prepare_auction_payment(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION claim_auction_payment_capture(p_payment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment auction_payments%ROWTYPE;
  v_offer auction_winner_offers%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payment
  FROM auction_payments
  WHERE id = p_payment_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status = 'captured' THEN
    RETURN jsonb_build_object('already_captured', true);
  END IF;

  IF v_payment.status = 'review_required' THEN
    RAISE EXCEPTION 'Payment requires manual reconciliation' USING ERRCODE = '55000';
  END IF;

  IF v_payment.status NOT IN ('created', 'approved') THEN
    RAISE EXCEPTION 'Payment is not ready to capture' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO STRICT v_offer
  FROM auction_winner_offers
  WHERE id = v_payment.winner_offer_id
  FOR UPDATE;

  SELECT * INTO STRICT v_auction
  FROM auctions
  WHERE id = v_payment.auction_id
  FOR UPDATE;

  IF v_offer.status NOT IN ('offered', 'payment_started')
    OR v_offer.expires_at <= v_now
    OR v_auction.status <> 'awaiting_payment'
    OR v_auction.winner_id <> v_payment.user_id THEN
    RAISE EXCEPTION 'Winner payment offer is no longer payable' USING ERRCODE = '55000';
  END IF;

  UPDATE auction_payments
  SET status = 'approved', failure_reason = NULL, updated_at = v_now
  WHERE id = v_payment.id;

  RETURN jsonb_build_object('already_captured', false, 'capture_claimed_at', v_now);
END;
$$;

REVOKE ALL ON FUNCTION claim_auction_payment_capture(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_auction_payment_capture(uuid) TO service_role;

CREATE OR REPLACE FUNCTION finalize_auction_payment(
  p_payment_id uuid,
  p_provider_order_id text,
  p_provider_capture_id text,
  p_provider_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment auction_payments%ROWTYPE;
  v_offer auction_winner_offers%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_order_id uuid;
  v_product_id uuid;
  v_provider_order jsonb;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payment
  FROM auction_payments
  WHERE id = p_payment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status = 'captured' THEN
    SELECT id INTO v_order_id FROM orders WHERE auction_id = v_payment.auction_id;
    RETURN jsonb_build_object(
      'payment_id', v_payment.id,
      'order_id', v_order_id,
      'already_captured', true
    );
  END IF;

  IF v_payment.status <> 'approved' THEN
    RAISE EXCEPTION 'Payment capture was not claimed' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO STRICT v_offer
  FROM auction_winner_offers
  WHERE id = v_payment.winner_offer_id
  FOR UPDATE;

  SELECT * INTO STRICT v_auction
  FROM auctions
  WHERE id = v_payment.auction_id
  FOR UPDATE;

  IF v_offer.bidder_id <> v_payment.user_id OR v_offer.status NOT IN ('offered', 'payment_started') THEN
    RAISE EXCEPTION 'Winner offer is not payable' USING ERRCODE = '55000';
  END IF;

  v_provider_order := CASE
    WHEN COALESCE(p_provider_payload, '{}'::jsonb) ? 'order'
      THEN p_provider_payload->'order'
    ELSE COALESCE(p_provider_payload, '{}'::jsonb)
  END;

  UPDATE auction_payments SET
    provider_order_id = p_provider_order_id,
    provider_capture_id = p_provider_capture_id,
    provider_payload = COALESCE(p_provider_payload, '{}'::jsonb),
    status = 'captured',
    completed_at = v_now,
    updated_at = v_now
  WHERE id = v_payment.id;

  UPDATE auction_winner_offers SET
    status = 'paid',
    responded_at = v_now
  WHERE id = v_offer.id;

  UPDATE auctions SET
    status = 'paid',
    winner_id = v_payment.user_id,
    payment_due_at = NULL,
    version = version + 1,
    updated_at = v_now
  WHERE id = v_auction.id;

  v_product_id := v_auction.product_id;
  IF v_product_id IS NULL THEN
    INSERT INTO products (
      title,
      description,
      price,
      condition,
      category_id,
      image_url,
      images,
      status,
      seller_id,
      listing_type,
      submission_type
    ) VALUES (
      v_auction.title,
      v_auction.description,
      v_payment.item_amount,
      v_auction.condition,
      v_auction.category_id,
      COALESCE(v_auction.images->>0, ''),
      v_auction.images,
      'sold',
      v_auction.seller_id,
      'auction',
      v_auction.submission_type
    )
    RETURNING id INTO v_product_id;

    UPDATE auctions SET product_id = v_product_id WHERE id = v_auction.id;
  ELSE
    UPDATE products SET status = 'sold', updated_at = v_now
    WHERE id = v_product_id;
  END IF;

  SELECT id INTO v_order_id FROM orders WHERE auction_id = v_auction.id;
  IF v_order_id IS NULL THEN
    INSERT INTO orders (
      user_id,
      total_amount,
      status,
      payment_status,
      shipping_address,
      shipping_city,
      shipping_postal_code,
      shipping_country,
      seller_id,
      auction_id,
      order_type,
      payment_due_at
    ) VALUES (
      v_payment.user_id,
      v_payment.total_amount,
      'processing',
      'paid',
      btrim(concat_ws(' ',
        v_provider_order #>> '{purchase_units,0,shipping,address,address_line_1}',
        v_provider_order #>> '{purchase_units,0,shipping,address,address_line_2}'
      )),
      COALESCE(v_provider_order #>> '{purchase_units,0,shipping,address,admin_area_2}', ''),
      COALESCE(v_provider_order #>> '{purchase_units,0,shipping,address,postal_code}', ''),
      COALESCE(v_provider_order #>> '{purchase_units,0,shipping,address,country_code}', ''),
      v_auction.seller_id,
      v_auction.id,
      'auction',
      NULL
    )
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (
      order_id,
      product_id,
      quantity,
      price,
      seller_id,
      auction_id
    ) VALUES (
      v_order_id,
      v_product_id,
      1,
      v_payment.item_amount,
      v_auction.seller_id,
      v_auction.id
    );
  END IF;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES
    (
      v_payment.user_id,
      'auction_payment_completed',
      'Auction payment completed',
      'Your payment for "' || v_auction.title || '" was completed successfully.',
      jsonb_build_object('auction_id', v_auction.id, 'order_id', v_order_id)
    ),
    (
      v_auction.seller_id,
      'auction_sold',
      'Your auction was paid',
      'The winner completed payment for "' || v_auction.title || '".',
      jsonb_build_object('auction_id', v_auction.id, 'order_id', v_order_id)
    );

  INSERT INTO auction_events (auction_id, actor_id, event_type, data)
  VALUES (
    v_auction.id,
    v_payment.user_id,
    'payment_captured',
    jsonb_build_object(
      'payment_id', v_payment.id,
      'order_id', v_order_id,
      'provider_capture_id', p_provider_capture_id,
      'total_amount', v_payment.total_amount
    )
  );

  RETURN jsonb_build_object(
    'payment_id', v_payment.id,
    'order_id', v_order_id,
    'auction_id', v_auction.id,
    'already_captured', false
  );
END;
$$;

REVOKE ALL ON FUNCTION finalize_auction_payment(uuid, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION finalize_auction_payment(uuid, text, text, jsonb) TO service_role;
