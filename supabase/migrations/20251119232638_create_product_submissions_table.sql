/*
  # Create Product Submissions Table

  1. New Tables
    - `product_submissions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `title` (text) - Product title
      - `description` (text) - Product description
      - `category_id` (uuid, foreign key to categories)
      - `condition` (text) - Product condition
      - `price` (numeric) - Suggested price
      - `original_price` (numeric, nullable) - Original price
      - `submission_type` (text) - Type: 'donation', 'symbolic_sale', 'public_sale'
      - `images` (jsonb) - Array of image URLs
      - `status` (text) - Status: 'pending', 'approved', 'rejected'
      - `rejection_reason` (text, nullable) - Reason if rejected
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `reviewed_at` (timestamptz, nullable)
      - `reviewed_by` (uuid, nullable) - Admin who reviewed

  2. Security
    - Enable RLS on `product_submissions` table
    - Add policy for users to create their own submissions
    - Add policy for users to view their own submissions
    - Add policy for users to update their pending submissions
*/

CREATE TABLE IF NOT EXISTS product_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  condition text NOT NULL DEFAULT 'Good',
  price numeric NOT NULL DEFAULT 0 CHECK (price >= 0),
  original_price numeric CHECK (original_price >= 0),
  submission_type text NOT NULL DEFAULT 'donation' CHECK (submission_type IN ('donation', 'symbolic_sale', 'public_sale')),
  images jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE product_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create their own submissions"
  ON product_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own submissions"
  ON product_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their pending submissions"
  ON product_submissions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

CREATE INDEX IF NOT EXISTS idx_product_submissions_user_id ON product_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_product_submissions_status ON product_submissions(status);
CREATE INDEX IF NOT EXISTS idx_product_submissions_created_at ON product_submissions(created_at DESC);