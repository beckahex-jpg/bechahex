/*
  # Update Products RLS Policies for Admin Access

  1. Changes
    - Add admin policies to allow full access to products
    - Admins can insert, update, delete any product
    - Keep existing policies for regular users
    
  2. Security
    - Admins have full control (verified via profiles.is_admin)
    - Regular users maintain existing restricted access
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Authenticated users can insert products" ON products;
DROP POLICY IF EXISTS "Sellers can update their own products" ON products;
DROP POLICY IF EXISTS "Sellers can delete their own products" ON products;

-- Allow authenticated users (including admins) to insert products
CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = seller_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Allow sellers and admins to update products
CREATE POLICY "Sellers and admins can update products"
  ON products FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = seller_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    auth.uid() = seller_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Allow sellers and admins to delete products
CREATE POLICY "Sellers and admins can delete products"
  ON products FOR DELETE
  TO authenticated
  USING (
    auth.uid() = seller_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );
