/*
  # Add Seller Tracking to Order Items

  1. Changes
    - Add `seller_id` column to order_items to track which seller the sale belongs to
    - This preserves seller information even if the product is deleted
    - Backfill existing order_items with seller_id from products table
    - Create index for faster seller queries

  2. Security
    - No changes to RLS policies needed
    - This is historical data preservation

  3. Notes
    - This fixes the issue where sellers can't see their sales after deleting products
    - seller_id is stored at the time of purchase to maintain accurate sales history
*/

-- Add seller_id column to order_items
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'order_items' AND column_name = 'seller_id'
  ) THEN
    ALTER TABLE order_items ADD COLUMN seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

    -- Backfill existing order_items with seller_id from products
    UPDATE order_items
    SET seller_id = products.seller_id
    FROM products
    WHERE order_items.product_id = products.id
    AND order_items.seller_id IS NULL;

    -- Create index for faster seller queries
    CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON order_items(seller_id);
  END IF;
END $$;