import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { lookupApiKey, checkRateLimit } from '@/lib/api-key-service'
import { queryOne } from '@/lib/database'
import { getJiraIntegration } from '@/lib/integration-selection-service'
import { JiraClient } from '@/lib/jira-client'
import { mapIssueToJiraSimple } from '@/lib/jira-mapping-service'

const CI_JIRA_TIMEOUT_MS = 45000

function jsonError(message: string, code: string | undefined, status: number = 400) {
  return NextResponse.json({ error: message, code }, { status })
}

function deriveWcagLevel(issue: any): string {
  if (typeof issue?.wcag_level === 'string' && issue.wcag_level.trim()) return issue.wcag_level
  if (typeof issue?.wcagLevel === 'string' && issue.wcagLevel.trim()) return issue.wcagLevel
  const tags = Array.isArray(issue?.tags) ? issue.tags.map((t: any) => String(t).toLowerCase()) : []
  if (tags.some((t: string) => t.includes('aaa'))) return 'AAA'
  if (tags.some((t: string) => t.includes('aa'))) return 'AA'
  return 'A'
}

async function resolveUserForApiKey(organizationId: string, requestedUserId?: string): Promise<{ userId: string } | { error: string }> {
  if (requestedUserId) {
    const match = await queryOne(
      `SELECT 1
       FROM organization_members
       WHERE organization_id = $1 AND user_id = $2 AND is_active = true
       LIMIT 1`,
      [organizationId, requestedUserId]
    )
    if (!match) return { error: 'Requested userId is not an active member of this organization' }
    return { userId: requestedUserId }
  }

  const resolved = await queryOne(
    `SELECT om.user_id
     FROM organization_members om
     WHERE om.organization_id = $1 AND om.is_active = true
     ORDER BY om.joined_at DESC
     LIMIT 1`,
    [organizationId]
  )
  if (!resolved?.user_id) return { error: 'Failed to resolve user for this API key' }
  return { userId: resolved.user_id }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const apiKeyHeader = request.headers.get('x-api-key')
    const plainKey = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : (apiKeyHeader || '').trim()

    if (!plainKey) {
      return jsonError('Missing API key. Use Authorization: Bearer <key> or X-API-Key: <key>.', undefined, 401)
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

    let body: any
    try {
      body = await request.json()
    } catch {
      return jsonError('Invalid JSON body', undefined, 400)
    }

    const { issues, results: requestResults, scanResults, userId: bodyUserId } = body ?? {}
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

    const requestedUserId = bodyUserId ?? keyRecord.user_id ?? undefined
    const userResolved = await resolveUserForApiKey(keyRecord.organization_id, requestedUserId)
    if ('error' in userResolved) return jsonError(userResolved.error, undefined, 403)
    const userId = userResolved.userId

    const integration = await getJiraIntegration(userId)
    if (!integration) {
      return jsonError("No Jira integration is configured for this organization/user.", 'JIRA_NOT_CONFIGURED', 404)
    }
    // CI automation should be able to add tickets whenever Jira is configured.
    // Treat auto-sync as enabled by default (historical behavior).

    const client = new JiraClient({
      jiraUrl: integration.jira_url,
      email: integration.jira_email,
      encryptedApiToken: integration.encrypted_api_token
    })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('CI Jira add timed out')), CI_JIRA_TIMEOUT_MS)
    })

    const workPromise = (async () => {
      const created: Array<{ ruleName: string; ticketKey: string; ticketUrl: string }> = []
      const skipped: Array<{ ruleName: string; reason: string }> = []
      const errors: Array<{ ruleName: string; error: string }> = []
      const dedupe = new Set<string>()

      for (const issue of rawIssues) {
        const url: string = issue?.url || body?.url || body?.pageUrl || issue?.pageUrl || ''
        const ruleName: string = issue?.ruleName || issue?.id || issue?.rule_id || 'unknown-rule'
        const selector = issue?.nodes?.[0]?.target?.[0] ? String(issue.nodes[0].target[0]) : ''
        const dedupeKey = `${ruleName}|${selector}|${url}`
        if (dedupe.has(dedupeKey)) {
          skipped.push({ ruleName, reason: 'Duplicate in CI payload' })
          continue
        }
        dedupe.add(dedupeKey)

        try {
          const mapped = mapIssueToJiraSimple(
            {
              id: crypto.randomUUID(),
              rule_name: ruleName,
              description: issue?.description || issue?.help || 'Accessibility issue detected',
              impact: issue?.impact || 'moderate',
              priority: issue?.priority || (issue?.impact === 'critical' || issue?.impact === 'serious' ? 'high' : issue?.impact === 'minor' ? 'low' : 'medium'),
              wcag_level: deriveWcagLevel(issue),
              total_occurrences: Array.isArray(issue?.nodes) ? issue.nodes.length : 1,
              affected_pages: url ? [url] : [],
              help_url: typeof issue?.helpUrl === 'string' ? issue.helpUrl : undefined,
              help_text: typeof issue?.help === 'string' ? issue.help : undefined,
              offendingElements: (Array.isArray(issue?.nodes) ? issue.nodes : []).map((node: any) => ({
                html: node?.html,
                target: Array.isArray(node?.target) ? node.target : [],
                failureSummary: node?.failureSummary || issue?.description,
                impact: issue?.impact || 'moderate',
                url
              })),
              suggestions: Array.isArray(issue?.suggestions) ? issue.suggestions : []
            },
            integration.project_key,
            integration.issue_type || 'Bug'
          )

          const createdTicket = await client.createIssue(mapped)
          created.push({
            ruleName,
            ticketKey: createdTicket.key,
            ticketUrl: client.getTicketUrl(createdTicket.key)
          })
        } catch (e: any) {
          const message = e?.message ? String(e.message) : 'Unknown Jira create error'
          errors.push({ ruleName, error: message })
        }
      }

      return {
        success: errors.length === 0,
        jiraProject: integration.project_key,
        issueType: integration.issue_type,
        createdCount: created.length,
        skippedCount: skipped.length,
        errorCount: errors.length,
        created,
        skipped,
        errors
      }
    })()

    const outcome = await Promise.race([workPromise, timeoutPromise])
    return NextResponse.json(outcome)
  } catch (err: any) {
    console.error('CI Jira add route error:', err)
    return jsonError(err?.message ?? 'Failed to add Jira tickets', 'JIRA_ADD_FAILED', 500)
  }
}

