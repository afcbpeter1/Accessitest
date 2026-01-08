# Why Webhooks Worked Before But Not Now

## The Key Difference

**Before (Production):**
- Stripe Dashboard webhooks automatically send events to your production server
- When you make a purchase, Stripe immediately sends `checkout.session.completed` to your webhook URL
- This happens automatically - no CLI needed

**Now (Local Development with Stripe CLI):**
- Stripe CLI only forwards events that are **triggered** or **sent to it**
- When you make a test purchase, Stripe sends the webhook to your **Stripe Dashboard webhook endpoint** (if configured)
- The CLI won't show anything unless:
  1. You manually trigger an event: `stripe trigger checkout.session.completed`
  2. OR you configure Stripe Dashboard to send test events to the CLI endpoint

## How to Fix This

### Option 1: Use Stripe CLI Trigger (Quick Test)
```bash
# In a new terminal, trigger a test event
stripe trigger checkout.session.completed
```

This will simulate a purchase and you should see:
- CLI shows the event being forwarded
- Your server logs show `🔔 Webhook received!`
- Credits get added

### Option 2: Check Your Server Logs
Even if CLI doesn't show anything, your server might be receiving webhooks. Check your Next.js server console for:
- `🔔 Webhook received!`
- `🛒 Processing checkout session completed`

### Option 3: Make a Real Test Purchase
1. Make sure your server is running: `npm run dev`
2. Make a test purchase using card `4242 4242 4242 4242`
3. Check BOTH:
   - Stripe CLI output (should show event)
   - Your server console (should show webhook processing)

### Option 4: Check Stripe Dashboard
1. Go to Stripe Dashboard → Developers → Webhooks
2. Check if you have a webhook endpoint configured
3. If yes, check the "Events" tab to see if events are being sent
4. If events are being sent but failing, check the error messages

## Most Likely Issue

If it worked before, you probably had:
- A webhook endpoint configured in Stripe Dashboard pointing to your production server
- OR you were testing in production mode

Now you're testing locally, so:
- The webhooks might be going to your production endpoint (not localhost)
- OR your local server isn't running
- OR the webhook secret doesn't match

## Quick Debug Steps

1. **Is your server running?**
   ```bash
   # Check if port 3000 is in use
   netstat -ano | findstr :3000
   ```

2. **Test the webhook endpoint directly:**
   ```bash
   curl http://localhost:3000/api/stripe-webhook
   # Should return an error (not connection refused)
   ```

3. **Check your server logs** when you make a purchase - do you see `🔔 Webhook received!`?

4. **Trigger a test event:**
   ```bash
   stripe trigger checkout.session.completed
   ```

