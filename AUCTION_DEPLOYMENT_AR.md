# نشر نظام المزادات

هذه الدفعة تنشئ نظام المزادات محليًا، لكنها لا تطبق أي تغيير تلقائيًا على مشروع Supabase الإنتاجي.

## 1. قبل النشر

- أنشئ نسخة احتياطية من قاعدة البيانات.
- تأكد أن مجلد `supabase/migrations` يطابق مشروع الإنتاج الفعلي.
- دوّر مفتاح Resend القديم لأنه كان مكتوبًا سابقًا داخل ملفات متتبعة في Git.
- احذف أي `VITE_SUPABASE_SERVICE_ROLE_KEY` من بيئة الواجهة ودوّر المفتاح إن سبق نشره. مفتاح `service_role` لا يجوز أن يصل إلى المتصفح.
- ابدأ باستخدام PayPal Sandbox، ولا تنتقل إلى Live قبل اختبار الدفع والاسترداد وWebhook.

## 2. متغيرات الواجهة

انسخ `.env.example` إلى البيئة المحلية أو إعدادات Vercel، ثم ضع القيم العامة فقط:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_PAYPAL_CLIENT_ID=YOUR_PAYPAL_CLIENT_ID
```

## 3. أسرار Supabase Edge Functions

اضبط الأسرار التالية من لوحة Supabase أو CLI:

```powershell
supabase secrets set GEMINI_API_KEY=YOUR_KEY
supabase secrets set GEMINI_MODERATION_MODEL=gemini-2.5-flash
supabase secrets set PAYPAL_CLIENT_ID=YOUR_SERVER_CLIENT_ID
supabase secrets set PAYPAL_CLIENT_SECRET=YOUR_SERVER_CLIENT_SECRET
supabase secrets set PAYPAL_ENVIRONMENT=sandbox
supabase secrets set PAYPAL_WEBHOOK_ID=YOUR_WEBHOOK_ID
supabase secrets set RESEND_API_KEY=YOUR_NEW_RESEND_KEY
supabase secrets set FROM_EMAIL=verified@your-domain.example
supabase secrets set SITE_URL=https://your-production-domain.example
```

لا تضع `PAYPAL_CLIENT_SECRET` أو `SUPABASE_SERVICE_ROLE_KEY` في متغير يبدأ بـ `VITE_`.

## 4. تطبيق قاعدة البيانات

راجع أولًا الهجرتين بالترتيب:

1. `20260702090000_create_auction_system.sql`
2. `20260702091000_schedule_auction_jobs_and_email.sql`

ثم طبق الهجرات على بيئة اختبار مرتبطة بالمشروع:

```powershell
supabase db push
```

تحقق بعد ذلك من مهمة الإغلاق:

```sql
select jobname, schedule, active
from cron.job
where jobname = 'beckah-auction-scheduler';
```

النظام يستخدم `pg_cron` كل دقيقة لإغلاق المزادات، اختيار الفائز، ثم نقل العرض إلى صاحب ثاني أعلى سعر إذا انتهت مهلة الدفع.

## 5. نشر الدوال

```powershell
supabase functions deploy create-auction
supabase functions deploy moderate-auction
supabase functions deploy retry-auction-moderation
supabase functions deploy place-bid
supabase functions deploy set-auto-bid
supabase functions deploy close-auctions
supabase functions deploy create-auction-payment
supabase functions deploy capture-auction-payment
supabase functions deploy remove-auction
supabase functions deploy send-auction-notification
supabase functions deploy send-email
supabase functions deploy paypal-auction-webhook --no-verify-jwt
supabase functions deploy create-stripe-auction-payment
supabase functions deploy confirm-stripe-auction-payment
supabase functions deploy capture-stripe-auction-payment
supabase functions deploy stripe-auction-maintenance
supabase functions deploy stripe-auction-webhook --no-verify-jwt
```

### أسرار Stripe (نظام احتجاز المبلغ للفائز)

```powershell
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

والمفتاح المعلن في بيئة الواجهة: `VITE_STRIPE_PUBLISHABLE_KEY=pk_...`

يُنشأ Webhook في لوحة Stripe على `/functions/v1/stripe-auction-webhook` بالأحداث:
`payment_intent.amount_capturable_updated`, `payment_intent.succeeded`, `payment_intent.canceled`, `payment_intent.payment_failed`.

آلية الدفع: تفويض يدوي (احتجاز) عند دفع الفائز ← السحب عند إدخال البائع بيانات الشحن ← فك الاحتجاز تلقائياً إن لم يشحن خلال ~5.5 يوم (تحذير للبائع في اليوم الرابع، عبر مهمة `beckah-stripe-maintenance` الدورية).

دالة PayPal Webhook وحدها تُنشر بدون فحص Supabase JWT؛ وهي تتحقق داخلها من توقيع PayPal الرسمي قبل قبول الحدث.

## 6. إعداد PayPal Webhook

في تطبيق PayPal Sandbox أضف العنوان:

```text
https://YOUR_PROJECT.supabase.co/functions/v1/paypal-auction-webhook
```

وفعّل الحدث:

```text
PAYMENT.CAPTURE.COMPLETED
```

انسخ Webhook ID الناتج إلى سر `PAYPAL_WEBHOOK_ID`.

## 7. ربط البريد

التشغيل الحالي يعيد استخدام جدول `email_config` الموجود في المشروع. نفّذ من SQL Editor بحساب مالك المشروع:

```sql
select set_email_notification_settings(
  'https://YOUR_PROJECT.supabase.co',
  'YOUR_NEW_SERVICE_ROLE_KEY'
);
```

صلاحية هذه الدالة مقيدة الآن على `service_role` ومالك قاعدة البيانات. يُفضّل لاحقًا نقل هذا السر إلى Supabase Vault بدل تخزينه في جدول الإعداد الحالي.

## 8. اختبار Sandbox الإلزامي

1. أنشئ مستخدم بائع ومستخدمين مزايدين لاختبار الأدوار المختلفة.
2. أنشئ مزادًا يبدأ الآن وينتهي بعد عدة دقائق.
3. جرّب منتجًا مسموحًا، ثم منتجًا مخالفًا، وتأكد أن الثاني لا ينشر.
4. ضع مزايدتين متزامنتين وتأكد أن واحدة فقط تصبح الأعلى وفق الحد الأدنى للزيادة.
5. تأكد من وصول إشعار `outbid`.
6. انتظر الإغلاق وتأكد من إنشاء عرض الفائز ومهلة الدفع المحددة عند النشر.
7. ادفع من حساب PayPal Sandbox وتأكد من إنشاء الطلب مرة واحدة فقط.
8. اختبر عدم دفع الفائز وتأكد من انتقال الحق إلى ثاني أعلى مزايد.
9. احذف مزادًا مدفوعًا من لوحة الإدارة وتأكد أن PayPal يعيد المبلغ قبل إخفاء المزاد.
10. أعد إرسال Webhook نفسه وتأكد أنه لا ينشئ طلبًا أو دفعة مكررة.

لا يُنصح بتفعيل PayPal Live قبل نجاح السيناريوهات العشرة كاملة.
