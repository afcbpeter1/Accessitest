const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function setupPeriodicScans() {
  console.log('🕒 Setting up Periodic Scans functionality...');
  
  try {
    // Read and execute the SQL file
    const sqlFile = path.join(__dirname, 'create-periodic-scans-table.sql');
    const sql = fs.readFileSync(sqlFile, 'utf8');
    
    await pool.query(sql);
    console.log('✅ Periodic scans tables created successfully!');
    
    // Create some sample data for testing
    console.log('📊 Creating sample periodic scan...');
    
    // Get a sample user ID
    const userResult = await pool.query('SELECT id FROM users LIMIT 1');
    if (userResult.rows.length === 0) {
      console.log('⚠️  No users found. Please create a user first.');
      return;
    }
    
    const userId = userResult.rows[0].id;
    
    // Create a sample periodic scan
    const sampleScan = await pool.query(`
      INSERT INTO periodic_scans (
        user_id, scan_type, scan_title, url, frequency, 
        scheduled_date, scheduled_time, timezone, status,
        notify_on_completion, notify_on_failure, email_notifications
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING id
    `, [
      userId,
      'web',
      'Weekly Accessibility Check',
      'https://example.com',
      'weekly',
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next week
      '09:00:00',
      'UTC',
      'scheduled',
      true,
      true,
      true
    ]);
    
    console.log('✅ Sample periodic scan created:', sampleScan.rows[0].id);
    
    // Show table structure
    const tablesResult = await pool.query(`
      SELECT table_name, column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name IN ('periodic_scans', 'periodic_scan_executions')
      ORDER BY table_name, ordinal_position
    `);
    
    console.log('\n📋 Created tables:');
    const tables = {};
    tablesResult.rows.forEach(row => {
      if (!tables[row.table_name]) {
        tables[row.table_name] = [];
      }
      tables[row.table_name].push(`${row.column_name} (${row.data_type})`);
    });
    
    Object.keys(tables).forEach(tableName => {
      console.log(`  - ${tableName}: ${tables[tableName].length} columns`);
    });
    
    console.log('\n🎯 Periodic Scans Features:');
    console.log('  ✅ Flexible scheduling (once, daily, weekly, monthly, custom)');
    console.log('  ✅ Timezone support for global users');
    console.log('  ✅ Email notifications on completion/failure');
    console.log('  ✅ Execution tracking and history');
    console.log('  ✅ Retry logic for failed scans');
    console.log('  ✅ Cancel/pause functionality');
    
  } catch (error) {
    console.error('❌ Error setting up periodic scans:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

setupPeriodicScans()
  .then(() => {
    console.log('\n✅ Periodic Scans setup complete!');
    console.log('🚀 Ready to implement advanced scheduling features.');
  })
  .catch(error => {
    console.error('❌ Setup failed:', error);
    process.exit(1);
  });
 