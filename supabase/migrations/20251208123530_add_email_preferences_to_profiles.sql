/*
  # Add Email Preferences to Profiles

  1. Changes
    - Add `email_notifications_enabled` (boolean) - Master toggle for all email notifications
    - Add `email_preferences` (jsonb) - Granular preferences for different email types
      - order_updates: true/false
      - shipping_updates: true/false
      - marketing_emails: true/false
      - review_requests: true/false
      - abandoned_cart_reminders: true/false

  2. Notes
    - All email preferences default to true (opt-out model)
    - Users can control each email type individually
    - Master toggle overrides all individual preferences
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email_notifications_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email_notifications_enabled boolean DEFAULT true;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'email_preferences'
  ) THEN
    ALTER TABLE profiles ADD COLUMN email_preferences jsonb DEFAULT '{
      "order_updates": true,
      "shipping_updates": true,
      "marketing_emails": true,
      "review_requests": true,
      "abandoned_cart_reminders": true
    }'::jsonb;
  END IF;
END $$;
