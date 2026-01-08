# Stripe CLI Troubleshooting

## Quick Checks

### 1. Is your Next.js server running?
```bash
# Check if port 3000 is in use
netstat -ano | findstr :3000
```

If nothing shows up, start your server:
```bash
npm run dev
```

### 2. Test if the webhook endpoint is accessible
```bash
# Test if localhost:3000 is responding
curl http://localhost:3000/api/stripe-webhook
```

Should return an error (not connection refused) - that means the server is running.

### 3. Check your Stripe CLI command
Make sure you're running:
```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

**Important**: 
- Use `localhost` not `127.0.0.1`
- Use `http://` not `https://`
- Make sure the path is exactly `/api/stripe-webhook`

### 4. Trigger a test event
The CLI won't show anything until an event is triggered:

```bash
# In a NEW terminal (keep CLI running), trigger a test event
stripe trigger checkout.session.completed
```

You should see:
- CLI: Event forwarded to localhost:3000
- Server console: `🔔 Webhook received!`

### 5. Check if events are being sent
When you make a purchase, check:
- **Stripe Dashboard** → Developers → Events
- See if events are being created
- Check if they're being sent to your webhook endpoint

### 6. Common Issues

**Issue: CLI shows "Ready!" but no events**
- Events only appear when triggered or sent
- Make a test purchase OR run `stripe trigger checkout.session.completed`

**Issue: "Connection refused"**
- Your server isn't running on port 3000
- Start it with `npm run dev`

**Issue: "Webhook signature verification failed"**
- Your `.env` secret doesn't match the CLI secret
- Copy the secret from CLI output (starts with `whsec_`)

**Issue: Events go to Dashboard webhook, not CLI**
- Test mode events go to Dashboard webhooks by default
- CLI only forwards events you manually trigger OR events sent to it
- Use `stripe trigger` to test locally

