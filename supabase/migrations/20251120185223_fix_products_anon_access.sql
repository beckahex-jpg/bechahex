/*
  # Fix Products Access for Anonymous Users

  ## Changes
  - Drop existing SELECT policy on products
  - Create new simplified policy that allows everyone (including anonymous users) to view available products
  
  ## Details
  - Anonymous users should be able to browse products without logging in
  - Authenticated users can also see their own products regardless of status
*/

DROP POLICY IF EXISTS "Anyone can view available products" ON products;

CREATE POLICY "Public can view available products"
  ON products
  FOR SELECT
  TO public
  USING (status = 'available');

CREATE POLICY "Sellers can view their own products"
  ON products
  FOR SELECT
  TO authenticated
  USING (seller_id = auth.uid());