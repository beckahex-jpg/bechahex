/*
  # Add Seller Symbolic Price Field to Product Submissions

  1. Changes
    - Add `seller_symbolic_price` column to `product_submissions` table
      - This field stores the symbolic price that the seller wants to receive
      - Only visible to admin, never shown to public
      - Used for "symbolic_sale" submission type
      - Nullable because not all submissions are symbolic sales
    
  2. Purpose
    - For donations: seller_symbolic_price = null (seller gets nothing)
    - For symbolic sales: seller_symbolic_price = small amount seller wants, original_price = actual product value
    - For regular sales: seller_symbolic_price = null (seller gets the full price minus commission)
    
  3. Admin Workflow
    - When product sells for $100 with seller_symbolic_price = $5:
      - Transfer $5 to seller
      - Keep $95 for charity
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_submissions' AND column_name = 'seller_symbolic_price'
  ) THEN
    ALTER TABLE product_submissions 
    ADD COLUMN seller_symbolic_price numeric CHECK (seller_symbolic_price >= 0);
  END IF;
END $$;

COMMENT ON COLUMN product_submissions.seller_symbolic_price IS 'The symbolic amount seller wants to receive (for symbolic_sale type only). Admin-only field, never shown to public.';