/*
  # Add notification_settings column to profiles

  1. Changes
    - Add `notification_settings` JSONB column to profiles table
    - Set default value with all notification preferences
    - Migrate existing notification columns to new JSONB format
  
  2. Notes
    - This allows flexible notification preferences storage
    - Maintains backwards compatibility by keeping old columns
*/

-- Add notification_settings column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'notification_settings'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notification_settings JSONB DEFAULT '{
      "email_notifications": true,
      "order_updates": true,
      "submission_updates": true,
      "marketing_emails": false,
      "product_sold": true
    }'::jsonb;
  END IF;
END $$;

-- Migrate existing data from old columns to new JSONB column
UPDATE profiles
SET notification_settings = jsonb_build_object(
  'email_notifications', true,
  'order_updates', COALESCE(notification_order_updates, true),
  'submission_updates', COALESCE(notification_product_updates, true),
  'marketing_emails', COALESCE(notification_promotions, false),
  'product_sold', true
)
WHERE notification_settings IS NULL OR notification_settings = '{}'::jsonb;
