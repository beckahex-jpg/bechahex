/*
  Sellers had NO read access to orders/order_items: the only SELECT policies
  were buyer-scoped (orders.user_id = auth.uid()), admin, and service_role.
  SellerOrdersPage and the seller dashboard therefore always saw zero sales.

  The orders policy goes through a SECURITY DEFINER helper instead of a
  direct EXISTS on order_items, because the existing "Users can view own
  order items" policy already references orders — a direct cross-reference
  would recurse.

  Deliberately SELECT-only: seller shipping updates should go through a
  dedicated function later, not a broad UPDATE policy that would let any
  seller with one item in an order rewrite the whole order row.
*/

CREATE OR REPLACE FUNCTION order_contains_seller_items(p_order_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = p_order_id AND seller_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION order_contains_seller_items(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION order_contains_seller_items(uuid) TO authenticated;

DROP POLICY IF EXISTS "Sellers view order items for their products" ON order_items;
CREATE POLICY "Sellers view order items for their products"
  ON order_items FOR SELECT TO authenticated
  USING (seller_id = auth.uid());

DROP POLICY IF EXISTS "Sellers view orders containing their items" ON orders;
CREATE POLICY "Sellers view orders containing their items"
  ON orders FOR SELECT TO authenticated
  USING (order_contains_seller_items(id));
