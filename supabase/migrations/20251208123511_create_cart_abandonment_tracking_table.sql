/*
  # Cart Abandonment Tracking Table

  1. New Tables
    - `cart_abandonment_tracking`
      - `id` (uuid, primary key) - Unique identifier
      - `user_id` (uuid, foreign key) - References auth.users
      - `cart_data` (jsonb) - Snapshot of cart items at the time
      - `total_amount` (numeric) - Total cart value
      - `abandoned_at` (timestamptz) - When the cart was detected as abandoned
      - `reminder_sent_at` (timestamptz, nullable) - When reminder email was sent
      - `converted_at` (timestamptz, nullable) - When user completed purchase
      - `order_id` (uuid, nullable) - References orders if converted
      - `created_at` (timestamptz) - When the tracking entry was created

  2. Security
    - Enable RLS on `cart_abandonment_tracking` table
    - Admin users can view all abandoned cart records
    - Regular users can view their own abandoned cart records
    
  3. Indexes
    - Index on user_id for fast user lookups
    - Index on abandoned_at for finding carts to send reminders
    - Index on converted_at to track conversions
*/

CREATE TABLE IF NOT EXISTS cart_abandonment_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cart_data jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  abandoned_at timestamptz NOT NULL DEFAULT now(),
  reminder_sent_at timestamptz,
  converted_at timestamptz,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cart_abandonment_tracking ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_cart_abandonment_user_id ON cart_abandonment_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_cart_abandonment_abandoned_at ON cart_abandonment_tracking(abandoned_at DESC);
CREATE INDEX IF NOT EXISTS idx_cart_abandonment_reminder_sent ON cart_abandonment_tracking(reminder_sent_at);
CREATE INDEX IF NOT EXISTS idx_cart_abandonment_converted ON cart_abandonment_tracking(converted_at);

CREATE POLICY "Admin users can view all cart abandonment records"
  ON cart_abandonment_tracking
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own cart abandonment records"
  ON cart_abandonment_tracking
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert cart abandonment records"
  ON cart_abandonment_tracking
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update cart abandonment records"
  ON cart_abandonment_tracking
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
