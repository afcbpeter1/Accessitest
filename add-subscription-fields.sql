-- Add subscription-related fields to database tables
-- Run this to ensure all required fields exist for subscription functionality

-- ============================================
-- USERS table - Add subscription fields
-- ============================================
DO $$ 
BEGIN
  -- Add plan_type if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'plan_type'
  ) THEN
    ALTER TABLE users ADD COLUMN plan_type VARCHAR(50) DEFAULT 'free';
    RAISE NOTICE 'Added plan_type column to users';
  END IF;
  
  -- Add stripe_subscription_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE users ADD COLUMN stripe_subscription_id VARCHAR(255);
    RAISE NOTICE 'Added stripe_subscription_id column to users';
  END IF;
END $$;

-- ============================================
-- USER_CREDITS table - Ensure all fields exist
-- ============================================
DO $$ 
BEGIN
  -- Add unlimited_credits if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'unlimited_credits'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN unlimited_credits BOOLEAN DEFAULT false;
    RAISE NOTICE 'Added unlimited_credits column to user_credits';
  END IF;
  
  -- Add credits_remaining if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'credits_remaining'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN credits_remaining INTEGER DEFAULT 0;
    RAISE NOTICE 'Added credits_remaining column to user_credits';
  END IF;
  
  -- Add credits_used if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_credits' AND column_name = 'credits_used'
  ) THEN
    ALTER TABLE user_credits ADD COLUMN credits_used INTEGER DEFAULT 0;
    RAISE NOTICE 'Added credits_used column to user_credits';
  END IF;
END $$;

-- ============================================
-- Add indexes for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_plan_type ON users(plan_type);
CREATE INDEX IF NOT EXISTS idx_users_stripe_subscription_id ON users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_unlimited ON user_credits(unlimited_credits);

-- ============================================
-- Verify the changes
-- ============================================
DO $$
BEGIN
  RAISE NOTICE '✅ Subscription fields check complete';
  RAISE NOTICE 'Check the output above to see which fields were added';
END $$;

