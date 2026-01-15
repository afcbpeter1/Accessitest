# Setting Up Webhooks for Production

## Local Development (Current)
- Uses **Stripe CLI** to forward events to `localhost:3000`
- Webhook secret comes from CLI output: `whsec_...`
- CLI must be running: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

## Production (When You Go Live)

### 1. Configure Webhook in Stripe Dashboard

1. Go to: https://dashboard.stripe.com/webhooks
2. Click **"Add endpoint"**
3. Enter your production URL:
   ```
   https://yourdomain.com/api/stripe-webhook
   ```
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment.paid` (if needed)
   - `payment_intent.succeeded` (for credit purchases)

5. Click **"Add endpoint"**

### 2. Get Production Webhook Secret

1. After creating the endpoint, click on it
2. Click **"Reveal"** next to "Signing secret"
3. Copy the secret (starts with `whsec_`)
4. This is DIFFERENT from your CLI secret!

### 3. Set Environment Variable in Production

Add the production webhook secret to your production environment:

**Vercel/Netlify/Railway/etc:**
- Go to your hosting platform's environment variables
- Add: `STRIPE_WEBHOOK_SECRET=whsec_YOUR_PRODUCTION_SECRET`
- Redeploy your app

**Or in your production `.env`:**
```
STRIPE_WEBHOOK_SECRET=whsec_YOUR_PRODUCTION_SECRET
```

### 4. Test Production Webhook

1. Use Stripe Dashboard's "Send test webhook" feature
2. Or make a test purchase in production
3. Check your production server logs for: `🔔 WEBHOOK ENDPOINT HIT!`

## Important Notes

✅ **Your code will work in production** - the webhook handler code is the same
✅ **No CLI needed in production** - Stripe sends directly to your server
✅ **Different secrets** - CLI secret (local) vs Dashboard secret (production)
✅ **HTTPS required** - Production webhooks require HTTPS (not HTTP)

## Environment-Specific Setup

You can use different secrets for different environments:

```env
# Local development
STRIPE_WEBHOOK_SECRET=whsec_CLI_SECRET

# Production (set in hosting platform)
STRIPE_WEBHOOK_SECRET=whsec_PRODUCTION_SECRET
```

## Troubleshooting Production Webhooks

If webhooks don't work in production:

1. **Check webhook endpoint URL** - Must be HTTPS and publicly accessible
2. **Verify webhook secret** - Must match the one from Stripe Dashboard
3. **Check server logs** - Look for `🔔 WEBHOOK ENDPOINT HIT!`
4. **Check Stripe Dashboard** - Go to webhook events, see if they're being sent
5. **Check firewall/security** - Make sure Stripe can reach your server

## Summary

- **Local**: Stripe CLI forwards → `localhost:3000`
- **Production**: Stripe sends directly → `https://yourdomain.com/api/stripe-webhook`
- **Code**: Same webhook handler works for both
- **Secrets**: Different secrets for local vs production





