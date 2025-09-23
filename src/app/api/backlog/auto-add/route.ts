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
    const { scanResults, domain } = body

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
        // Check if this issue already exists for this domain
        const existingItem = await queryOne(`
          SELECT id FROM product_backlog 
          WHERE user_id = $1 AND issue_id = $2 AND domain = $3
        `, [user.userId, issue.id, domain])

        if (existingItem) {
          // Update last_scan_at for existing items
          await query(`
            UPDATE product_backlog 
            SET last_scan_at = NOW(), updated_at = NOW()
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
            priority_rank, status
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `, [
          user.userId, 
          issue.id, 
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
          'backlog'
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
