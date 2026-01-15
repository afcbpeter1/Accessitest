# Setting Up Stripe Test Mode for Payment Testing

## The Problem

You **cannot move products between test and live mode** in Stripe. You need to create **separate products and prices** in test mode.

## Solution: Create Test Mode Products

### Step 1: Switch to Test Mode in Stripe Dashboard

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Look for the toggle at the top that says **"Test mode"** or **"Live mode"**
3. Make sure it's set to **"Test mode"** (the URL should show `https://dashboard.stripe.com/test/...`)

### Step 2: Create Test Mode Products

You need to create the same products you have in live mode, but in test mode:

#### A. Create Subscription Products

1. Go to **Products** → **Add product**
2. Create products matching your live products:
   - **Unlimited Access (Monthly)**
   - **Unlimited Access (Yearly)**

3. For each product:
   - Set the **price** to match your live prices
   - Set **billing period** (monthly or yearly)
   - Click **Save**

4. **Copy the Price IDs** (they start with `price_` and are different from live mode)

#### B. Create Credit Package Products

1. Create products for each credit package:
   - **Starter Pack** (5 credits)
   - **Professional Pack** (7 credits)
   - **Business Pack** (9 credits)
   - **Enterprise Pack** (11 credits)

2. Set prices and **copy the Price IDs**

### Step 3: Update Your Configuration

You have two options:

#### Option A: Use Environment Variables (Recommended)

Add these to your `.env` file when testing:

```env
# Test Mode Stripe Keys (starts with sk_test_ and pk_test_)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# Test Mode Price IDs (from Step 2)
STRIPE_TEST_UNLIMITED_MONTHLY_PRICE_ID=price_xxxxx
STRIPE_TEST_UNLIMITED_YEARLY_PRICE_ID=price_xxxxx
STRIPE_TEST_STARTER_PACK_PRICE_ID=price_xxxxx
STRIPE_TEST_PROFESSIONAL_PACK_PRICE_ID=price_xxxxx
STRIPE_TEST_BUSINESS_PACK_PRICE_ID=price_xxxxx
STRIPE_TEST_ENTERPRISE_PACK_PRICE_ID=price_xxxxx
```

The code will **automatically detect test mode** based on your `STRIPE_SECRET_KEY` (if it starts with `sk_test_`).

#### Option B: Update stripe-config.ts Directly

Edit `src/lib/stripe-config.ts` and replace the test mode price placeholders with your actual test mode price IDs.

### Step 4: Test Your Payments

1. Make sure you're using **test mode API keys** (`sk_test_...` and `pk_test_...`)
2. Use **test card numbers**:
   - **Success**: `4242 4242 4242 4242`
   - **Decline**: `4000 0000 0000 0002`
   - **3D Secure**: `4000 0025 0000 3155`
3. Use any future expiry date, any CVC, any ZIP code

### Step 5: Test Webhooks

#### Local Development:
```bash
stripe listen --forward-to localhost:3000/api/stripe-webhook
```

#### Production Testing:
1. Create a test webhook endpoint in Stripe Dashboard (test mode)
2. Point it to: `https://yourdomain.com/api/stripe-webhook`
3. Copy the webhook secret (starts with `whsec_`)
4. Set `STRIPE_WEBHOOK_SECRET` in your environment

## Quick Checklist

- [ ] Switched to Test Mode in Stripe Dashboard
- [ ] Created test mode subscription products
- [ ] Created test mode credit package products
- [ ] Copied all test mode Price IDs
- [ ] Updated environment variables or stripe-config.ts
- [ ] Using test mode API keys (`sk_test_...`)
- [ ] Test webhook configured (local or production)

## How It Works

The code automatically detects test mode by checking if `STRIPE_SECRET_KEY` starts with `sk_test_`:

- **Test Mode** (`sk_test_...`) → Uses test mode price IDs
- **Live Mode** (`sk_live_...`) → Uses live mode price IDs

## Important Notes

✅ **Test mode = No real money** - Perfect for testing!
✅ **Test cards work in test mode** - Use `4242 4242 4242 4242`
✅ **Separate products required** - Can't move products between modes
✅ **Separate webhooks** - Test mode webhooks are separate from live mode

## When Ready for Production

1. Switch to **Live Mode** in Stripe Dashboard
2. Use **live mode API keys** (`sk_live_...` and `pk_live_...`)
3. The code will automatically use live mode price IDs
4. Create **live mode webhook** endpoint
5. Update `STRIPE_WEBHOOK_SECRET` with live mode secret

