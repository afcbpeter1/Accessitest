-- Add page tracking columns to organization_credits table
-- This tracks monthly page usage for unlimited subscription users

ALTER TABLE organization_credits
ADD COLUMN IF NOT EXISTS pages_scanned_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS monthly_page_limit INTEGER DEFAULT 200,
ADD COLUMN IF NOT EXISTS last_page_reset_date TIMESTAMP DEFAULT NOW();

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_org_credits_reset_date ON organization_credits(last_page_reset_date);

-- Update existing rows to have default values
UPDATE organization_credits
SET pages_scanned_this_month = 0,
    monthly_page_limit = 200,
    last_page_reset_date = NOW()
WHERE pages_scanned_this_month IS NULL
   OR monthly_page_limit IS NULL
   OR last_page_reset_date IS NULL;

