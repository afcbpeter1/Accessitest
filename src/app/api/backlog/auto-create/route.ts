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
    const { scanResults, scanId, scanType } = body

    if (!scanResults || !Array.isArray(scanResults) || !scanId) {
      return NextResponse.json(
        { success: false, error: 'Invalid scan results or scan ID' },
        { status: 400 }
      )
    }

    const addedItems = []
    const reopenedItems = []
    const skippedItems = []

    for (const issue of scanResults) {
      try {
        // Generate unique issue ID based on rule, element, and URL
        const issueId = generateIssueId(issue.ruleName, issue.elementSelector, issue.url)
        const domain = new URL(issue.url).hostname

        // Check if this exact issue already exists for this domain
        const existingItem = await queryOne(`
          SELECT id, status, created_at, last_scan_at 
          FROM product_backlog 
          WHERE user_id = $1 AND issue_id = $2 AND domain = $3
        `, [user.userId, issueId, domain])

        if (existingItem) {
          // Update last_scan_at and check if we should reopen
          const now = new Date()
          const lastSeen = new Date(existingItem.last_scan_at)
          const daysSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))

          // If issue was closed/done and it's been more than 7 days, reopen it
          if ((existingItem.status === 'done' || existingItem.status === 'cancelled') && daysSinceLastSeen > 7) {
            await query(`
              UPDATE product_backlog 
              SET status = 'backlog', 
                  last_scan_at = NOW(), 
                  updated_at = NOW(),
                  priority_rank = (
                    SELECT COALESCE(MAX(priority_rank), 0) + 1 
                    FROM product_backlog 
                    WHERE user_id = $1
                  )
              WHERE id = $2
            `, [user.userId, existingItem.id])

            reopenedItems.push({
              id: existingItem.id,
              issueId: issueId,
              ruleName: issue.ruleName,
              impact: issue.impact,
              reason: `Reopened after ${daysSinceLastSeen} days (was ${existingItem.status})`
            })
          } else {
            // Just update last seen time
            await query(`
              UPDATE product_backlog 
              SET last_scan_at = NOW(), updated_at = NOW()
              WHERE id = $1
            `, [existingItem.id])

            skippedItems.push({
              issueId: issueId,
              ruleName: issue.ruleName,
              reason: `Already exists (status: ${existingItem.status})`
            })
          }
          continue
        }

        // Get the next priority rank
        const maxRank = await queryOne(`
          SELECT COALESCE(MAX(priority_rank), 0) as max_rank 
          FROM product_backlog 
          WHERE user_id = $1
        `, [user.userId])

        const nextRank = (maxRank?.max_rank || 0) + 1

        // Insert new backlog item
        const result = await queryOne(`
          INSERT INTO product_backlog (
            user_id, issue_id, rule_name, description, impact, wcag_level,
            element_selector, element_html, failure_summary, url, domain,
            priority_rank, status, last_scan_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          RETURNING *
        `, [
          user.userId, 
          issueId, 
          issue.ruleName, 
          issue.description, 
          issue.impact, 
          issue.wcagLevel,
          issue.elementSelector, 
          issue.elementHtml, 
          issue.failureSummary, 
          issue.url, 
          domain,
          nextRank, 
          'backlog',
          new Date()
        ])

        addedItems.push({
          id: result.id,
          issueId: issueId,
          ruleName: issue.ruleName,
          impact: issue.impact
        })
      } catch (error) {
        console.error(`Error processing issue ${issue.ruleName}:`, error)
        skippedItems.push({
          issueId: issue.ruleName,
          ruleName: issue.ruleName,
          reason: 'Error processing issue'
        })
      }
    }

    return NextResponse.json({
      success: true,
      added: addedItems,
      reopened: reopenedItems,
      skipped: skippedItems,
      summary: {
        total: scanResults.length,
        added: addedItems.length,
        reopened: reopenedItems.length,
        skipped: skippedItems.length
      }
    })
  } catch (error) {
    console.error('Error auto-creating backlog items:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create backlog items' },
      { status: 500 }
    )
  }
}

// Generate a unique issue ID based on rule, element, and URL
function generateIssueId(ruleName: string, elementSelector: string, url: string): string {
  const crypto = require('crypto')
  const content = `${ruleName}|${elementSelector || ''}|${url}`
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
}
