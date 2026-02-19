-- Email System Verification Script
-- Run this in Supabase SQL Editor to verify your email system setup

-- ============================================
-- 1. Check if email_logs table exists and has data
-- ============================================
SELECT
    'email_logs table' as check_name,
    COUNT(*) as record_count,
    MAX(created_at) as last_email_sent
FROM email_logs;

-- ============================================
-- 2. Check email status distribution
-- ============================================
SELECT
    'Email Status Distribution' as report_name,
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM email_logs
GROUP BY status
ORDER BY count DESC;

-- ============================================
-- 3. Check email types sent
-- ============================================
SELECT
    'Email Types Sent' as report_name,
    email_type,
    COUNT(*) as count,
    MAX(created_at) as last_sent
FROM email_logs
GROUP BY email_type
ORDER BY count DESC;

-- ============================================
-- 4. Check recent failed emails
-- ============================================
SELECT
    'Recent Failed Emails' as report_name,
    id,
    recipient_email,
    email_type,
    error_message,
    created_at
FROM email_logs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- ============================================
-- 5. Check if profiles have email preferences enabled
-- ============================================
SELECT
    'Email Preferences Status' as report_name,
    CASE
        WHEN email_notifications_enabled THEN 'Enabled'
        ELSE 'Disabled'
    END as notification_status,
    COUNT(*) as user_count
FROM profiles
GROUP BY email_notifications_enabled;

-- ============================================
-- 6. Check if admins exist for product notifications
-- ============================================
SELECT
    'Admin Users' as report_name,
    id,
    email,
    full_name,
    email_notifications_enabled
FROM profiles
WHERE role = 'admin';

-- ============================================
-- 7. Check cart_abandonment_tracking table
-- ============================================
SELECT
    'Abandoned Cart Tracking' as report_name,
    COUNT(*) as total_abandonments,
    COUNT(CASE WHEN reminder_sent_at IS NOT NULL THEN 1 END) as reminders_sent,
    COUNT(CASE WHEN recovered_at IS NOT NULL THEN 1 END) as recovered_carts
FROM cart_abandonment_tracking;

-- ============================================
-- 8. Check review_requests table
-- ============================================
SELECT
    'Review Requests' as report_name,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN review_submitted_at IS NOT NULL THEN 1 END) as reviews_submitted
FROM review_requests;

-- ============================================
-- 9. Verify all required tables exist
-- ============================================
SELECT
    'Database Tables Check' as report_name,
    table_name,
    CASE
        WHEN table_name IN (
            'email_logs',
            'cart_abandonment_tracking',
            'review_requests',
            'profiles',
            'orders',
            'order_items',
            'products',
            'product_submissions'
        ) THEN '✓ Required'
        ELSE 'Optional'
    END as table_status
FROM information_schema.tables
WHERE table_schema = 'public'
    AND table_name IN (
        'email_logs',
        'cart_abandonment_tracking',
        'review_requests',
        'profiles',
        'orders',
        'order_items',
        'products',
        'product_submissions'
    )
ORDER BY table_name;

-- ============================================
-- 10. Check RLS policies on email-related tables
-- ============================================
SELECT
    'RLS Policies Check' as report_name,
    schemaname,
    tablename,
    policyname,
    cmd as policy_command,
    CASE
        WHEN qual IS NOT NULL THEN 'Has USING clause'
        ELSE 'No USING clause'
    END as using_status
FROM pg_policies
WHERE tablename IN ('email_logs', 'profiles', 'product_submissions', 'orders')
ORDER BY tablename, policyname;

-- ============================================
-- SUMMARY REPORT
-- ============================================
WITH email_stats AS (
    SELECT
        COUNT(*) as total_emails,
        COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_emails,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_emails,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_emails,
        MAX(created_at) as last_email_time
    FROM email_logs
),
profile_stats AS (
    SELECT
        COUNT(*) as total_users,
        COUNT(CASE WHEN email_notifications_enabled THEN 1 END) as enabled_notifications
    FROM profiles
),
admin_stats AS (
    SELECT COUNT(*) as admin_count
    FROM profiles
    WHERE role = 'admin'
)
SELECT
    '=== EMAIL SYSTEM SUMMARY ===' as summary_title,
    json_build_object(
        'total_emails_sent', COALESCE(e.total_emails, 0),
        'successful_emails', COALESCE(e.sent_emails, 0),
        'failed_emails', COALESCE(e.failed_emails, 0),
        'pending_emails', COALESCE(e.pending_emails, 0),
        'success_rate', CASE
            WHEN e.total_emails > 0 THEN
                ROUND((e.sent_emails::numeric / e.total_emails::numeric) * 100, 2)
            ELSE 0
        END || '%',
        'last_email_sent', e.last_email_time,
        'total_users', p.total_users,
        'users_with_notifications_enabled', p.enabled_notifications,
        'admin_users_count', a.admin_count,
        'system_status', CASE
            WHEN e.total_emails > 0 AND e.sent_emails > 0 THEN '✅ Active'
            WHEN e.total_emails = 0 THEN '⚠️ No emails sent yet'
            ELSE '❌ Issues detected'
        END
    ) as system_stats
FROM email_stats e
CROSS JOIN profile_stats p
CROSS JOIN admin_stats a;

-- ============================================
-- RECOMMENDATIONS
-- ============================================
SELECT
    'System Recommendations' as section_title,
    CASE
        WHEN (SELECT COUNT(*) FROM email_logs) = 0 THEN
            '⚠️ No emails have been sent yet. Test the system by creating a user or submitting a product.'
        WHEN (SELECT COUNT(*) FROM email_logs WHERE status = 'failed') > (SELECT COUNT(*) FROM email_logs WHERE status = 'sent') THEN
            '❌ More emails are failing than succeeding. Check your RESEND_API_KEY configuration.'
        WHEN (SELECT COUNT(*) FROM profiles WHERE role = 'admin') = 0 THEN
            '⚠️ No admin users found. Product submission notifications won''t be sent.'
        WHEN (SELECT COUNT(*) FROM profiles WHERE email_notifications_enabled = false) > (SELECT COUNT(*) FROM profiles) * 0.5 THEN
            'ℹ️ More than 50% of users have disabled email notifications.'
        ELSE
            '✅ Email system appears to be working correctly!'
    END as recommendation;
