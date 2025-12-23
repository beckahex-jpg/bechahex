/*
  Email System Configuration Script

  هذا السكريبت يقوم بإعداد نظام البريد الإلكتروني التلقائي

  تعليمات الاستخدام:
  1. افتح Supabase Dashboard
  2. اذهب إلى SQL Editor
  3. انسخ هذا السكريبت
  4. استبدل 'YOUR_SERVICE_ROLE_KEY' بمفتاحك الحقيقي من:
     Project Settings > API > service_role (secret)
  5. شغل السكريبت
*/

-- Step 1: Verify pg_net extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Step 2: Configure email notification settings
-- IMPORTANT: Replace 'YOUR_SERVICE_ROLE_KEY' with your actual service role key
SELECT set_email_notification_settings(
  'https://moiddznrwcazaupspuxt.supabase.co',  -- Your Supabase URL
  'YOUR_SERVICE_ROLE_KEY'                      -- Replace with your actual service_role key
);

-- Step 3: Verify triggers are created
SELECT
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  tgenabled as enabled
FROM pg_trigger
WHERE tgname IN (
  'trigger_notify_admin_new_submission',
  'trigger_notify_seller_status_change',
  'trigger_notify_order_created'
)
ORDER BY tgname;

-- Step 4: Check current settings
SELECT
  current_setting('app.settings.supabase_url', true) as supabase_url_configured,
  CASE
    WHEN current_setting('app.settings.service_role_key', true) IS NOT NULL
    THEN 'YES - Configured ✓'
    ELSE 'NO - Not configured ✗'
  END as service_role_key_status;

-- Step 5: Verify email_logs table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables
  WHERE table_schema = 'public'
  AND table_name = 'email_logs'
) as email_logs_table_exists;

-- Step 6: Enable email notifications for your profile (optional)
-- Replace 'your-email@example.com' with your actual email
UPDATE profiles
SET
  email_notifications_enabled = true,
  email_preferences = jsonb_build_object(
    'order_updates', true,
    'shipping_updates', true,
    'marketing_emails', true,
    'review_requests', true,
    'abandoned_cart_reminders', true,
    'product_updates', true,
    'seller_orders', true,
    'admin_notifications', true
  )
WHERE email = 'shawkiyemen35@gmail.com';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✓ Email system configuration completed!';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Test by submitting a new product';
  RAISE NOTICE '2. Check email_logs table for sent emails';
  RAISE NOTICE '3. Verify emails arrive in your inbox';
END $$;
