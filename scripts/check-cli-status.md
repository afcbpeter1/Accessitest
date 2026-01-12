# Is Stripe CLI the Problem?

## Quick Check

### 1. Is Stripe CLI Running?

Look for a terminal window showing:
```
> Ready! Your webhook signing secret is whsec_...
```

If you DON'T see this, CLI isn't running → **This is the problem!**

### 2. Is CLI Receiving Events?

When you make a purchase, check the CLI terminal. You should see:
```
--> checkout.session.completed [200] POST http://localhost:3000/api/stripe-webhook
```

If you DON'T see this, CLI isn't receiving events → **This is the problem!**

### 3. Is Your Server Receiving Events?

Check your server console. You should see:
```
🔔 WEBHOOK ENDPOINT HIT!
```

If you DON'T see this, events aren't reaching your server → **Could be CLI or server issue**

## Common CLI Issues

### Issue 1: CLI Not Running
**Symptom:** No events in CLI terminal
**Fix:** Start it: `stripe listen --forward-to localhost:3000/api/stripe-webhook`

### Issue 2: CLI Running But No Events
**Symptom:** CLI shows "Ready!" but no events when purchasing
**Cause:** Dashboard webhooks might be intercepting events
**Fix:** Delete Dashboard webhooks pointing to localhost

### Issue 3: CLI Receiving But Not Forwarding
**Symptom:** CLI shows events but server doesn't receive them
**Cause:** Server not running or wrong port
**Fix:** Check server is running on port 3000

## How to Test

1. **Check CLI is running:**
   ```bash
   # Look for terminal with "Ready!" message
   ```

2. **Test with manual trigger:**
   ```bash
   stripe trigger checkout.session.completed
   ```
   - Should see in CLI: `--> checkout.session.completed [200]`
   - Should see in server: `🔔 WEBHOOK ENDPOINT HIT!`

3. **If manual trigger works but real purchases don't:**
   - CLI is working fine
   - Problem is likely Dashboard webhooks intercepting real purchases
   - Delete Dashboard webhooks

## Quick Diagnostic

Run this in your terminal:
```bash
# Check if CLI process is running
# (Windows PowerShell)
Get-Process | Where-Object { $_.ProcessName -like "*stripe*" }
```

If no Stripe process found → **CLI is not running** → This is your problem!

