/*
  Stripe hold-then-capture payments for auction winners.

  Flow: winner confirms a manual-capture PaymentIntent (funds held on their
  card) -> record_stripe_authorization creates the order so the seller can
  ship -> shipping triggers capture (record_stripe_capture) -> if the seller
  never ships, the hold is voided (cancel_stripe_authorization). An hourly
  maintenance tick warns idle sellers on day 4 and voids on day ~5.5, well
  inside Stripe's 7-day hold window.
*/

ALTER TABLE auction_payments DROP CONSTRAINT IF EXISTS auction_payments_provider_check;
ALTER TABLE auction_payments ADD CONSTRAINT auction_payments_provider_check
  CHECK (provider IN ('paypal', 'stripe'));

ALTER TABLE auction_payments DROP CONSTRAINT IF EXISTS auction_payments_status_check;
ALTER TABLE auction_payments ADD CONSTRAINT auction_payments_status_check
  CHECK (status IN ('created', 'approved', 'authorized', 'captured', 'review_required', 'failed', 'cancelled', 'refunded'));

/* Hold placed: lock in the sale and create the order so the seller can
   ship. Money is NOT taken yet — auction_payments.status='authorized' is
   the source of truth for the real money state. */
CREATE OR REPLACE FUNCTION record_stripe_authorization(
  p_payment_id uuid,
  p_provider_order_id text,
  p_payload jsonb
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
  v_now timestamptz := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payment FROM auction_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status IN ('authorized', 'captured') THEN
    SELECT id INTO v_order_id FROM orders WHERE auction_id = v_payment.auction_id;
    RETURN jsonb_build_object('payment_id', v_payment.id, 'order_id', v_order_id, 'already', true);
  END IF;

  IF v_payment.status NOT IN ('created', 'approved') THEN
    RAISE EXCEPTION 'Payment is not awaiting authorization' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO STRICT v_offer FROM auction_winner_offers WHERE id = v_payment.winner_offer_id FOR UPDATE;
  SELECT * INTO STRICT v_auction FROM auctions WHERE id = v_payment.auction_id FOR UPDATE;

  IF v_offer.bidder_id <> v_payment.user_id OR v_offer.status NOT IN ('offered', 'payment_started') THEN
    RAISE EXCEPTION 'Winner offer is not payable' USING ERRCODE = '55000';
  END IF;

  UPDATE auction_payments SET
    provider = 'stripe',
    provider_order_id = p_provider_order_id,
    provider_payload = COALESCE(p_payload, '{}'::jsonb),
    status = 'authorized',
    updated_at = v_now
  WHERE id = v_payment.id;

  UPDATE auction_winner_offers SET status = 'paid', responded_at = v_now
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
    INSERT INTO products (title, description, price, condition, category_id, image_url, images, status, seller_id, listing_type, submission_type)
    VALUES (
      v_auction.title, v_auction.description, v_payment.item_amount, v_auction.condition,
      v_auction.category_id, COALESCE(v_auction.images->>0, ''), v_auction.images,
      'sold', v_auction.seller_id, 'auction', v_auction.submission_type
    )
    RETURNING id INTO v_product_id;
    UPDATE auctions SET product_id = v_product_id WHERE id = v_auction.id;
  ELSE
    UPDATE products SET status = 'sold', updated_at = v_now WHERE id = v_product_id;
  END IF;

  SELECT id INTO v_order_id FROM orders WHERE auction_id = v_auction.id;
  IF v_order_id IS NULL THEN
    INSERT INTO orders (
      user_id, total_amount, status, payment_status,
      shipping_address, shipping_city, shipping_postal_code, shipping_country,
      seller_id, auction_id, order_type, payment_due_at
    ) VALUES (
      v_payment.user_id,
      v_payment.total_amount,
      'processing',
      'paid',
      btrim(concat_ws(' ',
        p_payload #>> '{shipping,name}',
        p_payload #>> '{shipping,address,line1}',
        p_payload #>> '{shipping,address,line2}'
      )),
      COALESCE(p_payload #>> '{shipping,address,city}', ''),
      COALESCE(p_payload #>> '{shipping,address,postal_code}', ''),
      COALESCE(p_payload #>> '{shipping,address,country}', ''),
      v_auction.seller_id,
      v_auction.id,
      'auction',
      NULL
    )
    RETURNING id INTO v_order_id;

    INSERT INTO order_items (order_id, product_id, quantity, price, seller_id, auction_id)
    VALUES (v_order_id, v_product_id, 1, v_payment.item_amount, v_auction.seller_id, v_auction.id);
  END IF;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES
    (
      v_payment.user_id,
      'auction_payment_authorized',
      'Payment hold placed',
      'Your payment for "' || v_auction.title || '" is on hold. It will only be charged when the seller ships your item.',
      jsonb_build_object('auction_id', v_auction.id, 'order_id', v_order_id)
    ),
    (
      v_auction.seller_id,
      'auction_sold',
      'Your auction was sold — ship now',
      'The winner''s payment for "' || v_auction.title || '" is secured on hold. Add shipping details to receive the funds.',
      jsonb_build_object('auction_id', v_auction.id, 'order_id', v_order_id)
    );

  INSERT INTO auction_events (auction_id, actor_id, event_type, data)
  VALUES (v_auction.id, v_payment.user_id, 'payment_authorized',
    jsonb_build_object('payment_id', v_payment.id, 'order_id', v_order_id, 'provider_order_id', p_provider_order_id, 'total_amount', v_payment.total_amount));

  RETURN jsonb_build_object('payment_id', v_payment.id, 'order_id', v_order_id, 'auction_id', v_auction.id, 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION record_stripe_authorization(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_stripe_authorization(uuid, text, jsonb) TO service_role;

/* Funds actually taken (at shipping time, or by the webhook safety net). */
CREATE OR REPLACE FUNCTION record_stripe_capture(
  p_payment_id uuid,
  p_capture_id text,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment auction_payments%ROWTYPE;
  v_now timestamptz := clock_timestamp();
BEGIN
  IF COALESCE(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_payment FROM auction_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found' USING ERRCODE = 'P0002';
  END IF;

  IF v_payment.status = 'captured' THEN
    RETURN jsonb_build_object('payment_id', v_payment.id, 'already', true);
  END IF;

  IF v_payment.status <> 'authorized' THEN
    RAISE EXCEPTION 'Payment is not on hold' USING ERRCODE = '55000';
  END IF;

  UPDATE auction_payments SET
    status = 'captured',
    provider_capture_id = COALESCE(p_capture_id, provider_capture_id),
    provider_payload = COALESCE(p_payload, provider_payload),
    completed_at = v_now,
    updated_at = v_now
  WHERE id = v_payment.id;

  INSERT INTO auction_events (auction_id, actor_id, event_type, data)
  VALUES (v_payment.auction_id, v_payment.user_id, 'payment_captured',
    jsonb_build_object('payment_id', v_payment.id, 'provider_capture_id', p_capture_id, 'total_amount', v_payment.total_amount));

  RETURN jsonb_build_object('payment_id', v_payment.id, 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION record_stripe_capture(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION record_stripe_capture(uuid, text, jsonb) TO service_role;

/* Hold released without charging: unwind the sale. */
CREATE OR REPLACE FUNCTION cancel_stripe_authorization(
  p_payment_id uuid,
  p_reason text
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

  UPDATE auctions SET
    status = 'closed',
    cancellation_reason = left(COALESCE(p_reason, 'Payment hold released'), 500),
    version = version + 1,
    updated_at = v_now
  WHERE id = v_auction.id;

  IF v_auction.product_id IS NOT NULL THEN
    UPDATE products SET status = 'available', updated_at = v_now WHERE id = v_auction.product_id;
  END IF;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES
    (
      v_payment.user_id,
      'auction_hold_released',
      'Payment hold released',
      'The hold on your payment for "' || v_auction.title || '" was released — you have not been charged. Reason: ' || COALESCE(p_reason, 'sale cancelled'),
      jsonb_build_object('auction_id', v_auction.id)
    ),
    (
      v_auction.seller_id,
      'auction_sale_cancelled',
      'Auction sale cancelled',
      'The sale of "' || v_auction.title || '" was cancelled and the buyer''s hold was released. Reason: ' || COALESCE(p_reason, 'not shipped in time'),
      jsonb_build_object('auction_id', v_auction.id)
    );

  INSERT INTO auction_events (auction_id, actor_id, event_type, data)
  VALUES (v_auction.id, v_payment.user_id, 'payment_authorization_cancelled',
    jsonb_build_object('payment_id', v_payment.id, 'reason', p_reason));

  RETURN jsonb_build_object('payment_id', v_payment.id, 'already', false);
END;
$$;

REVOKE ALL ON FUNCTION cancel_stripe_authorization(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION cancel_stripe_authorization(uuid, text) TO service_role;

/* Hourly maintenance: same pg_net dispatch pattern as the notification
   emails — calls the stripe-auction-maintenance edge function which talks
   to Stripe (capture shipped-but-uncaptured, warn day-4, void day ~5.5). */
CREATE OR REPLACE FUNCTION stripe_auction_maintenance_tick()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  SELECT supabase_url, service_role_key
  INTO v_supabase_url, v_service_role_key
  FROM email_config
  WHERE id = 1;

  IF v_supabase_url IS NOT NULL AND v_service_role_key IS NOT NULL THEN
    PERFORM net.http_post(
      url := v_supabase_url || '/functions/v1/stripe-auction-maintenance',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || v_service_role_key
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

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'beckah-stripe-maintenance') THEN
    PERFORM cron.schedule(
      'beckah-stripe-maintenance',
      '30 * * * *',
      'SELECT public.stripe_auction_maintenance_tick();'
    );
  END IF;
END $$;
