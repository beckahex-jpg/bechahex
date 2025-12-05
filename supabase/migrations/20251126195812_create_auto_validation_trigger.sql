/*
  # Create Auto-Validation Trigger

  1. New Functions
    - `process_submission_auto_validation()` - Calls Edge Function to validate and price product
    - Automatically publishes approved products
    - Creates notifications for admin and user

  2. Triggers
    - Trigger on product_submissions INSERT to auto-validate
*/

-- Create function to process auto-validation
CREATE OR REPLACE FUNCTION process_submission_auto_validation()
RETURNS TRIGGER AS $$
DECLARE
  v_category_name text;
  v_validation_result jsonb;
  v_product_id uuid;
BEGIN
  -- Get category name
  SELECT name INTO v_category_name
  FROM categories
  WHERE id = NEW.category_id;

  -- Call Edge Function for validation
  SELECT content::jsonb INTO v_validation_result
  FROM http((
    'POST',
    current_setting('app.supabase_url') || '/functions/v1/auto-validate-product',
    ARRAY[
      http_header('Content-Type', 'application/json'),
      http_header('Authorization', 'Bearer ' || current_setting('app.supabase_anon_key'))
    ],
    'application/json',
    json_build_object(
      'submission_id', NEW.id,
      'title', NEW.title,
      'description', NEW.description,
      'category', COALESCE(v_category_name, 'Unknown'),
      'images', NEW.images,
      'user_price', NEW.price
    )::text
  )::http_request);

  -- Update submission with validation results
  IF v_validation_result->>'approved' = 'true' THEN
    -- Product is approved, auto-publish
    UPDATE product_submissions
    SET 
      ai_validation_status = 'approved',
      ai_suggested_price = (v_validation_result->>'suggested_price')::numeric,
      ai_validation_notes = v_validation_result->>'pricing_reasoning',
      requires_manual_review = false,
      auto_published = true,
      status = 'approved',
      reviewed_at = now()
    WHERE id = NEW.id;

    -- Create product automatically
    INSERT INTO products (
      title,
      description,
      category_id,
      condition,
      price,
      original_price,
      stock,
      images,
      created_at
    ) VALUES (
      NEW.title,
      NEW.description,
      NEW.category_id,
      NEW.condition,
      (v_validation_result->>'suggested_price')::numeric,
      NEW.original_price,
      1,
      NEW.images,
      now()
    ) RETURNING id INTO v_product_id;

    -- Notify admin
    INSERT INTO notifications (user_id, type, title, message, link, created_at)
    SELECT 
      id,
      'system',
      'Auto-Published Product',
      'Product "' || NEW.title || '" was automatically validated and published. AI suggested price: $' || (v_validation_result->>'suggested_price'),
      '/admin/products',
      now()
    FROM profiles
    WHERE role = 'admin';

    -- Notify user
    INSERT INTO notifications (user_id, type, title, message, link, created_at)
    VALUES (
      NEW.user_id,
      'success',
      'Product Published!',
      'Your product "' || NEW.title || '" has been automatically approved and published.',
      '/dashboard',
      now()
    );

  ELSE
    -- Product requires manual review
    UPDATE product_submissions
    SET 
      ai_validation_status = 'flagged',
      ai_validation_notes = v_validation_result->>'reason',
      requires_manual_review = true,
      status = 'pending'
    WHERE id = NEW.id;

    -- Notify admin for review
    INSERT INTO notifications (user_id, type, title, message, link, created_at)
    SELECT 
      id,
      'warning',
      'Product Requires Review',
      'Product "' || NEW.title || '" requires manual review. Reason: ' || (v_validation_result->>'reason'),
      '/admin/submissions',
      now()
    FROM profiles
    WHERE role = 'admin';

    -- Notify user
    INSERT INTO notifications (user_id, type, title, message, link, created_at)
    VALUES (
      NEW.user_id,
      'info',
      'Product Under Review',
      'Your product "' || NEW.title || '" is being reviewed by our team. We will notify you once it is approved.',
      '/dashboard',
      now()
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- On error, flag for manual review
    UPDATE product_submissions
    SET 
      ai_validation_status = 'error',
      ai_validation_notes = 'Validation error: ' || SQLERRM,
      requires_manual_review = true
    WHERE id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_auto_validate_submission ON product_submissions;
CREATE TRIGGER trigger_auto_validate_submission
  AFTER INSERT ON product_submissions
  FOR EACH ROW
  EXECUTE FUNCTION process_submission_auto_validation();
