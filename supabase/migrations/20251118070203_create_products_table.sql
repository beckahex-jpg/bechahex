/*
  # Create Products Table

  1. New Tables
    - `products`
      - `id` (uuid, primary key) - Unique identifier
      - `title` (text) - Product title
      - `description` (text) - Detailed description
      - `price` (numeric) - Current price
      - `original_price` (numeric) - Original/retail price
      - `condition` (text) - Product condition (Like New, Excellent, Good, etc.)
      - `category_id` (uuid) - Foreign key to categories
      - `image_url` (text) - Product image URL
      - `status` (text) - Product status (available, sold, pending)
      - `seller_id` (uuid) - Foreign key to auth.users (who donated/listed)
      - `created_at` (timestamptz) - Creation timestamp
      - `updated_at` (timestamptz) - Last update timestamp
      
  2. Security
    - Enable RLS on `products` table
    - Add policy for public read access to available products
    - Add policy for authenticated users to insert products
    - Add policy for sellers to update their own products
*/

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  price numeric(10, 2) NOT NULL CHECK (price >= 0),
  original_price numeric(10, 2) CHECK (original_price >= 0),
  condition text NOT NULL DEFAULT 'Good',
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  image_url text DEFAULT '',
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'sold', 'pending')),
  seller_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available products"
  ON products FOR SELECT
  TO anon, authenticated
  USING (status = 'available' OR seller_id = auth.uid());

CREATE POLICY "Authenticated users can insert products"
  ON products FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update their own products"
  ON products FOR UPDATE
  TO authenticated
  USING (auth.uid() = seller_id)
  WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete their own products"
  ON products FOR DELETE
  TO authenticated
  USING (auth.uid() = seller_id);