# Organization & Team Management Setup Guide

This guide covers what you need to set up for the multi-user organization and team management feature.

## Database Setup

### 1. Run the Migration

You need to run the migration file to create the new tables and modify existing ones:

```bash
# Connect to your PostgreSQL database and run:
psql -d your_database_name -f migrations/003_organizations_and_teams.sql
```

Or if you're using a database client:
1. Open your database management tool (pgAdmin, DBeaver, etc.)
2. Connect to your database
3. Open and execute the file: `migrations/003_organizations_and_teams.sql`

### What the Migration Does:

- **Creates new tables:**
  - `organizations` - Top-level business entities
  - `teams` - Sub-groups within organizations
  - `organization_members` - User-organization relationships with roles
  - `organization_credits` - Organization-wide credit pools
  - `team_integrations` - Integration configs per team

- **Modifies existing tables:**
  - `users` - Adds `default_organization_id`
  - `jira_integrations` - Adds `team_id` (nullable)
  - `azure_devops_integrations` - Adds `team_id` (nullable)
  - `issues` - Adds `organization_id`, `team_id`, `created_by_user_id`
  - `active_scans` - Adds `organization_id`, `team_id`
  - `credit_transactions` - Adds `organization_id`
  - `scan_history` - Adds `organization_id`, `team_id`

- **Data migration:**
  - Creates a personal organization for each existing user
  - Sets user as 'owner' of their organization
  - Migrates user credits to organization credits
  - Sets the organization as the user's default

### 2. Verify Migration

After running the migration, verify it worked:

```sql
-- Check that organizations were created
SELECT COUNT(*) FROM organizations;

-- Check that each user has an organization
SELECT u.email, o.name 
FROM users u 
LEFT JOIN organization_members om ON u.id = om.user_id 
LEFT JOIN organizations o ON om.organization_id = o.id 
WHERE om.role = 'owner';
```

## Stripe Setup

### 1. Create Per-User Pricing Product

You need to create a **per-user subscription product** in Stripe for organization billing:

1. Go to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to **Products** → **Add Product**
3. Create a new product:
   - **Name**: "Per User (Monthly)" or similar
   - **Pricing Model**: Recurring
   - **Billing Period**: Monthly (or Yearly if you prefer)
   - **Price**: Set your per-user price (e.g., $10/user/month)
   - **Billing**: Per unit (this is important - it allows quantity-based pricing)

4. **Copy the Price ID** (starts with `price_...`)

### 2. Set Environment Variable

Add the Price ID to your `.env` file:

```env
STRIPE_PER_USER_PRICE_ID=price_xxxxxxxxxxxxx
```

Replace `price_xxxxxxxxxxxxx` with the actual Price ID from Stripe.

### 3. Configure Webhook (if not already done)

Make sure your Stripe webhook is configured to receive these events:
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `checkout.session.completed`
- `invoice.payment_succeeded`

The webhook handler has been updated to automatically handle organization subscriptions.

### 4. Test the Setup

1. Create an organization via the API
2. Try to add a user (should check user limits)
3. Create a checkout session for adding users
4. Complete a test payment in Stripe test mode
5. Verify the webhook updates `max_users` in the organization

## Environment Variables Summary

Make sure these are set in your `.env` file:

```env
# Existing Stripe config
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...

# New: Per-user pricing for organizations
STRIPE_PER_USER_PRICE_ID=price_...

# Database (should already be set)
DATABASE_URL=postgresql://...
```

## Post-Migration Checklist

After running the migration:

- [ ] Verify all tables were created
- [ ] Check that existing users have personal organizations
- [ ] Verify user credits were migrated to organization credits
- [ ] Test creating a new organization via API
- [ ] Test inviting a user to an organization
- [ ] Test team creation and user assignment
- [ ] Verify Stripe per-user price is configured
- [ ] Test organization billing checkout flow

## Troubleshooting

### Migration Fails

- Check that you have proper database permissions
- Ensure all existing tables exist (users, user_credits, etc.)
- Check PostgreSQL version (should be 12+ for UUID support)

### Stripe Checkout Not Working

- Verify `STRIPE_PER_USER_PRICE_ID` is set correctly
- Check that the price is set to "per unit" billing
- Ensure webhook is receiving events
- Check webhook logs for errors

### Credits Not Working

- Verify organization credits were created during migration
- Check that `default_organization_id` is set on users
- Test credit deduction via API to see if it uses org credits

## Next Steps

After setup is complete, you can:
1. Build the UI components (organization dashboard, team management, etc.)
2. Test the full workflow end-to-end
3. Deploy to production

