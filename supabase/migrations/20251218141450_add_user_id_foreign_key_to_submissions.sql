/*
  # Add User ID Foreign Key to Product Submissions

  1. Changes
    - Add foreign key constraint on user_id column to reference profiles table
    - This allows PostgREST to perform joins between product_submissions and profiles

  2. Purpose
    - Required for email notification Edge Functions to work properly
    - Enables PostgREST embedded resources (joins) in API queries
*/

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'product_submissions_user_id_fkey'
      AND table_name = 'product_submissions'
  ) THEN
    ALTER TABLE product_submissions
    ADD CONSTRAINT product_submissions_user_id_fkey
    FOREIGN KEY (user_id)
    REFERENCES profiles(id)
    ON DELETE CASCADE;
  END IF;
END $$;