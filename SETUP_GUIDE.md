# Email System Setup Guide

This guide will help you complete the email system setup for your Beckah Marketplace.

## Prerequisites

- ✅ Supabase project already set up
- ✅ RESEND_API_KEY obtained: `re_2chjjTmJ_EL69548uPL7a22tBHfpuYo9R`
- ✅ Sender email configured: `info@beckahex.org`

## Step 1: Add Secrets to Supabase Edge Functions

You need to add the following secrets to your Supabase project:

1. Go to: [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → Project Settings → Edge Functions → Secrets

2. Add these secrets:

   | Secret Name | Value |
   |------------|-------|
   | `RESEND_API_KEY` | `re_2chjjTmJ_EL69548uPL7a22tBHfpuYo9R` |
   | `FROM_EMAIL` | `info@beckahex.org` |
   | `SITE_URL` | `https://beckahex.org` |

3. Click "Save" after adding each secret.

**IMPORTANT:** The `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are automatically configured and do NOT need to be added manually.

## Step 2: Verify Edge Functions Deployment

All Edge Functions have been deployed. You can verify them in your Supabase Dashboard:

Go to: Edge Functions → You should see these functions:
- ✅ send-email
- ✅ send-welcome-email
- ✅ send-product-submission-to-admin
- ✅ send-product-status-notification
- ✅ send-order-confirmation
- ✅ send-new-order-to-seller

## Step 3: Test the Email System

After adding the secrets, test the email system:

1. **Test Product Submission**
   - Go to your marketplace
   - Submit a new product as a seller
   - Check if admin receives an email

2. **Test Welcome Email**
   - Create a new user account
   - Check if the new user receives a welcome email

3. **Test Order Emails**
   - Place a test order
   - Verify both buyer and seller receive order confirmation emails

## Email Flow Summary

### When a User Signs Up:
- ✉️ Welcome email sent automatically

### When a Seller Submits a Product:
- ✉️ Admin receives notification email
- ✉️ Seller receives confirmation email after approval/rejection

### When a Buyer Places an Order:
- ✉️ Buyer receives order confirmation email
- ✉️ Seller receives new order notification email

### When Order Status Changes:
- ✉️ Buyer receives status update email (shipped, delivered, etc.)

## Troubleshooting

### Emails Not Sending?

1. **Check Secrets Configuration**
   - Go to Supabase Dashboard → Edge Functions → Secrets
   - Verify `RESEND_API_KEY`, `FROM_EMAIL`, and `SITE_URL` are set correctly

2. **Check Function Logs**
   - Go to Supabase Dashboard → Edge Functions → Select a function → Logs
   - Look for error messages

3. **Verify Email Address**
   - Make sure `info@beckahex.org` is verified in your Resend account
   - Go to: [Resend Dashboard](https://resend.com/domains) → Verify your domain

4. **Check Email Preferences**
   - Users can disable email notifications in their profile settings
   - Go to Settings page → Email Preferences

## Email Types Available

1. **Welcome Email** - Sent when user signs up
2. **Product Submission to Admin** - Notifies admin of new product
3. **Product Approved** - Notifies seller of approval
4. **Product Rejected** - Notifies seller of rejection
5. **Order Confirmation** - Notifies buyer of order
6. **New Order to Seller** - Notifies seller of sale
7. **Shipping Notification** - Notifies buyer when order ships
8. **Delivery Confirmation** - Notifies buyer of delivery
9. **Order Status Update** - Notifies buyer of status changes
10. **Review Request** - Requests buyer to review product
11. **Abandoned Cart** - Reminds buyer of items in cart

## Database Email Logging

All emails are logged in the `email_logs` table:
- Email status (pending, sent, failed)
- Recipient email
- Email type
- Timestamps
- Error messages (if any)

To view email logs:
```sql
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 50;
```

## Support

If you encounter any issues:
1. Check the function logs in Supabase Dashboard
2. Verify all secrets are configured correctly
3. Check that your Resend domain is verified
4. Ensure users have email notifications enabled in their settings

---

## Quick Checklist

- [ ] Added `RESEND_API_KEY` secret to Supabase
- [ ] Added `FROM_EMAIL` secret to Supabase
- [ ] Added `SITE_URL` secret to Supabase
- [ ] Verified all Edge Functions are deployed
- [ ] Tested welcome email by creating a test user
- [ ] Tested product submission email
- [ ] Tested order confirmation emails
- [ ] Checked email logs in database

Once all items are checked, your email system is fully operational! ✅
