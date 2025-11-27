/*
  # Create Orders and Order Items Tables

  ## Purpose
  This migration creates tables to manage customer orders and their items.

  ## Tables Created
    
    ### 1. `orders`
      - `id` (uuid, primary key, auto-generated)
      - `user_id` (uuid, foreign key to profiles) - Customer who placed the order
      - `order_number` (text, unique, not null) - Human-readable order number
      - `status` (text, not null) - Order status (pending, paid, processing, shipped, delivered, cancelled)
      - `subtotal` (numeric, not null) - Sum of all items before tax/shipping
      - `tax_amount` (numeric, default 0) - Tax amount
      - `shipping_amount` (numeric, default 0) - Shipping cost
      - `total_amount` (numeric, not null) - Final total amount
      - `payment_status` (text, not null) - Payment status (pending, completed, failed, refunded)
      - `payment_method` (text) - Payment method used
      - `stripe_payment_id` (text) - Stripe payment intent ID
      - `shipping_address` (jsonb) - Shipping address details
      - `billing_address` (jsonb) - Billing address details
      - `customer_email` (text, not null) - Customer email
      - `customer_phone` (text) - Customer phone
      - `notes` (text) - Order notes/comments
      - `created_at` (timestamptz, default now())
      - `updated_at` (timestamptz, default now())
      - `paid_at` (timestamptz) - When payment was completed
      - `shipped_at` (timestamptz) - When order was shipped
      - `delivered_at` (timestamptz) - When order was delivered

    ### 2. `order_items`
      - `id` (uuid, primary key, auto-generated)
      - `order_id` (uuid, foreign key to orders) - Parent order
      - `product_id` (uuid, foreign key to products) - Product purchased
      - `product_title` (text, not null) - Product title at time of purchase
      - `product_image` (text) - Product image URL
      - `quantity` (integer, not null) - Quantity purchased
      - `unit_price` (numeric, not null) - Price per unit at time of purchase
      - `total_price` (numeric, not null) - quantity × unit_price
      - `created_at` (timestamptz, default now())

  ## Security
    - Enable RLS on both tables
    - Users can view their own orders
    - Users can view items for their own orders
    - Admins can view and manage all orders

  ## Notes
    - Order numbers are auto-generated (e.g., MH-2024-000001)
    - Product details are stored in order_items to preserve historical data
*/

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  order_number text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled')),
  subtotal numeric(10, 2) NOT NULL CHECK (subtotal >= 0),
  tax_amount numeric(10, 2) DEFAULT 0 CHECK (tax_amount >= 0),
  shipping_amount numeric(10, 2) DEFAULT 0 CHECK (shipping_amount >= 0),
  total_amount numeric(10, 2) NOT NULL CHECK (total_amount >= 0),
  payment_status text NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_method text,
  stripe_payment_id text,
  shipping_address jsonb,
  billing_address jsonb,
  customer_email text NOT NULL,
  customer_phone text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  paid_at timestamptz,
  shipped_at timestamptz,
  delivered_at timestamptz
);

-- Create order_items table
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_title text NOT NULL,
  product_image text,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric(10, 2) NOT NULL CHECK (unit_price >= 0),
  total_price numeric(10, 2) NOT NULL CHECK (total_price >= 0),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product_id ON order_items(product_id);

-- Enable Row Level Security
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- Orders Policies

-- Policy: Users can view their own orders
CREATE POLICY "Users can view own orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own orders
CREATE POLICY "Users can insert own orders"
  ON orders
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Admins can view all orders
CREATE POLICY "Admins can view all orders"
  ON orders
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Admins can update all orders
CREATE POLICY "Admins can update all orders"
  ON orders
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

-- Order Items Policies

-- Policy: Users can view items from their own orders
CREATE POLICY "Users can view own order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Policy: Users can insert items for their own orders
CREATE POLICY "Users can insert own order items"
  ON order_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );

-- Policy: Admins can view all order items
CREATE POLICY "Admins can view all order items"
  ON order_items
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_admin = true
    )
  );

-- Policy: Admins can manage all order items
CREATE POLICY "Admins can manage all order items"
  ON order_items
  FOR ALL
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

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS handle_orders_updated_at ON orders;
CREATE TRIGGER handle_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS text AS $$
DECLARE
  new_order_number text;
  current_year text;
  next_sequence integer;
BEGIN
  current_year := TO_CHAR(NOW(), 'YYYY');
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 9) AS integer)), 0) + 1
  INTO next_sequence
  FROM orders
  WHERE order_number LIKE 'MH-' || current_year || '-%';
  
  new_order_number := 'MH-' || current_year || '-' || LPAD(next_sequence::text, 6, '0');
  
  RETURN new_order_number;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate order number
CREATE OR REPLACE FUNCTION auto_generate_order_number()
RETURNS trigger AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := generate_order_number();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_generate_order_number ON orders;
CREATE TRIGGER trigger_auto_generate_order_number
  BEFORE INSERT ON orders
  FOR EACH ROW EXECUTE FUNCTION auto_generate_order_number();

-- Function to update product stock after order
CREATE OR REPLACE FUNCTION update_product_stock()
RETURNS trigger AS $$
BEGIN
  -- Decrease stock when order item is created
  IF (TG_OP = 'INSERT') THEN
    UPDATE products
    SET stock_quantity = stock_quantity - NEW.quantity,
        sold_count = sold_count + NEW.quantity
    WHERE id = NEW.product_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_stock ON order_items;
CREATE TRIGGER trigger_update_product_stock
  AFTER INSERT ON order_items
  FOR EACH ROW EXECUTE FUNCTION update_product_stock();
