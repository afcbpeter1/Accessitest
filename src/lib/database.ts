import { Pool } from 'pg'

// Normalize: trim and strip surrounding quotes (env can load "postgresql://..." which breaks new URL())
const raw = process.env.DATABASE_URL ?? ''
const dbUrl = raw.trim().replace(/^["']|["']$/g, '')
if (dbUrl) {
  try {
    new URL(dbUrl)
  } catch {
    console.error('❌ DATABASE_URL is not a valid URL')
  }
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

export { pool }
export default pool
