# Render Deployment Setup Guide

## Option 1: Using render.yaml (Recommended if supported)

If your Render account supports Blueprint (render.yaml), the configuration is already in place:

1. **Connect your GitHub repository** to Render
2. **Render should auto-detect** the `render.yaml` file
3. **Verify the build command** in Render dashboard matches:
   ```
   DISABLE_OPENCOLLECTIVE=1 npm install && npm run build
   ```

The `render.yaml` file already includes:
- Build command with `DISABLE_OPENCOLLECTIVE=1`
- Environment variables set
- Start command: `npm start`

## Option 2: Manual Dashboard Configuration (If render.yaml doesn't work)

If Render doesn't automatically use `render.yaml`, configure manually:

### Step 1: Create a New Web Service

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **"New +"** → **"Web Service"**
3. Connect your GitHub repository: `afcbpeter1/Accessitest`
4. Select branch: `master`

### Step 2: Configure Build Settings

**Build Command:**
```bash
DISABLE_OPENCOLLECTIVE=1 npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Node Version:**
- Select `18.x` or `20.x` (matches your `package.json` engines requirement)

**Root Directory:**
- Leave as `/` (root) unless your app is in a subdirectory

### Step 3: Set Environment Variables

In the Render dashboard, go to **Environment** tab and add:

**Required Variables:**
```
NODE_ENV=production
DISABLE_OPENCOLLECTIVE=1
```

**Your Application Variables:**
```
DATABASE_URL=your_production_database_url
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_BASE_URL=https://accessitest.onrender.com
JWT_SECRET=your_jwt_secret_here
RESEND_API_KEY=re_...
ENCRYPTION_KEY=your_32_character_key_here
OPENAI_API_KEY=sk-...
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Step 4: Deploy

1. Click **"Create Web Service"**
2. Render will start building
3. Monitor the build logs - you should no longer see the `find` command errors

## Why This Fixes the Issue

The `find` command errors come from `opencollective-postinstall` scripts that run after `npm install`. These scripts:
- Are just donation prompts (not required for your app)
- Use `find` commands that fail if packages aren't fully installed
- Can cause builds to fail even though they're non-critical

By setting `DISABLE_OPENCOLLECTIVE=1` in the build command, we prevent these scripts from running.

## Troubleshooting

### If build still fails:

1. **Clear Build Cache:**
   - In Render dashboard → Your service → Settings
   - Click **"Clear build cache"**
   - Redeploy

2. **Check Build Logs:**
   - Look for the actual error (not just the find warnings)
   - The find errors might be warnings, not the real failure

3. **Verify Environment Variables:**
   - Make sure `DISABLE_OPENCOLLECTIVE=1` is set in the build command
   - Or set it as an environment variable in the dashboard

### If render.yaml isn't working:

- Render Blueprint (render.yaml) might not be enabled for your account
- Use Option 2 (Manual Dashboard Configuration) instead
- The build command is the most important part: `DISABLE_OPENCOLLECTIVE=1 npm install && npm run build`

## Quick Reference

**Build Command:**
```bash
DISABLE_OPENCOLLECTIVE=1 npm install && npm run build
```

**Start Command:**
```bash
npm start
```

**Key Environment Variable:**
```
DISABLE_OPENCOLLECTIVE=1
```

