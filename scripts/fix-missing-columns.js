const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
})

async function fixMissingColumns() {
  const client = await pool.connect()
  
  try {
    console.log('🔧 Fixing missing columns...')
    
    // Add missing columns
    console.log('📝 Adding last_ip column...')
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_ip VARCHAR(45)')
    
    console.log('📝 Adding verification_code column...')
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code VARCHAR(6)')
    
    console.log('📝 Adding verification_code_expires_at column...')
    await client.query('ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_code_expires_at TIMESTAMP WITH TIME ZONE')
    
    // Create indexes
    console.log('📝 Creating indexes...')
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_last_ip ON users(last_ip)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_users_verification_code ON users(verification_code) WHERE verification_code IS NOT NULL')
    
    // Verify the columns were added
    console.log('🔍 Verifying columns...')
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      AND column_name IN ('last_ip', 'verification_code', 'verification_code_expires_at')
      ORDER BY column_name
    `)
    
    console.log('\n✅ Added columns:')
    result.rows.forEach(row => {
      console.log(`- ${row.column_name} (${row.data_type}) - ${row.is_nullable === 'YES' ? 'nullable' : 'not null'}`)
    })
    
    console.log('\n🎉 All missing columns have been added successfully!')
    
  } catch (error) {
    console.error('❌ Error fixing columns:', error.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

fixMissingColumns()

