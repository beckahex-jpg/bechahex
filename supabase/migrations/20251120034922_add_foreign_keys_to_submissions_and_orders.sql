/*
  # Add Foreign Key Relationships

  1. Changes
    - Add foreign key from product_submissions.user_id to profiles.id
    - Add foreign key from product_submissions.reviewed_by to profiles.id
    - Add foreign key from orders.user_id to profiles.id
    
  2. Purpose
    - Enable Supabase to automatically join tables in queries
    - Fix the "Could not find a relationship" errors
*/

-- Add foreign key from product_submissions to profiles (user who submitted)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_submissions_user_id_fkey'
  ) THEN
    ALTER TABLE product_submissions
      ADD CONSTRAINT product_submissions_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add foreign key from product_submissions to profiles (reviewer)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'product_submissions_reviewed_by_fkey'
  ) THEN
    ALTER TABLE product_submissions
      ADD CONSTRAINT product_submissions_reviewed_by_fkey
      FOREIGN KEY (reviewed_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add foreign key from orders to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'orders_user_id_fkey'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;