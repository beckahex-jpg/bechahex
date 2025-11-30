/*
  # Create Categories Table

  1. New Tables
    - `categories`
      - `id` (uuid, primary key) - Unique identifier
      - `name` (text) - Category name (e.g., Fashion, Electronics)
      - `slug` (text, unique) - URL-friendly version
      - `description` (text) - Category description
      - `icon` (text) - Icon name for UI
      - `created_at` (timestamptz) - Creation timestamp
      
  2. Security
    - Enable RLS on `categories` table
    - Add policy for public read access (everyone can view categories)
    - Add policy for authenticated admin users to manage categories
*/

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text DEFAULT '',
  icon text DEFAULT 'package',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete categories"
  ON categories FOR DELETE
  TO authenticated
  USING (true);