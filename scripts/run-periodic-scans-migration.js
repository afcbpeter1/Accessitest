const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Database connection configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
})

async function runMigration() {
  const client = await pool.connect()
  
  try {
    console.log('🔄 Running periodic scans migration...')
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-periodic-scans-table.sql')
    const sql = fs.readFileSync(sqlPath, 'utf8')
    
    // Execute the migration
    await client.query(sql)
    
    console.log('✅ Periodic scans table created successfully!')
    console.log('📋 Features added:')
    console.log('   - Periodic scan scheduling (daily, weekly, monthly)')
    console.log('   - Scan settings storage')
    console.log('   - Next run time calculation')
    console.log('   - Active/inactive status management')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()
