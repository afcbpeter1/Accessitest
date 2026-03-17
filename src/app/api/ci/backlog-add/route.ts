import { NextRequest, NextResponse } from 'next/server'
import { lookupApiKey, checkRateLimit } from '@/lib/api-key-service'
import { query, queryOne } from '@/lib/database'
import crypto from 'crypto'

const CI_BACKLOG_TIMEOUT_MS = 30000

type FailOn = 'critical' | 'criticalAndSerious'

function jsonError(message: string, code: string | undefined, status: number = 400) {
  return NextResponse.json({ error: message, code }, { status })
}

function generateIssueId(ruleName: string, elementSelector: string, url: string): string {
  const content = `${ruleName}|${elementSelector || ''}|${url}`
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
}

async function resolveUserForApiKey(organizationId: string): Promise<{ userId: string } | { error: string }> {
  // Pick an active member in the org. We rely on your existing org->members schema.
  const row = await queryOne(
    `SELECT om.user_id
     FROM organization_members om
     WHERE om.organization_id = $1 AND om.is_active = true
     ORDER BY om.joined_at DESC
     LIMIT 1`,
    [organizationId]
  )
  if (!row?.user_id) return { error: 'No active user found for this organization' }
  return { userId: row.user_id }
}

export async function POST(request: NextRequest) {
  try {
    // ---- Auth (same API key style as CI scan) ----
    const authHeader = request.headers.get('authorization')
    const apiKeyHeader = request.headers.get('x-api-key')
    const plainKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (apiKeyHeader || '').trim()

    if (!plainKey) {
      return jsonError(
        'Missing API key. Use Authorization: Bearer <key> or X-API-Key: <key>.',
        undefined,
        401
      )
    }

    const keyRecord = await lookupApiKey(plainKey)
    if (!keyRecord) {
      return jsonError('Invalid or expired API key', undefined, 401)
    }

    const rate = await checkRateLimit(keyRecord.id)
    if (!rate.allowed) {
      const res = jsonError('Rate limit exceeded. Try again later.', 'RATE_LIMIT_EXCEEDED', 429)
      if (rate.retryAfter != null) res.headers.set('Retry-After', String(rate.retryAfter))
      return res
    }

    // ---- Body ----
    let body: any
    try {
      body = await request.json()
    } catch {
      return jsonError('Invalid JSON body', undefined, 400)
    }

    const { issues, results: requestResults, scanResults, failOn } = body ?? {}
    const rawIssues = Array.isArray(issues)
      ? issues
      : Array.isArray(scanResults)
        ? scanResults
        : Array.isArray(requestResults)
          ? requestResults.flatMap((r: any) => r?.issues ?? [])
          : []

    if (!Array.isArray(rawIssues) || rawIssues.length === 0) {
      return jsonError('Missing issues array. Pass "issues" or "results[]".', 'MISSING_ISSUES', 400)
    }

    const userResolved = await resolveUserForApiKey(keyRecord.organization_id)
    if ('error' in userResolved) return jsonError(userResolved.error, undefined, 403)
    const userId = userResolved.userId

    // ---- Timeout guard ----
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('CI backlog add timed out')), CI_BACKLOG_TIMEOUT_MS)
    })

    const workPromise = (async () => {
      const added: any[] = []
      const reopened: any[] = []
      const skipped: any[] = []

      // Normalize issues into the shape backlog expects
      // CI scan payload issues include: id, impact, description, help, helpUrl, nodes, suggestions
      for (const issue of rawIssues) {
        const url: string = issue?.url || body?.url || body?.pageUrl || issue?.pageUrl
        if (!url) continue

        const ruleName: string = issue?.ruleName || issue?.id || issue?.rule_id || 'unknown'
        const node0 = Array.isArray(issue?.nodes) ? issue.nodes[0] : null
        const elementSelector =
          node0?.target?.[0] != null ? String(node0.target[0]) : (issue?.elementSelector ?? '')
        const elementHtml = node0?.html ?? issue?.elementHtml ?? null
        const failureSummary = node0?.failureSummary ?? issue?.failureSummary ?? issue?.description ?? ''

        // Your CI scan route does not currently return wcag_level/tags, so default to AA.
        const wcagLevel = issue?.wcag_level ?? issue?.wcagLevel ?? 'AA'

        const impact = issue?.impact ?? issue?.type ?? 'moderate'

        const domain = new URL(url).hostname
        const issueId = generateIssueId(ruleName, elementSelector, url)

        // De-dup by (user_id, issue_id, domain)
        const existingItem = await queryOne(
          `SELECT id, status, created_at, last_scan_at
           FROM product_backlog
           WHERE user_id = $1 AND issue_id = $2 AND domain = $3`,
          [userId, issueId, domain]
        )

        if (existingItem) {
          const now = new Date()
          const lastSeen = new Date(existingItem.last_scan_at)
          const daysSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))

          if ((existingItem.status === 'done' || existingItem.status === 'cancelled') && daysSinceLastSeen > 7) {
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
            reopened.push({ id: existingItem.id, issueId, ruleName, impact, reason: 'Reopened' })
          } else {
            await query(
              `UPDATE product_backlog
               SET last_scan_at = NOW(), updated_at = NOW()
               WHERE id = $1`,
              [existingItem.id]
            )
            skipped.push({ issueId, ruleName, impact, reason: `Already exists (status: ${existingItem.status})` })
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

        const finalImpact = String(impact).slice(0, 10)
        const finalWcag = String(wcagLevel).slice(0, 10)

        // Map CI fields to product_backlog columns
        await query(
          `INSERT INTO product_backlog (
            user_id, issue_id, rule_name, description, impact, wcag_level,
            element_selector, element_html, failure_summary, url, domain,
            priority_rank, status, last_scan_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'backlog', NOW())`,
          [
            userId,
            issueId,
            String(ruleName).slice(0, 255),
            String(issue?.description ?? issue?.help ?? '').slice(0, 5000),
            finalImpact,
            finalWcag,
            String(elementSelector || '').slice(0, 2000),
            elementHtml ? String(elementHtml).slice(0, 10000) : null,
            String(failureSummary).slice(0, 5000),
            url,
            domain,
            nextRank
          ]
        )

        added.push({ issueId, ruleName, impact })
      }

      return { success: true, added, reopened, skipped }
    })()

    const outcome = await Promise.race([workPromise, timeoutPromise])
    return NextResponse.json(outcome)
  } catch (err: any) {
    console.error('CI backlog add route error:', err)
    return jsonError(err?.message ?? 'Failed to add issues to backlog', 'BACKLOG_ADD_FAILED', 500)
  }
}

