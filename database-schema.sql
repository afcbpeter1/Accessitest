-- Database Schema for Document Repair System
-- Run this SQL in your PostgreSQL database

-- ============================================
-- SCAN HISTORY TABLE
-- Stores all scan/repair results
-- ============================================
CREATE TABLE IF NOT EXISTS scan_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scan_type VARCHAR(20) NOT NULL CHECK (scan_type IN ('web', 'document')),
  scan_title VARCHAR(500) NOT NULL,
  url TEXT,
  file_name VARCHAR(500),
  file_type VARCHAR(100),
  scan_results JSONB,
  compliance_summary JSONB,
  remediation_report JSONB,
  total_issues INTEGER DEFAULT 0,
  critical_issues INTEGER DEFAULT 0,
  serious_issues INTEGER DEFAULT 0,
  moderate_issues INTEGER DEFAULT 0,
  minor_issues INTEGER DEFAULT 0,
  pages_scanned INTEGER,
  pages_analyzed INTEGER,
  overall_score INTEGER,
  is_508_compliant BOOLEAN,
  scan_duration_seconds INTEGER,
  scan_settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for scan_history
CREATE INDEX IF NOT EXISTS idx_scan_history_user_id ON scan_history(user_id);
CREATE INDEX IF NOT EXISTS idx_scan_history_scan_type ON scan_history(scan_type);
CREATE INDEX IF NOT EXISTS idx_scan_history_created_at ON scan_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_history_file_name ON scan_history(file_name);

-- ============================================
-- ISSUES TABLE
-- Stores issues for product backlog
-- ============================================
CREATE TABLE IF NOT EXISTS issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  issue_key VARCHAR(50) UNIQUE NOT NULL,
  rule_id VARCHAR(255),
  rule_name VARCHAR(255),
  description TEXT,
  impact VARCHAR(50),
  wcag_level VARCHAR(50),
  total_occurrences INTEGER DEFAULT 1,
  affected_pages TEXT[],
  notes TEXT,
  status VARCHAR(10) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  rank INTEGER DEFAULT 0,
  story_points INTEGER DEFAULT 1,
  remaining_points INTEGER DEFAULT 1,
  first_seen_scan_id UUID REFERENCES scan_history(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for issues
CREATE INDEX IF NOT EXISTS idx_issues_status ON issues(status);
CREATE INDEX IF NOT EXISTS idx_issues_priority ON issues(priority);
CREATE INDEX IF NOT EXISTS idx_issues_first_seen_scan_id ON issues(first_seen_scan_id);
CREATE INDEX IF NOT EXISTS idx_issues_rank ON issues(rank);

-- ============================================
-- USER CREDITS TABLE
-- Tracks user credits and unlimited status
-- ============================================
CREATE TABLE IF NOT EXISTS user_credits (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  credits_remaining INTEGER DEFAULT 3,
  credits_used INTEGER DEFAULT 0,
  unlimited_credits BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for user_credits
CREATE INDEX IF NOT EXISTS idx_user_credits_user_id ON user_credits(user_id);

-- ============================================
-- CREDIT TRANSACTIONS TABLE
-- Tracks all credit purchases and usage
-- ============================================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund')),
  credits_amount INTEGER NOT NULL,
  description TEXT,
  stripe_payment_intent_id VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for credit_transactions
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_payment ON credit_transactions(stripe_payment_intent_id);

-- ============================================
-- USERS TABLE (if not exists)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  plan_type VARCHAR(50) DEFAULT 'free',
  stripe_subscription_id VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for users
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- ============================================
-- NOTIFICATIONS TABLE (if needed)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);

-- ============================================
-- COMMENTS
-- ============================================
-- All tables are now set up with proper indexes and foreign keys
-- The schema supports:
-- 1. Storing scan/repair history
-- 2. Tracking issues in backlog
-- 3. Managing user credits
-- 4. Recording credit transactions
-- 5. User management
-- 6. Notifications

