/*
  # Add Profile Fields

  1. Changes
    - Add `full_name` column to profiles table
    - Add `phone` column to profiles table
    
  2. Notes
    - These fields are optional and can be updated by users
    - Used for shipping address auto-fill in checkout
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN full_name text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone text;
  END IF;
END $$;