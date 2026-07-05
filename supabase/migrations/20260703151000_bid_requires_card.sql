/* Server-side enforcement of the card-on-file gate: both bid paths refuse
   users without an active saved payment method. Bodies are otherwise
   identical to 20260702094000_auction_auto_bids.sql. */

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

  IF NOT has_active_payment_method(v_user_id) THEN
    RAISE EXCEPTION 'A saved payment method is required before bidding' USING ERRCODE = '55000';
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

  UPDATE auction_auto_bids
  SET max_amount = GREATEST(max_amount, v_bid.amount), updated_at = v_now
  WHERE auction_id = p_auction_id AND bidder_id = v_user_id AND status = 'active';

  PERFORM resolve_auction_auto_bids(p_auction_id);

  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id;

  RETURN jsonb_build_object(
    'bid_id', v_bid.id,
    'auction_id', p_auction_id,
    'amount', v_bid.amount,
    'current_price', v_auction.current_price,
    'bid_count', v_auction.bid_count,
    'is_leading', v_auction.highest_bidder_id = v_user_id,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION place_auction_bid(uuid, numeric, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION place_auction_bid(uuid, numeric, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION set_auction_auto_bid(
  p_auction_id uuid,
  p_max_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_auction auctions%ROWTYPE;
  v_existing auction_auto_bids%ROWTYPE;
  v_next numeric(12,2);
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF NOT has_active_payment_method(v_user_id) THEN
    RAISE EXCEPTION 'A saved payment method is required before bidding' USING ERRCODE = '55000';
  END IF;

  IF p_max_amount IS NULL OR round(p_max_amount, 2) <> p_max_amount OR p_max_amount <= 0 THEN
    RAISE EXCEPTION 'Maximum amount must be a valid USD amount' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;

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

  SELECT * INTO v_existing
  FROM auction_auto_bids
  WHERE auction_id = p_auction_id AND bidder_id = v_user_id
  FOR UPDATE;

  IF FOUND AND v_existing.status = 'active' AND p_max_amount < v_existing.max_amount THEN
    RAISE EXCEPTION 'You can only raise your active maximum (currently % USD)', v_existing.max_amount USING ERRCODE = '22023';
  END IF;

  v_next := CASE
    WHEN v_auction.bid_count = 0 THEN v_auction.starting_price
    ELSE v_auction.current_price + v_auction.minimum_bid_increment
  END;

  IF v_auction.highest_bidder_id = v_user_id THEN
    IF p_max_amount < v_auction.current_price THEN
      RAISE EXCEPTION 'Your maximum cannot be below your current highest bid of % USD', v_auction.current_price USING ERRCODE = '22023';
    END IF;
  ELSIF p_max_amount < v_next THEN
    RAISE EXCEPTION 'Your maximum must be at least % USD', v_next USING ERRCODE = '22023';
  END IF;

  INSERT INTO auction_auto_bids (auction_id, bidder_id, max_amount, status, created_at, updated_at)
  VALUES (p_auction_id, v_user_id, p_max_amount, 'active', v_now, v_now)
  ON CONFLICT (auction_id, bidder_id) DO UPDATE SET
    max_amount = EXCLUDED.max_amount,
    status = 'active',
    updated_at = v_now,
    created_at = CASE
      WHEN auction_auto_bids.status = 'active' THEN auction_auto_bids.created_at
      ELSE v_now
    END;

  PERFORM resolve_auction_auto_bids(p_auction_id);

  RETURN jsonb_build_object(
    'max_amount', p_max_amount,
    'status', (SELECT status FROM auction_auto_bids WHERE auction_id = p_auction_id AND bidder_id = v_user_id),
    'is_leading', (SELECT highest_bidder_id = v_user_id FROM auctions WHERE id = p_auction_id),
    'current_price', (SELECT current_price FROM auctions WHERE id = p_auction_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION set_auction_auto_bid(uuid, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_auction_auto_bid(uuid, numeric) TO authenticated;
