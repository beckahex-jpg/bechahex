/*
  Seller-initiated auction cancellation, modelled on eBay's early-ending rules.

  Rules enforced server-side (the "12-hour rule"):
    - No bids yet                        -> cancel any time.
    - Bids + 12h or more remaining       -> cancel allowed; every bid is voided
                                            and all bidders are notified.
    - Bids + under 12h remaining         -> outright cancellation refused; the
                                            seller may only end early by selling
                                            to the current highest bidder.
    - "Sell to highest bidder" ends the auction immediately and reuses the
      standard close flow (winner offer, payment window, notifications).

  Also hardens admin_cancel_auction: an auction with an active Stripe card
  hold ('authorized') can no longer be cancelled before the hold is released,
  closing the dangling-hold gap in the removal path.
*/

ALTER TABLE auctions DROP CONSTRAINT IF EXISTS auctions_status_check;
ALTER TABLE auctions ADD CONSTRAINT auctions_status_check
  CHECK (status IN (
    'draft',
    'pending_ai_review',
    'scheduled',
    'active',
    'blocked',
    'awaiting_payment',
    'paid',
    'ended_no_bids',
    'cancelled_by_admin',
    'cancelled_by_seller',
    'closed'
  ));

CREATE OR REPLACE FUNCTION seller_cancel_auction(
  p_auction_id uuid,
  p_reason text,
  p_mode text DEFAULT 'cancel'
)
RETURNS auctions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auction auctions%ROWTYPE;
  v_user uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_mode NOT IN ('cancel', 'sell_to_highest') THEN
    RAISE EXCEPTION 'Unknown cancellation mode' USING ERRCODE = '22023';
  END IF;

  IF p_reason IS NULL OR char_length(btrim(p_reason)) < 3 THEN
    RAISE EXCEPTION 'A cancellation reason of at least 3 characters is required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_auction.seller_id <> v_user THEN
    RAISE EXCEPTION 'Only the seller can end their own auction' USING ERRCODE = '42501';
  END IF;

  IF v_auction.removed_at IS NOT NULL
    OR v_auction.status IN ('cancelled_by_admin', 'cancelled_by_seller') THEN
    RAISE EXCEPTION 'This auction is already cancelled' USING ERRCODE = '55000';
  END IF;

  IF v_auction.status NOT IN ('draft', 'pending_ai_review', 'scheduled', 'active', 'blocked') THEN
    RAISE EXCEPTION 'This auction has already ended and can no longer be cancelled' USING ERRCODE = '55000';
  END IF;

  IF p_mode = 'sell_to_highest' THEN
    IF v_auction.status <> 'active' OR v_auction.highest_bid_id IS NULL THEN
      RAISE EXCEPTION 'There is no bid to sell to yet' USING ERRCODE = '55000';
    END IF;

    -- End the auction now and reuse the standard close flow so the winner
    -- offer, payment window, and notifications behave exactly like a natural
    -- ending. The scheduler flag only lives for this transaction. The reason
    -- is recorded on the event, not the row: this auction is sold, not
    -- cancelled.
    UPDATE auctions SET
      ends_at = v_now,
      updated_at = v_now,
      version = version + 1
    WHERE id = p_auction_id;

    INSERT INTO auction_events (auction_id, actor_id, event_type, data)
    VALUES (
      p_auction_id,
      v_user,
      'ended_early_by_seller',
      jsonb_build_object('reason', btrim(p_reason), 'mode', 'sell_to_highest')
    );

    PERFORM set_config('app.auction_scheduler', 'on', true);
    PERFORM close_expired_auctions(p_auction_id);

    SELECT * INTO v_auction FROM auctions WHERE id = p_auction_id;
    RETURN v_auction;
  END IF;

  -- p_mode = 'cancel'
  IF v_auction.highest_bid_id IS NOT NULL THEN
    IF v_auction.ends_at - v_now < interval '12 hours' THEN
      RAISE EXCEPTION 'Auctions with bids cannot be cancelled in their final 12 hours; you can only end early by selling to the highest bidder'
        USING ERRCODE = '55000';
    END IF;

    UPDATE auction_bids SET status = 'invalidated'
    WHERE auction_id = p_auction_id AND status = 'accepted';

    UPDATE auction_auto_bids SET status = 'cancelled', updated_at = v_now
    WHERE auction_id = p_auction_id AND status = 'active';

    INSERT INTO notifications (user_id, type, title, message, data)
    SELECT DISTINCT
      b.bidder_id,
      'auction_cancelled',
      'Auction cancelled by the seller',
      'The auction "' || v_auction.title || '" was cancelled by the seller. Your bids on it no longer stand and nothing will be charged.',
      jsonb_build_object(
        'auction_id', p_auction_id,
        'product_id', v_auction.product_id,
        'reason', btrim(p_reason)
      )
    FROM auction_bids b
    WHERE b.auction_id = p_auction_id;
  END IF;

  UPDATE auctions SET
    status = 'cancelled_by_seller',
    cancellation_reason = btrim(p_reason),
    removed_at = v_now,
    updated_at = v_now,
    version = version + 1
  WHERE id = p_auction_id
  RETURNING * INTO v_auction;

  -- Bids mirrored the top bid into products.price; reset it so the returned
  -- product carries the seller's own price again, detached from auction flows.
  UPDATE products
  SET status = 'pending',
      price = v_auction.starting_price,
      listing_type = 'fixed_price',
      updated_at = v_now
  WHERE id = v_auction.product_id;

  INSERT INTO auction_events (auction_id, actor_id, event_type, data)
  VALUES (
    p_auction_id,
    v_user,
    'cancelled_by_seller',
    jsonb_build_object('reason', btrim(p_reason), 'had_bids', v_auction.bid_count > 0)
  );

  RETURN v_auction;
END;
$$;

REVOKE ALL ON FUNCTION seller_cancel_auction(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION seller_cancel_auction(uuid, text, text) TO authenticated;

/* Same body as 20260702090000, plus the 'authorized' hold guard: a live
   Stripe card hold must be voided (remove-auction does this) before the
   auction row can be cancelled, so holds can never be orphaned. */
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
    WHERE auction_id = p_auction_id AND status = 'authorized'
  ) THEN
    RAISE EXCEPTION 'This auction has an active card hold that must be released first'
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
  SET status = 'pending',
      price = v_auction.starting_price,
      listing_type = 'fixed_price',
      updated_at = clock_timestamp()
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

/* Keep cancelled auctions visible to the people who bid on them: without
   this, a cancellation makes the row vanish from bidders' "My bids" tab and
   from any open auction page (the public SELECT policy excludes cancelled
   statuses). Policies are OR'd, so this adds visibility without exposing
   cancelled auctions publicly. */
DROP POLICY IF EXISTS "Bidders read auctions they bid on" ON auctions;
CREATE POLICY "Bidders read auctions they bid on"
  ON auctions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auction_bids b
      WHERE b.auction_id = auctions.id AND b.bidder_id = auth.uid()
    )
  );

/* Re-create cancel_stripe_authorization with a relist switch. The hourly
   maintenance void keeps the old behavior (relist the product, close the
   auction). Admin removal passes p_relist=false so the item is never left
   publicly purchasable in the window between the hold release and
   admin_cancel_auction taking the auction down. The 2-arg overload must be
   dropped or PostgREST RPC calls would become ambiguous. */
DROP FUNCTION IF EXISTS cancel_stripe_authorization(uuid, text);

CREATE OR REPLACE FUNCTION cancel_stripe_authorization(
  p_payment_id uuid,
  p_reason text,
  p_relist boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment auction_payments%ROWTYPE;
  v_auction auctions%ROWTYPE;
  v_order orders%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payment FROM auction_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status = 'cancelled' THEN
    RETURN jsonb_build_object('payment_id', v_payment.id, 'already', true);
  END IF;

  IF v_payment.status <> 'authorized' THEN
    RAISE EXCEPTION 'Only a payment on hold can be released' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO STRICT v_auction FROM auctions WHERE id = v_payment.auction_id FOR UPDATE;

  UPDATE auction_payments SET
    status = 'cancelled',
    failure_reason = left(COALESCE(p_reason, 'Authorization released'), 500),
    updated_at = v_now
  WHERE id = v_payment.id;

  SELECT * INTO v_order FROM orders WHERE auction_id = v_auction.id FOR UPDATE;
  IF FOUND THEN
    UPDATE orders SET status = 'cancelled', payment_status = 'failed'
    WHERE id = v_order.id;
  END IF;

  UPDATE auction_winner_offers SET status = 'cancelled', responded_at = v_now
  WHERE id = v_payment.winner_offer_id;

  IF p_relist THEN
    UPDATE auctions SET
      status = 'closed',
      cancellation_reason = left(COALESCE(p_reason, 'Payment hold released'), 500),
      version = version + 1,
      updated_at = v_now
    WHERE id = v_auction.id;

    IF v_auction.product_id IS NOT NULL THEN
      UPDATE products SET status = 'available', updated_at = v_now WHERE id = v_auction.product_id;
    END IF;
  END IF;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_payment.user_id,
    'auction_hold_released',
    'Payment hold released',
    'The hold on your payment for "' || v_auction.title || '" was released — you have not been charged. Reason: ' || COALESCE(p_reason, 'sale cancelled'),
    jsonb_build_object('auction_id', v_auction.id)
  );

  IF p_relist THEN
    INSERT INTO notifications (user_id, type, title, message, data)
    VALUES (
      v_auction.seller_id,
      'auction_sale_cancelled',
      'Auction sale cancelled',
      'The sale of "' || v_auction.title || '" was cancelled and the buyer''s hold was released. Reason: ' || COALESCE(p_reason, 'not shipped in time'),
      jsonb_build_object('auction_id', v_auction.id)
    );
  END IF;

  INSERT INTO auction_events (auction_id, actor_id, event_type, data)
  VALUES (v_auction.id, v_payment.user_id, 'payment_authorization_cancelled',
    jsonb_build_object('payment_id', v_payment.id, 'reason', p_reason));

  RETURN jsonb_build_object('payment_id', v_payment.id, 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION cancel_stripe_authorization(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_stripe_authorization(uuid, text, boolean) TO service_role;

/* Cancelled auctions hand their product back as a 'pending' fixed-price
   listing, which used to slip past the auction-only cart guard. Harden the
   guard: nothing that is not publicly for sale can enter a cart. (order_items
   stays as-is — the auction payment finalizer legitimately inserts items for
   products already marked 'sold'.) */
CREATE OR REPLACE FUNCTION prevent_auction_cart_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing text;
  v_status text;
BEGIN
  SELECT listing_type, status INTO v_listing, v_status FROM products WHERE id = NEW.product_id;
  IF v_listing = 'auction' THEN
    RAISE EXCEPTION 'Auction items cannot be added to the cart. Place a bid instead.'
      USING ERRCODE = '42501';
  END IF;
  IF v_status IS DISTINCT FROM 'available' THEN
    RAISE EXCEPTION 'This item is not available for purchase.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
