# Diagnosing Missing Webhook Events

## Problem
You completed a subscription purchase but:
- ❌ No webhook event in Stripe CLI
- ❌ No `🔔 WEBHOOK ENDPOINT HIT!` in server logs
- ❌ Subscription not activated

## Step 1: Check Stripe Dashboard

1. Go to: https://dashboard.stripe.com/test/payments
2. Find your recent payment
3. Click on it to see the checkout session ID
4. Check the session status:
   - Should be `complete`
   - Payment status should be `paid`

## Step 2: Check Webhook Events in Dashboard

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Look for any webhooks pointing to `localhost:3000`
3. **Delete them** - they interfere with Stripe CLI
4. Check "Events" tab to see if `checkout.session.completed` was sent

## Step 3: Check Checkout Session Status

Run this script to check your checkout session:

```bash
node scripts/check-checkout-session.js <session_id>
```

Replace `<session_id>` with the session ID from Stripe Dashboard (starts with `cs_test_`)

## Step 4: Manually Resend Webhook

If the session is complete but webhook didn't fire:

1. Go to Stripe Dashboard → Webhooks → Events
2. Find the `checkout.session.completed` event (if it exists)
3. Click "Resend" to send it again
4. Or use Stripe CLI:
   ```bash
   stripe events resend <event_id>
   ```

## Step 5: Verify Stripe CLI is Listening

Make sure `stripe listen` is running:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

You should see:
```
> Ready! Your webhook signing secret is whsec_...
```

## Step 6: Test with Manual Trigger

While `stripe listen` is running, trigger a test event:

```bash
stripe trigger checkout.session.completed
```

You should see:
- **Stripe CLI**: `--> checkout.session.completed [200]`
- **Server console**: `🔔 WEBHOOK ENDPOINT HIT!`

## Common Issues

### Issue 1: Webhooks Going to Dashboard
**Symptom**: Events appear in Dashboard but not in CLI
**Fix**: Delete webhooks pointing to localhost in Dashboard

### Issue 2: Checkout Session Not Complete
**Symptom**: Session status is `open` or `expired`
**Fix**: Complete the checkout again or check payment method

### Issue 3: Stripe CLI Not Running
**Symptom**: No events in CLI at all
**Fix**: Start `stripe listen` in a separate terminal

### Issue 4: Wrong Webhook Secret
**Symptom**: `❌ Webhook signature verification failed` in server logs
**Fix**: Update `.env` with secret from `stripe listen` output

## Quick Fix

1. **Check recent checkout session in Dashboard**
2. **If session is complete, manually resend the webhook event**
3. **Or trigger a new test event**: `stripe trigger checkout.session.completed`








