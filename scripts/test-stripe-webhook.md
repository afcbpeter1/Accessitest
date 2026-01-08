# Testing Stripe Webhooks Locally

## Quick Test Steps

### 1. Verify Your Setup

Make sure:
- ✅ Stripe CLI is running: `stripe listen --forward-to localhost:3000/api/stripe-webhook`
- ✅ Your server is running on port 3000
- ✅ Your `.env` file has: `STRIPE_WEBHOOK_SECRET=whsec_fed4bdd7ff5430a326168c6c969f937f08f92026eb6808ffa418b6455ff6e3e5`

### 2. Trigger a Test Webhook Event

The Stripe CLI won't show anything until an event is triggered. To test:

**Option A: Trigger a test checkout.session.completed event**
```bash
stripe trigger checkout.session.completed
```

**Option B: Make a real test purchase**
1. Go to your app in test mode
2. Make a test purchase using test card: `4242 4242 4242 4242`
3. The webhook should fire automatically

### 3. Check Your Server Logs

After triggering, you should see in your server console:
- `🔔 Webhook received!`
- `✅ Webhook signature verified successfully`
- `🛒 Processing checkout session completed: cs_...`

### 4. Verify Webhook Secret Match

The webhook secret from CLI output should match your `.env` file exactly:
- CLI shows: `whsec_fed4bdd7ff5430a326168c6c969f937f08f92026eb6808ffa418b6455ff6e3e5`
- Your `.env` should have: `STRIPE_WEBHOOK_SECRET=whsec_fed4bdd7ff5430a326168c6c969f937f08f92026eb6808ffa418b6455ff6e3e5`

**Important**: No quotes, no spaces, exact match!

### 5. Common Issues

**Issue: CLI shows "Ready!" but no events**
- **Solution**: Events only appear when triggered. Use `stripe trigger` or make a test purchase.

**Issue: Webhook signature verification fails**
- **Solution**: Make sure the secret in `.env` matches exactly what CLI shows (no quotes/spaces)

**Issue: Server not receiving webhooks**
- **Solution**: 
  1. Check server is running: `npm run dev` or `next dev`
  2. Check port 3000 is accessible
  3. Try: `curl http://localhost:3000/api/stripe-webhook` (should return an error, not connection refused)

**Issue: Credits not updating after purchase**
- **Solution**: 
  1. Check server logs for webhook processing
  2. Look for `🎫 Processing credit purchase` messages
  3. Check database: `SELECT credits_remaining FROM user_credits WHERE user_id = 'YOUR_USER_ID'`

