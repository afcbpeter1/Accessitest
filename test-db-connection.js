// Test database connection
const { Pool } = require('pg');

// Try different connection methods
async function testConnection() {
  console.log('🔍 Testing database connection...');
  
  // Method 1: Try DATABASE_URL from environment
  if (process.env.DATABASE_URL) {
    console.log('📡 Found DATABASE_URL in environment');
    try {
      const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
      });
      
      const result = await pool.query('SELECT NOW()');
      console.log('✅ Database connected successfully!');
      console.log('🕐 Current time:', result.rows[0].now);
      await pool.end();
      return;
    } catch (error) {
      console.log('❌ DATABASE_URL connection failed:', error.message);
    }
  }
  
  // Method 2: Try individual connection parameters
  console.log('📡 Trying individual connection parameters...');
  try {
    const pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: process.env.DB_PORT || 5432,
      database: process.env.DB_NAME || 'accessitest',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || '',
    });
    
    const result = await pool.query('SELECT NOW()');
    console.log('✅ Database connected successfully!');
    console.log('🕐 Current time:', result.rows[0].now);
    await pool.end();
  } catch (error) {
    console.log('❌ Individual parameters connection failed:', error.message);
  }
  
  // Method 3: Show environment variables
  console.log('\n🔍 Environment variables:');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  console.log('DB_HOST:', process.env.DB_HOST || 'Not set');
  console.log('DB_PORT:', process.env.DB_PORT || 'Not set');
  console.log('DB_NAME:', process.env.DB_NAME || 'Not set');
  console.log('DB_USER:', process.env.DB_USER || 'Not set');
  console.log('DB_PASSWORD:', process.env.DB_PASSWORD ? 'Set' : 'Not set');
}

testConnection();
