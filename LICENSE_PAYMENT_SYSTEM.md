# License Payment System - How It Works

## Overview

Your system uses a **license pool model** where licenses are purchased and stored in a pool, then consumed when members accept invitations and join the organization. The organization owner is always free and doesn't require a license.

## How License Payments Work

### 1. **Purchasing Licenses**

**Where:** Organization → Billing Tab

**Process:**
1. Admin/Owner navigates to the Billing tab
2. Enters the number of licenses to purchase (e.g., 5 licenses)
3. Clicks "Purchase Licenses"
4. System creates a Stripe Checkout session
5. User is redirected to Stripe to complete payment
6. After payment, user returns to the organization page

**Payment Details:**
- **Payment Processor:** Stripe
- **Billing Period:** Monthly or Yearly (matches the organization owner's subscription period)
- **Price:** Set via environment variables:
  - `STRIPE_PER_USER_PRICE_ID` (monthly)
  - `STRIPE_PER_USER_PRICE_ID_YEARLY` (yearly)
- **Subscription Model:** Recurring subscription (not one-time payment)

### 2. **License Pool System**

**Database Fields (in `organizations` table):**
- `total_licenses` - Total number of licenses purchased
- `available_licenses` - Licenses available for assignment
- `used_licenses` - Calculated as: `total_licenses - available_licenses`

**How It Works:**
```
Example:
- You purchase 10 licenses → total_licenses = 10, available_licenses = 10
- 3 members accept invitations → available_licenses = 7, used_licenses = 3
- You purchase 5 more licenses → total_licenses = 15, available_licenses = 12
```

### 3. **Stripe Webhook Processing**

When a payment is completed, Stripe sends webhooks to your system:

**Webhook Events:**
1. `checkout.session.completed` - Payment successful
2. `customer.subscription.created` - New subscription created
3. `customer.subscription.updated` - Subscription updated (e.g., more licenses added)

**What Happens:**
1. Stripe webhook handler receives the event
2. System identifies it's an organization subscription (not individual user)
3. Calculates how many licenses were added
4. Updates the organization's license pool:
   - `total_licenses` = subscription quantity
   - `available_licenses` += licenses added
5. Sends billing confirmation email to organization owner

### 4. **License Consumption**

**When Licenses Are Consumed:**
- When a member **accepts an invitation** and joins the organization
- Owner role does NOT consume a license (always free)
- Admin and User roles DO consume licenses

**Process:**
1. Member clicks invitation link
2. System checks if `available_licenses > 0`
3. If yes: Consumes 1 license (`available_licenses -= 1`)
4. If no: Returns error asking to purchase more licenses
5. Member is activated and joins the organization

**Code Flow:**
```typescript
// In acceptInvitation()
if (!isOwner && availableLicenses <= 0) {
  return { success: false, message: 'No licenses available...' }
}
// Consume license
UPDATE organizations 
SET available_licenses = available_licenses - 1
```

### 5. **License Release**

**When Licenses Are Released:**
- When a member is **removed from the organization**
- License is returned to the pool: `available_licenses += 1`

### 6. **Billing Period Matching**

**Important:** License billing period matches the organization owner's subscription:

- If owner has **monthly** subscription → licenses are billed monthly
- If owner has **yearly** subscription → licenses are billed yearly

**How It's Determined:**
1. System checks organization owner's `stripe_subscription_id`
2. Looks up subscription in Stripe
3. Checks `price.recurring.interval` (month or year)
4. Uses corresponding price ID for license purchases

### 7. **Invitation Flow with Licenses**

**Scenario 1: Licenses Available**
1. Admin invites member → Invitation sent (no license check)
2. Member accepts invitation → License consumed from pool
3. Member joins organization

**Scenario 2: No Licenses Available**
1. Admin invites member → Invitation sent (still allowed)
2. Member tries to accept → Error: "No licenses available"
3. Member must wait until licenses are purchased

**Note:** You can invite members even without licenses, but they can't join until licenses are available.

### 8. **License Status Display**

**In the UI:**
- **Billing Tab** shows:
  - Total Licenses (purchased)
  - Used Licenses (assigned to members)
  - Available Licenses (ready to assign)

**In the Invite Modal:**
- Error message appears if no licenses available
- Message: "No licenses available. Please purchase licenses before inviting members..."

### 9. **Subscription Management**

**Adding More Licenses:**
- Each purchase creates/updates a Stripe subscription
- Subscription quantity = total licenses
- If you have 5 licenses and buy 3 more → subscription quantity becomes 8

**Renewal:**
- Licenses renew automatically based on billing period
- Stripe handles recurring billing
- Webhook updates organization on each renewal

**Cancellation:**
- If subscription is canceled, licenses remain until period ends
- After period ends, licenses are no longer available
- Members keep access until their current period expires

### 10. **Email Notifications**

**Billing Confirmation Email:**
- Sent when licenses are purchased
- Includes:
  - Number of licenses purchased
  - Amount charged
  - Billing period (monthly/yearly)
  - Invoice ID

## Key Points

✅ **Owner is Free:** Organization owner never consumes a license  
✅ **Pool System:** Licenses are stored in a pool and consumed on-demand  
✅ **Invite First:** You can invite members before purchasing licenses  
✅ **Join Requires License:** Members need available licenses to accept invitations  
✅ **Recurring Billing:** Licenses are subscription-based, not one-time  
✅ **Period Matching:** License billing matches owner's subscription period  
✅ **Automatic Renewal:** Stripe handles recurring payments automatically  

## Environment Variables Required

```env
STRIPE_SECRET_KEY=sk_...
STRIPE_PER_USER_PRICE_ID=price_... (monthly license price)
STRIPE_PER_USER_PRICE_ID_YEARLY=price_... (yearly license price)
```

## Database Schema

```sql
organizations
├── total_licenses (INTEGER) - Total licenses purchased
├── available_licenses (INTEGER) - Licenses available for assignment
├── subscription_status (VARCHAR) - Stripe subscription status
└── stripe_customer_id (VARCHAR) - Stripe customer ID
```

## Troubleshooting

**Issue:** Licenses not appearing after purchase
- Check Stripe webhook is configured correctly
- Verify webhook events are being received
- Check server logs for webhook processing

**Issue:** Can't invite members
- Check if `available_licenses > 0` (or invite anyway, they'll wait)
- Verify organization has `stripe_customer_id`

**Issue:** Billing period mismatch
- Ensure owner has active subscription
- Check owner's subscription interval (month/year)
- Verify correct price IDs are configured


