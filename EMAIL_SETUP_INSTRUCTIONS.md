# Email System Setup Instructions

## Overview
Your email notification system is ready to go! You just need to add a few secrets to your Supabase Edge Functions configuration.

## Step-by-Step Setup

### Step 1: Add Secrets via Supabase Dashboard

1. **Navigate to your Supabase Dashboard:**
   - Go to https://supabase.com/dashboard
   - Select your project: `moiddznrwcazaupspuxt`

2. **Go to Edge Functions Secrets:**
   - Click on **Edge Functions** in the left sidebar
   - Click on **Manage secrets** or **Settings** tab
   - Look for the **Secrets** section

3. **Add the following three secrets:**

   | Secret Name | Value |
   |-------------|-------|
   | `RESEND_API_KEY` | `re_2chjjTmJ_EL69548uPL7a22tBHfpuYo9R` |
   | `FROM_EMAIL` | `info@beckahex.org` |
   | `SITE_URL` | `https://beckahex.org` |

4. **Click Save** after adding each secret

### Step 2: Verify Setup

Once you've added the secrets, the email system will automatically work. To test:

1. **Create a new user account** - You should receive a welcome email
2. **Place a test order** - Order confirmation emails should be sent
3. **Check the email logs** - Run this SQL query in your Supabase SQL Editor:

```sql
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 10;
```

## What Gets Emailed?

The system automatically sends these emails:

- ✉️ **Welcome Email** - When a new user signs up
- ✉️ **Order Confirmation** - When a customer places an order
- ✉️ **Shipping Notification** - When an order is shipped
- ✉️ **Delivery Confirmation** - When an order is delivered
- ✉️ **New Order to Seller** - When a seller receives an order
- ✉️ **Payment Transfer** - When payment is transferred to seller
- ✉️ **Product Approved** - When admin approves a product submission
- ✉️ **Product Rejected** - When admin rejects a product submission
- ✉️ **Abandoned Cart** - When a user leaves items in cart
- ✉️ **Review Request** - 7 days after delivery

## Important Notes

### Do NOT Run SQL Functions
- ❌ **DO NOT** run `set_email_notification_settings()`
- ❌ **DO NOT** try to store secrets in the database
- ✅ **ONLY** add secrets via the Supabase Dashboard as shown above

### Why This Approach?
- **Secure**: Secrets are encrypted and never exposed
- **Standard**: This is Supabase's recommended approach
- **Automatic**: Edge Functions automatically receive these variables
- **No Permissions Issues**: Works with your current access level

### Automatic Credentials
These are **already available** (no need to add them):
- `SUPABASE_URL` - Auto-provided by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-provided by Supabase
- `SUPABASE_ANON_KEY` - Auto-provided by Supabase

## Troubleshooting

### Email not sending?
1. Check that all three secrets are added correctly
2. Verify the Resend API key is valid
3. Check email logs in database: `SELECT * FROM email_logs WHERE status = 'failed';`
4. Make sure the user has email notifications enabled in their profile

### Testing Resend Integration
You can test the Resend API directly:
```bash
curl -X POST 'https://api.resend.com/emails' \
  -H 'Authorization: Bearer re_2chjjTmJ_EL69548uPL7a22tBHfpuYo9R' \
  -H 'Content-Type: application/json' \
  -d '{
    "from": "info@beckahex.org",
    "to": ["your-email@example.com"],
    "subject": "Test Email",
    "html": "<p>This is a test email!</p>"
  }'
```

## Email Templates

All email templates are beautifully designed with:
- Responsive design for mobile and desktop
- Branded header with gradient
- Clear call-to-action buttons
- Professional footer with unsubscribe options
- Product images and order details

## User Preferences

Users can manage their email preferences at:
- https://beckahex.org/settings

Each user can enable/disable:
- Email notifications
- Order updates
- Marketing emails
- Review requests
- And more...

## Need Help?

If you encounter any issues:
1. Check the Supabase Edge Functions logs
2. Review the email_logs table in your database
3. Verify all secrets are correctly added
4. Test with a simple welcome email first

---

**That's it!** Once you add those 3 secrets to the Supabase Dashboard, your entire email notification system will be live and working! 🎉
