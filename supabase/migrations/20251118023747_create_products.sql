/*
  # Create Products Table

  ## Purpose
  This migration creates the products table to store all items available for sale.

  ## Tables Created
    - `products`
      - `id` (uuid, primary key, auto-generated)
      - `category_id` (uuid, foreign key to categories)
      - `title` (text, not null) - Product title
      - `description` (text) - Detailed product description
      - `price` (numeric, not null) - Current selling price
      - `original_price` (numeric) - Original price before discount
      - `condition` (text, not null) - Product condition (New, Like New, Excellent, Good, Fair)
      - `images` (jsonb, default []) - Array of image URLs
      - `main_image` (text) - Main product image URL
      - `stock_quantity` (integer, default 1) - Available quantity
      - `sku` (text, unique) - Stock Keeping Unit
      - `is_featured` (boolean, default false) - Featured on homepage
      - `is_active` (boolean, default true) - Product is visible/available
      - `views_count` (integer, default 0) - Number of times viewed
      - `sold_count` (integer, default 0) - Number of times sold
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())

  ## Security
    - Enable RLS on products table
    - Anyone can view active products with stock
    - Only admins can create, update, or delete products

  ## Notes
    - Products with stock_quantity = 0 are considered out of stock
    - is_active flag allows admins to hide products without deleting
*/

-- Create products table
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  original_price numeric(10, 2) CHECK (original_price >= 0),
  condition text NOT NULL CHECK (condition IN ('New', 'Like New', 'Excellent', 'Very Good', 'Good', 'Fair')),
  images jsonb DEFAULT '[]'::jsonb,
  main_image text,
  stock_quantity integer DEFAULT 1 CHECK (stock_quantity >= 0),
  sku text UNIQUE,
  is_featured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  views_count integer DEFAULT 0,
  sold_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_is_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(price);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can view active products
CREATE POLICY "Anyone can view active products"
  ON products
  FOR SELECT
  TO public
  USING (is_active = true);

-- Policy: Admins can view all products (including inactive)
CREATE POLICY "Admins can view all products"
  ON products
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Admins can insert products
CREATE POLICY "Admins can insert products"
  ON products
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Admins can update products
CREATE POLICY "Admins can update products"
  ON products
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

-- Policy: Admins can delete products
CREATE POLICY "Admins can delete products"
  ON products
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
DROP TRIGGER IF EXISTS handle_products_updated_at ON products;
CREATE TRIGGER handle_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate SKU
CREATE OR REPLACE FUNCTION generate_sku()
RETURNS text AS $$
DECLARE
  new_sku text;
  sku_exists boolean;
BEGIN
  LOOP
    new_sku := 'MH-' || LPAD(FLOOR(RANDOM() * 1000000)::text, 6, '0');
    SELECT EXISTS(SELECT 1 FROM products WHERE sku = new_sku) INTO sku_exists;
    EXIT WHEN NOT sku_exists;
  END LOOP;
  RETURN new_sku;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate SKU if not provided
CREATE OR REPLACE FUNCTION auto_generate_sku()
RETURNS trigger AS $$
BEGIN
  IF NEW.sku IS NULL THEN
    NEW.sku := generate_sku();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_sku ON products;
CREATE TRIGGER trigger_auto_generate_sku
  BEFORE INSERT ON products
  FOR EACH ROW EXECUTE FUNCTION auto_generate_sku();
