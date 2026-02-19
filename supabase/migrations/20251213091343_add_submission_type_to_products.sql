/*
  # Add Submission Type to Products Table

  1. Changes
    - Add `submission_type` column to `products` table
      - Stores the type of submission: 'donation', 'symbolic_sale', 'public_sale'
      - Helps identify products that are full donations for special badges/display
      - Default to 'public_sale' for existing products
    
  2. Purpose
    - Display donation badge on product cards
    - Track donation vs sale products for analytics
    - Show special messaging for donated products
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'submission_type'
  ) THEN
    ALTER TABLE products 
    ADD COLUMN submission_type text DEFAULT 'public_sale' CHECK (submission_type IN ('donation', 'symbolic_sale', 'public_sale'));
  END IF;
END $$;

COMMENT ON COLUMN products.submission_type IS 'Type of product submission: donation (100% to charity), symbolic_sale (seller gets symbolic amount), public_sale (regular sale with commission)';