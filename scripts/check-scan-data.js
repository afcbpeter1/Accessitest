const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function checkScanData() {
  try {
    console.log('🔍 Checking scan data structure...');
    
    const result = await pool.query(`
      SELECT id, scan_results, created_at 
      FROM scan_history 
      WHERE scan_results IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ No scan data found');
      return;
    }
    
    const scan = result.rows[0];
    console.log('📊 Scan ID:', scan.id);
    console.log('📅 Created:', scan.created_at);
    console.log('📋 Scan results structure:');
    console.log(JSON.stringify(scan.scan_results, null, 2));
    
  } catch (error) {
    console.error('❌ Error checking scan data:', error);
  } finally {
    await pool.end();
  }
}

checkScanData();