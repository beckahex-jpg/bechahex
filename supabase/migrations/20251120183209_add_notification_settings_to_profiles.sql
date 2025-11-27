/*
  # Add Notification Settings to Profiles

  ## Changes
  - Add `notification_settings` column to `profiles` table to store user notification preferences
  
  ## Details
  - Column type: jsonb (stores JSON data for flexible settings)
  - Default value: Default notification preferences (all enabled except marketing)
  - Allows users to customize their notification preferences
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'notification_settings'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notification_settings jsonb DEFAULT '{
      "email_notifications": true,
      "order_updates": true,
      "submission_updates": true,
      "marketing_emails": false,
      "product_sold": true
    }'::jsonb;
  END IF;
END $$;