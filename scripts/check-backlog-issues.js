/**
 * Quick script to check if issues are in the database but not showing in backlog
 * Run: node scripts/check-backlog-issues.js <user_id>
 */

const { Pool } = require('pg')
require('dotenv').config()

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

async function checkBacklogIssues(userId) {
  try {
    console.log(`🔍 Checking backlog issues for user: ${userId}\n`)
    
    // Check scan_history
    const scanHistory = await pool.query(`
      SELECT id, user_id, scan_type, url, file_name, total_issues, created_at
      FROM scan_history
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId])
    
    console.log(`📋 Recent Scans (${scanHistory.rows.length}):`)
    scanHistory.rows.forEach(scan => {
      console.log(`  - ${scan.scan_type} scan: ${scan.url || scan.file_name || 'N/A'}`)
      console.log(`    ID: ${scan.id}, Issues: ${scan.total_issues}, Created: ${scan.created_at}`)
    })
    console.log('')
    
    // Check issues directly
    const allIssues = await pool.query(`
      SELECT 
        i.id,
        i.issue_key,
        i.rule_name,
        i.status,
        i.first_seen_scan_id,
        sh.id as scan_history_id,
        sh.user_id as scan_user_id,
        sh.scan_type
      FROM issues i
      LEFT JOIN scan_history sh ON i.first_seen_scan_id = sh.id
      WHERE sh.user_id = $1 OR i.first_seen_scan_id IN (SELECT id FROM scan_history WHERE user_id = $1)
      ORDER BY i.created_at DESC
      LIMIT 20
    `, [userId])
    
    console.log(`📊 All Issues (${allIssues.rows.length}):`)
    allIssues.rows.forEach(issue => {
      console.log(`  - ${issue.rule_name} (${issue.status})`)
      console.log(`    Issue ID: ${issue.id}, Scan History: ${issue.scan_history_id || 'NULL'}, User Match: ${issue.scan_user_id === userId}`)
    })
    console.log('')
    
    // Check what backlog query would return
    const backlogQuery = await pool.query(`
      SELECT 
        i.id,
        i.rule_name,
        i.status,
        sh.id as scan_history_id,
        sh.user_id
      FROM issues i
      INNER JOIN scan_history sh ON i.first_seen_scan_id = sh.id
      LEFT JOIN sprint_issues si ON i.id = si.issue_id
      WHERE sh.user_id = $1 
        AND si.id IS NULL
      ORDER BY i.created_at DESC
      LIMIT 20
    `, [userId])
    
    console.log(`🎯 Backlog Query Results (${backlogQuery.rows.length}):`)
    if (backlogQuery.rows.length === 0) {
      console.log('  ❌ NO ISSUES FOUND IN BACKLOG QUERY')
      console.log('  This means either:')
      console.log('    1. No issues were created')
      console.log('    2. Issues have wrong first_seen_scan_id')
      console.log('    3. Scan_history has wrong user_id')
      console.log('    4. All issues are in sprints')
    } else {
      backlogQuery.rows.forEach(issue => {
        console.log(`  ✅ ${issue.rule_name} (${issue.status})`)
      })
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await pool.end()
  }
}

const userId = process.argv[2]
if (!userId) {
  console.error('Usage: node scripts/check-backlog-issues.js <user_id>')
  process.exit(1)
}

checkBacklogIssues(userId)

