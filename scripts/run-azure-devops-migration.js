/**
 * Run Azure DevOps Integration Migration
 * 
 * This script runs the Azure DevOps integration database migration.
 * 
 * Usage: node scripts/run-azure-devops-migration.js
 */

const { Pool } = require('pg')
const fs = require('fs')
const path = require('path')
require('dotenv').config()

const dbUrl = process.env.DATABASE_URL

if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in environment variables')
  console.error('Please set DATABASE_URL in your .env file')
  process.exit(1)
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
})

async function runMigration() {
  const client = await pool.connect()
  
  try {
    console.log('🔄 Starting Azure DevOps integration migration...')
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'migrations', '002_azure_devops_integration.sql')
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8')
    
    // Run the migration
    await client.query(migrationSQL)
    
    console.log('✅ Migration completed successfully!')
    console.log('📋 Created tables:')
    console.log('   - azure_devops_integrations')
    console.log('   - azure_devops_work_item_mappings')
    console.log('📋 Added columns to issues table:')
    console.log('   - azure_devops_synced')
    console.log('   - azure_devops_work_item_id')
    console.log('   - azure_devops_sync_error')
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    if (error.code === '42P01') {
      console.error('   This might mean a table already exists or there\'s a dependency issue')
    }
    throw error
  } finally {
    client.release()
    await pool.end()
  }
}

runMigration()
  .then(() => {
    console.log('✅ Migration script completed')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Migration script failed:', error)
    process.exit(1)
  })




