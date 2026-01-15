# Webhook Setup Diagnostic Guide

## Problem: You see transactions in Stripe but no logs in CLI

This usually means webhooks are being sent to **Stripe Dashboard** instead of your **Stripe CLI**.

## Quick Diagnostic Steps

### 1. Check if Stripe CLI is Running

In a terminal, run:
```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

You should see:
```
> Ready! Your webhook signing secret is whsec_... (^C to quit)
```

**If you don't see this**, the CLI is not running and webhooks won't be forwarded.

### 2. Check Your Stripe Dashboard Webhook Configuration

1. Go to: https://dashboard.stripe.com/test/webhooks
2. Look for any webhook endpoints pointing to your local server
3. **If you see a webhook endpoint**, it might be receiving events instead of CLI

**Important**: For local development, you should:
- ✅ Use Stripe CLI (forwards events to localhost)
- ❌ NOT use Dashboard webhooks (they go to production URLs)

### 3. Verify Your Server is Receiving Webhooks

Check your **Next.js server console** (where you ran `npm run dev`). You should see:
- `🔔 Webhook received!` when a webhook arrives
- `✅ Webhook signature verified successfully` if signature is valid
- `❌ Webhook signature verification failed` if there's a mismatch

**If you see NOTHING in your server console**, the webhooks are not reaching your server.

### 4. Check Where Stripe is Sending Webhooks

When you make a purchase:
- **Stripe CLI** will show: `--> checkout.session.completed [evt_...]`
- **Your server console** will show: `🔔 Webhook received!`

**If CLI shows events but server doesn't**:
- Check that your server is running on port 3000
- Check that the CLI is forwarding to the correct URL

**If CLI doesn't show events**:
- Stripe is sending webhooks to Dashboard instead
- You need to use Stripe CLI for local development

## Solution: Use Stripe CLI for Local Development

1. **Stop any Dashboard webhooks** pointing to localhost (or disable them)

2. **Start Stripe CLI**:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe-webhook
   ```

3. **Copy the webhook secret** from CLI output (starts with `whsec_`)

4. **Update your `.env` file**:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_YOUR_SECRET_FROM_CLI
   ```

5. **Restart your Next.js server** to load the new secret

6. **Make a test purchase** and watch both:
   - Stripe CLI terminal (should show events)
   - Next.js server console (should show `🔔 Webhook received!`)

## Testing Without Making a Purchase

You can test the webhook endpoint without making a purchase:

```bash
# In a new terminal (while Stripe CLI is running)
stripe trigger checkout.session.completed
```

This will:
- Show the event in Stripe CLI
- Forward it to your server
- You should see logs in your server console

## Common Issues

### Issue: CLI shows "Ready!" but no events when purchasing
**Cause**: Stripe is sending webhooks to Dashboard, not CLI
**Solution**: Make sure no Dashboard webhooks are active, or use `stripe trigger` to test

### Issue: Server shows "Webhook signature verification failed"
**Cause**: Webhook secret in `.env` doesn't match CLI secret
**Solution**: Copy the exact secret from CLI output (no quotes, no spaces)

### Issue: Server shows nothing at all
**Cause**: Webhooks not reaching server
**Solution**: 
1. Check server is running: `npm run dev`
2. Check CLI is forwarding: `stripe listen --forward-to localhost:3000/api/stripe-webhook`
3. Test endpoint: `curl http://localhost:3000/api/stripe-webhook` (should return error, not connection refused)





