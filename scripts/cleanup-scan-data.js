#!/usr/bin/env node

/**
 * Scan Data Cleanup Script
 * Provides options to clean up old scan data to free up database space
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
});

async function getStorageStats() {
  const result = await pool.query(`
    SELECT 
      COUNT(*) as total_scans,
      pg_size_pretty(pg_total_relation_size('scan_history')) as table_size,
      pg_total_relation_size('scan_history') as table_size_bytes,
      MIN(created_at) as oldest_scan,
      MAX(created_at) as newest_scan
    FROM scan_history
  `);
  return result.rows[0];
}

async function cleanupOldScans(daysOld = 30, dryRun = true) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  console.log(`\n🧹 ${dryRun ? 'DRY RUN: ' : ''}Cleaning up scans older than ${daysOld} days (before ${cutoffDate.toISOString().split('T')[0]})`);
  
  // Get count of scans to be deleted
  const countResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM scan_history 
    WHERE created_at < $1
  `, [cutoffDate]);
  
  const deleteCount = parseInt(countResult.rows[0].count);
  console.log(`Found ${deleteCount.toLocaleString()} scans to delete`);
  
  if (deleteCount === 0) {
    console.log('No scans to delete.');
    return { deletedCount: 0, freedSpace: 0 };
  }
  
  if (dryRun) {
    console.log('DRY RUN: Would delete these scans');
    return { deletedCount: deleteCount, freedSpace: 0 };
  }
  
  // Get size before deletion
  const beforeStats = await getStorageStats();
  const beforeSize = beforeStats.table_size_bytes;
  
  // Delete old scans
  const deleteResult = await pool.query(`
    DELETE FROM scan_history 
    WHERE created_at < $1
  `, [cutoffDate]);
  
  // Get size after deletion
  const afterStats = await getStorageStats();
  const afterSize = afterStats.table_size_bytes;
  
  const freedSpace = beforeSize - afterSize;
  
  console.log(`✅ Deleted ${deleteResult.rowCount.toLocaleString()} scans`);
  console.log(`💾 Freed up ${Math.round(freedSpace / 1024 / 1024)} MB of space`);
  
  return { deletedCount: deleteResult.rowCount, freedSpace };
}

async function cleanupLargeScans(sizeThresholdKB = 1000, dryRun = true) {
  console.log(`\n🧹 ${dryRun ? 'DRY RUN: ' : ''}Cleaning up scans larger than ${sizeThresholdKB}KB`);
  
  const sizeThresholdBytes = sizeThresholdKB * 1024;
  
  // Get count of large scans
  const countResult = await pool.query(`
    SELECT COUNT(*) as count
    FROM scan_history 
    WHERE (LENGTH(scan_results::text) + LENGTH(compliance_summary::text) + LENGTH(remediation_report::text)) > $1
  `, [sizeThresholdBytes]);
  
  const deleteCount = parseInt(countResult.rows[0].count);
  console.log(`Found ${deleteCount.toLocaleString()} large scans to delete`);
  
  if (deleteCount === 0) {
    console.log('No large scans to delete.');
    return { deletedCount: 0, freedSpace: 0 };
  }
  
  if (dryRun) {
    console.log('DRY RUN: Would delete these large scans');
    return { deletedCount: deleteCount, freedSpace: 0 };
  }
  
  // Get size before deletion
  const beforeStats = await getStorageStats();
  const beforeSize = beforeStats.table_size_bytes;
  
  // Delete large scans
  const deleteResult = await pool.query(`
    DELETE FROM scan_history 
    WHERE (LENGTH(scan_results::text) + LENGTH(compliance_summary::text) + LENGTH(remediation_report::text)) > $1
  `, [sizeThresholdBytes]);
  
  // Get size after deletion
  const afterStats = await getStorageStats();
  const afterSize = afterStats.table_size_bytes;
  
  const freedSpace = beforeSize - afterSize;
  
  console.log(`✅ Deleted ${deleteResult.rowCount.toLocaleString()} large scans`);
  console.log(`💾 Freed up ${Math.round(freedSpace / 1024 / 1024)} MB of space`);
  
  return { deletedCount: deleteResult.rowCount, freedSpace };
}

async function optimizeJsonbColumns(dryRun = true) {
  console.log(`\n🔧 ${dryRun ? 'DRY RUN: ' : ''}Optimizing JSONB columns`);
  
  if (dryRun) {
    console.log('DRY RUN: Would run VACUUM ANALYZE on scan_history table');
    return;
  }
  
  console.log('Running VACUUM ANALYZE on scan_history table...');
  await pool.query('VACUUM ANALYZE scan_history');
  console.log('✅ Optimization complete');
}

async function showCleanupOptions() {
  console.log('🧹 SCAN DATA CLEANUP OPTIONS');
  console.log('='.repeat(50));
  
  const stats = await getStorageStats();
  console.log(`Current scan_history table: ${stats.table_size} (${parseInt(stats.total_scans).toLocaleString()} scans)`);
  console.log(`Date range: ${stats.oldest_scan.toISOString().split('T')[0]} to ${stats.newest_scan.toISOString().split('T')[0]}`);
  
  console.log('\nAvailable cleanup options:');
  console.log('1. Delete scans older than X days');
  console.log('2. Delete scans larger than X KB');
  console.log('3. Optimize database (VACUUM ANALYZE)');
  console.log('4. Show detailed analysis');
  console.log('5. Exit');
  
  return stats;
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  try {
    if (!command) {
      await showCleanupOptions();
      console.log('\nUsage:');
      console.log('  node cleanup-scan-data.js analyze                    # Show detailed analysis');
      console.log('  node cleanup-scan-data.js cleanup-old [days] [--dry] # Delete scans older than X days');
      console.log('  node cleanup-scan-data.js cleanup-large [kb] [--dry] # Delete scans larger than X KB');
      console.log('  node cleanup-scan-data.js optimize [--dry]           # Optimize database');
      console.log('  node cleanup-scan-data.js stats                     # Show current stats');
      return;
    }
    
    switch (command) {
      case 'analyze':
        console.log('🔍 Running detailed analysis...');
        // This would call the analyze script
        console.log('Run: node analyze-db-storage.js for detailed analysis');
        break;
        
      case 'cleanup-old':
        const days = parseInt(args[1]) || 30;
        const dryRunOld = args.includes('--dry');
        await cleanupOldScans(days, dryRunOld);
        break;
        
      case 'cleanup-large':
        const sizeKB = parseInt(args[1]) || 1000;
        const dryRunLarge = args.includes('--dry');
        await cleanupLargeScans(sizeKB, dryRunLarge);
        break;
        
      case 'optimize':
        const dryRunOpt = args.includes('--dry');
        await optimizeJsonbColumns(dryRunOpt);
        break;
        
      case 'stats':
        const stats = await getStorageStats();
        console.log('📊 CURRENT STATS:');
        console.log(`Total scans: ${parseInt(stats.total_scans).toLocaleString()}`);
        console.log(`Table size: ${stats.table_size}`);
        console.log(`Oldest scan: ${stats.oldest_scan.toISOString().split('T')[0]}`);
        console.log(`Newest scan: ${stats.newest_scan.toISOString().split('T')[0]}`);
        break;
        
      default:
        console.log('Unknown command. Use without arguments to see usage.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await pool.end();
  }
}

// Run the script
main().catch(console.error);


