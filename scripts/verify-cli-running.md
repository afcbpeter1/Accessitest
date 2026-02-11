# Verify Stripe CLI is Running Correctly

## What You Should See

When Stripe CLI starts, you should see:
```
> Ready! Your webhook signing secret is whsec_...
```

## Quick Test

### 1. Test with Manual Trigger

In a new terminal, run:
```bash
stripe trigger checkout.session.completed
```

**You should see:**
- **In Stripe CLI terminal:** `--> checkout.session.completed [200] POST http://localhost:3000/api/stripe-webhook`
- **In your server console:** `🔔 WEBHOOK ENDPOINT HIT!`

### 2. Test with Real Purchase

1. Make a subscription purchase in your app
2. Use test card: `4242 4242 4242 4242`
3. Complete the payment

**You should see:**
- **In Stripe CLI terminal:** `--> checkout.session.completed [200]`
- **In your server console:** 
  - `🔔 WEBHOOK ENDPOINT HIT!`
  - `🛒 Processing checkout session completed: cs_test_...`
  - `✅ User ... upgraded to ...`

## If It's Working

✅ CLI shows events being forwarded
✅ Server shows `🔔 WEBHOOK ENDPOINT HIT!`
✅ Subscription activates in database
✅ UI updates to show new plan

## If It's Not Working

❌ No events in CLI → Check CLI is actually running
❌ Events in CLI but not server → Check server is running on port 3000
❌ Events reach server but fail → Check webhook secret matches








