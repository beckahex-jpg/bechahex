/*
  # Add images array column to products table

  1. Changes
    - Add `images` column to `products` table as JSONB array
    - Add `stock` column if missing
    - Keep existing `image_url` for backward compatibility

  2. Notes
    - This allows products to have multiple images
    - Default to empty array for new products
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'images'
  ) THEN
    ALTER TABLE products ADD COLUMN images JSONB DEFAULT '[]'::jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'products' AND column_name = 'stock'
  ) THEN
    ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 1;
  END IF;
END $$;