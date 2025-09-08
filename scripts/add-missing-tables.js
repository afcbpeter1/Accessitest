const { Pool } = require('pg')

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_PkNvW6bX5UFm@ep-summer-mode-abfxox5j-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
})

async function addMissingTables() {
  const client = await pool.connect()
  
  try {
    console.log('🔧 Adding missing tables...')
    
    // Create vpn_detection_log table
    console.log('📝 Creating vpn_detection_log table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS vpn_detection_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address VARCHAR(45) NOT NULL,
        is_vpn BOOLEAN NOT NULL,
        detection_method VARCHAR(50),
        detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        user_agent TEXT,
        country VARCHAR(2),
        city VARCHAR(100),
        isp VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    
    // Create registration_attempts table
    console.log('📝 Creating registration_attempts table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS registration_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address VARCHAR(45) NOT NULL,
        email VARCHAR(255) NOT NULL,
        attempted_at TIMESTAMP DEFAULT NOW(),
        success BOOLEAN DEFAULT FALSE,
        user_id UUID REFERENCES users(id)
      )
    `)
    
    // Create free_scan_usage table
    console.log('📝 Creating free_scan_usage table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS free_scan_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ip_address VARCHAR(45) NOT NULL,
        email VARCHAR(255),
        url_scanned TEXT NOT NULL,
        scanned_at TIMESTAMP DEFAULT NOW(),
        user_id UUID REFERENCES users(id)
      )
    `)
    
    // Create email_verification_attempts table
    console.log('📝 Creating email_verification_attempts table...')
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_verification_attempts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        email VARCHAR(255) NOT NULL,
        verification_code VARCHAR(6) NOT NULL,
        attempts INTEGER DEFAULT 0,
        last_attempt_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `)
    
    // Create indexes
    console.log('📝 Creating indexes...')
    await client.query('CREATE INDEX IF NOT EXISTS idx_vpn_detection_log_ip ON vpn_detection_log(ip_address)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_vpn_detection_log_detected_at ON vpn_detection_log(detected_at)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_registration_attempts_ip ON registration_attempts(ip_address)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_registration_attempts_attempted_at ON registration_attempts(attempted_at)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_registration_attempts_email ON registration_attempts(email)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_free_scan_ip ON free_scan_usage(ip_address)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_free_scan_attempted_at ON free_scan_usage(scanned_at)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_email_verification_attempts_user_id ON email_verification_attempts(user_id)')
    await client.query('CREATE INDEX IF NOT EXISTS idx_email_verification_attempts_email ON email_verification_attempts(email)')
    
    // Verify tables were created
    console.log('🔍 Verifying tables...')
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('vpn_detection_log', 'registration_attempts', 'free_scan_usage', 'email_verification_attempts')
      ORDER BY table_name
    `)
    
    console.log('\n✅ Created tables:')
    result.rows.forEach(row => {
      console.log(`- ${row.table_name}`)
    })
    
    console.log('\n🎉 All missing tables have been created successfully!')
    
  } catch (error) {
    console.error('❌ Error creating tables:', error.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

addMissingTables()

