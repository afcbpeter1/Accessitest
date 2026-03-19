import { query, queryOne } from '@/lib/database'
import { generateIssueId } from '@/lib/backlog-from-scan'

export type ScanResultPage = { url: string; issues: any[] }

/**
 * Add scan results (e.g. from extension or CI) to the product_backlog table
 * so they appear on the Product Backlog page. Uses same dedup key as CI:
 * (user_id, issue_id, domain) where issue_id = hash(rule + selector + url).
 */
export async function addScanResultsToProductBacklog(
  userId: string,
  scanResults: ScanResultPage[]
): Promise<{ added: number; reopened: number; skipped: number }> {
  const added: any[] = []
  const reopened: any[] = []
  const skipped: any[] = []

  if (!scanResults?.length) return { added: added.length, reopened: reopened.length, skipped: skipped.length }

  for (const result of scanResults) {
    const url = result?.url
    if (!url || typeof url !== 'string') continue
    let domain: string
    try {
      domain = new URL(url).hostname
    } catch {
      domain = 'unknown'
    }
    const issues = Array.isArray(result.issues) ? result.issues : []
    for (const issue of issues) {
      const ruleName: string = issue?.ruleName ?? issue?.id ?? issue?.rule_id ?? 'unknown'
      const helpText = typeof issue?.help === 'string' ? issue.help : null
      const helpUrl = typeof issue?.helpUrl === 'string' ? issue.helpUrl : null
      const node0 = Array.isArray(issue?.nodes) ? issue.nodes[0] : null
      const elementSelector =
        node0?.target?.[0] != null ? String(node0.target[0]) : (issue?.elementSelector ?? '')
      const elementHtml = node0?.html ?? issue?.elementHtml ?? null
      const failureSummary =
        node0?.failureSummary ?? issue?.failureSummary ?? issue?.description ?? ''
      const suggestions = Array.isArray(issue?.suggestions) ? issue.suggestions : null
      const wcagLevel = issue?.wcag_level ?? issue?.wcagLevel ?? 'AA'
      const impact = issue?.impact ?? issue?.type ?? 'moderate'

      const issueId = generateIssueId(ruleName, elementSelector, url)

      const existingItem = await queryOne(
        `SELECT id, status, created_at, last_scan_at
         FROM product_backlog
         WHERE user_id = $1 AND issue_id = $2 AND domain = $3`,
        [userId, issueId, domain]
      )

      if (existingItem) {
        const now = new Date()
        const lastSeen = new Date(existingItem.last_scan_at)
        const daysSinceLastSeen = Math.floor(
          (now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24)
        )
        if (
          (existingItem.status === 'done' || existingItem.status === 'cancelled') &&
          daysSinceLastSeen > 7
        ) {
          await query(
            `UPDATE product_backlog
             SET status = 'backlog',
                 last_scan_at = NOW(),
                 updated_at = NOW(),
                 priority_rank = (
                   SELECT COALESCE(MAX(priority_rank), 0) + 1
                   FROM product_backlog
                   WHERE user_id = $1
                 )
             WHERE id = $2`,
            [userId, existingItem.id]
          )
          reopened.push({ id: existingItem.id, issueId, ruleName, impact })
        } else {
          await query(
            `UPDATE product_backlog
             SET last_scan_at = NOW(), updated_at = NOW()
             WHERE id = $1`,
            [existingItem.id]
          )
          skipped.push({ issueId, ruleName, impact })
        }
        continue
      }

      const maxRank = await queryOne(
        `SELECT COALESCE(MAX(priority_rank), 0) as max_rank
         FROM product_backlog
         WHERE user_id = $1`,
        [userId]
      )
      const nextRank = (maxRank?.max_rank || 0) + 1

      const insertParams = [
        userId,
        issueId,
        String(ruleName).slice(0, 255),
        String(issue?.description ?? issue?.help ?? '').slice(0, 5000),
        String(impact).slice(0, 10),
        String(wcagLevel).slice(0, 10),
        helpText ? String(helpText).slice(0, 5000) : null,
        helpUrl ? String(helpUrl).slice(0, 2000) : null,
        suggestions ? JSON.stringify(suggestions).slice(0, 200000) : null,
        String(elementSelector || '').slice(0, 2000),
        elementHtml ? String(elementHtml).slice(0, 10000) : null,
        String(failureSummary).slice(0, 5000),
        url,
        domain,
        nextRank
      ]

      const fallbackParams = [
        insertParams[0],
        insertParams[1],
        insertParams[2],
        insertParams[3],
        insertParams[4],
        insertParams[5],
        insertParams[9],
        insertParams[10],
        insertParams[11],
        insertParams[12],
        insertParams[13],
        insertParams[14]
      ]
      try {
        await query(
          `INSERT INTO product_backlog (
            user_id, issue_id, rule_name, description, impact, wcag_level,
            help_text, help_url, suggestions,
            element_selector, element_html, failure_summary, url, domain,
            priority_rank, status, last_scan_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13, $14, $15, 'backlog', NOW())`,
          insertParams
        )
      } catch (insertErr: any) {
        const msg = insertErr?.message ?? ''
        const isMissingColumn =
          msg.includes('column') &&
          (msg.includes('does not exist') ||
            msg.includes('help_text') ||
            msg.includes('help_url') ||
            msg.includes('suggestions'))
        const isJsonbOrInvalid = msg.includes('jsonb') || msg.includes('invalid input') || msg.includes('invalid text')
        if (isMissingColumn || isJsonbOrInvalid) {
          await query(
            `INSERT INTO product_backlog (
              user_id, issue_id, rule_name, description, impact, wcag_level,
              element_selector, element_html, failure_summary, url, domain,
              priority_rank, status, last_scan_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'backlog', NOW())`,
            fallbackParams
          )
        } else {
          throw insertErr
        }
      }
      added.push({ issueId, ruleName, impact })
    }
  }

  return {
    added: added.length,
    reopened: reopened.length,
    skipped: skipped.length
  }
}
