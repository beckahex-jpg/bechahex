/*
  # Add Service Role Policies for Email Notifications

  1. Changes
    - Add SELECT policy for service_role on product_submissions
    - Add SELECT policy for service_role on profiles
    - Add SELECT policy for service_role on orders
    - This allows Edge Functions using service_role_key to read data for email notifications

  2. Security
    - Only service_role can use these policies
    - Required for email notification triggers to work properly
*/

-- Allow service_role to read all product submissions
CREATE POLICY "Service role can read all submissions"
  ON product_submissions
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service_role to read all profiles
CREATE POLICY "Service role can read all profiles"
  ON profiles
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service_role to read all orders
CREATE POLICY "Service role can read all orders"
  ON orders
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service_role to read all order_items
CREATE POLICY "Service role can read all order items"
  ON order_items
  FOR SELECT
  TO service_role
  USING (true);

-- Allow service_role to read all categories
CREATE POLICY "Service role can read all categories"
  ON categories
  FOR SELECT
  TO service_role
  USING (true);