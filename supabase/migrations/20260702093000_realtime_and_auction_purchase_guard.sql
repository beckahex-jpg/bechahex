/*
  1. Add auctions to the supabase_realtime publication so postgres_changes
     subscriptions (bid updates, countdown status) actually fire. RLS still
     applies: subscribers only receive rows they are allowed to SELECT.
  2. Server-side guard against buying auction items through the legacy
     fixed-price flow (cart -> checkout writes orders/order_items directly
     from the client). Auction sales are only recorded by
     finalize_auction_payment, which runs as service_role and always sets
     order_items.auction_id.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'auctions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.auctions;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION prevent_auction_cart_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing text;
BEGIN
  SELECT listing_type INTO v_listing FROM products WHERE id = NEW.product_id;
  IF v_listing = 'auction' THEN
    RAISE EXCEPTION 'Auction items cannot be added to the cart. Place a bid instead.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_auction_cart_items ON cart_items;
CREATE TRIGGER trigger_prevent_auction_cart_items
  BEFORE INSERT ON cart_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_auction_cart_items();

CREATE OR REPLACE FUNCTION prevent_direct_auction_order_items()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_listing text;
BEGIN
  IF NEW.auction_id IS NOT NULL THEN
    -- Auction sales may only be recorded by the service-role payment
    -- finalizer; a client must not be able to forge one.
    IF COALESCE(auth.role(), '') <> 'service_role' THEN
      RAISE EXCEPTION 'Auction order items can only be created by the payment system.'
        USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  SELECT listing_type INTO v_listing FROM products WHERE id = NEW.product_id;
  IF v_listing = 'auction' THEN
    RAISE EXCEPTION 'Auction items cannot be purchased directly. Win the auction to buy this item.'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_prevent_direct_auction_order_items ON order_items;
CREATE TRIGGER trigger_prevent_direct_auction_order_items
  BEFORE INSERT ON order_items
  FOR EACH ROW
  EXECUTE FUNCTION prevent_direct_auction_order_items();
