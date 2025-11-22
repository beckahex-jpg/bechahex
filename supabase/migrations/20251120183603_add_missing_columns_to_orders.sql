/*
  # Add Missing Columns to Orders Table

  ## Changes
  - Add `payment_method` column to store payment method (card, cash_on_delivery)
  - Add `notes` column to store customer order notes
  - Add `full_name` column to store recipient name
  - Add `phone` column to store recipient phone
  
  ## Details
  - All new columns are optional (nullable) to maintain compatibility
  - payment_method defaults to 'card'
*/

DO $$
BEGIN
  -- Add payment_method column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'payment_method'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_method text DEFAULT 'card';
  END IF;

  -- Add notes column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'notes'
  ) THEN
    ALTER TABLE orders ADD COLUMN notes text;
  END IF;

  -- Add full_name column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE orders ADD COLUMN full_name text DEFAULT '';
  END IF;

  -- Add phone column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'phone'
  ) THEN
    ALTER TABLE orders ADD COLUMN phone text DEFAULT '';
  END IF;
END $$;