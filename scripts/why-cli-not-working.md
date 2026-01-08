# Why Stripe CLI Isn't Showing Events

## The Key Issue

**Stripe CLI doesn't automatically intercept test purchases!**

When you make a test purchase:
- Stripe sends webhooks to your **Dashboard webhook endpoints** (if configured)
- The CLI **only** forwards events that are:
  1. **Manually triggered** with `stripe trigger`
  2. **Sent directly to the CLI endpoint** (rare)

## What You're Seeing

Your CLI shows "Ready!" but no events because:
- ✅ CLI is running and listening
- ❌ No events are being sent to it
- Test purchases go to Dashboard webhooks, not CLI

## Solutions

### Option 1: Trigger Test Events (Recommended for Testing)

In a **NEW terminal** (keep CLI running), run:

```bash
# Test checkout completion
stripe trigger checkout.session.completed

# Test charge
stripe trigger charge.succeeded

# Test payment intent
stripe trigger payment_intent.succeeded
```

You should then see:
- CLI: Event forwarded to localhost:3000
- Server: `🔔 Webhook received!`

### Option 2: Check Your Server Logs

Even if CLI doesn't show events, your server might be receiving them:

1. Make a test purchase
2. Check your **Next.js server console** (where you ran `npm run dev`)
3. Look for: `🔔 Webhook received!`

If you see this, webhooks ARE working - they're just going to Dashboard webhooks, not CLI.

### Option 3: Check Stripe Dashboard

1. Go to Stripe Dashboard → Developers → Events
2. See if events are being created
3. Check if they're being sent to webhook endpoints
4. See if any are failing

### Option 4: Use Dashboard Webhooks for Testing

If Dashboard webhooks are working, you can:
1. Keep using them for testing
2. Make sure your production webhook secret matches
3. Test with real purchases

## The Real Question

**Are credits being added to your account?**

If yes → Webhooks ARE working, just not through CLI
If no → Webhooks aren't reaching your server at all

Check your server logs when you make a purchase - that will tell you what's actually happening!

