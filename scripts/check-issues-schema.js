const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

async function checkIssuesSchema() {
  try {
    console.log('🔍 Checking issues table schema...');
    
    // Get table structure
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'issues'
      ORDER BY ordinal_position
    `);
    
    console.log('📊 Issues table columns:');
    result.rows.forEach((col, index) => {
      console.log(`${index + 1}. ${col.column_name} (${col.data_type}) - ${col.is_nullable === 'YES' ? 'nullable' : 'not null'}`);
    });
    
    // Get sample data
    console.log('\n📋 Sample issues data:');
    const sampleResult = await pool.query('SELECT * FROM issues LIMIT 3');
    if (sampleResult.rows.length > 0) {
      console.log('Sample issue:', JSON.stringify(sampleResult.rows[0], null, 2));
    } else {
      console.log('No issues found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

checkIssuesSchema();