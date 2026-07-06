/*
  # Product stock management

  1. Ensure products.stock exists (added by 20251126203000 in most
     environments), backfill NULLs to 1 and enforce stock >= 0.
  2. Add quantity to product_submissions so sellers declare how many units
     they are listing; it becomes products.stock when the listing is approved.
  3. Decrement stock when an order is paid (orders.payment_status -> 'paid').
     A fixed-price product whose stock reaches 0 is marked 'sold', which
     removes it from the marketplace automatically because the public SELECT
     policy only exposes status = 'available'. Auction items are skipped:
     their sale is finalized by the auction payment flow.

  Safe to re-run: everything is guarded.
*/

-- 1. products.stock
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'stock'
  ) THEN
    ALTER TABLE products ADD COLUMN stock integer DEFAULT 1;
  END IF;
END $$;

UPDATE products SET stock = 1 WHERE stock IS NULL;
ALTER TABLE products ALTER COLUMN stock SET DEFAULT 1;
ALTER TABLE products ALTER COLUMN stock SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_stock_non_negative' AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE products ADD CONSTRAINT products_stock_non_negative CHECK (stock >= 0);
  END IF;
END $$;

-- 2. product_submissions.quantity
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'product_submissions' AND column_name = 'quantity'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN quantity integer NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_submissions_quantity_positive' AND conrelid = 'public.product_submissions'::regclass
  ) THEN
    ALTER TABLE product_submissions ADD CONSTRAINT product_submissions_quantity_positive CHECK (quantity >= 1);
  END IF;
END $$;

-- 3. Stock decrement on paid orders
CREATE OR REPLACE FUNCTION decrement_stock_on_paid_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item RECORD;
BEGIN
  FOR v_item IN
    SELECT product_id, SUM(quantity)::integer AS qty
    FROM order_items
    WHERE order_id = NEW.id
      AND auction_id IS NULL
      AND product_id IS NOT NULL
    GROUP BY product_id
  LOOP
    -- The row lock taken by UPDATE serializes concurrent paid orders for the
    -- same product; GREATEST keeps stock at 0 if an oversell slips through.
    UPDATE products
    SET stock = GREATEST(stock - v_item.qty, 0),
        status = CASE WHEN stock - v_item.qty <= 0 THEN 'sold' ELSE status END,
        updated_at = now()
    WHERE id = v_item.product_id
      AND COALESCE(listing_type, 'fixed_price') <> 'auction';
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_decrement_stock_on_paid_order ON orders;
CREATE TRIGGER trigger_decrement_stock_on_paid_order
  AFTER UPDATE ON orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION decrement_stock_on_paid_order();
