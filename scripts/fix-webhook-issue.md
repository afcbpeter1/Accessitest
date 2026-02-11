# Why Webhooks Stopped Working (Sandbox/Test Mode)

## Most Likely Causes (in order of probability):

### 1. **Stripe CLI Stopped Running** ⚠️ MOST COMMON
When you restart your computer or close the terminal, Stripe CLI stops. Webhooks won't reach your local server.

**Fix:**
```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

**Check:** Look for this in your terminal:
```
> Ready! Your webhook signing secret is whsec_...
```

### 2. **Webhook Secret Changed**
Every time you restart Stripe CLI, it generates a NEW webhook secret. Your `.env` file still has the OLD secret.

**Fix:**
1. Start Stripe CLI (see #1)
2. Copy the NEW secret from CLI output (starts with `whsec_`)
3. Update `.env`:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_NEW_SECRET_HERE
   ```
4. Restart your Next.js server

### 3. **Webhooks Going to Dashboard Instead of CLI**
If you have webhooks configured in Stripe Dashboard pointing to localhost, they might be receiving events instead of your CLI.

**Check:**
- Go to: https://dashboard.stripe.com/test/webhooks
- Look for any webhooks pointing to `localhost:3000` or `127.0.0.1:3000`
- Delete them (they're for production, not local dev)

### 4. **Server Not Running on Port 3000**
If your Next.js server isn't running or is on a different port, webhooks can't reach it.

**Check:**
- Is your dev server running? (`npm run dev`)
- Is it on port 3000? (check the console output)

## Quick Diagnostic Steps:

1. **Check if webhook endpoint is being hit:**
   - When you make a purchase, look for this in your server console:
   ```
   🔔 WEBHOOK ENDPOINT HIT!
   ```
   - If you DON'T see this, webhooks aren't reaching your server

2. **Check Stripe CLI:**
   - Look for this when you make a purchase:
   ```
   --> checkout.session.completed [200] POST http://localhost:3000/api/stripe-webhook
   ```
   - If you DON'T see this, CLI isn't forwarding events

3. **Test manually:**
   ```bash
   stripe trigger checkout.session.completed
   ```
   - This should show events in BOTH:
     - Stripe CLI terminal (shows the event being forwarded)
     - Your server console (shows `🔔 WEBHOOK ENDPOINT HIT!`)

## What Changed in the Code?

The webhook handler code itself is fine. The logic for processing subscriptions hasn't fundamentally changed. The issue is almost certainly one of the configuration problems above.

## Most Likely Fix:

**99% chance it's #1 or #2:**
1. Restart Stripe CLI
2. Update your `.env` with the new secret
3. Restart your Next.js server
4. Try purchasing again

## If It Still Doesn't Work:

Check your server logs when making a purchase:
- Do you see `🔔 WEBHOOK ENDPOINT HIT!`? 
  - YES → Webhook is reaching server, check handler logic
  - NO → Webhook isn't reaching server, check Stripe CLI








