-- Add billing columns to organizations table for user seat management
-- This migration adds the necessary columns for tracking user seats, subscriptions, and billing

-- Add max_users column (tracks how many user seats the organization has purchased)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'organizations' AND column_name = 'max_users') THEN
    ALTER TABLE organizations ADD COLUMN max_users INTEGER DEFAULT 1;
    COMMENT ON COLUMN organizations.max_users IS 'Maximum number of users allowed in the organization. Owner is free, additional users require payment.';
  END IF;
END $$;

-- Add subscription_status column (tracks Stripe subscription status)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'organizations' AND column_name = 'subscription_status') THEN
    ALTER TABLE organizations ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'inactive';
    COMMENT ON COLUMN organizations.subscription_status IS 'Stripe subscription status: active, inactive, canceled, etc.';
  END IF;
END $$;

-- Add stripe_customer_id column (links organization to Stripe customer)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'organizations' AND column_name = 'stripe_customer_id') THEN
    ALTER TABLE organizations ADD COLUMN stripe_customer_id VARCHAR(255);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id 
      ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;
    COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID for billing. Links organization to Stripe subscription.';
  END IF;
END $$;

-- Add max_teams column (for future team-based billing, optional)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name = 'organizations' AND column_name = 'max_teams') THEN
    ALTER TABLE organizations ADD COLUMN max_teams INTEGER DEFAULT 0;
    COMMENT ON COLUMN organizations.max_teams IS 'Maximum number of teams allowed (for future team-based billing)';
  END IF;
END $$;

-- Set default values for existing organizations
UPDATE organizations 
SET max_users = 1, 
    subscription_status = COALESCE(subscription_status, 'inactive'),
    max_teams = COALESCE(max_teams, 0)
WHERE max_users IS NULL 
   OR subscription_status IS NULL 
   OR max_teams IS NULL;

-- Create index on stripe_customer_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_organizations_stripe_customer_id_lookup 
  ON organizations(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

