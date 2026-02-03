-- Fix database schema to allow longer status values
-- Run this SQL in your PostgreSQL database

-- First, check the current schema
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'issues' 
  AND character_maximum_length IS NOT NULL
ORDER BY column_name;

-- Increase status field from VARCHAR(10) to VARCHAR(20) to be safe
ALTER TABLE issues 
ALTER COLUMN status TYPE VARCHAR(20);

-- Allow longer impact and wcag_level (document scan issues can have long criterion text)
ALTER TABLE issues ALTER COLUMN impact TYPE VARCHAR(100);
ALTER TABLE issues ALTER COLUMN wcag_level TYPE VARCHAR(100);

-- Ensure rule_id can hold long IDs (e.g. adobe_issue_1770141764002_0 or hashed values)
ALTER TABLE issues ALTER COLUMN rule_id TYPE VARCHAR(255);

-- Verify the change
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'issues' 
  AND column_name = 'status';

-- Optional: If you want to be extra safe, also check and increase priority if needed
-- (Priority should already be VARCHAR(20), but let's verify)
SELECT 
    column_name, 
    data_type, 
    character_maximum_length
FROM information_schema.columns
WHERE table_name = 'issues' 
  AND column_name = 'priority';

-- Fix issues_status_check: app inserts status = 'backlog' but the constraint may not allow it.
-- Drop the existing check and add one that includes 'backlog' so scan issues show in the backlog.
ALTER TABLE issues DROP CONSTRAINT IF EXISTS issues_status_check;
ALTER TABLE issues ADD CONSTRAINT issues_status_check CHECK (
  status IN ('open', 'in_progress', 'resolved', 'closed', 'backlog')
);

-- Optional: add stripe_payment_intent_id to credit_transactions for purchase audit trail.
-- Code works without it; add this if you want to store the Stripe payment intent ID on purchase.
-- ALTER TABLE credit_transactions ADD COLUMN IF NOT EXISTS stripe_payment_intent_id VARCHAR(255);

