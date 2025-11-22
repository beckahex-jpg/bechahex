/*
  # Create Product Submissions Table

  ## Purpose
  This migration creates the product_submissions table to allow users to submit items
  they want to donate or sell to the platform. Admins review and approve these submissions.

  ## Tables Created
    - `product_submissions`
      - `id` (uuid, primary key, auto-generated)
      - `user_id` (uuid, foreign key to profiles) - User who submitted the item
      - `category_id` (uuid, foreign key to categories) - Suggested category
      - `title` (text, not null) - Item title
      - `description` (text) - Item description
      - `suggested_price` (numeric) - Price suggested by submitter
      - `condition` (text, not null) - Item condition
      - `images` (jsonb, default []) - Array of uploaded image URLs
      - `submission_type` (text, not null) - Type: donation, sell, consignment
      - `status` (text, not null) - Status: pending, under_review, approved, rejected, published
      - `admin_notes` (text) - Notes from admin reviewer
      - `approved_price` (numeric) - Price set by admin after review
      - `reviewed_by` (uuid, foreign key to profiles) - Admin who reviewed
      - `reviewed_at` (timestamptz) - When it was reviewed
      - `published_product_id` (uuid, foreign key to products) - Created product if approved
      - `contact_phone` (text) - Submitter's contact phone
      - `contact_email` (text) - Submitter's contact email
      - `pickup_address` (text) - Address for item pickup
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  ## Security
    - Enable RLS on product_submissions table
    - Users can view and create their own submissions
    - Users can update their own pending submissions
    - Admins can view and manage all submissions

  ## Notes
    - Submission types: donation (free gift), sell (platform buys), consignment (sell on behalf)
    - Approved submissions can be converted to products by admins
*/

-- Create product_submissions table
CREATE TABLE IF NOT EXISTS product_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  suggested_price numeric(10, 2) CHECK (suggested_price >= 0),
  condition text NOT NULL CHECK (condition IN ('New', 'Like New', 'Excellent', 'Very Good', 'Good', 'Fair')),
  images jsonb DEFAULT '[]'::jsonb,
  submission_type text NOT NULL CHECK (submission_type IN ('donation', 'sell', 'consignment')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'under_review', 'approved', 'rejected', 'published')),
  admin_notes text,
  approved_price numeric(10, 2) CHECK (approved_price >= 0),
  reviewed_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  published_product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  contact_phone text,
  contact_email text,
  pickup_address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON product_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_submissions_status ON product_submissions(status);
CREATE INDEX IF NOT EXISTS idx_submissions_type ON product_submissions(submission_type);
CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON product_submissions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE product_submissions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own submissions
CREATE POLICY "Users can view own submissions"
  ON product_submissions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own submissions
CREATE POLICY "Users can insert own submissions"
  ON product_submissions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own pending submissions
CREATE POLICY "Users can update own pending submissions"
  ON product_submissions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

-- Policy: Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
  ON product_submissions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Admins can update all submissions
CREATE POLICY "Admins can update all submissions"
  ON product_submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Admins can delete submissions
CREATE POLICY "Admins can delete submissions"
  ON product_submissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_submissions_updated_at ON product_submissions;
CREATE TRIGGER handle_submissions_updated_at
  BEFORE UPDATE ON product_submissions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to automatically set reviewed_at when status changes to approved/rejected
CREATE OR REPLACE FUNCTION set_reviewed_timestamp()
RETURNS trigger AS $$
BEGIN
  IF (NEW.status IN ('approved', 'rejected')) AND (OLD.status NOT IN ('approved', 'rejected')) THEN
    NEW.reviewed_at := now();
    IF NEW.reviewed_by IS NULL THEN
      NEW.reviewed_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_reviewed_timestamp ON product_submissions;
CREATE TRIGGER trigger_set_reviewed_timestamp
  BEFORE UPDATE ON product_submissions
  FOR EACH ROW EXECUTE FUNCTION set_reviewed_timestamp();
