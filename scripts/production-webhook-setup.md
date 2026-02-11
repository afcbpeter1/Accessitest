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
   - `checkout.session.completed` (main one for credits & subscriptions)
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `payment_intent.succeeded` (fallback for credit purchases)
   - `charge.succeeded` (fallback if checkout.session.completed didn’t run)

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

## Receiving Receipt and Payment Emails

Receipt emails (and subscription payment emails) are sent by **your app** using **Resend**, not by Stripe.

### What you need

1. **Resend API key**
   - Sign up at [resend.com](https://resend.com) and create an API key.
   - In production, set: `RESEND_API_KEY=re_...` (your real key).
   - If this is missing or set to `dummy-key-for-development`, the app will skip sending and you won’t get receipts.

2. **Verified sending domain (required for receipts to customers)**
   - Without a verified domain, Resend only allows sending to the email address of the Resend account owner. Other recipient addresses get a 403 “You can only send testing emails to your own email address”.
   - In Resend, go to [resend.com/domains](https://resend.com/domains), add your domain (e.g. `a11ytest.ai`), follow the DNS verification steps, and set your “From” address to use that domain (e.g. `noreply@a11ytest.ai`).

3. **Stripe’s own receipts (optional)**
   - Stripe can also send receipts. In Dashboard → Settings → Emails → Customer emails, you can turn on “Payment receipts”. Those are separate from the app’s Resend emails.

### Why you might get no email

- `RESEND_API_KEY` not set or still the dummy value in production.
- **No verified domain in Resend** → Resend returns 403 and only allows sending to your own email; verify a domain at [resend.com/domains](https://resend.com/domains) to send to customers.
- Webhook never runs (see below) → `checkout.session.completed` isn’t handled → receipt is never sent.
- Customer email missing on the Stripe session (e.g. checkout created without `customer_email` or customer record).

---

## Why Tokens Didn’t Increase After a Purchase

Tokens (credits) are added only when the **webhook** runs successfully. The flow is:

1. Customer pays → Stripe sends `checkout.session.completed` to your webhook URL.
2. Your app receives it at `/api/stripe-webhook`, verifies the signature, then calls `handleCheckoutSessionCompleted` → `handleCreditPurchase` → `addCredits(...)`.

If tokens didn’t increase:

1. **Webhook not configured for the environment you used**
   - **Live mode**: You need an endpoint in Stripe Dashboard → [Webhooks](https://dashboard.stripe.com/webhooks) (live mode) pointing to `https://yourdomain.com/api/stripe-webhook`, and `STRIPE_WEBHOOK_SECRET` in production must be that endpoint’s “Signing secret”.
   - **Test mode**: Same idea: add an endpoint in test mode, use its signing secret (often via Stripe CLI locally, or a test-mode endpoint in the Dashboard for production).

2. **Wrong or missing secret**
   - If `STRIPE_WEBHOOK_SECRET` doesn’t match the endpoint Stripe uses, verification fails and the handler returns 400 without adding credits.

3. **Missing metadata on the session**
   - The handler needs `userId`, `priceId`, and (for credits) `type: 'credits'` in `session.metadata`. These are set when creating the checkout session (e.g. from your Pricing/checkout flow). If the front end doesn’t send `userId` when calling `/api/create-checkout-session`, metadata will be empty and the webhook will log “Missing required metadata” and not add credits.

4. **User not found by email**
   - If `userId` is missing, the webhook looks up the user by `session.customer_email`. If that email doesn’t exist in your `users` table, it won’t add credits.

### Quick checks

- In Stripe Dashboard → Developers → Webhooks → your endpoint → “Recent events”: see if requests were sent and whether they succeeded or failed.
- In your production logs, look for `🔔 WEBHOOK ENDPOINT HIT!` and then either `✅ Webhook signature verified` or `❌ Webhook signature verification failed`, and any “Missing required metadata” or “User not found” messages.

---

## Summary

- **Local**: Stripe CLI forwards → `localhost:3000`
- **Production**: Stripe sends directly → `https://yourdomain.com/api/stripe-webhook`
- **Code**: Same webhook handler works for both
- **Secrets**: Different secrets for local vs production
- **Emails**: Require `RESEND_API_KEY` in production; receipts are sent by your app, not Stripe
- **Tokens**: Only increase when the webhook runs and metadata (e.g. `userId`, `priceId`, `type`) is present and valid








