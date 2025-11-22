/*
  # Allow Public View of Profiles

  1. Changes
    - Drop existing "Users can view own profile" policy
    - Create new policy allowing everyone to view all profiles
    - This is needed so product listings can show seller names

  2. Security
    - Users can still only update/delete their own profiles
    - Public viewing of profiles is common for marketplace apps
*/

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Create new policy allowing public view
CREATE POLICY "Anyone can view profiles"
  ON profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);
