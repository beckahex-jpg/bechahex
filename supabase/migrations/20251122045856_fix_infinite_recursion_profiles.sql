/*
  # Fix infinite recursion in profiles RLS policies

  1. Problem
    - Admin policies cause infinite recursion by checking profiles table within profiles policies
    - This prevents any queries on profiles table from executing

  2. Solution
    - Drop problematic admin policies
    - Keep simple policies: "Public can view profiles", "Users can view/update own profile"
    - Remove admin-specific policies to avoid recursion

  3. Security
    - Public can still view all profiles (needed for product listings showing seller info)
    - Users can only update their own profiles
    - Admin privileges will be checked at application level, not database level for profiles
*/

-- Drop the problematic admin policies that cause infinite recursion
DROP POLICY IF EXISTS "Admin can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admin can update all profiles" ON profiles;

-- Keep these safe policies:
-- 1. "Public can view profiles" - already exists
-- 2. "Users can view own profile" - already exists  
-- 3. "Users can update own profile" - already exists
-- 4. "Users can insert own profile" - already exists
