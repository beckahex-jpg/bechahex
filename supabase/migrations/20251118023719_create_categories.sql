/*
  # Create Categories Table

  ## Purpose
  This migration creates the categories table to organize products into different categories.

  ## Tables Created
    - `categories`
      - `id` (uuid, primary key, auto-generated)
      - `name` (text, unique, not null) - Category name (e.g., "Electronics", "Fashion")
      - `slug` (text, unique, not null) - URL-friendly version (e.g., "electronics")
      - `description` (text) - Category description
      - `icon` (text) - Icon name from lucide-react
      - `color_from` (text) - Gradient start color (e.g., "blue-500")
      - `color_to` (text) - Gradient end color (e.g., "cyan-500")
      - `display_order` (integer, default 0) - Order for displaying categories
      - `is_active` (boolean, default true) - Whether category is visible
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  ## Security
    - Enable RLS on categories table
    - Anyone can view active categories (public read access)
    - Only admins can create, update, or delete categories

  ## Initial Data
    - Pre-populated with 8 main categories matching the frontend
*/

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'Package',
  color_from text NOT NULL DEFAULT 'gray-500',
  color_to text NOT NULL DEFAULT 'gray-600',
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active categories
CREATE POLICY "Anyone can view active categories"
  ON categories
  FOR SELECT
  TO public
  USING (is_active = true);

-- Policy: Admins can view all categories (including inactive)
CREATE POLICY "Admins can view all categories"
  ON categories
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Admins can insert categories
CREATE POLICY "Admins can insert categories"
  ON categories
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Admins can update categories
CREATE POLICY "Admins can update categories"
  ON categories
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

-- Policy: Admins can delete categories
CREATE POLICY "Admins can delete categories"
  ON categories
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS handle_categories_updated_at ON categories;
CREATE TRIGGER handle_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Insert default categories
INSERT INTO categories (name, slug, description, icon, color_from, color_to, display_order) VALUES
  ('Electronics', 'electronics', 'Computers, phones, cameras and electronic devices', 'Laptop', 'blue-500', 'cyan-500', 1),
  ('Fashion', 'fashion', 'Clothing, shoes, accessories and fashion items', 'Shirt', 'pink-500', 'rose-500', 2),
  ('Home & Garden', 'home-garden', 'Furniture, decor and garden equipment', 'Home', 'green-500', 'emerald-500', 3),
  ('Books', 'books', 'Books, magazines and reading materials', 'Book', 'amber-500', 'orange-500', 4),
  ('Watches', 'watches', 'Watches and timepieces', 'Watch', 'slate-600', 'gray-700', 5),
  ('Art & Crafts', 'art-crafts', 'Artwork, crafts and creative supplies', 'Palette', 'purple-500', 'violet-500', 6),
  ('Gaming', 'gaming', 'Video games, consoles and gaming accessories', 'Gamepad2', 'red-500', 'pink-500', 7),
  ('Mobile', 'mobile', 'Mobile phones and accessories', 'Smartphone', 'teal-500', 'cyan-500', 8)
ON CONFLICT (slug) DO NOTHING;
