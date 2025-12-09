/*
  # Add product_id to product_submissions table

  1. Changes
    - Add `product_id` column to link approved submissions to published products
    - Add foreign key constraint to products table
  
  2. Security
    - No RLS changes needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_submissions' AND column_name = 'product_id'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN product_id uuid REFERENCES products(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_product_submissions_product_id ON product_submissions(product_id);
  END IF;
END $$;
