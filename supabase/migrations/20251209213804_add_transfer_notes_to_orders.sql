/*
  # Add transfer notes column to orders table

  1. Changes
    - Add `transfer_notes` column to `orders` table to store manual bank transfer notes
    
  2. Details
    - Column type: text (nullable)
    - Purpose: Allow admin to add notes when manually confirming bank transfers to sellers
    - This field is optional and only filled when payment_released is true
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'transfer_notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN transfer_notes text;
  END IF;
END $$;
