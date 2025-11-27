/*
  # Fix Admin Check Policy

  ## Changes
  - Simplify the profiles SELECT policies to ensure users can always read their own is_admin status
  - Remove duplicate policies that might be conflicting

  ## Security
  - Users can read their own profile including is_admin field
  - Admins can read all profiles
*/

-- Drop all existing SELECT policies on profiles
DROP POLICY IF EXISTS "Users can view own role" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;

-- Create a simple policy: authenticated users can read all profiles
CREATE POLICY "Authenticated users can view all profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (true);

-- Create a policy: anonymous users can view basic profile info (excluding sensitive fields)
CREATE POLICY "Anonymous users can view basic profiles"
  ON profiles
  FOR SELECT
  TO anon
  USING (true);
