/*
  # Add Admin Access Policy for Order Items

  1. Changes
    - Add admin policy to view all order items
    
  2. Security
    - Admins can view all order items regardless of order ownership
*/

-- Allow admins to view all order items
CREATE POLICY "Admins can view all order items"
  ON order_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );