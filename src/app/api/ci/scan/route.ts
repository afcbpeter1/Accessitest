import { NextRequest, NextResponse } from 'next/server'
import { ScanService } from '@/lib/scan-service'
import { lookupApiKey, checkRateLimit } from '@/lib/api-key-service'
import { query, queryOne } from '@/lib/database'
import crypto from 'crypto'
import {
  getLearnedSuggestion,
  logPipelineSuggestion,
  computePatternHash,
  computeSuggestionSignature
} from '@/lib/learned-suggestions-service'

const RAPIDAPI_PROXY_SECRET = process.env.RAPIDAPI_PROXY_SECRET
const CI_SCAN_TIMEOUT_MS = 90000
const CI_SCAN_MAX_URLS = 50

type FailOn = 'critical' | 'criticalAndSerious'

function jsonError(message: string, code?: string, status: number = 400) {
  return NextResponse.json({ error: message, code }, { status })
}

function normalizeAndValidateUrl(input: string): { url: string } | { error: string } {
  let url = (input || '').trim()
  if (!url) return { error: 'URL is required' }
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = 'https://' + url
  }
  try {
    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { error: 'Only http and https URLs are allowed' }
    }
    const host = parsed.hostname.toLowerCase()
    if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local')) {
      return { error: 'Localhost and .local URLs are not allowed' }
    }
    if (/^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\.|^192\.168\./.test(host)) {
      return { error: 'Private network URLs are not allowed' }
    }
    return { url: parsed.href }
  } catch {
    return { error: 'Invalid URL format' }
  }
}

async function resolveAuth(request: NextRequest): Promise<
  | { type: 'api_key'; organizationId: string; apiKeyId: string }
  | { type: 'rapidapi' }
  | { error: string; status: number }
> {
  const rapidApiSecret = request.headers.get('x-rapidapi-proxy-secret')
  if (RAPIDAPI_PROXY_SECRET && rapidApiSecret && rapidApiSecret === RAPIDAPI_PROXY_SECRET) {
    return { type: 'rapidapi' }
  }

  const authHeader = request.headers.get('authorization')
  const apiKeyHeader = request.headers.get('x-api-key')
  const plainKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : (apiKeyHeader || '').trim()

  if (!plainKey) {
    return { error: 'Missing API key. Use Authorization: Bearer <key> or X-API-Key: <key>.', status: 401 }
  }

  const keyRecord = await lookupApiKey(plainKey)
  if (!keyRecord) {
    return { error: 'Invalid or expired API key', status: 401 }
  }

  const orgCredits = await queryOne(
    `SELECT unlimited_credits FROM organization_credits WHERE organization_id = $1`,
    [keyRecord.organization_id]
  )
  if (!orgCredits?.unlimited_credits) {
    return { error: 'API access requires an active subscription', status: 403 }
  }

  return {
    type: 'api_key',
    organizationId: keyRecord.organization_id,
    apiKeyId: keyRecord.id
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await resolveAuth(request)
    if ('error' in auth) {
      return jsonError(auth.error, undefined, auth.status)
    }

    if (auth.type === 'api_key') {
      const rate = await checkRateLimit(auth.apiKeyId)
      if (!rate.allowed) {
        const res = jsonError('Rate limit exceeded. Try again later.', 'RATE_LIMIT_EXCEEDED', 429)
        if (rate.retryAfter != null) {
          res.headers.set('Retry-After', String(rate.retryAfter))
        }
        return res
      }
    }

    let body: { url?: string; urls?: string[]; failOn?: string }
    try {
      body = await request.json()
    } catch {
      return jsonError('Invalid JSON body', undefined, 400)
    }

    const rawList = Array.isArray(body.urls) ? body.urls : body.url != null ? [body.url] : []
    if (rawList.length === 0) {
      return jsonError('At least one URL is required. Use "url" or "urls".', undefined, 400)
    }
    if (rawList.length > CI_SCAN_MAX_URLS) {
      return jsonError(
        `Maximum ${CI_SCAN_MAX_URLS} URLs per request. You sent ${rawList.length}.`,
        'TOO_MANY_URLS',
        400
      )
    }

    const urls: string[] = []
    const seen = new Set<string>()
    for (const raw of rawList) {
      const res = normalizeAndValidateUrl(typeof raw === 'string' ? raw : '')
      if ('error' in res) {
        return jsonError(res.error, undefined, 400)
      }
      if (!seen.has(res.url)) {
        seen.add(res.url)
        urls.push(res.url)
      }
    }

    const failOn: FailOn = body.failOn === 'critical' ? 'critical' : 'criticalAndSerious'
    const forwardedHost = request.headers.get('x-forwarded-host')
    const forwardedProto = request.headers.get('x-forwarded-proto') ?? 'https'
    const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, '')
      || process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '')
      || (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null)
      || request.nextUrl.origin
    const scanService = new ScanService()
    const results: Array<{
      url: string
      passed: boolean
      summary: { total: number; critical: number; serious: number; moderate: number; minor: number }
      issues: any[]
    }> = []

    for (const url of urls) {
      let result
      try {
        result = await scanService.runSinglePageScan(url, {
          ciMode: true,
          timeoutMs: CI_SCAN_TIMEOUT_MS
        })
      } catch (err: any) {
        const msg = err?.message ?? 'Scan failed'
        if (msg.includes('timed out') || msg === 'Scan timed out') {
          return jsonError(`Scan timed out for ${url}`, 'TIMEOUT', 408)
        }
        if (msg.includes('Could not navigate') || msg.includes('net::')) {
          return jsonError(
            `Could not reach ${url}. Ensure it is publicly accessible.`,
            'NAVIGATION_FAILED',
            400
          )
        }
        console.error('CI scan error:', err)
        return jsonError(`Scan failed for ${url}. Please try again.`, 'SCAN_FAILED', 500)
      }

      const summary = result.summary
      const critical = summary?.critical ?? 0
      const serious = summary?.serious ?? 0
      const pagePassed =
        failOn === 'critical'
          ? critical === 0
          : critical === 0 && serious === 0

      const summaryPayload = {
        total: summary?.total ?? 0,
        critical: summary?.critical ?? 0,
        serious: summary?.serious ?? 0,
        moderate: summary?.moderate ?? 0,
        minor: summary?.minor ?? 0
      }

      const issues = await Promise.all(
        (result.issues ?? []).map(async (issue: any) => {
          const html = issue.nodes?.[0]?.html ?? ''
          const patternHash = computePatternHash(issue.id, html)
          const learned = await getLearnedSuggestion(issue.id, patternHash)
          const suggestions = learned
            ? [{
                type: 'fix',
                description: learned.description,
                codeExample: learned.codeExample ?? undefined,
                priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : issue.impact === 'moderate' ? 'medium' : 'low') as 'high' | 'medium' | 'low'
              }]
            : (issue.suggestions ?? []).map((s: any) => ({
                type: s.type,
                description: s.description,
                codeExample: s.codeExample,
                priority: s.priority
              }))
          const issuePayload = {
            id: issue.id,
            impact: issue.impact,
            description: issue.description,
            help: issue.help,
            helpUrl: issue.helpUrl,
            nodes: (issue.nodes ?? []).map((node: any) => ({
              target: node.target,
              html: node.html,
              failureSummary: node.failureSummary
            })),
            suggestions
          }
          logPipelineSuggestion(issue.id, patternHash, computeSuggestionSignature(suggestions[0]?.description, suggestions[0]?.codeExample)).catch(() => {})
          return issuePayload
        })
      )

      results.push({
        url: result.url,
        passed: pagePassed,
        summary: summaryPayload,
        issues
      })
    }

    const passed = results.every((r) => r.passed)

    if (results.length === 1) {
      const single = results[0]
      const reportPayload = {
        passed: single.passed,
        url: single.url,
        summary: single.summary,
        issues: single.issues,
        createdAt: new Date().toISOString()
      }
      const reportId = crypto.randomUUID()
      await query(
        `INSERT INTO ci_scan_reports (id, data, created_at) VALUES ($1, $2, NOW())`,
        [reportId, JSON.stringify(reportPayload)]
      )
      const reportUrl = `${origin}/reports/${reportId}`
      return NextResponse.json({
        passed,
        url: single.url,
        summary: single.summary,
        issues: single.issues,
        reportUrl,
        results: results.map((r, i) => ({ ...r, reportUrl: i === 0 ? reportUrl : `${reportUrl}?page=${i}` }))
      })
    }

    const reportPayload = {
      passed,
      results,
      createdAt: new Date().toISOString()
    }
    const reportId = crypto.randomUUID()
    await query(
      `INSERT INTO ci_scan_reports (id, data, created_at) VALUES ($1, $2, NOW())`,
      [reportId, JSON.stringify(reportPayload)]
    )
    const reportUrl = `${origin}/reports/${reportId}`
    return NextResponse.json({
      passed,
      reportUrl,
      results: results.map((r, i) => ({ ...r, reportUrl: `${reportUrl}?page=${i}` }))
    })
  } catch (err) {
    console.error('CI scan route error:', err)
    return jsonError('An unexpected error occurred', 'INTERNAL_ERROR', 500)
  }
}
