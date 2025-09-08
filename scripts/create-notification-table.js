const { Pool } = require('pg')

const pool = new Pool({
  connectionString: 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
})

async function createNotificationTable() {
  const client = await pool.connect()
  
  try {
    console.log('🔧 Creating user_notification_preferences table...')
    
    // Create the table
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_notification_preferences (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        scan_completion BOOLEAN DEFAULT true,
        critical_issues BOOLEAN DEFAULT true,
        weekly_reports BOOLEAN DEFAULT false,
        security_alerts BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        UNIQUE(user_id)
      )
    `)
    
    console.log('✅ Table created successfully')
    
    // Create index
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id 
      ON user_notification_preferences(user_id)
    `)
    
    console.log('✅ Index created successfully')
    
    // Verify table exists
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'user_notification_preferences'
    `)
    
    if (result.rows.length > 0) {
      console.log('🎉 user_notification_preferences table is ready!')
    } else {
      console.log('❌ Table was not created')
    }
    
  } catch (error) {
    console.error('❌ Error creating table:', error.message)
  } finally {
    client.release()
    await pool.end()
  }
}

createNotificationTable()

