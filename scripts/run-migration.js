const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
})

async function runMigration() {
  const client = await pool.connect()
  
  try {
    console.log('🚀 Starting database migration...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'run-all-migrations.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Split by semicolon and execute each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim())
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim()
      if (statement && !statement.startsWith('--')) {
        try {
          console.log(`📝 Executing statement ${i + 1}/${statements.length}...`)
          await client.query(statement)
        } catch (error) {
          // Some statements might fail if they already exist, that's okay
          if (error.message.includes('already exists') || error.message.includes('does not exist')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists or not needed)`)
          } else {
            console.error(`❌ Error in statement ${i + 1}:`, error.message)
            throw error
          }
        }
      }
    }
    
    console.log('✅ Migration completed successfully!')
    console.log('🎉 Your database is now ready for signup and email verification!')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()

