/*
  # Add Final Price to Product Submissions
  
  1. Changes
    - Add `final_price` column to `product_submissions` table
      - This is the price after admin markup for charity
      - Defaults to NULL (admin must set before approval)
    
  2. Notes
    - `price` = Original price from seller (usually very low for charity)
    - `final_price` = Price shown to customers (includes charity markup)
    - Difference goes to charity organization
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_submissions' AND column_name = 'final_price'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN final_price numeric CHECK (final_price >= 0);
  END IF;
END $$;