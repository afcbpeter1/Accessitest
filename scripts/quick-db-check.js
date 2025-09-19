const { Pool } = require('pg');

console.log('Starting database check...');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: {
    rejectUnauthorized: false
  }
});

async function quickCheck() {
  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected successfully!');
    
    // Get basic database info
    const result = await client.query('SELECT pg_size_pretty(pg_database_size(current_database())) as size');
    console.log('Database size:', result.rows[0].size);
    
    // Check scan_history table
    const scanCount = await client.query('SELECT COUNT(*) as count FROM scan_history');
    console.log('Scan history records:', scanCount.rows[0].count);
    
    // Get table sizes
    const tableSizes = await client.query(`
      SELECT 
        tablename,
        pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size('public.'||tablename) DESC
      LIMIT 10
    `);
    
    console.log('\nTop 10 largest tables:');
    tableSizes.rows.forEach(row => {
      console.log(`${row.tablename}: ${row.size}`);
    });
    
    client.release();
    await pool.end();
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error.message);
    await pool.end();
  }
}

quickCheck();


