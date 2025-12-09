/*
  # Create Donations Table

  ## Purpose
  This migration creates the donations table to track monetary donations made by users
  to support the platform's charitable mission.

  ## Tables Created
    - `donations`
      - `id` (uuid, primary key, auto-generated)
      - `user_id` (uuid, foreign key to profiles) - User who made the donation (nullable for anonymous)
      - `amount` (numeric, not null) - Donation amount
      - `currency` (text, default 'USD') - Currency code
      - `donation_type` (text, not null) - Type: one_time, monthly, yearly
      - `status` (text, not null) - Status: pending, completed, failed, refunded
      - `payment_method` (text) - Payment method used
      - `stripe_payment_id` (text) - Stripe payment intent ID
      - `donor_name` (text) - Name of donor (for anonymous or named donations)
      - `donor_email` (text, not null) - Donor's email for receipt
      - `donor_phone` (text) - Donor's phone number
      - `is_anonymous` (boolean, default false) - Hide donor name publicly
      - `message` (text) - Optional message from donor
      - `receipt_sent` (boolean, default false) - Whether receipt email was sent
      - `receipt_number` (text, unique) - Receipt number for tax purposes
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  ## Security
    - Enable RLS on donations table
    - Users can view their own donations
    - Users can create donations
    - Admins can view all donations
    - Public can view non-anonymous donations (for transparency)

  ## Notes
    - Supports one-time and recurring donations
    - Anonymous donations hide donor information publicly
    - Receipt numbers generated for tax-deductible donations
*/

-- Create donations table
CREATE TABLE IF NOT EXISTS donations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  amount numeric(10, 2) NOT NULL CHECK (amount > 0),
  currency text DEFAULT 'USD' NOT NULL,
  donation_type text NOT NULL DEFAULT 'one_time' CHECK (donation_type IN ('one_time', 'monthly', 'yearly')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method text,
  stripe_payment_id text,
  donor_name text,
  donor_email text NOT NULL,
  donor_phone text,
  is_anonymous boolean DEFAULT false,
  message text,
  receipt_sent boolean DEFAULT false,
  receipt_number text UNIQUE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_type ON donations(donation_type);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_donations_is_anonymous ON donations(is_anonymous);

-- Enable Row Level Security
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own donations
CREATE POLICY "Users can view own donations"
  ON donations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own donations
CREATE POLICY "Users can insert own donations"
  ON donations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Anyone can view completed non-anonymous donations (for transparency)
CREATE POLICY "Public can view non-anonymous donations"
  ON donations
  FOR SELECT
  TO public
  USING (status = 'completed' AND is_anonymous = false);

-- Policy: Admins can view all donations
CREATE POLICY "Admins can view all donations"
  ON donations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Admins can update donations
CREATE POLICY "Admins can update donations"
  ON donations
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

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS handle_donations_updated_at ON donations;
CREATE TRIGGER handle_donations_updated_at
  BEFORE UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number()
RETURNS text AS $$
DECLARE
  new_receipt_number text;
  current_year text;
  next_sequence integer;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(receipt_number FROM 13) AS integer)), 0) + 1
  INTO next_sequence
  FROM donations
  WHERE receipt_number LIKE 'RCPT-' || current_year || '-%';
  
  new_receipt_number := 'RCPT-' || current_year || '-' || LPAD(next_sequence::text, 6, '0');
  
  RETURN new_receipt_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate receipt number for completed donations
CREATE OR REPLACE FUNCTION auto_generate_receipt_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'completed' AND (NEW.receipt_number IS NULL OR NEW.receipt_number = '') THEN
    NEW.receipt_number := generate_receipt_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_receipt_number ON donations;
CREATE TRIGGER trigger_auto_generate_receipt_number
  BEFORE INSERT OR UPDATE ON donations
  FOR EACH ROW EXECUTE FUNCTION auto_generate_receipt_number();
