# Testing Webhooks Locally - Quick Guide

## Current Setup (Correct for Local Development)

✅ **Your `.env` file has the CLI secret** - This is CORRECT for local development
```
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

✅ **Stripe CLI is running** - This forwards events to localhost:3000

## Why the Dashboard Webhook is Different

- **Stripe CLI** generates its own secret when you run `stripe listen`
- **Stripe Dashboard** webhooks have their own separate secret
- These are **DIFFERENT** and serve different purposes:
  - CLI secret = for local development
  - Dashboard secret = for production/staging

## The Dashboard Webhook is DISABLED

The webhook you see in Dashboard (`https://ripe-yaks-drop.loca.lt/api/stripe-webhook`) is:
- ❌ **DISABLED** - Stripe won't send events to it
- ❌ Points to an old localtunnel URL (probably not running)
- ❌ Has a different secret (not needed for local dev)

## What You Need to Do

### For Local Development (What You're Doing Now):

1. ✅ Keep your `.env` with the CLI secret (you have this)
2. ✅ Keep Stripe CLI running: `stripe listen --forward-to localhost:3000/api/stripe-webhook`
3. ✅ Keep your Next.js server running: `npm run dev`
4. ✅ **Test purchases will work** - Stripe CLI will forward events to your local server

### To Test Right Now:

```bash
# In a new terminal, trigger a test event
stripe trigger checkout.session.completed
```

You should see:
- CLI: Event forwarded to localhost:3000
- Server console: `🔔 Webhook received!` and credit processing

### When You Go to Production:

You'll need to:
1. Create a new webhook endpoint in Stripe Dashboard pointing to your production URL
2. Use that webhook's secret in your production `.env`
3. Enable the webhook

But for now, **your local setup is correct!** The Dashboard webhook is just old/unused.

