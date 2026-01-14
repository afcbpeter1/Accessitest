# Fix Render Build Error - opencollective-postinstall

## Problem
Build fails with `find: './node_modules/...': No such file or directory` errors from `opencollective-postinstall`.

## Solution

### Step 1: Update Build Command in Render Dashboard

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Select your service: `accessitest`
3. Go to **Settings** tab
4. Scroll to **Build & Deploy** section
5. Update **Build Command** to (try Option A first, if it still fails use Option B):

   **Option A (Recommended - skips problematic scripts, try build first):**
   ```bash
   npm install --ignore-scripts && npm run build
   ```

   **Option B (If Option A fails with native module errors, rebuild critical modules):**
   ```bash
   npm install --ignore-scripts && npm rebuild canvas sharp && npm run build
   ```

   **Option C (If puppeteer is needed, handle it separately):**
   ```bash
   npm install --ignore-scripts && npm rebuild canvas sharp && (cd node_modules/puppeteer && npm install --ignore-scripts=false) && npm run build
   ```

   **Option B (If Option A still shows find errors - try with DISABLE_OPENCOLLECTIVE):**
   ```bash
   DISABLE_OPENCOLLECTIVE=1 npm ci && npm run build
   ```

   **Option C (Fallback - normal install with env var):**
   ```bash
   DISABLE_OPENCOLLECTIVE=1 npm install && npm run build
   ```

   **Why Option A is better:**
   - Skips ALL postinstall scripts (including opencollective)
   - Only rebuilds the 3 critical native modules (canvas, puppeteer, sharp)
   - Much faster than rebuilding everything (should take 5-10 minutes instead of 30+)

6. Click **Save Changes**

### Step 2: Set Environment Variable

1. In the same service, go to **Environment** tab
2. Add or update:
   - **Key:** `DISABLE_OPENCOLLECTIVE`
   - **Value:** `1`
3. Click **Save Changes**

### Step 3: Redeploy

1. Go to **Manual Deploy** dropdown
2. Select **"Deploy latest commit"** or **"Clear build cache & deploy"**
3. Monitor the build logs

## Why This Works

The `opencollective-postinstall` script runs after `npm install` and tries to use `find` commands that fail during the build process. Setting `DISABLE_OPENCOLLECTIVE=1` prevents these scripts from running.

## Alternative: Set in package.json (Not Recommended)

You could also add this to your `package.json`:
```json
{
  "scripts": {
    "postinstall": "DISABLE_OPENCOLLECTIVE=1"
  }
}
```

But the build command approach is cleaner and more explicit.

## Verify

After redeploying, you should see:
- ✅ No `find` command errors
- ✅ `npm install` completes successfully
- ✅ `npm run build` completes successfully
- ✅ Service starts correctly

