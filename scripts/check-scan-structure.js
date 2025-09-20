const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function checkScanStructure() {
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
    console.log('📋 Scan results type:', typeof scan.scan_results);
    console.log('📋 Is array:', Array.isArray(scan.scan_results));
    
    if (scan.scan_results) {
      console.log('📋 Keys:', Object.keys(scan.scan_results));
      
      // Check if it has results array
      if (scan.scan_results.results) {
        console.log('📋 Results array length:', scan.scan_results.results.length);
        if (scan.scan_results.results.length > 0) {
          const firstResult = scan.scan_results.results[0];
          console.log('📋 First result keys:', Object.keys(firstResult));
          if (firstResult.issues) {
            console.log('📋 Issues count:', firstResult.issues.length);
            if (firstResult.issues.length > 0) {
              console.log('📋 First issue:', firstResult.issues[0].description);
            }
          }
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkScanStructure();