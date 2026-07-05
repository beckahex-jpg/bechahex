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
