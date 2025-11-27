/*
  # Add Admin DELETE Policies

  1. Changes
    - Add DELETE policy for admins on `product_submissions` table
    - Add DELETE policy for admins on `products` table (if not exists)
  
  2. Security
    - Only users with `is_admin = true` in profiles can delete submissions
    - Only users with `is_admin = true` in profiles can delete products
    - This allows admins to permanently remove submissions and products from the system
  
  3. Important Notes
    - This fixes the issue where admins couldn't delete product submissions
    - Deletion is permanent and cannot be undone
    - Related data (like products created from approved submissions) should be handled in application logic
*/

-- Add DELETE policy for admins on product_submissions
DROP POLICY IF EXISTS "Admins can delete product submissions" ON product_submissions;
CREATE POLICY "Admins can delete product submissions"
  ON product_submissions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Add DELETE policy for admins on products (checking if it already exists)
DROP POLICY IF EXISTS "Admins can delete any product" ON products;
CREATE POLICY "Admins can delete any product"
  ON products FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );