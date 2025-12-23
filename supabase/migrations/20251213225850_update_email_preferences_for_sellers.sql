/*
  # Update Email Preferences for Sellers and Product Notifications

  1. Changes
    - Update default email_preferences to include seller-specific notifications
    - Add product_updates preference for product approval/rejection notifications
    - Add seller_orders preference for new order notifications to sellers
    - Add admin_notifications preference for admin-specific notifications

  2. New Preferences Structure
    - order_updates: Buyer order status updates
    - shipping_updates: Shipping notifications
    - marketing_emails: Marketing and promotional emails
    - review_requests: Product review requests
    - abandoned_cart_reminders: Cart abandonment reminders
    - product_updates: Product approval/rejection notifications (for sellers)
    - seller_orders: New order notifications (for sellers)
    - admin_notifications: Admin-specific notifications (for admins)

  3. Notes
    - All existing users will keep their current preferences
    - New users will get the updated default preferences
    - Existing users' missing fields will be null (which is treated as true by the email functions)
*/

-- Update the default value for new users
ALTER TABLE profiles 
  ALTER COLUMN email_preferences 
  SET DEFAULT '{
    "order_updates": true,
    "shipping_updates": true,
    "marketing_emails": true,
    "review_requests": true,
    "abandoned_cart_reminders": true,
    "product_updates": true,
    "seller_orders": true,
    "admin_notifications": true
  }'::jsonb;

-- Update existing users who have NULL email_preferences
UPDATE profiles 
SET email_preferences = '{
  "order_updates": true,
  "shipping_updates": true,
  "marketing_emails": true,
  "review_requests": true,
  "abandoned_cart_reminders": true,
  "product_updates": true,
  "seller_orders": true,
  "admin_notifications": true
}'::jsonb
WHERE email_preferences IS NULL;

-- For existing users with email_preferences, add missing keys with true as default
UPDATE profiles 
SET email_preferences = email_preferences || jsonb_build_object(
  'product_updates', COALESCE((email_preferences->>'product_updates')::boolean, true),
  'seller_orders', COALESCE((email_preferences->>'seller_orders')::boolean, true),
  'admin_notifications', COALESCE((email_preferences->>'admin_notifications')::boolean, true)
)
WHERE email_preferences IS NOT NULL 
  AND (
    email_preferences->>'product_updates' IS NULL 
    OR email_preferences->>'seller_orders' IS NULL 
    OR email_preferences->>'admin_notifications' IS NULL
  );