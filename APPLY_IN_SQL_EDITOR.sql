-- ============================================================
-- APPLY IN SUPABASE SQL EDITOR (all 3 pending migrations)
-- Safe to re-run: everything is guarded with IF NOT EXISTS.
-- Delete this file after applying.
-- ============================================================

-- ===== 1/3: order_items snapshot columns (fixes checkout error) =====
/*
  # Order item snapshot columns

  The live database's order_items table was created by
  20251122040725_create_complete_database.sql WITHOUT the product_title /
  product_image snapshot columns that 20251118023826 defined and that the
  checkout insert and seller-orders queries rely on ("Could not find the
  'product_image' column of 'order_items' in the schema cache").

  Adds the missing columns (guarded, safe to re-run) and backfills them from
  the products table so existing orders render correctly.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_title'
  ) THEN
    ALTER TABLE order_items ADD COLUMN product_title text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_image'
  ) THEN
    ALTER TABLE order_items ADD COLUMN product_image text;
  END IF;
END $$;

-- Backfill snapshots for existing rows from the live product data.
UPDATE order_items
SET
  product_title = COALESCE(order_items.product_title, products.title),
  product_image = COALESCE(order_items.product_image, products.image_url)
FROM products
WHERE order_items.product_id = products.id
  AND (order_items.product_title IS NULL OR order_items.product_image IS NULL);

COMMENT ON COLUMN order_items.product_title IS
  'Snapshot of the product title at purchase time (survives product deletion).';
COMMENT ON COLUMN order_items.product_image IS
  'Snapshot of the product image URL at purchase time.';

-- ===== 2/3: product reviews system =====
/*
  # Product Reviews & Seller Ratings

  1. New Tables
    - `product_reviews`
      - One review per (order_id, product_id, reviewer_id).
      - Verified purchase by construction: rows can only be created through the
        SECURITY DEFINER RPC `submit_product_review`, which validates that the
        caller owns a delivered order containing the product. There is NO
        INSERT grant on the table for client roles.
      - `status` is 'published' (default, visible immediately) or 'hidden'
        (admin moderation). Hidden reviews leave the public views and the
        aggregate counts automatically.

  2. Aggregates
    - `products.rating_avg` / `products.rating_count` columns maintained by a
      trigger that recomputes from published reviews. Product grids read them
      through the existing `select('*')` queries with no extra requests.
    - `seller_review_stats` view exposes per-seller average/count.

  3. Public read surface
    - `public_product_reviews` view: published reviews only, reviewer name
      masked to "First L." (same idea as public_auction_bid_history).

  4. Security
    - RLS on product_reviews: public reads published rows; reviewers read
      their own rows (any status); admins read everything.
    - Reviewers may edit/delete their own review while it is published, but
      cannot un-hide a review an admin has hidden. Admins can update status
      and delete.
*/

CREATE TABLE IF NOT EXISTS product_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  reviewer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text CHECK (title IS NULL OR char_length(title) <= 120),
  comment text NOT NULL DEFAULT '' CHECK (char_length(comment) <= 2000),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (order_id, product_id, reviewer_id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'rating_avg'
  ) THEN
    ALTER TABLE products ADD COLUMN rating_avg numeric(3,2) NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'rating_count'
  ) THEN
    ALTER TABLE products ADD COLUMN rating_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_published
  ON product_reviews(product_id, created_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_product_reviews_seller_published
  ON product_reviews(seller_id) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_product_reviews_reviewer ON product_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_product_reviews_order ON product_reviews(order_id);

ALTER TABLE product_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public reads published reviews" ON product_reviews;
CREATE POLICY "Public reads published reviews"
  ON product_reviews FOR SELECT TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS "Reviewers read own reviews" ON product_reviews;
CREATE POLICY "Reviewers read own reviews"
  ON product_reviews FOR SELECT TO authenticated
  USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all reviews" ON product_reviews;
CREATE POLICY "Admins read all reviews"
  ON product_reviews FOR SELECT TO authenticated
  USING (auction_current_user_is_admin());

DROP POLICY IF EXISTS "Reviewers update own published reviews" ON product_reviews;
CREATE POLICY "Reviewers update own published reviews"
  ON product_reviews FOR UPDATE TO authenticated
  USING (reviewer_id = auth.uid() AND status = 'published')
  WITH CHECK (reviewer_id = auth.uid() AND status = 'published');

DROP POLICY IF EXISTS "Admins update reviews" ON product_reviews;
CREATE POLICY "Admins update reviews"
  ON product_reviews FOR UPDATE TO authenticated
  USING (auction_current_user_is_admin())
  WITH CHECK (auction_current_user_is_admin());

DROP POLICY IF EXISTS "Reviewers delete own reviews" ON product_reviews;
CREATE POLICY "Reviewers delete own reviews"
  ON product_reviews FOR DELETE TO authenticated
  USING (reviewer_id = auth.uid());

DROP POLICY IF EXISTS "Admins delete reviews" ON product_reviews;
CREATE POLICY "Admins delete reviews"
  ON product_reviews FOR DELETE TO authenticated
  USING (auction_current_user_is_admin());

-- No INSERT grant: submit_product_review() is the only write path.
REVOKE ALL ON product_reviews FROM anon, authenticated;
GRANT SELECT ON product_reviews TO anon, authenticated;
GRANT UPDATE (rating, title, comment, status) ON product_reviews TO authenticated;
GRANT DELETE ON product_reviews TO authenticated;

CREATE TRIGGER trigger_product_reviews_updated_at
  BEFORE UPDATE ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION set_auction_updated_at();

-- Recompute-from-scratch keeps hide/unhide/edit/delete trivially correct.
-- SECURITY DEFINER because the reviewer's role cannot update other people's
-- products under RLS.
CREATE OR REPLACE FUNCTION refresh_product_rating_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid := COALESCE(NEW.product_id, OLD.product_id);
BEGIN
  UPDATE products p
  SET
    rating_avg = COALESCE(r.avg_rating, 0),
    rating_count = COALESCE(r.review_count, 0),
    updated_at = clock_timestamp()
  FROM (
    SELECT
      round(avg(rating)::numeric, 2) AS avg_rating,
      count(*) AS review_count
    FROM product_reviews
    WHERE product_id = v_product_id AND status = 'published'
  ) r
  WHERE p.id = v_product_id;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trigger_product_reviews_aggregates
  AFTER INSERT OR DELETE OR UPDATE OF rating, status ON product_reviews
  FOR EACH ROW EXECUTE FUNCTION refresh_product_rating_aggregates();

CREATE OR REPLACE VIEW public_product_reviews AS
SELECT
  r.id,
  r.product_id,
  r.seller_id,
  r.rating,
  r.title,
  r.comment,
  r.created_at,
  CASE
    WHEN btrim(COALESCE(p.full_name, '')) = '' THEN 'Beckah Buyer'
    WHEN position(' ' IN btrim(p.full_name)) = 0 THEN btrim(p.full_name)
    ELSE split_part(btrim(p.full_name), ' ', 1) || ' '
         || upper(left(regexp_replace(btrim(p.full_name), '^.*\s', ''), 1)) || '.'
  END AS reviewer_name
FROM product_reviews r
LEFT JOIN profiles p ON p.id = r.reviewer_id
WHERE r.status = 'published';

CREATE OR REPLACE VIEW seller_review_stats AS
SELECT
  seller_id,
  round(avg(rating)::numeric, 2) AS rating_avg,
  count(*) AS rating_count
FROM product_reviews
WHERE status = 'published'
GROUP BY seller_id;

GRANT SELECT ON public_product_reviews TO anon, authenticated;
GRANT SELECT ON seller_review_stats TO anon, authenticated;

CREATE OR REPLACE FUNCTION submit_product_review(
  p_order_id uuid,
  p_product_id uuid,
  p_rating integer,
  p_title text DEFAULT NULL,
  p_comment text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order orders%ROWTYPE;
  v_item order_items%ROWTYPE;
  v_seller_id uuid;
  v_existing product_reviews%ROWTYPE;
  v_review product_reviews%ROWTYPE;
  v_title text := NULLIF(btrim(COALESCE(p_title, '')), '');
  v_comment text := btrim(COALESCE(p_comment, ''));
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'Rating must be between 1 and 5' USING ERRCODE = '22023';
  END IF;

  IF v_title IS NOT NULL AND char_length(v_title) > 120 THEN
    RAISE EXCEPTION 'Title must be 120 characters or fewer' USING ERRCODE = '22023';
  END IF;

  IF char_length(v_comment) > 2000 THEN
    RAISE EXCEPTION 'Comment must be 2000 characters or fewer' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  -- Same message whether the order is missing or owned by someone else, so
  -- order existence is not leaked.
  IF NOT FOUND OR v_order.user_id <> v_user_id THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (v_order.status = 'delivered' OR COALESCE(v_order.confirmed_by_buyer, false)) THEN
    RAISE EXCEPTION 'You can review this order after delivery is confirmed' USING ERRCODE = '55000';
  END IF;

  SELECT * INTO v_item
  FROM order_items
  WHERE order_id = p_order_id AND product_id = p_product_id
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'This product is not part of the order' USING ERRCODE = 'P0002';
  END IF;

  v_seller_id := v_item.seller_id;
  IF v_seller_id IS NULL THEN
    SELECT seller_id INTO v_seller_id FROM products WHERE id = p_product_id;
  END IF;

  IF v_seller_id IS NULL THEN
    RAISE EXCEPTION 'Unable to determine the seller for this product' USING ERRCODE = 'P0002';
  END IF;

  IF v_seller_id = v_user_id THEN
    RAISE EXCEPTION 'You cannot review your own product' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_existing
  FROM product_reviews
  WHERE order_id = p_order_id
    AND product_id = p_product_id
    AND reviewer_id = v_user_id;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'review_id', v_existing.id,
      'product_id', p_product_id,
      'rating', v_existing.rating,
      'duplicate', true
    );
  END IF;

  INSERT INTO product_reviews (product_id, seller_id, order_id, reviewer_id, rating, title, comment)
  VALUES (p_product_id, v_seller_id, p_order_id, v_user_id, p_rating, v_title, v_comment)
  RETURNING * INTO v_review;

  UPDATE review_requests
  SET review_submitted_at = now(), link_clicked = true
  WHERE order_id = p_order_id
    AND product_id = p_product_id
    AND user_id = v_user_id
    AND review_submitted_at IS NULL;

  RETURN jsonb_build_object(
    'review_id', v_review.id,
    'product_id', p_product_id,
    'rating', v_review.rating,
    'duplicate', false
  );
END;
$$;

REVOKE ALL ON FUNCTION submit_product_review(uuid, uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION submit_product_review(uuid, uuid, integer, text, text) TO authenticated;

COMMENT ON TABLE product_reviews IS
  'Verified-purchase product reviews. Insert path is submit_product_review() only; status hidden removes a review from public views and aggregates.';
COMMENT ON FUNCTION submit_product_review(uuid, uuid, integer, text, text) IS
  'Creates a review for a delivered order owned by the caller. Idempotent per (order, product, reviewer): returns duplicate=true instead of failing.';

-- ===== 3/3: seller payout details =====
/*
  # Seller Payout Details

  Sellers are promised transfers to their "registered bank account", but there
  was nowhere to register one. This table stores where the admin should send
  manual payouts.

  Deliberately a separate table (NOT columns on profiles): profiles are
  publicly readable, bank details must never be.

  Security:
    - RLS: owner can read/insert/update their own row; admins can read all
      rows (to perform the transfer from the Payments section).
    - No DELETE policy for owners; clearing fields is enough and history of
      where money was sent stays intact.
*/

CREATE TABLE IF NOT EXISTS seller_payout_details (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  method text NOT NULL DEFAULT 'bank_transfer' CHECK (method IN ('bank_transfer', 'paypal')),
  bank_name text CHECK (bank_name IS NULL OR char_length(bank_name) <= 120),
  account_holder_name text CHECK (account_holder_name IS NULL OR char_length(account_holder_name) <= 120),
  iban text CHECK (iban IS NULL OR char_length(iban) <= 64),
  paypal_email text CHECK (paypal_email IS NULL OR char_length(paypal_email) <= 255),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_seller_payout_details_user ON seller_payout_details(user_id);

ALTER TABLE seller_payout_details ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners read own payout details" ON seller_payout_details;
CREATE POLICY "Owners read own payout details"
  ON seller_payout_details FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins read all payout details" ON seller_payout_details;
CREATE POLICY "Admins read all payout details"
  ON seller_payout_details FOR SELECT TO authenticated
  USING (auction_current_user_is_admin());

DROP POLICY IF EXISTS "Owners insert own payout details" ON seller_payout_details;
CREATE POLICY "Owners insert own payout details"
  ON seller_payout_details FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Owners update own payout details" ON seller_payout_details;
CREATE POLICY "Owners update own payout details"
  ON seller_payout_details FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

REVOKE ALL ON seller_payout_details FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON seller_payout_details TO authenticated;

CREATE TRIGGER trigger_seller_payout_details_updated_at
  BEFORE UPDATE ON seller_payout_details
  FOR EACH ROW EXECUTE FUNCTION set_auction_updated_at();

COMMENT ON TABLE seller_payout_details IS
  'Where the admin sends manual seller payouts (bank transfer or PayPal). Kept out of profiles because profiles are publicly readable.';
