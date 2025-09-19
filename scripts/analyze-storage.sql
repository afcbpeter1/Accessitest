-- Database Storage Analysis SQL Script
-- Run this directly in your database client to analyze storage usage

-- 1. Get overall database size
SELECT 
  pg_size_pretty(pg_database_size(current_database())) as database_size,
  pg_database_size(current_database()) as database_size_bytes;

-- 2. Get table sizes (sorted by total size)
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as total_size,
  pg_total_relation_size(schemaname||'.'||tablename) as total_size_bytes,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 3. Analyze scan_history table specifically
SELECT 
  COUNT(*) as total_scans,
  COUNT(CASE WHEN scan_type = 'web' THEN 1 END) as web_scans,
  COUNT(CASE WHEN scan_type = 'document' THEN 1 END) as document_scans,
  MIN(created_at) as oldest_scan,
  MAX(created_at) as newest_scan,
  AVG(LENGTH(scan_results::text)) as avg_scan_results_size,
  MAX(LENGTH(scan_results::text)) as max_scan_results_size,
  AVG(LENGTH(compliance_summary::text)) as avg_compliance_summary_size,
  MAX(LENGTH(compliance_summary::text)) as max_compliance_summary_size,
  AVG(LENGTH(remediation_report::text)) as avg_remediation_report_size,
  MAX(LENGTH(remediation_report::text)) as max_remediation_report_size
FROM scan_history;

-- 4. Get largest scan records
SELECT 
  id,
  scan_type,
  scan_title,
  created_at,
  LENGTH(scan_results::text) as scan_results_size,
  LENGTH(compliance_summary::text) as compliance_summary_size,
  LENGTH(remediation_report::text) as remediation_report_size,
  (LENGTH(scan_results::text) + LENGTH(compliance_summary::text) + LENGTH(remediation_report::text)) as total_jsonb_size
FROM scan_history
ORDER BY (LENGTH(scan_results::text) + LENGTH(compliance_summary::text) + LENGTH(remediation_report::text)) DESC
LIMIT 10;

-- 5. Scans by date (last 30 days)
SELECT 
  DATE_TRUNC('day', created_at) as scan_date,
  COUNT(*) as scan_count,
  AVG(LENGTH(scan_results::text) + LENGTH(compliance_summary::text) + LENGTH(remediation_report::text)) as avg_size
FROM scan_history
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY scan_date DESC
LIMIT 15;

-- 6. Row counts for all tables
SELECT 
  schemaname,
  tablename,
  n_tup_ins as inserts,
  n_tup_upd as updates,
  n_tup_del as deletes,
  n_live_tup as live_rows,
  n_dead_tup as dead_rows
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;


