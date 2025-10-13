const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

async function checkScreenshots() {
  try {
    console.log('🔍 Checking scan results structure...')
    
    const result = await pool.query(`
      SELECT 
        id,
        rule_name,
        scan_results
      FROM issues 
      WHERE scan_results IS NOT NULL
      LIMIT 1
    `)
    
    if (result.rows.length > 0) {
      const issue = result.rows[0]
      console.log('📊 Issue ID:', issue.id)
      console.log('📊 Rule Name:', issue.rule_name)
      console.log('📊 Scan Results Keys:', Object.keys(issue.scan_results || {}))
      
      if (issue.scan_results) {
        console.log('📊 Full scan_results structure:')
        console.log(JSON.stringify(issue.scan_results, null, 2))
      }
    } else {
      console.log('❌ No issues with scan_results found')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

checkScreenshots()
