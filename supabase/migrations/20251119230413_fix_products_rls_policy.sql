/*
  # Fix Products RLS Policy

  1. Changes
    - Drop existing "Anyone can view available products" policy
    - Create new policy that allows viewing available products regardless of seller_id
    - This fixes the issue where products with null seller_id cannot be viewed

  2. Security
    - Maintains security by only allowing viewing of 'available' products
    - Authenticated users can still view their own products regardless of status
*/

-- Drop the existing policy
DROP POLICY IF EXISTS "Anyone can view available products" ON products;

-- Create new policy that handles null seller_id
CREATE POLICY "Anyone can view available products"
  ON products
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'available' 
    OR (seller_id IS NOT NULL AND seller_id = auth.uid())
  );
