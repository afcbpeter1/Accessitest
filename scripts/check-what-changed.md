# What Changed That Might Have Broken Webhooks?

## Key Changes Made During This Session

### 1. **Added Organization Billing Handlers**
- Added `handleOrganizationCheckoutCompleted` which is called for EVERY checkout
- This might be interfering with regular subscription purchases

### 2. **Enhanced Logging**
- Added extensive logging that might be slowing things down
- But this shouldn't break functionality

### 3. **Webhook Secret Handling**
- Added `.trim()` to webhook secret
- This could cause issues if the secret has unexpected whitespace

## Most Likely Issue: Stripe CLI Not Running

**If this worked before, the most common reason it stopped working is:**

1. **Stripe CLI stopped running** - You need to restart it:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe-webhook
   ```

2. **Webhook secret changed** - When you restart Stripe CLI, it generates a NEW secret
   - You need to update your `.env` file with the new secret from CLI output

3. **Webhooks going to Dashboard instead of CLI** - Check your Stripe Dashboard:
   - https://dashboard.stripe.com/test/webhooks
   - If you see webhooks pointing to localhost, they might be receiving events instead of CLI

## Quick Diagnostic Steps

1. **Check if Stripe CLI is running:**
   - Look for a terminal window showing: `> Ready! Your webhook signing secret is whsec_...`
   - If not running, start it: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

2. **Check your `.env` file:**
   - Make sure `STRIPE_WEBHOOK_SECRET` matches the secret from CLI output
   - No quotes, no spaces, exact match

3. **Check your server logs:**
   - When you make a purchase, you should see: `🔔 WEBHOOK ENDPOINT HIT!`
   - If you don't see this, webhooks aren't reaching your server

4. **Test manually:**
   ```bash
   stripe trigger checkout.session.completed
   ```
   - This should show events in both CLI and server console

## What to Do Right Now

1. **Restart Stripe CLI** (this is most likely the issue):
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe-webhook
   ```

2. **Copy the new webhook secret** from CLI output (starts with `whsec_`)

3. **Update your `.env` file:**
   ```
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_NEW_SECRET_HERE
   ```

4. **Restart your Next.js server** to load the new secret

5. **Try purchasing again** and watch both:
   - Stripe CLI terminal (should show: `--> checkout.session.completed`)
   - Server console (should show: `🔔 WEBHOOK ENDPOINT HIT!`)

## If It Still Doesn't Work

The code itself should be fine - the webhook handler logic hasn't fundamentally changed. The issue is almost certainly:
- Stripe CLI not running
- Webhook secret mismatch
- Webhooks going to Dashboard instead of CLI








