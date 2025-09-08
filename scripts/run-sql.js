const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
})

async function runSQL() {
  const client = await pool.connect()
  
  try {
    console.log('🔧 Running SQL script...')
    
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'create-missing-tables.sql')
    const sqlContent = fs.readFileSync(sqlPath, 'utf8')
    
    // Split by semicolon and execute each statement
    const statements = sqlContent.split(';').filter(stmt => stmt.trim())
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim()
      if (statement && !statement.startsWith('--')) {
        try {
          console.log(`📝 Executing statement ${i + 1}/${statements.length}...`)
          const result = await client.query(statement)
          if (result.rows && result.rows.length > 0) {
            console.log('📋 Result:', result.rows)
          }
        } catch (error) {
          if (error.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists)`)
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message)
            throw error
          }
        }
      }
    }
    
    console.log('✅ SQL script completed successfully!')
    
  } catch (error) {
    console.error('❌ Error running SQL:', error.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

runSQL()

