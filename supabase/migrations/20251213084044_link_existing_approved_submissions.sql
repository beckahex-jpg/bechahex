/*
  # Link Existing Approved Submissions to Products

  1. Purpose
    - Find approved product_submissions without a product_id
    - Try to match them with existing products in the products table
    - Update product_id in product_submissions for matched records

  2. Matching Logic
    - Match by seller_id (user_id) and title
    - Only process records with status = 'approved' and product_id IS NULL

  3. Notes
    - This migration is idempotent and safe to run multiple times
    - It will only update records where a clear match is found
*/

DO $$
DECLARE
  submission_record RECORD;
  matching_product_id uuid;
BEGIN
  -- Loop through all approved submissions without product_id
  FOR submission_record IN
    SELECT id, user_id, title
    FROM product_submissions
    WHERE status = 'approved'
      AND product_id IS NULL
  LOOP
    -- Try to find matching product
    SELECT id INTO matching_product_id
    FROM products
    WHERE seller_id = submission_record.user_id
      AND title = submission_record.title
    LIMIT 1;

    -- If a match is found, update the submission
    IF matching_product_id IS NOT NULL THEN
      UPDATE product_submissions
      SET product_id = matching_product_id
      WHERE id = submission_record.id;

      RAISE NOTICE 'Linked submission % to product %', submission_record.id, matching_product_id;
    END IF;
  END LOOP;
END $$;
