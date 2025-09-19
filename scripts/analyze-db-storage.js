#!/usr/bin/env node

/**
 * Database Storage Analysis Script
 * Analyzes database storage usage to identify what's consuming space
 */

const { Pool } = require('pg');

// Try to load environment variables
try {
  require('dotenv').config();
} catch (error) {
  console.log('Note: dotenv not available, using system environment variables');
}

// Use the database connection string from the test script
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function analyzeDatabaseStorage() {
  console.log('🔍 Analyzing database storage usage...\n');
  console.log('Connecting to database...');
  
  try {
    // Get database size
    const dbSizeResult = await pool.query(`
      SELECT 
        pg_size_pretty(pg_database_size(current_database())) as database_size,
        pg_database_size(current_database()) as database_size_bytes
    `);
    
    console.log('📊 DATABASE OVERVIEW:');
    console.log(`Total Database Size: ${dbSizeResult.rows[0].database_size}`);
    console.log(`Total Database Size (bytes): ${dbSizeResult.rows[0].database_size_bytes.toLocaleString()}\n`);

    // Get table sizes
    const tableSizesResult = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
        pg_total_relation_size(schemaname||'.'||tablename) as size_bytes,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) as table_size,
        pg_relation_size(schemaname||'.'||tablename) as table_size_bytes,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size,
        (pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) as index_size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    `);

    console.log('📋 TABLE SIZES (sorted by total size):');
    console.log('='.repeat(100));
    console.log('Table Name'.padEnd(25) + 'Total Size'.padEnd(15) + 'Table Size'.padEnd(15) + 'Index Size'.padEnd(15) + 'Rows');
    console.log('='.repeat(100));

    for (const row of tableSizesResult.rows) {
      // Get row count for each table
      const rowCountResult = await pool.query(`SELECT COUNT(*) as count FROM ${row.tablename}`);
      const rowCount = parseInt(rowCountResult.rows[0].count);
      
      console.log(
        row.tablename.padEnd(25) + 
        row.size.padEnd(15) + 
        row.table_size.padEnd(15) + 
        row.index_size.padEnd(15) + 
        rowCount.toLocaleString()
      );
    }

    console.log('\n');

    // Analyze scan_history table specifically
    console.log('🔍 SCAN_HISTORY TABLE ANALYSIS:');
    console.log('='.repeat(60));
    
    const scanHistoryStats = await pool.query(`
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
      FROM scan_history
    `);

    const stats = scanHistoryStats.rows[0];
    console.log(`Total Scans: ${parseInt(stats.total_scans).toLocaleString()}`);
    console.log(`Web Scans: ${parseInt(stats.web_scans).toLocaleString()}`);
    console.log(`Document Scans: ${parseInt(stats.document_scans).toLocaleString()}`);
    console.log(`Oldest Scan: ${stats.oldest_scan}`);
    console.log(`Newest Scan: ${stats.newest_scan}`);
    console.log(`\nJSONB Column Sizes:`);
    console.log(`  scan_results - Avg: ${Math.round(stats.avg_scan_results_size).toLocaleString()} bytes, Max: ${parseInt(stats.max_scan_results_size).toLocaleString()} bytes`);
    console.log(`  compliance_summary - Avg: ${Math.round(stats.avg_compliance_summary_size).toLocaleString()} bytes, Max: ${parseInt(stats.max_compliance_summary_size).toLocaleString()} bytes`);
    console.log(`  remediation_report - Avg: ${Math.round(stats.avg_remediation_report_size).toLocaleString()} bytes, Max: ${parseInt(stats.max_remediation_report_size).toLocaleString()} bytes`);

    // Get largest scan records
    console.log('\n🔍 LARGEST SCAN RECORDS:');
    console.log('='.repeat(80));
    
    const largestScans = await pool.query(`
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
      LIMIT 10
    `);

    console.log('ID'.padEnd(40) + 'Type'.padEnd(10) + 'Total Size'.padEnd(15) + 'Created');
    console.log('-'.repeat(80));
    
    for (const scan of largestScans.rows) {
      const totalSizeKB = Math.round(scan.total_jsonb_size / 1024);
      console.log(
        scan.id.substring(0, 36) + '...'.padEnd(4) + 
        scan.scan_type.padEnd(10) + 
        `${totalSizeKB}KB`.padEnd(15) + 
        scan.created_at.toISOString().split('T')[0]
      );
    }

    // Analyze by date ranges
    console.log('\n📅 SCANS BY DATE RANGE:');
    console.log('='.repeat(50));
    
    const dateRanges = await pool.query(`
      SELECT 
        DATE_TRUNC('day', created_at) as scan_date,
        COUNT(*) as scan_count,
        AVG(LENGTH(scan_results::text) + LENGTH(compliance_summary::text) + LENGTH(remediation_report::text)) as avg_size
      FROM scan_history
      WHERE created_at >= NOW() - INTERVAL '30 days'
      GROUP BY DATE_TRUNC('day', created_at)
      ORDER BY scan_date DESC
      LIMIT 15
    `);

    console.log('Date'.padEnd(15) + 'Scans'.padEnd(10) + 'Avg Size (KB)');
    console.log('-'.repeat(50));
    
    for (const range of dateRanges.rows) {
      const avgSizeKB = Math.round(range.avg_size / 1024);
      console.log(
        range.scan_date.toISOString().split('T')[0].padEnd(15) + 
        range.scan_count.toString().padEnd(10) + 
        avgSizeKB.toString()
      );
    }

    // Check for other large tables
    console.log('\n🔍 OTHER LARGE TABLES:');
    console.log('='.repeat(60));
    
    const otherTables = await pool.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size,
        pg_total_relation_size('public.'||tablename) as size_bytes
      FROM pg_tables 
      WHERE schemaname = 'public' 
        AND tablename != 'scan_history'
        AND pg_total_relation_size('public.'||tablename) > 1024 * 1024  -- > 1MB
      ORDER BY pg_total_relation_size('public.'||tablename) DESC
    `);

    for (const table of otherTables.rows) {
      const rowCountResult = await pool.query(`SELECT COUNT(*) as count FROM ${table.tablename}`);
      const rowCount = parseInt(rowCountResult.rows[0].count);
      console.log(`${table.tablename}: ${table.size} (${rowCount.toLocaleString()} rows)`);
    }

    console.log('\n✅ Analysis complete!');
    
  } catch (error) {
    console.error('❌ Error analyzing database:', error);
  } finally {
    await pool.end();
  }
}

// Run the analysis
analyzeDatabaseStorage().catch(console.error);
