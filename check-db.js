const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

async function main() {
  try {
    const client = await pool.connect();
    
    // Database size
    const dbSize = await client.query('SELECT pg_size_pretty(pg_database_size(current_database())) as size');
    console.log('Database size:', dbSize.rows[0].size);
    
    // Scan history count
    const scanCount = await client.query('SELECT COUNT(*) as count FROM scan_history');
    console.log('Total scans:', scanCount.rows[0].count);
    
    // Table sizes
    const tables = await client.query(`
      SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename)) as size
      FROM pg_tables WHERE schemaname = 'public'
      ORDER BY pg_total_relation_size('public.'||tablename) DESC LIMIT 5
    `);
    
    console.log('\nLargest tables:');
    tables.rows.forEach(t => console.log(`${t.tablename}: ${t.size}`));
    
    client.release();
    await pool.end();
  } catch (error) {
    console.error('Error:', error.message);
  }
}

main();


