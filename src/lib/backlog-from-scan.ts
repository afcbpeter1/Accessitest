import { query, queryOne } from './database'
import crypto from 'crypto'
import { getStandardTagsFromAxeTags } from './standard-tags'

/**
 * Generate a unique issue ID based on rule, element, and URL.
 * Used by scan-progress and extension/scan to create backlog items from scan results.
 */
export function generateIssueId(ruleName: string, elementSelector: string, url: string): string {
  const content = `${ruleName}|${elementSelector || ''}|${url}`
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
}

/**
 * Auto-create backlog items for unique issues (with scan history ID).
 * Shared by scan-progress and extension/scan routes.
 */
export async function autoCreateBacklogItemsWithHistoryId(
  userId: string,
  scanResults: any[],
  scanHistoryId: string
): Promise<{ added: number; reopened: number; skipped: number }> {
  const addedItems: any[] = []
  const reopenedItems: any[] = []
  const skippedItems: any[] = []

  if (!scanResults || scanResults.length === 0) {
    return { added: 0, reopened: 0, skipped: 0 }
  }

  if (!scanHistoryId) {
    console.error('❌ No scanHistoryId provided to autoCreateBacklogItemsWithHistoryId')
    return { added: 0, reopened: 0, skipped: 0 }
  }

  let firstError: string | null = null

  for (const result of scanResults) {
    if (!result.issues || result.issues.length === 0) continue

    for (const issue of result.issues) {
      try {
        const elementSelector = (issue.nodes?.[0]?.target && Array.isArray(issue.nodes[0].target))
          ? String(issue.nodes[0].target[0] ?? '')
          : ''
        const issueId = generateIssueId(issue.id || 'unknown', elementSelector, result.url)

        const existingForUser = await queryOne(
          `SELECT i.id, i.status, i.created_at, i.updated_at, sh.user_id as scan_user_id
           FROM issues i
           LEFT JOIN scan_history sh ON i.first_seen_scan_id = sh.id
           WHERE i.issue_key = $1 AND sh.user_id = $2`,
          [issueId, userId]
        )

        if (existingForUser) {
          const shouldReopen = existingForUser.status === 'closed' || existingForUser.status === 'resolved'
          await query(
            `UPDATE issues 
             SET updated_at = NOW(),
                 total_occurrences = total_occurrences + 1,
                 affected_pages = CASE 
                   WHEN $2 = ANY(affected_pages) THEN affected_pages
                   ELSE array_append(affected_pages, $2)
                 END,
                 status = CASE 
                   WHEN $3 THEN 'backlog'
                   ELSE status
                 END
             WHERE id = $1`,
            [existingForUser.id, result.url, shouldReopen]
          )
          if (shouldReopen) reopenedItems.push({ id: existingForUser.id, issueId, ruleName: issue.id, impact: issue.impact })
          else skippedItems.push({ issueId: issue.id, ruleName: issue.id, reason: 'Duplicate' })
          continue
        }

        const existingIssue = await queryOne('SELECT id FROM issues WHERE issue_key = $1', [issueId])

        if (existingIssue) {
          await query(
            `INSERT INTO user_issues (user_id, issue_id) VALUES ($1, $2)
             ON CONFLICT (user_id, issue_id) DO NOTHING`,
            [userId, existingIssue.id]
          )
          await query(
            `UPDATE issues
             SET updated_at = NOW(),
                 total_occurrences = total_occurrences + 1,
                 affected_pages = CASE
                   WHEN $2 = ANY(affected_pages) THEN affected_pages
                   ELSE array_append(affected_pages, $2)
                 END
             WHERE id = $1`,
            [existingIssue.id, result.url]
          )
          addedItems.push({ id: existingIssue.id, issueId, ruleName: issue.id, impact: issue.impact })
          continue
        }

        const maxRank = await queryOne(
          `SELECT COALESCE(MAX(rank), 0) as max_rank 
           FROM issues 
           WHERE first_seen_scan_id IN (
             SELECT id FROM scan_history WHERE user_id = $1
           )`,
          [userId]
        )
        const nextRank = (maxRank?.max_rank || 0) + 1

        const safeStr = (v: any, max: number) => (v == null ? '' : String(v).slice(0, max))
        const ruleId = safeStr(issue.id, 255)
        const ruleName = safeStr(issue.id, 255)
        const description = safeStr(issue.description, 5000)
        const impact = safeStr(issue.impact, 50)
        const wcagLevel = (issue.tags && Array.isArray(issue.tags) && issue.tags.find((tag: string) => tag.startsWith('wcag'))) || 'AA'
        const standardTags = getStandardTagsFromAxeTags(issue.tags)
        const notes = safeStr(issue.nodes?.[0]?.failureSummary, 5000)
        const affectedPages = Array.isArray(result.url) ? result.url : [result.url].filter(Boolean)

        const newItem = await queryOne(
          `INSERT INTO issues (
            issue_key, rule_id, rule_name, description, impact, wcag_level, standard_tags,
            total_occurrences, affected_pages, notes,
            status, priority, rank, story_points, remaining_points,
            first_seen_scan_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
          RETURNING *`,
          [
            issueId,
            ruleId,
            ruleName,
            description,
            impact,
            safeStr(wcagLevel, 50),
            standardTags.length > 0 ? standardTags : null,
            issue.nodes?.length || 1,
            affectedPages,
            notes,
            'backlog',
            'medium',
            nextRank,
            1,
            1,
            scanHistoryId,
            new Date().toISOString(),
            new Date().toISOString()
          ]
        )
        await query(
          `INSERT INTO user_issues (user_id, issue_id) VALUES ($1, $2)
           ON CONFLICT (user_id, issue_id) DO NOTHING`,
          [userId, newItem.id]
        )
        addedItems.push({
          id: newItem.id,
          issueId,
          ruleName: issue.id,
          impact: issue.impact
        })
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        console.error(`❌ Error processing issue ${issue.id}:`, error)
        if (!firstError) firstError = errMsg
        skippedItems.push({ issueId: issue.id, ruleName: issue.id, reason: errMsg })
      }
    }
  }

  if (addedItems.length === 0 && firstError && skippedItems.length > 0) {
    throw new Error(`Backlog creation failed: ${firstError}`)
  }

  return {
    added: addedItems.length,
    reopened: reopenedItems.length,
    skipped: skippedItems.length
  }
}
