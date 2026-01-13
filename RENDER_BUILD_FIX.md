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

   **Option A (Recommended):**
   ```bash
   npm config set opencollective false && DISABLE_OPENCOLLECTIVE=1 npm install && npm run build
   ```

   **Option B (If Option A still fails - more aggressive):**
   ```bash
   npm install --ignore-scripts && npm rebuild && npm run build
   ```

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

