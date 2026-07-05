/*
  Sellers have no UPDATE policy on orders (by design — a broad policy would
  let any seller with one item rewrite the whole order row). Shipping updates
  therefore go through this narrow SECURITY DEFINER function: it verifies the
  caller actually sells items in the order, updates only the shipping fields,
  and notifies the buyer — atomically.
*/

CREATE OR REPLACE FUNCTION mark_order_shipped(
  p_order_id uuid,
  p_shipping_company text,
  p_tracking_number text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_order orders%ROWTYPE;
  v_company text := btrim(coalesce(p_shipping_company, ''));
  v_tracking text := btrim(coalesce(p_tracking_number, ''));
  v_now timestamptz := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '28000';
  END IF;

  IF v_company = '' OR char_length(v_company) > 100
     OR v_tracking = '' OR char_length(v_tracking) > 100 THEN
    RAISE EXCEPTION 'Shipping company and tracking number are required' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM order_items
    WHERE order_id = p_order_id AND seller_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Only the seller of this order can update shipping' USING ERRCODE = '42501';
  END IF;

  IF v_order.status IN ('delivered', 'cancelled') OR v_order.confirmed_by_buyer THEN
    RAISE EXCEPTION 'This order can no longer be updated' USING ERRCODE = '55000';
  END IF;

  UPDATE orders SET
    shipping_company = v_company,
    tracking_number = v_tracking,
    shipped_at = COALESCE(shipped_at, v_now),
    status = 'shipped'
  WHERE id = p_order_id;

  INSERT INTO notifications (user_id, type, title, message, data)
  VALUES (
    v_order.user_id,
    'order_shipped',
    'Order Shipped!',
    'Your order #' || v_order.order_number || ' has been shipped via ' || v_company || '. Tracking number: ' || v_tracking,
    jsonb_build_object(
      'order_id', v_order.id,
      'order_number', v_order.order_number,
      'tracking_number', v_tracking,
      'shipping_company', v_company
    )
  );

  RETURN jsonb_build_object('order_id', v_order.id, 'status', 'shipped');
END;
$$;

REVOKE ALL ON FUNCTION mark_order_shipped(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION mark_order_shipped(uuid, text, text) TO authenticated;
