# دليل إكمال إعداد نظام البريد الإلكتروني

## حالة النظام الحالية ✓

تم التحقق من التالي وكل شيء جاهز:

- ✓ **pg_net Extension**: مفعّلة (الإصدار 0.19.5)
- ✓ **Database Triggers**: جميع triggers موجودة ومفعلة (3 triggers)
- ✓ **Email Preferences**: إعدادات البريد مفعلة لحسابك
- ✓ **Edge Functions Secrets**: تم إضافة RESEND_API_KEY و FROM_EMAIL و SITE_URL

## ما المطلوب لإكمال الإعداد؟

هناك خطوة واحدة فقط متبقية: **تكوين إعدادات قاعدة البيانات**

النظام يحتاج معرفة عنوان Supabase URL ومفتاح Service Role Key لكي يتمكن من إرسال البريد الإلكتروني تلقائياً عند حدوث أحداث معينة (مثل: رفع منتج جديد، موافقة على منتج، إنشاء طلب).

---

## الخطوة المطلوبة

### 1. احصل على Service Role Key

1. اذهب إلى [Supabase Dashboard](https://supabase.com/dashboard)
2. افتح مشروعك
3. اذهب إلى: **Project Settings** > **API**
4. انزل للأسفل حتى تجد **Project API keys**
5. انسخ المفتاح المسمى: **`service_role`** (secret)

   ⚠️ **مهم جداً**: هذا المفتاح سري ولا يجب مشاركته مع أحد!

### 2. شغّل الأمر في Supabase SQL Editor

1. في Supabase Dashboard، اذهب إلى: **SQL Editor**
2. انسخ والصق هذا الأمر:

```sql
SELECT set_email_notification_settings(
  'https://moiddznrwcazaupspuxt.supabase.co',
  'YOUR_SERVICE_ROLE_KEY_HERE'
);
```

3. **استبدل** `YOUR_SERVICE_ROLE_KEY_HERE` بالمفتاح الذي نسخته في الخطوة السابقة
4. اضغط **Run** أو **F5**

### 3. تحقق من نجاح الإعداد

بعد تشغيل الأمر، شغّل هذا الأمر للتحقق:

```sql
SELECT
  current_setting('app.settings.supabase_url', true) as supabase_url,
  CASE
    WHEN current_setting('app.settings.service_role_key', true) IS NOT NULL
    THEN '✓ تم التكوين بنجاح'
    ELSE '✗ لم يتم التكوين بعد'
  END as status;
```

يجب أن ترى:
- `supabase_url`: عنوان مشروعك
- `status`: ✓ تم التكوين بنجاح

---

## اختبار النظام

بعد إكمال الإعداد، اختبر النظام بالطرق التالية:

### 1. اختبار إشعار رفع منتج جديد

1. ارفع منتج جديد من صفحة "Submit Product"
2. بعد الرفع، شغّل هذا الأمر لمعرفة حالة البريد:

```sql
SELECT
  email_type,
  recipient_email,
  status,
  subject,
  created_at,
  error_message
FROM email_logs
WHERE email_type = 'product_submission'
ORDER BY created_at DESC
LIMIT 5;
```

3. تحقق من بريدك الإلكتروني (shawkiyemen35@gmail.com)

### 2. اختبار إشعار الموافقة على منتج

1. كـ Admin، وافق على منتج من لوحة الإدارة
2. تحقق من جدول email_logs:

```sql
SELECT
  email_type,
  recipient_email,
  status,
  created_at
FROM email_logs
WHERE email_type = 'product_approved'
ORDER BY created_at DESC
LIMIT 5;
```

### 3. اختبار إشعار الطلب الجديد

1. قم بإنشاء طلب شراء
2. يجب أن يتم إرسال بريدين:
   - بريد تأكيد الطلب للمشتري
   - بريد إشعار طلب جديد للبائع

```sql
SELECT
  email_type,
  recipient_email,
  status,
  created_at
FROM email_logs
WHERE email_type IN ('order_confirmation', 'new_order_seller')
ORDER BY created_at DESC
LIMIT 10;
```

---

## استكشاف الأخطاء

### إذا لم يتم إرسال البريد:

1. **تحقق من email_logs للأخطاء:**
```sql
SELECT
  email_type,
  recipient_email,
  status,
  error_message,
  created_at
FROM email_logs
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;
```

2. **تحقق من أن Resend API Key صحيح:**
   - اذهب إلى: [Resend Dashboard](https://resend.com/api-keys)
   - تأكد من أن API Key نشط وليس منتهي الصلاحية

3. **تحقق من FROM_EMAIL:**
   - يجب أن يكون البريد: `info@beckahex.org`
   - تأكد من أن هذا البريد مسجل ومعتمد في Resend

4. **تحقق من إعدادات البريد في Profile:**
```sql
SELECT
  email,
  email_notifications_enabled,
  email_preferences
FROM profiles
WHERE email = 'shawkiyemen35@gmail.com';
```

---

## ملفات مساعدة تم إنشاؤها

تم إنشاء ملف SQL جاهز للاستخدام:
- **`configure_email_system.sql`**: سكريبت كامل لإعداد النظام والتحقق منه

يمكنك فتح هذا الملف ونسخ الأوامر منه مباشرة.

---

## معلومات النظام

### Triggers المفعلة:
1. `trigger_notify_admin_new_submission` - على جدول `product_submissions`
2. `trigger_notify_seller_status_change` - على جدول `product_submissions`
3. `trigger_notify_order_created` - على جدول `orders`

### Edge Functions الموجودة:
1. `send-email` - الوظيفة الرئيسية لإرسال البريد
2. `send-product-submission-to-admin` - إشعار Admin برفع منتج
3. `send-product-status-notification` - إشعار البائع بحالة المنتج
4. `send-order-confirmation` - تأكيد الطلب للمشتري
5. `send-new-order-to-seller` - إشعار البائع بطلب جديد
6. `send-welcome-email` - بريد الترحيب للأعضاء الجدد

---

## الخلاصة

**الخطوة الوحيدة المتبقية:**
شغّل أمر `set_email_notification_settings` في SQL Editor مع Service Role Key الصحيح.

بعد ذلك، النظام سيعمل تلقائياً وسيرسل البريد الإلكتروني عند:
- رفع منتج جديد
- الموافقة على منتج أو رفضه
- إنشاء طلب جديد
- تغيير حالة الطلب
- وأحداث أخرى

---

## دعم

إذا واجهت أي مشاكل، تحقق من:
- جدول `email_logs` للأخطاء
- Supabase Logs في Dashboard
- Resend Logs في [Resend Dashboard](https://resend.com/emails)

**الوثائق المفيدة:**
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Resend API Docs](https://resend.com/docs)
- [pg_net Extension](https://github.com/supabase/pg_net)
