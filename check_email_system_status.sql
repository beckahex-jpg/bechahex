/*
  سكريبت التحقق السريع من حالة نظام البريد الإلكتروني

  استخدم هذا السكريبت للتحقق من حالة النظام في أي وقت
*/

-- 1. التحقق من تفعيل pg_net
SELECT
  CASE
    WHEN COUNT(*) > 0 THEN '✓ pg_net مفعّلة'
    ELSE '✗ pg_net غير مفعّلة'
  END as pg_net_status
FROM pg_extension
WHERE extname = 'pg_net';

-- 2. التحقق من إعدادات قاعدة البيانات
SELECT
  CASE
    WHEN current_setting('app.settings.supabase_url', true) IS NOT NULL
    THEN '✓ Supabase URL مكونة'
    ELSE '✗ Supabase URL غير مكونة'
  END as supabase_url_status,
  CASE
    WHEN current_setting('app.settings.service_role_key', true) IS NOT NULL
    THEN '✓ Service Role Key مكونة'
    ELSE '✗ Service Role Key غير مكونة - تحتاج إعداد!'
  END as service_role_key_status;

-- 3. التحقق من وجود Triggers
SELECT
  COUNT(*) as active_triggers,
  CASE
    WHEN COUNT(*) = 3 THEN '✓ جميع Triggers مفعلة (3/3)'
    ELSE '✗ بعض Triggers مفقودة'
  END as triggers_status
FROM pg_trigger
WHERE tgname IN (
  'trigger_notify_admin_new_submission',
  'trigger_notify_seller_status_change',
  'trigger_notify_order_created'
)
AND tgenabled = 'O';

-- 4. قائمة Triggers التفصيلية
SELECT
  tgname as trigger_name,
  tgrelid::regclass as table_name,
  CASE tgenabled
    WHEN 'O' THEN '✓ Enabled'
    WHEN 'D' THEN '✗ Disabled'
  END as status
FROM pg_trigger
WHERE tgname IN (
  'trigger_notify_admin_new_submission',
  'trigger_notify_seller_status_change',
  'trigger_notify_order_created'
)
ORDER BY tgname;

-- 5. التحقق من جدول email_logs
SELECT
  CASE
    WHEN EXISTS (
      SELECT FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name = 'email_logs'
    ) THEN '✓ جدول email_logs موجود'
    ELSE '✗ جدول email_logs مفقود'
  END as email_logs_table_status;

-- 6. إحصائيات البريد الإلكتروني (آخر 7 أيام)
SELECT
  COUNT(*) as total_emails,
  COUNT(*) FILTER (WHERE status = 'sent') as sent,
  COUNT(*) FILTER (WHERE status = 'failed') as failed,
  COUNT(*) FILTER (WHERE status = 'pending') as pending
FROM email_logs
WHERE created_at >= NOW() - INTERVAL '7 days';

-- 7. آخر 10 رسائل بريد إلكتروني
SELECT
  email_type,
  recipient_email,
  status,
  subject,
  created_at,
  CASE
    WHEN status = 'failed' THEN error_message
    ELSE NULL
  END as error
FROM email_logs
ORDER BY created_at DESC
LIMIT 10;

-- 8. التحقق من إعدادات المستخدم
SELECT
  email,
  email_notifications_enabled,
  email_preferences,
  role
FROM profiles
WHERE email = 'shawkiyemen35@gmail.com'
LIMIT 1;

-- ملخص الحالة
DO $$
DECLARE
  supabase_url text;
  service_key text;
  pg_net_count int;
  triggers_count int;
BEGIN
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  SELECT COUNT(*) INTO pg_net_count FROM pg_extension WHERE extname = 'pg_net';

  SELECT COUNT(*) INTO triggers_count
  FROM pg_trigger
  WHERE tgname IN (
    'trigger_notify_admin_new_submission',
    'trigger_notify_seller_status_change',
    'trigger_notify_order_created'
  )
  AND tgenabled = 'O';

  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE 'حالة نظام البريد الإلكتروني';
  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '';

  IF pg_net_count > 0 THEN
    RAISE NOTICE '✓ pg_net Extension: مفعّلة';
  ELSE
    RAISE NOTICE '✗ pg_net Extension: غير مفعّلة';
  END IF;

  IF supabase_url IS NOT NULL THEN
    RAISE NOTICE '✓ Supabase URL: مكونة';
  ELSE
    RAISE NOTICE '✗ Supabase URL: غير مكونة';
  END IF;

  IF service_key IS NOT NULL THEN
    RAISE NOTICE '✓ Service Role Key: مكونة';
  ELSE
    RAISE NOTICE '✗ Service Role Key: غير مكونة - تحتاج إعداد!';
  END IF;

  IF triggers_count = 3 THEN
    RAISE NOTICE '✓ Database Triggers: جميعها مفعلة (3/3)';
  ELSE
    RAISE NOTICE '✗ Database Triggers: بعضها مفقود (% من 3)', triggers_count;
  END IF;

  RAISE NOTICE '';
  RAISE NOTICE '═══════════════════════════════════════';

  IF pg_net_count > 0 AND triggers_count = 3 AND supabase_url IS NOT NULL AND service_key IS NOT NULL THEN
    RAISE NOTICE '✓ النظام جاهز للعمل!';
  ELSE
    RAISE NOTICE '⚠ النظام يحتاج إعداد إضافي';
    IF service_key IS NULL THEN
      RAISE NOTICE '→ قم بتشغيل: SELECT set_email_notification_settings(...)';
    END IF;
  END IF;

  RAISE NOTICE '═══════════════════════════════════════';
END $$;
