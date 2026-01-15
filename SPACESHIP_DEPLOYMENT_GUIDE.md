# Complete Spaceship Hosting Deployment Guide

## Step-by-Step: Deploy from GitHub to Spaceship

This guide will walk you through deploying your Next.js app to Spaceship hosting using GitHub.

---

## Prerequisites

✅ Your code is pushed to GitHub (repository: `afcbpeter1/Accessitest`)  
✅ You have a Spaceship hosting account with cPanel access  
✅ You have your environment variables ready (database, Stripe keys, etc.)

---

## Part 1: Prepare Your GitHub Repository

### Step 1.1: Verify Your Repository

Make sure your GitHub repo has:
- ✅ `package.json` with all dependencies
- ✅ `server.js` (already exists in your repo)
- ✅ `next.config.js`
- ✅ All source code in `src/` directory

**Your repo is already set up correctly!** ✅

---

## Part 2: Set Up Node.js App in Spaceship cPanel

### Step 2.1: Access cPanel

1. Log in to your **Spaceship hosting account**
2. Open **cPanel**
3. Scroll down to the **"Exclusive"** or **"Software"** section
4. Find and click **"Setup Node.js App"**

### Step 2.2: Create New Node.js Application

1. Click the **"Create Application"** button
2. Fill in the application details:

   **Application Details:**
   - **Node.js version:** Select `18.x` or `20.x` (matches your `package.json`)
   - **Application mode:** Select `Production`
   - **Application root:** Usually `/home/yourusername/nodejs` (default is fine)
   - **Application URL:** Select your domain (e.g., `a11ytest.ai` or subdomain)
   - **Application startup file:** `server.js` ⚠️ **Important!**

3. Click **"Create"**

### Step 2.3: Note Your Application Details

After creation, note:
- **Application URL:** `https://yourdomain.com`
- **Application root path:** `/home/yourusername/nodejs/your-app-name`
- **Port number:** Usually shown in the app details

---

## Part 3: Connect GitHub Repository

### Step 3.1: Enable Git Deployment

1. In the **Node.js App** manager, find your application
2. Look for **"Deploy from Git"** or **"Git Repository"** option
3. Click it to open the Git deployment settings

### Step 3.2: Configure GitHub Connection

**Option A: If Git Deployment is Available:**

1. Enter your GitHub repository URL:
   ```
   https://github.com/afcbpeter1/Accessitest.git
   ```
   Or if using SSH:
   ```
   git@github.com:afcbpeter1/Accessitest.git
   ```

2. **Branch:** `master` (or `main` if that's your default branch)

3. **Deploy path:** Leave as default (usually the app root)

4. Click **"Deploy"** or **"Pull"**

**Option B: If Git Deployment is NOT Available (Manual Upload):**

You'll need to use File Manager or SSH. See Part 4 below.

---

## Part 4: Manual Setup (If Git Deployment Not Available)

### Step 4.1: Access Your App Directory via File Manager

1. In cPanel, go to **"Files"** → **"File Manager"**
2. Navigate to your Node.js app directory:
   ```
   /home/yourusername/nodejs/your-app-name
   ```
3. **Delete any existing files** in this directory (if it's a fresh setup)

### Step 4.2: Clone Repository via SSH (Recommended)

1. In cPanel, go to **"Advanced"** → **"Terminal"** (or use SSH client)
2. Navigate to your app directory:
   ```bash
   cd /home/yourusername/nodejs/your-app-name
   ```
3. Clone your repository:
   ```bash
   git clone https://github.com/afcbpeter1/Accessitest.git .
   ```
   (The `.` at the end clones into current directory)

4. If you get authentication errors, you may need to:
   - Set up SSH keys in cPanel
   - Or use HTTPS with a personal access token

### Step 4.3: Alternative - Upload via File Manager

1. Download your repo as ZIP from GitHub
2. In File Manager, navigate to your app directory
3. Upload the ZIP file
4. Extract it in File Manager
5. Move all files from the extracted folder to the app root

---

## Part 5: Install Dependencies

### Step 5.1: Install via Node.js App Manager

1. In **Node.js App** manager, find your application
2. Click **"NPM Install"** button
3. Wait for dependencies to install (this may take 5-10 minutes)
4. Check the logs for any errors

### Step 5.2: Install via Terminal/SSH (Alternative)

1. Open Terminal in cPanel or use SSH
2. Navigate to your app directory:
   ```bash
   cd /home/yourusername/nodejs/your-app-name
   ```
3. Run:
   ```bash
   npm install
   ```
4. Wait for installation to complete

---

## Part 6: Build Your Application

### Step 6.1: Build via Node.js App Manager

1. In **Node.js App** manager, find your application
2. Click **"Run NPM Script"**
3. Enter: `build`
4. Click **"Run"**
5. Wait for build to complete (may take 2-5 minutes)

### Step 6.2: Build via Terminal (Alternative)

1. Open Terminal/SSH
2. Navigate to your app directory
3. Run:
   ```bash
   npm run build
   ```
4. Wait for build to complete

**Expected output:** You should see "Creating an optimized production build" and "Compiled successfully"

---

## Part 7: Configure Environment Variables

### Step 7.1: Add Environment Variables in Node.js App Manager

1. In **Node.js App** manager, find your application
2. Click **"Edit"** or look for **"Environment Variables"** section
3. Add each variable one by one:

**Required Environment Variables:**

```
NODE_ENV=production
PORT=3000
HOSTNAME=localhost
```

**Database:**
```
DATABASE_URL=postgresql://user:password@host:port/database
```

**Stripe (Production Keys):**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Next.js:**
```
NEXT_PUBLIC_BASE_URL=https://yourdomain.com
```

**JWT:**
```
JWT_SECRET=your_jwt_secret_here
```

**Email (Resend):**
```
RESEND_API_KEY=re_...
```

**Encryption:**
```
ENCRYPTION_KEY=your_32_character_key_here
```

**OpenAI (if using):**
```
OPENAI_API_KEY=sk-...
```

**Cloudinary (if using):**
```
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

4. Click **"Save"** after adding all variables

### Step 7.2: Verify Environment Variables

Make sure all variables are set correctly. Double-check:
- ✅ No typos in variable names
- ✅ No extra spaces
- ✅ Production keys (not test keys) for Stripe
- ✅ Correct database URL

---

## Part 8: Configure Startup File

### Step 8.1: Verify Startup File

1. In **Node.js App** manager, find your application
2. Check **"Application startup file"** is set to: `server.js`
3. If not, change it to `server.js`
4. Click **"Save"**

### Step 8.2: Verify server.js Exists

1. In File Manager, navigate to your app directory
2. Verify `server.js` exists in the root
3. If missing, the file is already in your GitHub repo - it should be there after cloning

---

## Part 9: Start Your Application

### Step 9.1: Restart Application

1. In **Node.js App** manager, find your application
2. Click **"Restart"** button
3. Wait for the app to start (check status indicator)

### Step 9.2: Check Application Status

1. Look for **"Status"** indicator - should show **"Running"** (green)
2. Check **"Logs"** for any errors
3. Note the **Port** number (usually 3000)

---

## Part 10: Configure Domain & SSL

### Step 10.1: Point Domain to Application

1. In cPanel, go to **"Domains"** or **"Subdomains"**
2. Make sure your domain/subdomain points to your Node.js app directory
3. Or configure in **Node.js App** manager under **"Application URL"**

### Step 10.2: Enable SSL Certificate

1. In cPanel, go to **"SSL/TLS"**
2. Find your domain
3. Install **Let's Encrypt** certificate (free)
4. Or use **AutoSSL** if available (automatic)

---

## Part 11: Test Your Deployment

### Step 11.1: Visit Your Site

1. Open your browser
2. Go to: `https://yourdomain.com`
3. You should see your application

### Step 11.2: Check for Errors

1. Open browser **Developer Tools** (F12)
2. Check **Console** for JavaScript errors
3. Check **Network** tab for failed requests
4. Check application logs in **Node.js App** manager

### Step 11.3: Test Key Features

- ✅ Homepage loads
- ✅ Login/Signup works
- ✅ Database connection works
- ✅ Stripe integration works (test with test mode first!)

---

## Part 12: Set Up Production Stripe Webhook

### Step 12.1: Create Production Webhook in Stripe

1. Go to [Stripe Dashboard](https://dashboard.stripe.com) → **Switch to Live Mode**
2. Go to **"Developers"** → **"Webhooks"**
3. Click **"Add endpoint"**
4. Enter your production URL:
   ```
   https://yourdomain.com/api/stripe-webhook
   ```
5. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment.paid`
   - `payment_intent.succeeded`
   - `charge.succeeded`
6. Click **"Add endpoint"**
7. Copy the **Signing secret** (starts with `whsec_`)

### Step 12.2: Add Webhook Secret to Environment Variables

1. Go back to **Node.js App** manager
2. Edit environment variables
3. Update `STRIPE_WEBHOOK_SECRET` with the production secret
4. Save and restart the application

---

## Part 13: Run Database Migrations

### Step 13.1: Connect to Database

1. In cPanel, go to **"Databases"** → **"phpPgAdmin"** or use a database client
2. Connect to your PostgreSQL database

### Step 13.2: Run Migration Files

1. Find your migration files in: `migrations/009_add_organization_billing_columns.sql`
2. Run each migration file in order (if you have multiple)
3. Or create a script to run them all

**Via Terminal:**
```bash
cd /home/yourusername/nodejs/your-app-name
psql $DATABASE_URL -f migrations/009_add_organization_billing_columns.sql
```

---

## Part 14: Update Code (Future Deployments)

### Step 14.1: Update via Git (If Git Deployment Enabled)

1. Push changes to GitHub:
   ```bash
   git add .
   git commit -m "Your changes"
   git push origin master
   ```
2. In **Node.js App** manager, click **"Pull"** or **"Deploy"**
3. Run **"NPM Install"** if dependencies changed
4. Run **"Build"** script
5. **Restart** application

### Step 14.2: Update via SSH/Terminal

1. SSH into your server
2. Navigate to app directory:
   ```bash
   cd /home/yourusername/nodejs/your-app-name
   ```
3. Pull latest code:
   ```bash
   git pull origin master
   ```
4. Install dependencies (if needed):
   ```bash
   npm install
   ```
5. Build:
   ```bash
   npm run build
   ```
6. Restart in Node.js App manager

---

## Troubleshooting

### Build Fails

**Problem:** `npm run build` fails

**Solutions:**
- Check Node.js version matches `package.json` (>=18.0.0)
- Check build logs for specific errors
- Ensure all dependencies installed: `npm install`
- Check disk space: `df -h`
- Increase Node.js memory if needed

### Application Won't Start

**Problem:** App shows "Stopped" or crashes

**Solutions:**
- Check **Logs** in Node.js App manager
- Verify `server.js` exists and is correct
- Check environment variables are set
- Verify port is available (usually 3000)
- Check database connection

### Database Connection Errors

**Problem:** Can't connect to database

**Solutions:**
- Verify `DATABASE_URL` is correct
- Check database allows connections from your server IP
- Verify database credentials
- Check PostgreSQL is running

### 404 Errors

**Problem:** Pages return 404

**Solutions:**
- Verify domain points to correct directory
- Check `.htaccess` or routing configuration
- Verify Next.js build completed successfully
- Check application is running

### Environment Variables Not Working

**Problem:** Variables not being read

**Solutions:**
- Restart application after adding variables
- Check variable names match exactly (case-sensitive)
- Verify no extra spaces in values
- Check variables are saved in Node.js App manager

---

## Quick Reference Checklist

Before going live, verify:

- [ ] Code pushed to GitHub
- [ ] Node.js app created in cPanel
- [ ] GitHub repository connected (or manually uploaded)
- [ ] Dependencies installed (`npm install`)
- [ ] Application built (`npm run build`)
- [ ] All environment variables set
- [ ] `server.js` set as startup file
- [ ] Application restarted and running
- [ ] Domain configured and SSL enabled
- [ ] Production Stripe webhook created
- [ ] Database migrations run
- [ ] Tested key features
- [ ] Monitoring logs for errors

---

## Support Resources

- **Spaceship Support:** Check your hosting provider's documentation
- **cPanel Documentation:** [cpanel.net/docs](https://docs.cpanel.net)
- **Next.js Deployment:** [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)
- **Node.js on cPanel:** Check your hosting provider's Node.js guide

---

## Important Notes

⚠️ **Always test in production with Stripe test mode first!**

⚠️ **Keep your environment variables secure - never commit them to GitHub**

⚠️ **Backup your database before running migrations**

⚠️ **Monitor your application logs regularly**

✅ **Your `server.js` file is already configured correctly**

✅ **Your `package.json` has all the right scripts**

---

## Need Help?

If you encounter issues:
1. Check the **Troubleshooting** section above
2. Review application **Logs** in Node.js App manager
3. Check browser **Console** for frontend errors
4. Verify all steps were completed correctly

Good luck with your deployment! 🚀





