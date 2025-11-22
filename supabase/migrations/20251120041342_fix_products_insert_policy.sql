/*
  # Fix Products Insert Policy for Admin Approval

  1. Changes
    - Drop the restrictive insert policy
    - Create new policy that allows:
      - Users to insert their own products
      - Admins to insert products on behalf of others (for approval flow)
  
  2. Security
    - Maintains security by checking admin role from profiles table
    - Users can only insert products where they are the seller
    - Admins can insert any product
*/

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;

-- Create new flexible policy for inserts
CREATE POLICY "Users and admins can insert products"
ON products FOR INSERT
TO authenticated
WITH CHECK (
  -- User is inserting their own product
  auth.uid() = seller_id
  OR
  -- User is an admin (checking from profiles table)
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);
