/*
  # Add Shipping and Payment Tracking

  1. Changes to orders table
    - Add `tracking_number` (text) - رقم الشحنة
    - Add `shipping_company` (text) - شركة الشحن
    - Add `shipped_at` (timestamptz) - تاريخ الشحن
    - Add `delivered_at` (timestamptz) - تاريخ الاستلام
    - Add `confirmed_by_buyer` (boolean) - تأكيد المشتري للاستلام
    - Add `payment_released` (boolean) - هل تم تحويل المبلغ للبائع
    - Add `payment_released_at` (timestamptz) - تاريخ تحويل المبلغ
    - Add `admin_commission` (numeric) - عمولة الأدمن
    - Add `seller_amount` (numeric) - المبلغ المستحق للبائع
    - Update status enum to include shipping statuses

  2. Notes
    - Status flow: pending -> paid -> shipped -> delivered -> completed
    - Payment is released after delivery confirmation
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'tracking_number'
  ) THEN
    ALTER TABLE orders ADD COLUMN tracking_number text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'shipping_company'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipping_company text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'shipped_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN shipped_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'delivered_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN delivered_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'confirmed_by_buyer'
  ) THEN
    ALTER TABLE orders ADD COLUMN confirmed_by_buyer boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_released'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_released boolean DEFAULT false;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'payment_released_at'
  ) THEN
    ALTER TABLE orders ADD COLUMN payment_released_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'admin_commission'
  ) THEN
    ALTER TABLE orders ADD COLUMN admin_commission numeric(10,2) DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'seller_amount'
  ) THEN
    ALTER TABLE orders ADD COLUMN seller_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name = 'seller_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN seller_id uuid REFERENCES profiles(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_seller_id ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_payment_released ON orders(payment_released);
CREATE INDEX IF NOT EXISTS idx_orders_confirmed_by_buyer ON orders(confirmed_by_buyer);
