-- Check which tables already exist and their structure
-- Run this to see what's already in your database

-- Check if tables exist
SELECT 
  table_name,
  CASE 
    WHEN table_name = 'scan_history' THEN '✅ Scan History'
    WHEN table_name = 'issues' THEN '✅ Issues/Backlog'
    WHEN table_name = 'user_credits' THEN '✅ User Credits'
    WHEN table_name = 'credit_transactions' THEN '✅ Credit Transactions'
    WHEN table_name = 'users' THEN '✅ Users'
    WHEN table_name = 'notifications' THEN '✅ Notifications'
    ELSE '❓ Other'
  END as table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('scan_history', 'issues', 'user_credits', 'credit_transactions', 'users', 'notifications')
ORDER BY table_name;

-- Check scan_history columns
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'scan_history'
ORDER BY ordinal_position;

-- Check issues columns
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'issues'
ORDER BY ordinal_position;

-- Check user_credits columns
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'user_credits'
ORDER BY ordinal_position;

-- Check credit_transactions columns
SELECT 
  column_name, 
  data_type, 
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'credit_transactions'
ORDER BY ordinal_position;

