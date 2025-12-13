/*
  # Review Requests Table

  1. New Tables
    - `review_requests`
      - `id` (uuid, primary key) - Unique identifier
      - `order_id` (uuid, foreign key) - References orders table
      - `user_id` (uuid, foreign key) - References auth.users
      - `product_id` (uuid, foreign key) - References products table
      - `request_sent_at` (timestamptz) - When review request email was sent
      - `review_submitted_at` (timestamptz, nullable) - When user submitted review
      - `email_opened` (boolean) - Whether email was opened
      - `link_clicked` (boolean) - Whether review link was clicked
      - `created_at` (timestamptz) - When the record was created

  2. Security
    - Enable RLS on `review_requests` table
    - Admin users can view all review requests
    - Regular users can view their own review requests
    
  3. Indexes
    - Index on order_id for fast order lookups
    - Index on user_id for fast user lookups
    - Index on product_id for product analytics
    - Index on request_sent_at for finding pending reviews
*/

CREATE TABLE IF NOT EXISTS review_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  request_sent_at timestamptz DEFAULT now(),
  review_submitted_at timestamptz,
  email_opened boolean DEFAULT false,
  link_clicked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_review_requests_order_id ON review_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_user_id ON review_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_product_id ON review_requests(product_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_sent_at ON review_requests(request_sent_at DESC);

CREATE POLICY "Admin users can view all review requests"
  ON review_requests
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can view their own review requests"
  ON review_requests
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "System can insert review requests"
  ON review_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can update review requests"
  ON review_requests
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
