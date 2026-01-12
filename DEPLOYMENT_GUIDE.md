# Deployment Guide for Spaceship Hosting

## Yes, You Can Deploy from GitHub! 🚀

Spaceship hosting supports Git-based deployments, so you can connect your GitHub repository and deploy automatically.

## Step-by-Step Deployment (cPanel)

### 1. Push Your Code to GitHub

If you haven't already:

```bash
# Make sure all changes are committed
git add .
git commit -m "Ready for production deployment"
git push origin main
```

### 2. Set Up Node.js App in cPanel

1. In cPanel, scroll to the **"Exclusive"** section
2. Click **"Setup Node.js App"**
3. Click **"Create Application"** button

### 3. Configure Your Node.js Application

Fill in the form:

**Application Details:**
- **Node.js version:** Select `18.x` or `20.x` (check your `package.json` engines)
- **Application mode:** Select `Production`
- **Application root:** `/home/uvbnfavach/nodejs` (or similar - this is your home directory)
- **Application URL:** Select your domain `a11ytest.ai` (or subdomain)
- **Application startup file:** `server.js` (we'll create this)

**Click "Create"**

### 4. Connect to GitHub Repository

After creating the app, you should see options to:
- **Deploy from Git** - Click this
- Enter your GitHub repository URL: `https://github.com/yourusername/Accessitest.git`
- Or use SSH: `git@github.com:yourusername/Accessitest.git`
- **Branch:** `main` (or `master`)
- Click **"Deploy"** or **"Pull"**

**If Git option is not available:**
- You'll need to upload files manually (see Step 5)

### 5. Manual Upload (If Git Not Available)

1. In cPanel, go to **"Files"** → **"File Manager"**
2. Navigate to your Node.js app directory (usually `/home/uvbnfavach/nodejs/your-app-name`)
3. Upload all your project files (except `node_modules` and `.next`)
4. Or use FTP/SFTP to upload files

### 6. Create Production Startup File

**I've created a `server.js` file in your project root** - this file is already in your repository.

If you need to create it manually in cPanel:
1. In File Manager, navigate to your Node.js app directory
2. Create a new file called `server.js`
3. Copy the contents from the `server.js` file in your project root

**Note:** The `server.js` file is already in your GitHub repo, so if you deployed from Git, it should already be there!

### 7. Set Environment Variables

In the Node.js App manager in cPanel:

1. Find your application
2. Click **"Edit"** or **"Environment Variables"**
3. Add all your environment variables (see Step 4 in original guide)
4. Click **"Save"**

### 8. Install Dependencies & Build

In the Node.js App manager:

1. Find your application
2. Click **"NPM Install"** (this runs `npm install`)
3. Wait for dependencies to install
4. Click **"Run NPM Script"** and enter: `build`
5. Or use the terminal/SSH to run:
   ```bash
   cd /home/uvbnfavach/nodejs/your-app-name
   npm install
   npm run build
   ```

### 9. Update Startup File

In Node.js App manager:
- **Application startup file:** Change to `server.js`
- **Application URL:** Make sure it's set to your domain
- Click **"Save"**

### 10. Restart Application

1. In Node.js App manager, find your app
2. Click **"Restart"**
3. Your app should now be live!

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

