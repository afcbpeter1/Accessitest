# Testing Webhooks Locally - The Right Way

## The Problem

When you run `stripe trigger payment_intent.succeeded`, it sends the event to **Stripe Dashboard**, not your local server. That's why you see "Check dashboard for event details" but nothing happens in your app.

## The Solution: Use `stripe listen`

You need **TWO** things running:

1. **Stripe CLI listening** (`stripe listen`) - forwards events to your local server
2. **Your Next.js server** (`npm run dev`) - receives and processes events

## Step-by-Step Setup

### 1. Start Stripe CLI Listener

Open a **new terminal window** and run:

```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

You should see:
```
> Ready! Your webhook signing secret is whsec_...
```

**Keep this terminal open!** This is forwarding events to your server.

### 2. Start Your Next.js Server

In another terminal, make sure your server is running:

```bash
npm run dev
```

### 3. Test with Stripe CLI Trigger

Now when you run:

```bash
stripe trigger checkout.session.completed
```

You should see:
- **In Stripe CLI terminal**: `--> checkout.session.completed [200] POST http://localhost:3000/api/stripe-webhook`
- **In your server console**: `🔔 WEBHOOK ENDPOINT HIT!`

## Testing Real Purchases

When you make a real purchase in your app:

1. **Stripe CLI terminal** should show:
   ```
   --> checkout.session.completed [200] POST http://localhost:3000/api/stripe-webhook
   ```

2. **Your server console** should show:
   ```
   🔔 WEBHOOK ENDPOINT HIT!
   🛒 Processing checkout session completed: cs_test_...
   ```

## If It's Still Not Working

### Check 1: Is `stripe listen` running?
- Look for a terminal showing: `> Ready! Your webhook signing secret is whsec_...`
- If not, start it: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

### Check 2: Is your server running on port 3000?
- Check your Next.js console - should show: `Ready on http://localhost:3000`

### Check 3: Webhook secret matches?
- CLI shows: `whsec_...`
- Your `.env` has: `STRIPE_WEBHOOK_SECRET=whsec_...` (same value)
- Restart your Next.js server after updating `.env`

### Check 4: Test the endpoint directly
```bash
stripe trigger checkout.session.completed
```
- Watch BOTH terminals (CLI and server)
- You should see activity in both

## Quick Test Script

Run this to test everything:

```bash
# Terminal 1: Start Stripe CLI
stripe listen --forward-to localhost:3000/api/stripe-webhook

# Terminal 2: Start your server (if not already running)
npm run dev

# Terminal 3: Trigger a test event
stripe trigger checkout.session.completed
```

## Common Issues

### "No response at all"
- **Cause**: `stripe listen` not running
- **Fix**: Start it in a separate terminal

### "Webhook secret mismatch"
- **Cause**: `.env` has old secret
- **Fix**: Copy new secret from CLI, update `.env`, restart server

### "Connection refused"
- **Cause**: Server not running on port 3000
- **Fix**: Start your Next.js server

## Summary

- `stripe trigger` → Sends to Dashboard (not your server)
- `stripe listen` → Forwards to your local server (what you need!)
- Both must run: `stripe listen` + your Next.js server
- Test with: `stripe trigger checkout.session.completed` while `stripe listen` is running

