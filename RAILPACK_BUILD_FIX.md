# Railpack Build Timeout Fix

## Problem
The build is timing out after 10+ minutes during the Docker image build phase. This is caused by:

1. **Puppeteer** downloading Chromium (~170MB) during `npm ci`/`npm install`
2. **Native dependencies** (`canvas`, `sharp`) requiring compilation
3. Heavy dependencies taking too long to install

## Root Cause
- Puppeteer automatically downloads Chromium during installation
- The build process runs `npm ci` which installs all dependencies including Chromium
- This download + compilation process exceeds the 10-minute build timeout

## Solution

### Option 1: Skip Chromium Download During Build (Recommended)

Configure Puppeteer to skip Chromium download during build, then use system Chromium or download it at runtime.

**Update `.npmrc` file:**
```
# Skip Chromium download during npm install
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_SKIP_DOWNLOAD=true
```

**Set Environment Variables in Railpack:**
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium` (or path to system Chromium)

**Update build command in Railpack:**
```bash
npm ci --ignore-scripts && npm rebuild canvas sharp && npm run build
```

### Option 2: Use Puppeteer Core (Alternative)

If you can use system Chromium, switch to `puppeteer-core` which doesn't download Chromium:

1. Replace `puppeteer` with `puppeteer-core` in `package.json`
2. Update code to specify Chromium path:
   ```typescript
   const browser = await puppeteer.launch({
     executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
     // ... other options
   })
   ```

### Option 3: Optimize Build Process

**Update build command:**
```bash
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true npm ci --ignore-scripts && npm rebuild canvas sharp && npm run build
```

**Or use a multi-stage approach:**
```bash
# Install dependencies without scripts
npm ci --ignore-scripts

# Rebuild only critical native modules
npm rebuild canvas sharp

# Build the application
npm run build
```

## Implementation Steps

### Step 1: Update `.npmrc`
Add Puppeteer skip flags to prevent Chromium download during build.

### Step 2: Configure Railpack Environment Variables
In your Railpack dashboard, add:
- `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
- `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` (adjust based on your system)

### Step 3: Update Build Command
Use the optimized build command that skips Chromium download.

### Step 4: Ensure System Chromium is Available
Make sure your Railpack/Docker image has Chromium installed. The apt packages in your plan should include it, or add:
```dockerfile
RUN apt-get update && apt-get install -y chromium chromium-browser
```

## Why This Works

1. **Skips Chromium Download**: Saves 2-5 minutes during build
2. **Faster Installation**: `--ignore-scripts` skips postinstall scripts
3. **Selective Rebuild**: Only rebuilds necessary native modules
4. **System Chromium**: Uses pre-installed Chromium instead of downloading

## Expected Build Time
- Before: 10+ minutes (timeout)
- After: 5-7 minutes (should complete successfully)

## Code Changes Made

### 1. Updated `.npmrc`
Added Puppeteer skip flags to prevent Chromium download during build:
```
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_SKIP_DOWNLOAD=true
```

### 2. Created Puppeteer Configuration Utility
Created `src/lib/puppeteer-config.ts` to handle both bundled and system Chromium:
- Automatically detects system Chromium via `PUPPETEER_EXECUTABLE_PATH` env var
- Falls back to common system paths
- Provides helper functions for consistent Puppeteer configuration

**Optional:** Update your Puppeteer launch calls to use the utility:
```typescript
import { getPuppeteerLaunchOptions } from '@/lib/puppeteer-config'

const browser = await puppeteer.launch(getPuppeteerLaunchOptions())
```

## Verification

After deploying, test Puppeteer functionality:
1. Check if `/api/test-puppeteer` endpoint works
2. Verify accessibility scans work
3. Check application logs for Puppeteer errors

## Next Steps

1. **Commit the changes:**
   ```bash
   git add .npmrc src/lib/puppeteer-config.ts RAILPACK_BUILD_FIX.md
   git commit -m "Fix Railpack build timeout by skipping Puppeteer Chromium download"
   git push
   ```

2. **Configure Railpack:**
   - Set environment variable: `PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true`
   - Set environment variable: `PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser` (or appropriate path)
   - Update build command to: `npm ci --ignore-scripts && npm rebuild canvas sharp && npm run build`

3. **Redeploy** and monitor build logs

