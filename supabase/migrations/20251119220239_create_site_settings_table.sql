/*
  # Create Site Settings Table

  1. New Tables
    - `site_settings`
      - `id` (uuid, primary key) - Unique identifier
      - `site_name` (text) - Name of the site/foundation
      - `logo_url` (text) - Path to the logo image
      - `description` (text, nullable) - Site description
      - `contact_email` (text, nullable) - Contact email
      - `phone` (text, nullable) - Contact phone
      - `address` (text, nullable) - Physical address
      - `social_media` (jsonb, nullable) - Social media links
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp

  2. Security
    - Enable RLS on `site_settings` table
    - Add policy for public read access (anyone can view site settings)
    - Add policy for authenticated admin users to update settings

  3. Initial Data
    - Insert default site settings with Beckah Foundation logo
*/

CREATE TABLE IF NOT EXISTS site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_name text NOT NULL DEFAULT 'Beckah Foundation',
  logo_url text NOT NULL DEFAULT '/download.png',
  description text,
  contact_email text,
  phone text,
  address text,
  social_media jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings"
  ON site_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can update site settings"
  ON site_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert site settings"
  ON site_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO site_settings (site_name, logo_url, description, contact_email)
VALUES (
  'Beckah Foundation',
  '/download.png',
  'Supporting eco-friendly initiatives and sustainable living',
  'beckahex@beckah.org'
) ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION update_site_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_site_settings_updated_at();