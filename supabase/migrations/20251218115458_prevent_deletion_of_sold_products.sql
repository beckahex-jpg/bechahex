/*
  # Prevent Deletion of Sold Products

  1. Changes
    - Create trigger to prevent deletion of products that have sales (order_items)
    - Products with sales history must be preserved for data integrity
    - Sellers will get a clear error message if they try to delete sold products

  2. Security
    - Maintains data integrity for orders and sales history
    - Prevents accidental data loss

  3. Notes
    - This ensures sellers can always see their sales history
    - Products can only be deleted if they have no associated order_items
*/

-- Function to check if product has sales before deletion
CREATE OR REPLACE FUNCTION check_product_has_sales()
RETURNS trigger AS $$
DECLARE
  sales_count integer;
BEGIN
  -- Check if the product has any order_items
  SELECT COUNT(*) INTO sales_count
  FROM order_items
  WHERE product_id = OLD.id;

  -- If product has sales, prevent deletion
  IF sales_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete product with sales history. This product has % sale(s). Consider archiving instead.', sales_count;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent deletion of sold products
DROP TRIGGER IF EXISTS prevent_sold_product_deletion ON products;
CREATE TRIGGER prevent_sold_product_deletion
  BEFORE DELETE ON products
  FOR EACH ROW
  EXECUTE FUNCTION check_product_has_sales();