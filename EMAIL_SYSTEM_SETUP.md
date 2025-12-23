# Email Notification System Setup Guide

## Overview
This guide explains how to configure and use the comprehensive email notification system for Beckah Marketplace.

## System Architecture

The email system consists of:
1. **Email Templates** - Pre-designed HTML email templates
2. **Edge Functions** - Serverless functions that send emails
3. **Database Triggers** - Automatic email triggers on database events
4. **Email Preferences** - User-configurable notification settings

## Required Configuration

### 1. Resend API Key Setup

You need to configure the Resend API key in Supabase:

1. Go to your Supabase Dashboard
2. Navigate to Project Settings > Edge Functions > Secrets
3. Add the following secrets:
   - `RESEND_API_KEY`: Your Resend API key (get it from https://resend.com)
   - `FROM_EMAIL`: The email address to send from (e.g., "noreply@beckahex.org")
   - `SITE_URL`: Your website URL (e.g., "https://beckahex.org")

### 2. Database Configuration

The database triggers need to know your Supabase URL and service role key. Run this SQL command in the Supabase SQL Editor:

```sql
SELECT set_email_notification_settings(
  'YOUR_SUPABASE_URL',  -- e.g., 'https://xxxxx.supabase.co'
  'YOUR_SERVICE_ROLE_KEY'
);
```

**Important**: Replace the placeholders with your actual values from the Supabase dashboard.

### 3. Enable pg_net Extension

The system uses `pg_net` for async HTTP calls. It should be enabled automatically, but if you encounter issues, run:

```sql
CREATE EXTENSION IF NOT EXISTS pg_net;
```

## Edge Functions

The following Edge Functions have been created:

### Core Email Functions

- **send-email**: Main email sending function (uses Resend API)
- **send-welcome-email**: Sends welcome email to new users
- **send-order-confirmation**: Sends order confirmation to buyers
- **send-order-status-update**: Notifies users of order status changes

### Seller & Product Functions

- **send-product-submission-to-admin**: Notifies admin of new product submissions
- **send-product-status-notification**: Notifies sellers when products are approved/rejected
- **send-new-order-to-seller**: Notifies sellers when their products are purchased

### Other Functions

- **send-shipping-notification**: Notifies buyers when orders are shipped
- **send-delivery-confirmation**: Confirms delivery and requests reviews
- **send-abandoned-cart**: Reminds users of items left in cart
- **send-review-request**: Requests product reviews after delivery

## Automatic Email Triggers

The following database triggers automatically send emails:

### 1. New Product Submission
**Trigger**: `trigger_notify_admin_new_submission`
- **When**: A new product is submitted for review
- **Who receives**: All admin users
- **Email type**: Product submission notification

### 2. Product Status Change
**Trigger**: `trigger_notify_seller_status_change`
- **When**: A product submission is approved or rejected
- **Who receives**: The seller (product owner)
- **Email type**: Approval or rejection notification

### 3. New Order Created
**Trigger**: `trigger_notify_order_created`
- **When**: A new order is created
- **Who receives**:
  - Buyer: Order confirmation email
  - Seller: New order notification email
- **Email types**: Order confirmation and new order notification

## Email Preferences

Users can control which emails they receive through the `profiles.email_preferences` JSONB field:

```json
{
  "order_updates": true,              // Order status updates
  "shipping_updates": true,           // Shipping notifications
  "marketing_emails": true,           // Marketing and promotions
  "review_requests": true,            // Product review requests
  "abandoned_cart_reminders": true,   // Cart abandonment reminders
  "product_updates": true,            // Product approval/rejection (sellers)
  "seller_orders": true,              // New order notifications (sellers)
  "admin_notifications": true         // Admin-specific notifications
}
```

Users can also completely disable email notifications by setting `email_notifications_enabled` to `false` in their profile.

## Email Templates

All email templates are defined in `supabase/functions/email-templates.ts`. The templates include:

- `welcome`: Welcome email for new users
- `order_confirmation`: Order confirmation for buyers
- `shipping_notification`: Shipping notification
- `delivery_confirmation`: Delivery confirmation and review request
- `abandoned_cart`: Cart abandonment reminder
- `review_request`: Product review request
- `payment_transferred_to_seller`: Payment transfer notification for sellers
- `product_submission_to_admin`: New product submission notification for admins
- `product_approved`: Product approval notification for sellers
- `product_rejected`: Product rejection notification for sellers
- `new_order_to_seller`: New order notification for sellers

## Email Logging

All sent emails are logged in the `email_logs` table with the following information:

- Recipient email
- Email type
- Status (pending, sent, failed)
- Error message (if failed)
- Metadata (order ID, product ID, etc.)
- Timestamps

Admins can view email logs to monitor the system and troubleshoot issues.

## Testing the System

### 1. Test Welcome Email
Create a new user account to trigger the welcome email.

### 2. Test Product Submission
Submit a new product to trigger the admin notification email.

### 3. Test Product Approval/Rejection
As an admin, approve or reject a product submission to test seller notifications.

### 4. Test Order Flow
Place an order to test:
- Order confirmation email to buyer
- New order notification to seller

### 5. Test Order Updates
Update an order status to test status update emails.

## Troubleshooting

### Emails Not Being Sent

1. **Check Resend API Key**: Verify your Resend API key is correctly configured in Supabase Edge Functions Secrets.

2. **Check Email Preferences**: Ensure the user has not disabled email notifications:
   ```sql
   SELECT email_notifications_enabled, email_preferences
   FROM profiles
   WHERE id = 'user_id';
   ```

3. **Check Email Logs**: Look for failed emails:
   ```sql
   SELECT * FROM email_logs
   WHERE status = 'failed'
   ORDER BY created_at DESC
   LIMIT 10;
   ```

4. **Check Database Settings**: Verify the notification settings are configured:
   ```sql
   SELECT current_setting('app.settings.supabase_url', true);
   SELECT current_setting('app.settings.service_role_key', true);
   ```

### Trigger Not Firing

1. Check if pg_net extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_net';
   ```

2. Check trigger exists and is enabled:
   ```sql
   SELECT * FROM pg_trigger
   WHERE tgname IN (
     'trigger_notify_admin_new_submission',
     'trigger_notify_seller_status_change',
     'trigger_notify_order_created'
   );
   ```

3. Check for errors in PostgreSQL logs (available in Supabase Dashboard).

## Security Considerations

1. **Never expose service role key**: The service role key is stored securely in database settings and should never be exposed to the client.

2. **RLS on email_logs**: Only admins can view all email logs. Users can only see their own.

3. **Email preferences**: Always respect user email preferences and the master `email_notifications_enabled` toggle.

4. **Rate limiting**: Consider implementing rate limiting on email sending to prevent abuse.

## Future Enhancements

Potential improvements to the email system:

1. **Email Templates Editor**: Admin interface to customize email templates
2. **A/B Testing**: Test different email versions to improve engagement
3. **Email Analytics**: Track open rates, click rates, and conversions
4. **Scheduled Emails**: Schedule emails to be sent at optimal times
5. **Email Webhooks**: Handle bounces, complaints, and unsubscribes via Resend webhooks
6. **Multi-language Support**: Send emails in user's preferred language

## Support

For issues or questions about the email system, contact the development team or refer to the Supabase and Resend documentation:

- Supabase Edge Functions: https://supabase.com/docs/guides/functions
- Resend API: https://resend.com/docs
- pg_net Extension: https://github.com/supabase/pg_net
