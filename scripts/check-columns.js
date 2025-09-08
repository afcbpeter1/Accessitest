const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
})

async function checkColumns() {
  const client = await pool.connect()
  try {
    console.log('🔍 Checking users table columns...')
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `)
    
    console.log('\n📋 Users table columns:')
    result.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type}) - ${row.is_nullable === 'YES' ? 'nullable' : 'not null'}`)
    })
    
    // Check if specific columns exist
    const requiredColumns = ['last_ip', 'email_verified', 'verification_code', 'verification_code_expires_at']
    console.log('\n🔍 Checking required columns:')
    
    for (const col of requiredColumns) {
      const exists = result.rows.some(row => row.column_name === col)
      console.log(`${exists ? '✅' : '❌'} ${col}: ${exists ? 'EXISTS' : 'MISSING'}`)
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

checkColumns()
