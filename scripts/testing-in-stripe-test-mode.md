# Testing in Stripe Test Mode (No Real Money)

## Yes, You Can Test Everything Without Spending Real Money!

Stripe has **two separate modes**:
- **Test Mode** (sandbox) - Uses test cards, no real charges
- **Live Mode** - Real money, real charges

## How to Test in Test Mode

### 1. Make Sure You're in Test Mode

In Stripe Dashboard, check the toggle at the top:
- Should say **"Test mode"** (not "Live mode")
- URL will show: `https://dashboard.stripe.com/test/...`

### 2. Use Test Cards

Stripe provides test card numbers that work in test mode:

**Successful Payment:**
```
Card: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/25)
CVC: Any 3 digits (e.g., 123)
ZIP: Any 5 digits (e.g., 12345)
```

**Declined Payment:**
```
Card: 4000 0000 0000 0002
```

**Requires Authentication:**
```
Card: 4000 0025 0000 3155
```

### 3. Test Webhooks in Test Mode

**Local Development:**
- Use Stripe CLI: `stripe listen --forward-to localhost:3000/api/stripe-webhook`
- Make test purchases with test cards
- Webhooks will fire just like in production

**Production Testing:**
- Create a test webhook endpoint in Stripe Dashboard (test mode)
- Point it to your production URL: `https://yourdomain.com/api/stripe-webhook`
- Use test cards to make purchases
- Webhooks will fire to your production server

### 4. Test vs Live Keys

**Test Mode Keys:**
- Start with `sk_test_...` (secret key)
- Start with `pk_test_...` (publishable key)
- Webhook secret: `whsec_...` (from test mode webhook)

**Live Mode Keys:**
- Start with `sk_live_...` (secret key)
- Start with `pk_live_...` (publishable key)
- Webhook secret: `whsec_...` (from live mode webhook)

## Important: Keep Test and Live Separate

✅ **Test Mode:**
- Use test cards
- No real money
- Perfect for development/testing
- Separate webhook endpoints

✅ **Live Mode:**
- Real cards
- Real money
- Only use when ready for real customers
- Separate webhook endpoints

## Testing Strategy

1. **Develop Locally** → Use Stripe CLI + test mode
2. **Test in Production** → Use test mode webhook + test cards
3. **Go Live** → Switch to live mode when ready

## Your Current Setup

You're already in **test mode** (sandbox), which is perfect! You can:
- ✅ Test all webhook functionality
- ✅ Test subscriptions
- ✅ Test credit purchases
- ✅ Use test cards (no real money)
- ✅ Test everything before going live

## When You're Ready for Real Customers

1. Switch to **Live Mode** in Stripe Dashboard
2. Create **live mode** webhook endpoint
3. Update environment variables with **live** keys and secrets
4. Deploy to production

## Summary

- ✅ **Test mode = No real money** - Perfect for testing
- ✅ **Test cards work in test mode** - Use `4242 4242 4242 4242`
- ✅ **Webhooks work the same** - Test mode webhooks behave like live
- ✅ **You're already in test mode** - Keep testing!





