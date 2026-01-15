# Render Deployment Guide

This guide will walk you through deploying your Next.js application to Render.

## Prerequisites

- ✅ GitHub repository connected to Render
- ✅ All TypeScript build errors resolved (completed)
- ✅ Environment variables ready

## Step 1: Connect Repository to Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub account if not already connected
4. Select repository: `afcbpeter1/Accessitest`
5. Select branch: `master`

## Step 2: Configure Service Settings

### Option A: Using render.yaml (Recommended)

If your Render account supports Blueprint (render.yaml):

1. Render should auto-detect the `render.yaml` file
2. Review the settings that were auto-populated
3. Make sure the following match:
   - **Name:** `accessitest`
   - **Region:** Your preferred region (e.g., `oregon`)
   - **Branch:** `master`
   - **Root Directory:** `/` (leave empty)
   - **Runtime:** `Node`
   - **Node Version:** `20.x` (or `18.x`)

### Option B: Manual Configuration

If render.yaml isn't working, configure manually:

**Basic Settings:**
- **Name:** `accessitest`
- **Region:** Choose closest to your users
- **Branch:** `master`
- **Root Directory:** `/` (leave empty)
- **Runtime:** `Node`
- **Node Version:** `20.x` or `18.x`

**Build Settings:**
- **Build Command:**
  ```bash
  DISABLE_OPENCOLLECTIVE=1 npm install && npm run build
  ```
- **Start Command:**
  ```bash
  npm start
  ```

**Advanced Settings:**
- **Health Check Path:** `/` (optional, helps with zero-downtime deploys)
- **Auto-Deploy:** `On Commit` (deploys automatically on push to master)

## Step 3: Set Environment Variables

Go to the **Environment** tab in your service settings and add:

### Required Variables

```env
NODE_ENV=production
DISABLE_OPENCOLLECTIVE=1
```

### Application Variables

Add these with your actual production values:

```env
# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Stripe (Production Keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Next.js
NEXT_PUBLIC_BASE_URL=https://accessitest.onrender.com

# Authentication
JWT_SECRET=your_jwt_secret_here

# Email (Resend)
RESEND_API_KEY=re_...

# Encryption
ENCRYPTION_KEY=your_32_character_key_here

# OpenAI (if using)
OPENAI_API_KEY=sk-...

# Cloudinary (if using)
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

**Important Notes:**
- Use **production** keys for Stripe (not test keys)
- Generate a strong `JWT_SECRET` (at least 32 characters)
- Generate a strong `ENCRYPTION_KEY` (exactly 32 characters)
- Update `NEXT_PUBLIC_BASE_URL` after deployment with your actual Render URL

## Step 4: Create and Deploy

1. Click **"Create Web Service"**
2. Render will start building your application
3. Monitor the build logs in real-time

### Expected Build Process

1. **Install dependencies** (may take 5-10 minutes)
   - You should see `npm install` running
   - No `find` command errors (thanks to `DISABLE_OPENCOLLECTIVE=1`)

2. **Build application** (may take 2-5 minutes)
   - You should see "Creating an optimized production build"
   - TypeScript compilation
   - Next.js optimization

3. **Deploy** (usually 1-2 minutes)
   - Service starts
   - Health check passes
   - Service becomes available

## Step 5: Post-Deployment Configuration

### Update Base URL

After your first deployment:

1. Note your Render URL: `https://accessitest.onrender.com`
2. Update the `NEXT_PUBLIC_BASE_URL` environment variable
3. Redeploy (or restart) to apply the change

### Configure Stripe Webhook

1. Go to [Stripe Dashboard](https://dashboard.stripe.com/webhooks)
2. Add endpoint: `https://accessitest.onrender.com/api/stripe-webhook`
3. Select events to listen for
4. Copy the webhook secret
5. Update `STRIPE_WEBHOOK_SECRET` in Render environment variables
6. Redeploy

### Set Up Custom Domain (Optional)

1. In Render Dashboard → Your Service → Settings
2. Scroll to **"Custom Domains"**
3. Add your domain
4. Follow DNS configuration instructions
5. Render will provision SSL automatically

## Step 6: Verify Deployment

1. Visit your Render URL: `https://accessitest.onrender.com`
2. Test key functionality:
   - User registration/login
   - Starting a scan
   - Viewing scan results
   - Stripe checkout (if configured)

3. Check logs for any errors:
   - Render Dashboard → Your Service → Logs

## Understanding Render Deploys

### Auto-Deploys

By default, Render automatically deploys when you:
- Push to the `master` branch
- Merge a pull request to `master`

**Auto-Deploy Options:**
- **On Commit:** Deploy immediately (default)
- **After CI Checks Pass:** Wait for CI to pass first
- **Off:** Manual deploys only

### Manual Deploys

You can manually trigger deploys:

1. **Deploy Latest Commit:** Deploy the most recent commit
2. **Deploy Specific Commit:** Choose a specific commit
3. **Clear Build Cache & Deploy:** Fresh build without cache
4. **Restart Service:** Restart without redeploying

### Zero-Downtime Deploys

Render performs zero-downtime deploys by default:

1. Builds new version
2. Spins up new instance
3. Routes traffic to new instance
4. Shuts down old instance after 60 seconds

Your service stays available throughout the process!

## Troubleshooting

### Build Fails

**Common Issues:**

1. **TypeScript Errors:**
   - ✅ Already fixed! All TypeScript errors have been resolved.

2. **Dependency Installation Fails:**
   - Check build logs for specific package errors
   - Try clearing build cache: Settings → Clear Build Cache
   - Verify Node version matches `package.json` engines

3. **Build Timeout:**
   - Default timeout is 120 minutes
   - If you need more, contact Render support
   - Optimize build: remove unused dependencies

4. **Memory Issues:**
   - Upgrade to a higher plan if needed
   - Optimize build process

### Service Won't Start

1. **Check Logs:**
   - Look for error messages
   - Check if port is correctly configured

2. **Environment Variables:**
   - Verify all required variables are set
   - Check for typos in variable names
   - Ensure no extra spaces

3. **Database Connection:**
   - Verify `DATABASE_URL` is correct
   - Check database is accessible from Render
   - Test connection locally first

### Service Crashes After Start

1. **Check Application Logs:**
   - Look for runtime errors
   - Check for missing environment variables

2. **Health Check:**
   - Verify health check path is correct
   - Ensure `/` route is accessible

3. **Resource Limits:**
   - Check if service is hitting memory limits
   - Upgrade plan if needed

### Performance Issues

1. **Cold Starts:**
   - Free tier services spin down after inactivity
   - First request may be slow
   - Upgrade to paid plan for always-on service

2. **Build Optimization:**
   - Use build cache when possible
   - Optimize dependencies
   - Consider using Docker for faster builds

## Best Practices

### Environment Variables

- ✅ Never commit secrets to Git
- ✅ Use Render's environment variable management
- ✅ Use different values for staging/production
- ✅ Rotate secrets regularly

### Deployment Strategy

- ✅ Test locally before pushing
- ✅ Use feature branches for development
- ✅ Deploy to staging first (if you have one)
- ✅ Monitor logs after deployment

### Monitoring

- ✅ Set up health checks
- ✅ Monitor application logs
- ✅ Set up alerts for errors
- ✅ Track deployment history

## Quick Reference

**Build Command:**
```bash
DISABLE_OPENCOLLECTIVE=1 npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Key Environment Variables:**
- `NODE_ENV=production`
- `DISABLE_OPENCOLLECTIVE=1`
- `DATABASE_URL` (your database connection string)
- `NEXT_PUBLIC_BASE_URL` (your Render URL)

**Render Dashboard:**
- [Dashboard](https://dashboard.render.com)
- [Documentation](https://render.com/docs)

## Next Steps

After successful deployment:

1. ✅ Set up monitoring and alerts
2. ✅ Configure custom domain (optional)
3. ✅ Set up database backups
4. ✅ Configure CI/CD pipeline (optional)
5. ✅ Set up staging environment (optional)

## Support

- **Render Support:** [support@render.com](mailto:support@render.com)
- **Render Docs:** [render.com/docs](https://render.com/docs)
- **Render Community:** [community.render.com](https://community.render.com)

---

**Last Updated:** After TypeScript build fixes
**Status:** ✅ Ready for deployment





