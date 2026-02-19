/*
  # Fix Product Submissions Links

  1. Issue
    - Many approved product_submissions have product_id = NULL
    - Products table has items with seller_id = NULL
    - Need to link them properly based on title and timestamps

  2. Changes
    - Update product_submissions to link with corresponding products
    - Update products to set seller_id from submissions
    - Add index for better performance

  3. Security
    - No RLS changes, only data fixes
*/

-- First, let's link product_submissions with products based on title and similar timestamps
UPDATE product_submissions ps
SET product_id = p.id
FROM products p
WHERE ps.status = 'approved'
  AND ps.product_id IS NULL
  AND p.title = ps.title
  AND p.seller_id IS NULL
  AND ABS(EXTRACT(EPOCH FROM (p.created_at - ps.created_at))) < 60;

-- Now update products seller_id from submissions
UPDATE products p
SET seller_id = ps.user_id
FROM product_submissions ps
WHERE ps.product_id = p.id
  AND ps.status = 'approved'
  AND p.seller_id IS NULL;

-- Add index to improve query performance
CREATE INDEX IF NOT EXISTS idx_product_submissions_product_id 
ON product_submissions(product_id);

CREATE INDEX IF NOT EXISTS idx_products_seller_id 
ON products(seller_id);
