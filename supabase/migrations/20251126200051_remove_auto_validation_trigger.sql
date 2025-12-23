/*
  # Remove Auto-Validation Trigger

  1. Changes
    - Drop trigger and function for auto-validation
    - We're using Edge Function instead for better control
*/

DROP TRIGGER IF EXISTS trigger_auto_validate_submission ON product_submissions;
DROP FUNCTION IF EXISTS process_submission_auto_validation();
