-- Database Cleanup SQL Script
-- WARNING: These commands will DELETE data. Run with caution!

-- 1. Check current storage before cleanup
SELECT 
  'BEFORE CLEANUP' as status,
  COUNT(*) as total_scans,
  pg_size_pretty(pg_total_relation_size('scan_history')) as table_size
FROM scan_history;

-- 2. Show scans that would be deleted (older than 30 days)
SELECT 
  COUNT(*) as scans_to_delete,
  MIN(created_at) as oldest_to_delete,
  MAX(created_at) as newest_to_delete
FROM scan_history 
WHERE created_at < NOW() - INTERVAL '30 days';

-- 3. Show large scans that would be deleted (> 1MB total JSONB)
SELECT 
  COUNT(*) as large_scans_to_delete,
  AVG(LENGTH(scan_results::text) + LENGTH(compliance_summary::text) + LENGTH(remediation_report::text)) as avg_size
FROM scan_history 
WHERE (LENGTH(scan_results::text) + LENGTH(compliance_summary::text) + LENGTH(remediation_report::text)) > 1048576; -- 1MB

-- UNCOMMENT THE FOLLOWING LINES TO ACTUALLY DELETE DATA:

-- 4. Delete scans older than 30 days
-- DELETE FROM scan_history WHERE created_at < NOW() - INTERVAL '30 days';

-- 5. Delete scans larger than 1MB total JSONB
-- DELETE FROM scan_history WHERE (LENGTH(scan_results::text) + LENGTH(compliance_summary::text) + LENGTH(remediation_report::text)) > 1048576;

-- 6. Optimize the table after cleanup
-- VACUUM ANALYZE scan_history;

-- 7. Check storage after cleanup
-- SELECT 
--   'AFTER CLEANUP' as status,
--   COUNT(*) as total_scans,
--   pg_size_pretty(pg_total_relation_size('scan_history')) as table_size
-- FROM scan_history;

-- Alternative: Keep only the most recent N scans per user
-- WITH ranked_scans AS (
--   SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as rn
--   FROM scan_history
-- )
-- DELETE FROM scan_history 
-- WHERE id IN (
--   SELECT id FROM ranked_scans WHERE rn > 50  -- Keep only 50 most recent scans per user
-- );


