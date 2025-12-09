/*
  # Add Shipping Address Fields to Profiles

  1. Changes
    - Add shipping address fields to profiles table:
      - shipping_street: Street address
      - shipping_city: City
      - shipping_state: State/Province
      - shipping_zip_code: ZIP/Postal code
      - shipping_country: Country (defaults to 'United States')

  2. Purpose
    - Save user's shipping address for future orders
    - Auto-fill checkout form with saved address
    - Allow users to update their address anytime

  3. Security
    - Users can only view and update their own addresses
    - RLS policies already in place for profiles table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'shipping_street'
  ) THEN
    ALTER TABLE profiles ADD COLUMN shipping_street text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'shipping_city'
  ) THEN
    ALTER TABLE profiles ADD COLUMN shipping_city text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'shipping_state'
  ) THEN
    ALTER TABLE profiles ADD COLUMN shipping_state text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'shipping_zip_code'
  ) THEN
    ALTER TABLE profiles ADD COLUMN shipping_zip_code text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'shipping_country'
  ) THEN
    ALTER TABLE profiles ADD COLUMN shipping_country text DEFAULT 'United States';
  END IF;
END $$;
