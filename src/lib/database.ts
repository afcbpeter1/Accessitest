import { Pool } from 'pg'

// Debug database URL (without password)
const dbUrl = process.env.DATABASE_URL
if (dbUrl) {
  const urlParts = new URL(dbUrl)
  console.log('🔗 Database URL:', `${urlParts.protocol}//${urlParts.hostname}:${urlParts.port}${urlParts.pathname}`)
} else {
  console.error('❌ DATABASE_URL not found in environment variables')
}

// Database connection pool
const pool = new Pool({
  connectionString: dbUrl,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false
})

// Test database connection
export async function testConnection() {
  try {
    const client = await pool.connect()
    await client.query('SELECT NOW()')
    client.release()
    console.log('✅ Database connection successful')
    return true
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    return false
  }
}

// Helper function for database queries
export async function query(text: string, params?: any[]) {
  const start = Date.now()
  try {
    const res = await pool.query(text, params)
    const duration = Date.now() - start
    console.log('Executed query', { text, duration, rows: res.rowCount })
    return res
  } catch (error) {
    console.error('Database query error:', error)
    throw error
  }
}

// Helper function for single row queries
export async function queryOne(text: string, params?: any[]) {
  const result = await query(text, params)
  return result.rows[0]
}

// Helper function for multiple row queries
export async function queryMany(text: string, params?: any[]) {
  const result = await query(text, params)
  return result.rows
}

export default pool
