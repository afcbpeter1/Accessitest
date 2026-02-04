import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { scanResults, domain, fileName } = body

    if (!scanResults || !Array.isArray(scanResults) || !domain) {
      return NextResponse.json(
        { success: false, error: 'Invalid scan results or domain' },
        { status: 400 }
      )
    }

    const addedItems = []
    const skippedItems = []

    for (const issue of scanResults) {
      try {
        // Generate unique issue ID based on rule, element, and URL
        const crypto = require('crypto')
        const issueKey = crypto.createHash('sha256')
          .update(`${issue.ruleName}|${issue.elementSelector || ''}|${issue.url}`)
          .digest('hex').substring(0, 16)

        // Check if this issue already exists for this domain (for document-scan, match by file_name when provided)
        const existingItem = domain === 'document-scan' && fileName
          ? await queryOne(`
              SELECT i.id, i.status, i.created_at, i.updated_at 
              FROM issues i
              JOIN scan_history sh ON i.first_seen_scan_id = sh.id
              WHERE sh.user_id = $1 AND i.rule_name = $2 AND sh.file_name = $3
            `, [user.userId, issue.ruleName, fileName])
          : await queryOne(`
              SELECT i.id, i.status, i.created_at, i.updated_at 
              FROM issues i
              JOIN scan_history sh ON i.first_seen_scan_id = sh.id
              WHERE sh.user_id = $1 AND i.rule_name = $2 AND sh.url LIKE $3
            `, [user.userId, issue.ruleName, `%${domain}%`])

        if (existingItem) {
          // Update last_scan_at for existing items
          await query(`
            UPDATE issues 
            SET updated_at = NOW()
            WHERE id = $1
          `, [existingItem.id])
          
          skippedItems.push({
            issueId: issue.id,
            ruleName: issue.ruleName,
            reason: 'Already exists in backlog'
          })
          continue
        }

        // Get the next priority rank
        const maxRank = await queryOne(`
          SELECT COALESCE(MAX(rank), 0) as max_rank 
          FROM issues 
          WHERE first_seen_scan_id IN (
            SELECT id FROM scan_history WHERE user_id = $1
          )
        `, [user.userId])

        const nextRank = (maxRank?.max_rank || 0) + 1

        // Get the most recent scan history for this user (for document-scan, use most recent document scan so we don't attach to a web scan)
        const scanHistory = domain === 'document-scan'
          ? await queryOne(`
              SELECT id FROM scan_history 
              WHERE user_id = $1 AND scan_type = 'document'
              ORDER BY created_at DESC 
              LIMIT 1
            `, [user.userId])
          : await queryOne(`
              SELECT id FROM scan_history 
              WHERE user_id = $1
              ORDER BY created_at DESC 
              LIMIT 1
            `, [user.userId])

        if (!scanHistory) {
          console.error(`No scan history found for user ${user.userId}`)
          skippedItems.push({
            issueId: issue.id,
            ruleName: issue.ruleName,
            reason: 'No scan history found'
          })
          continue
        }

        // Insert new issue
        const result = await queryOne(`
          INSERT INTO issues (
            issue_key, rule_id, rule_name, description, impact, wcag_level,
            total_occurrences, affected_pages, notes,
            status, priority, rank, story_points, remaining_points,
            first_seen_scan_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING *
        `, [
          issueKey,
          issue.ruleName, // rule_id (using rule name as rule_id)
          issue.ruleName, 
          issue.description, 
          issue.impact, 
          issue.wcagLevel,
          1, // total_occurrences
          [issue.url], // affected_pages
          issue.failureSummary || '', // notes
          'open', 
          'medium', 
          nextRank, 
          1, // story_points
          1, // remaining_points
          scanHistory.id, 
          new Date().toISOString(), 
          new Date().toISOString()
        ])

        addedItems.push({
          id: result.id,
          issueId: issue.id,
          ruleName: issue.ruleName,
          impact: issue.impact
        })
      } catch (error) {
        console.error(`Error processing issue ${issue.id}:`, error)
        skippedItems.push({
          issueId: issue.id,
          ruleName: issue.ruleName,
          reason: 'Error processing issue'
        })
      }
    }

    return NextResponse.json({
      success: true,
      added: addedItems,
      skipped: skippedItems,
      summary: {
        total: scanResults.length,
        added: addedItems.length,
        skipped: skippedItems.length
      }
    })
  } catch (error) {
    console.error('Error auto-adding to backlog:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add issues to backlog' },
      { status: 500 }
    )
  }
}
