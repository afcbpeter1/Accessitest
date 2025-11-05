-- Add missing columns to existing tables (safe - only adds if missing)
-- Run this if tables exist but are missing some columns

-- ============================================
-- SCAN_HISTORY - Add missing columns if needed
-- ============================================
DO $$ 
BEGIN
  -- Add scan_settings if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scan_history' AND column_name = 'scan_settings'
  ) THEN
    ALTER TABLE scan_history ADD COLUMN scan_settings JSONB;
    RAISE NOTICE 'Added scan_settings column to scan_history';
  END IF;
  
  -- Add remediation_report if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'scan_history' AND column_name = 'remediation_report'
  ) THEN
    ALTER TABLE scan_history ADD COLUMN remediation_report JSONB;
    RAISE NOTICE 'Added remediation_report column to scan_history';
  END IF;
END $$;

-- ============================================
-- ISSUES - Add missing columns if needed
-- ============================================
DO $$ 
BEGIN
  -- Add affected_pages if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'affected_pages'
  ) THEN
    ALTER TABLE issues ADD COLUMN affected_pages TEXT[];
    RAISE NOTICE 'Added affected_pages column to issues';
  END IF;
  
  -- Add remaining_points if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'issues' AND column_name = 'remaining_points'
  ) THEN
    ALTER TABLE issues ADD COLUMN remaining_points INTEGER DEFAULT 1;
    RAISE NOTICE 'Added remaining_points column to issues';
  END IF;
END $$;

-- ============================================
-- CREDIT_TRANSACTIONS - Add missing columns if needed
-- ============================================
DO $$ 
BEGIN
  -- Add stripe_payment_intent_id if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'credit_transactions' AND column_name = 'stripe_payment_intent_id'
  ) THEN
    ALTER TABLE credit_transactions ADD COLUMN stripe_payment_intent_id VARCHAR(255);
    RAISE NOTICE 'Added stripe_payment_intent_id column to credit_transactions';
  END IF;
END $$;

-- ============================================
-- Add missing indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_type ON scan_history(scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_file_name ON scan_history(file_name);

CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_first_seen_scan_id ON issues(first_seen_scan_id);
CREATE INDEX IF NOT EXISTS idx_issues_rank ON issues(rank);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_payment ON credit_transactions(stripe_payment_intent_id);

