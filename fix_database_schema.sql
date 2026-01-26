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
-- This will allow values like 'backlog', 'in_progress', 'resolved', etc.
ALTER TABLE issues 
ALTER COLUMN status TYPE VARCHAR(20);

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

