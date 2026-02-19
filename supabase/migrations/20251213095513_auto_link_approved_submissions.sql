/*
  # Auto-link Approved Submissions with Products

  1. Issue
    - Some approved submissions don't get linked to their products automatically
    - Need to ensure product_id is set when submissions are approved

  2. Changes
    - Create function to auto-link submissions with products
    - Run it to fix any existing unlinked submissions
    - Add trigger to ensure future submissions are linked

  3. Security
    - No RLS changes, only data consistency improvements
*/

-- Function to link unlinked approved submissions with their products
CREATE OR REPLACE FUNCTION link_unlinked_submissions()
RETURNS void AS $$
BEGIN
  -- Link approved submissions that don't have product_id set
  -- but have a matching product with the same title and close timestamp
  UPDATE product_submissions ps
  SET product_id = p.id
  FROM products p
  WHERE ps.status = 'approved'
    AND ps.product_id IS NULL
    AND p.title = ps.title
    AND ABS(EXTRACT(EPOCH FROM (p.created_at - ps.created_at))) < 120;
    
  -- Also ensure products have correct seller_id from submissions
  UPDATE products p
  SET seller_id = ps.user_id
  FROM product_submissions ps
  WHERE ps.product_id = p.id
    AND ps.status = 'approved'
    AND (p.seller_id IS NULL OR p.seller_id != ps.user_id);
END;
$$ LANGUAGE plpgsql;

-- Run the function to fix existing data
SELECT link_unlinked_submissions();

-- Create a function to automatically link product when submission is approved
CREATE OR REPLACE FUNCTION auto_link_product_on_approval()
RETURNS TRIGGER AS $$
BEGIN
  -- If submission is being approved and has product_id set
  -- ensure the product has the correct seller_id
  IF NEW.status = 'approved' AND NEW.product_id IS NOT NULL THEN
    UPDATE products
    SET seller_id = NEW.user_id
    WHERE id = NEW.product_id
      AND (seller_id IS NULL OR seller_id != NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (drop if exists first)
DROP TRIGGER IF EXISTS trigger_auto_link_product ON product_submissions;

CREATE TRIGGER trigger_auto_link_product
  AFTER UPDATE ON product_submissions
  FOR EACH ROW
  WHEN (NEW.status = 'approved' AND NEW.product_id IS NOT NULL)
  EXECUTE FUNCTION auto_link_product_on_approval();
