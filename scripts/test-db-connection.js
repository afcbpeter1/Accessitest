const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
})

async function testConnection() {
  const client = await pool.connect()
  try {
    console.log('🔍 Testing database connection...')
    
    // Test basic connection
    await client.query('SELECT 1')
    console.log('✅ Database connection successful')
    
    // Check users table structure
    const result = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `)
    
    console.log('\n📋 Users table columns:')
    result.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type})`)
    })
    
    // Check for missing columns
    const requiredColumns = ['last_ip', 'email_verified', 'verification_code', 'verification_code_expires_at']
    const existingColumns = result.rows.map(row => row.column_name)
    
    console.log('\n🔍 Missing columns:')
    const missing = requiredColumns.filter(col => !existingColumns.includes(col))
    if (missing.length === 0) {
      console.log('✅ All required columns exist')
    } else {
      console.log('❌ Missing columns:', missing.join(', '))
    }
    
  } catch (error) {
    console.error('❌ Database error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

testConnection()
