# Deployment Guide for Spaceship Hosting

## Yes, You Can Deploy from GitHub! 🚀

Spaceship hosting supports Git-based deployments, so you can connect your GitHub repository and deploy automatically.

## Step-by-Step Deployment

### 1. Push Your Code to GitHub

If you haven't already:

```bash
# Make sure all changes are committed
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### 2. Connect GitHub to Spaceship

1. Log into your Spaceship hosting dashboard
2. Go to "Add New Site" or "Deploy"
3. Select "Connect GitHub Repository"
4. Authorize Spaceship to access your GitHub account
5. Select your repository: `Accessitest` (or your repo name)
6. Select the branch: `main` (or `master`)

### 3. Configure Build Settings

Spaceship should auto-detect Next.js, but verify these settings:

**Build Command:**
```bash
npm run build
```

**Start Command:**
```bash
npm start
```

**Node Version:**
- Set to: `18.x` or `20.x` (check your `package.json` engines)

**Root Directory:**
- Leave as `/` (root)

### 4. Set Environment Variables

In Spaceship dashboard, go to your site → Environment Variables and add:

#### Required Variables:

```env
# Database
DATABASE_URL=your_production_database_url

# Stripe (Production Keys - NOT test keys!)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_... (from Stripe Dashboard production webhook)

# Next.js
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
NODE_ENV=production

# JWT Secret
JWT_SECRET=your_jwt_secret_here

# Email (Resend)
RESEND_API_KEY=re_...

# Encryption (for Jira/DevOps credentials)
ENCRYPTION_KEY=your_32_character_key_here

# OpenAI (if using)
OPENAI_API_KEY=sk-...

# Cloudinary (if using)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### 5. Set Up Production Stripe Webhook

**IMPORTANT:** You need to create a production webhook in Stripe Dashboard:

1. Go to: https://dashboard.stripe.com/webhooks (switch to **Live Mode**)
2. Click **"Add endpoint"**
3. Enter your production URL:
   ```
   https://yourdomain.com/api/stripe-webhook
   ```
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment.paid`
   - `payment_intent.succeeded`
   - `charge.succeeded`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to Spaceship environment variables as `STRIPE_WEBHOOK_SECRET`

### 6. Update Stripe Keys for Production

**Switch to Live Mode in Stripe:**
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Click **"Activate test mode"** toggle to switch to **Live mode**
3. Copy your **Live** API keys:
   - Secret key: `sk_live_...`
   - Publishable key: `pk_live_...`
4. Add these to Spaceship environment variables

**Update Frontend:**
- Make sure your frontend uses `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (if you have it)
- Or update your Stripe config to use the live publishable key

### 7. Run Database Migrations

Before going live, make sure all migrations are run:

```bash
# Connect to your production database
# Run all migration files in order:
# migrations/001_jira_integration.sql
# migrations/002_azure_devops_integration.sql
# ... etc
```

Or create a migration script to run them all.

### 8. Deploy!

1. In Spaceship dashboard, click **"Deploy"** or **"Redeploy"**
2. Watch the build logs
3. Once deployed, your site will be live at your Spaceship URL

### 9. Test Production

1. Visit your live site
2. Make a test purchase (use Stripe test mode first if possible)
3. Check webhook logs in Stripe Dashboard
4. Verify credits/subscriptions are working

## Important Notes

### ⚠️ Security Checklist

- [ ] All environment variables set in Spaceship (not in code)
- [ ] Using **Live** Stripe keys (not test keys)
- [ ] Production webhook configured in Stripe Dashboard
- [ ] Database migrations run
- [ ] HTTPS enabled (Spaceship should provide this)
- [ ] `.env` file NOT committed to GitHub

### 🔑 Key Differences: Test vs Live

| Item | Test Mode | Live Mode |
|------|-----------|-----------|
| Stripe Keys | `sk_test_...` | `sk_live_...` |
| Webhook Secret | From CLI | From Dashboard |
| Money | Fake/test cards | Real money |
| Webhooks | CLI forwards | Stripe sends directly |

### 📧 Email Configuration

Make sure `RESEND_API_KEY` is set in production environment variables, or receipt emails won't be sent.

## Troubleshooting

### Build Fails
- Check Node version matches `package.json` engines
- Check all dependencies are in `package.json`
- Review build logs in Spaceship dashboard

### Webhooks Not Working
- Verify `STRIPE_WEBHOOK_SECRET` matches Dashboard secret
- Check webhook endpoint URL is correct
- Check Stripe Dashboard → Webhooks → Events for delivery status

### Database Connection Issues
- Verify `DATABASE_URL` is correct
- Check database allows connections from Spaceship IP
- Verify SSL is enabled for production

## Quick Reference

**Build Command:** `npm run build`
**Start Command:** `npm start`
**Node Version:** `18.x` or `20.x`
**Framework:** Next.js (auto-detected)

## Need Help?

Check Spaceship documentation for:
- Custom domains
- SSL certificates
- Environment variables
- Build logs
- Deployment history

