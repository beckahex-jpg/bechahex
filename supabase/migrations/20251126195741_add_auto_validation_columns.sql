/*
  # Add Auto-Validation Columns to Product Submissions

  1. Changes
    - Add `ai_validation_status` column - Status from AI validation
    - Add `ai_suggested_price` column - AI suggested price
    - Add `ai_validation_notes` column - AI validation reasoning
    - Add `requires_manual_review` column - Flag for admin review
    - Add `auto_published` column - Track if auto-published

  2. Security
    - No changes to RLS policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_submissions' AND column_name = 'ai_validation_status'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN ai_validation_status text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_submissions' AND column_name = 'ai_suggested_price'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN ai_suggested_price numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_submissions' AND column_name = 'ai_validation_notes'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN ai_validation_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_submissions' AND column_name = 'requires_manual_review'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN requires_manual_review boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'product_submissions' AND column_name = 'auto_published'
  ) THEN
    ALTER TABLE product_submissions ADD COLUMN auto_published boolean DEFAULT false;
  END IF;
END $$;
