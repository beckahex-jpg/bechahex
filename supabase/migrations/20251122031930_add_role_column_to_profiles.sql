/*
  # Add role column to profiles table

  1. Changes
    - Add `role` column to `profiles` table with default value 'user'
    - Set jallalalomary@gmail.com as admin
  
  2. Security
    - Maintains existing RLS policies
*/

-- Add role column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'user' NOT NULL;
  END IF;
END $$;

-- Set jallalalomary@gmail.com as admin
UPDATE profiles 
SET role = 'admin' 
WHERE email = 'jallalalomary@gmail.com';
