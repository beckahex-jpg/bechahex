/*
  Fix: orders.order_number is missing in the live database.

  The frontend (order lists, review page, emails, notifications) expects
  orders.order_number, but the live orders table was created without it,
  so pages that select the column explicitly fail with
  "column orders.order_number does not exist".

  This script:
    1. Adds the order_number column.
    2. Backfills existing orders as MH-YYYY-000001 style numbers.
    3. Adds a unique index.
    4. Auto-generates the number for every new order via trigger
       (race-free, sequence-based; unaffected by RLS).

  Apply in: Supabase Dashboard -> SQL Editor -> paste everything -> Run.
  Safe to run more than once.
*/

-- 1) Column
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS order_number text;

-- 2) Backfill existing rows in creation order
WITH numbered AS (
  SELECT
    id,
    TO_CHAR(created_at, 'YYYY') AS yr,
    ROW_NUMBER() OVER (ORDER BY created_at) AS seq
  FROM public.orders
  WHERE order_number IS NULL
)
UPDATE public.orders o
SET order_number = 'MH-' || n.yr || '-' || LPAD(n.seq::text, 6, '0')
FROM numbered n
WHERE o.id = n.id;

-- 3) Uniqueness
CREATE UNIQUE INDEX IF NOT EXISTS orders_order_number_key
  ON public.orders (order_number);

-- 4) Sequence for new orders, starting after the backfilled rows
CREATE SEQUENCE IF NOT EXISTS public.order_number_seq;
SELECT setval(
  'public.order_number_seq',
  GREATEST((SELECT COUNT(*) FROM public.orders), 1)
);

-- 5) Trigger: fill order_number automatically on INSERT
CREATE OR REPLACE FUNCTION public.auto_generate_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'MH-' || TO_CHAR(NOW(), 'YYYY') || '-'
      || LPAD(nextval('public.order_number_seq')::text, 6, '0');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_auto_generate_order_number ON public.orders;
CREATE TRIGGER trigger_auto_generate_order_number
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.auto_generate_order_number();

-- Verification: every order should now have a number
SELECT id, order_number, status, created_at
FROM public.orders
ORDER BY created_at DESC
LIMIT 10;
