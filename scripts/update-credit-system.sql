-- Update credit system for AccessiTest
-- This script ensures the user_credits table has the correct structure

-- Create user_credits table if it doesn't exist
CREATE TABLE IF NOT EXISTS user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credits_remaining INTEGER NOT NULL DEFAULT 0,
    credits_used INTEGER NOT NULL DEFAULT 0,
    unlimited_credits BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add any missing columns
DO $$ 
BEGIN
    -- Add unlimited_credits column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_credits' AND column_name = 'unlimited_credits') THEN
        ALTER TABLE user_credits ADD COLUMN unlimited_credits BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'user_credits' AND column_name = 'updated_at') THEN
        ALTER TABLE user_credits ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_user_credits_updated_at ON user_credits(updated_at);

-- Create credit_transactions table to track credit purchases and usage
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'bonus', 'refund')),
    amount INTEGER NOT NULL, -- Positive for purchases/bonuses, negative for usage
    description TEXT,
    stripe_payment_intent_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);

-- Create notifications table for user notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);

-- Update existing users to have 3 free credits if they don't have any credits record
INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
SELECT u.id, 3, 0, FALSE
FROM users u
LEFT JOIN user_credits uc ON u.id = uc.user_id
WHERE uc.user_id IS NULL
AND u.plan_type = 'free';

-- Update users with subscription plans to have unlimited credits
UPDATE user_credits 
SET unlimited_credits = TRUE, updated_at = NOW()
WHERE user_id IN (
    SELECT id FROM users 
    WHERE plan_type IN ('web_only', 'document_only', 'complete_access')
);

-- Verify the setup
SELECT 
    'user_credits' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN unlimited_credits = TRUE THEN 1 END) as unlimited_users,
    COUNT(CASE WHEN unlimited_credits = FALSE THEN 1 END) as credit_users
FROM user_credits
UNION ALL
SELECT 
    'credit_transactions' as table_name,
    COUNT(*) as total_records,
    0 as unlimited_users,
    0 as credit_users
FROM credit_transactions
UNION ALL
SELECT 
    'notifications' as table_name,
    COUNT(*) as total_records,
    0 as unlimited_users,
    0 as credit_users
FROM notifications;
