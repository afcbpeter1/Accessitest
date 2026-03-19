import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { ScanHistoryService } from '@/lib/scan-history-service'
import { getUserCredits, deductCredits } from '@/lib/credit-service'
import { NotificationService } from '@/lib/notification-service'
import { autoCreateBacklogItemsWithHistoryId } from '@/lib/backlog-from-scan'
import { addScanResultsToProductBacklog } from '@/lib/product-backlog-from-scan'
import { AccessibilityScanner } from '@/lib/accessibility-scanner'
import type { AccessibilityIssue } from '@/lib/accessibility-scanner'
import { isValidUrl } from '@/lib/url-utils'
import { screenshotService } from '@/lib/screenshot-service'
import { CloudinaryService } from '@/lib/cloudinary-service'
import { ClaudeAPI } from '@/lib/claude-api'
import { ensureRuleLevelLearnedSuggestionAtScanTime, isNoOpOrInvalidCodeExample } from '@/lib/runtime-learned-suggestion'
import {
  getLearnedSuggestion,
  logPipelineSuggestion,
  computePatternHash,
  computeSuggestionSignature
} from '@/lib/learned-suggestions-service'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

// Dedupe multi-page extension scans so we only deduct credits once per scan session.
// This is intentionally in-memory; if the server restarts, users may be charged again.
const CHARGE_DEDUP_WINDOW_MS = 60 * 60 * 1000 // 1 hour
const chargedMultiScanIds = new Map<string, number>()

function pruneChargedMultiScanIds(now: number) {
  for (const [key, timestamp] of chargedMultiScanIds.entries()) {
    if (now - timestamp > CHARGE_DEDUP_WINDOW_MS) {
      chargedMultiScanIds.delete(key)
    }
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  const headers: Record<string, string> = { ...CORS_HEADERS, 'Content-Type': 'application/json' }

  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json().catch(() => ({}))
    const { url, issues = [], summary = {}, wcagLevel: reqWcagLevel, selectedTags: reqSelectedTags, multiScanId } = body

    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid url' },
        { status: 400, headers }
      )
    }
    if (!isValidUrl(url)) {
      return NextResponse.json(
        { success: false, error: 'Invalid url: must be http or https' },
        { status: 400, headers }
      )
    }
    if (!Array.isArray(issues)) {
      return NextResponse.json(
        { success: false, error: 'issues must be an array' },
        { status: 400, headers }
      )
    }

    const totalIssues = Number(summary.total) || issues.length
    const criticalIssues = Number(summary.critical) ?? issues.filter((i: any) => i.impact === 'critical').length
    const seriousIssues = Number(summary.serious) ?? issues.filter((i: any) => i.impact === 'serious').length
    const moderateIssues = Number(summary.moderate) ?? issues.filter((i: any) => i.impact === 'moderate').length
    const minorIssues = Number(summary.minor) ?? issues.filter((i: any) => i.impact === 'minor').length

    const now = Date.now()
    pruneChargedMultiScanIds(now)
    const dedupeKey = typeof multiScanId === 'string' && multiScanId.trim().length > 0 ? multiScanId : null
    const shouldDeductCredits = !dedupeKey || !chargedMultiScanIds.has(dedupeKey)
    const scanId = `extension_scan_${Date.now()}`

    if (shouldDeductCredits) {
      const creditData = await getUserCredits(user.userId)
      if (!creditData.unlimited_credits && creditData.credits_remaining < 1) {
        await NotificationService.notifyInsufficientCredits(user.userId)
        return NextResponse.json(
          { success: false, error: 'Insufficient credits', canScan: false },
          { status: 402, headers }
        )
      }
      await deductCredits(user.userId, 1, `Web scan: ${url}`, scanId)
      if (dedupeKey) chargedMultiScanIds.set(dedupeKey, now)
    }

    // Normalize issues and use learned suggestions (same as pipeline) + rule-based fallback; log for cron to update daily
    const scanner = new AccessibilityScanner()
    const claude = new ClaudeAPI()
    const inflightRuleLearns = new Map<string, Promise<any>>()
    const normalizedIssues: AccessibilityIssue[] = issues.map((i: any) => ({
      id: i.id || 'unknown',
      impact: (i.impact === 'critical' || i.impact === 'serious' || i.impact === 'moderate' || i.impact === 'minor' ? i.impact : 'moderate') as AccessibilityIssue['impact'],
      tags: Array.isArray(i.tags) ? i.tags : [],
      description: typeof i.description === 'string' ? i.description : '',
      help: typeof i.help === 'string' ? i.help : '',
      helpUrl: typeof i.helpUrl === 'string' ? i.helpUrl : '',
      nodes: (Array.isArray(i.nodes) ? i.nodes : []).map((n: any) => ({
        html: typeof n.html === 'string' ? n.html : '',
        target: Array.isArray(n.target) ? n.target : [],
        failureSummary: typeof n.failureSummary === 'string' ? n.failureSummary : '',
        any: n.any || [],
        all: n.all || [],
        none: n.none || []
      }))
    }))

    for (const issue of normalizedIssues) {
      const html = issue.nodes?.[0]?.html ?? ''
      const patternHash = computePatternHash(issue.id, html)
      const learned = await getLearnedSuggestion(issue.id, patternHash)
      const priority = (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : issue.impact === 'moderate' ? 'medium' : 'low') as 'high' | 'medium' | 'low'

      const ruleBased = scanner.getRuleBasedSuggestion(issue)
      const firstSuggestion = ruleBased.length > 0 ? ruleBased[0] : null

      const learnedInvalid = learned ? isNoOpOrInvalidCodeExample(issue.id, learned.codeExample) : false
      if (!learned || learnedInvalid) {
        // Learn immediately for new rules and persist to learned_suggestions.
        const key = issue.id
        let p = inflightRuleLearns.get(key)
        if (!p) {
          p = (async () => {
            if (!firstSuggestion) return null
            return ensureRuleLevelLearnedSuggestionAtScanTime({
              claude,
              ruleId: key,
              currentDescription: firstSuggestion.description,
              currentCodeExample: firstSuggestion.codeExample
            })
          })()
          inflightRuleLearns.set(key, p)
        }
        const ensured = await p

        if (ensured?.codeExample) {
          ;(issue as any).suggestions = [{
            type: 'fix',
            description: ensured.description,
            codeExample: ensured.codeExample ?? undefined,
            priority
          }]
        } else if (ruleBased.length > 0) {
          ;(issue as any).suggestions = ruleBased
        }
      } else {
        const fallbackCode: string | undefined = firstSuggestion?.codeExample
        ;(issue as any).suggestions = [{
          type: 'fix',
          description: learned.description,
          codeExample: learned.codeExample ?? fallbackCode ?? undefined,
          priority
        }]
      }
      const sugg = (issue as any).suggestions?.[0]
      await logPipelineSuggestion(issue.id, patternHash, computeSuggestionSignature(sugg?.description, sugg?.codeExample)).catch(() => {})
    }

    const remediationReport: any[] = []
    for (const issue of normalizedIssues) {
      const sugg = (issue as any).suggestions
      if (sugg && Array.isArray(sugg) && sugg.length > 0) {
        remediationReport.push({
          issueId: issue.id,
          ruleName: issue.id,
          description: issue.description || 'Accessibility issue detected',
          impact: issue.impact || 'moderate',
          wcag22Level: 'A',
          help: issue.help || 'Please review and fix this accessibility issue',
          helpUrl: issue.helpUrl || 'https://www.w3.org/WAI/WCAG21/quickref/',
          totalOccurrences: issue.nodes?.length || 1,
          affectedUrls: [url],
          offendingElements: (issue.nodes || []).map((node: any) => ({
            html: node.html || `<${node.target?.[0] || 'element'}>`,
            target: node.target || [],
            failureSummary: node.failureSummary || issue.description,
            impact: issue.impact || 'moderate',
            url,
            screenshot: node.screenshot,
            boundingBox: node.boundingBox
          })),
          suggestions: sugg.map((s: any) => ({
            type: 'fix',
            description: s.description || s.text || 'Accessibility fix',
            codeExample: s.codeExample || s.code || '',
            priority: s.priority || 'medium'
          })),
          priority: (issue as any).priority || 'medium',
          screenshots: null
        })
      }
    }

    const results = [{ url, issues: normalizedIssues }]
    const complianceSummary = {
      totalIssues,
      criticalIssues,
      seriousIssues,
      moderateIssues,
      minorIssues
    }

    // Capture a redacted page reference screenshot for extension scans (best-effort).
    // The screenshot is masked (inputs/passwords) to reduce sensitive data leakage.
    let screenshots: { viewport?: string; fullPage?: string } | undefined = undefined
    try {
      const screenshotResult = await screenshotService.captureScreenshots(url, [], { fullPage: false, viewport: true })
      if (screenshotResult.viewport) {
        const viewportUpload = await CloudinaryService.uploadBase64Image(
          screenshotResult.viewport,
          'a11ytest/screenshots',
          { public_id: `${scanId}_viewport` }
        )
        screenshots = { viewport: viewportUpload.secure_url }
      }
    } catch (screenshotErr: any) {
      const msg = screenshotErr?.message ?? String(screenshotErr)
      if (msg.includes('Execution context was destroyed') || msg.includes('Protocol error')) {
        // Page/tab closed or navigated before screenshot; expected in some flows, no need to log fully
        console.warn('Extension screenshot skipped (page context no longer available)')
      } else {
        console.warn('Extension screenshot capture failed (non-fatal):', screenshotErr)
      }
    }

    const finalResults = {
      url,
      pagesScanned: 1,
      results,
      complianceSummary,
      remediationReport,
      screenshots
    }

    // Store exactly like the main app (a11ytest): same title format and scanSettings shape
    const scanHistoryId = await ScanHistoryService.storeScanResult(user.userId, 'web', {
      scanTitle: `Web Scan: ${url}`,
      url,
      scanResults: finalResults,
      complianceSummary,
      remediationReport,
      totalIssues: complianceSummary.totalIssues,
      criticalIssues: complianceSummary.criticalIssues,
      seriousIssues: complianceSummary.seriousIssues,
      moderateIssues: complianceSummary.moderateIssues,
      minorIssues: complianceSummary.minorIssues,
      pagesScanned: 1,
      scanSettings: {
        source: 'extension',
        pagesToScan: [url],
        includeSubdomains: false,
        wcagLevel: (reqWcagLevel === 'A' || reqWcagLevel === 'AAA' ? reqWcagLevel : 'AA') as string,
        selectedTags: Array.isArray(reqSelectedTags) && reqSelectedTags.length > 0
          ? reqSelectedTags
          : ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
      }
    })

    let backlogAdded = { added: 0, reopened: 0, skipped: 0 }
    let backlogError: string | null = null
    try {
      await autoCreateBacklogItemsWithHistoryId(user.userId, results, scanHistoryId)
    } catch (backlogErr) {
      console.error('Extension scan: issues/board backlog creation error', backlogErr)
    }
    try {
      backlogAdded = await addScanResultsToProductBacklog(user.userId, results)
    } catch (productBacklogErr) {
      console.error('Extension scan: product backlog creation error', productBacklogErr)
      backlogError =
        productBacklogErr instanceof Error ? productBacklogErr.message : 'Product backlog creation failed'
    }

    try {
      const { autoSyncIssuesToJira, getIssueIdsFromScan } = await import('@/lib/jira-sync-service')
      const issueIds = await getIssueIdsFromScan(scanHistoryId)
      if (issueIds.length > 0) {
        await autoSyncIssuesToJira(user.userId, issueIds)
      }
    } catch (jiraError) {
      console.error('Extension scan: Jira sync error', jiraError)
    }

    const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || request.nextUrl.origin
    const reportUrl = `${origin}/scan-history/${scanHistoryId}`

    return NextResponse.json(
      {
        success: true,
        scanHistoryId,
        reportUrl,
        remediationReport,
        // Backwards/forwards compatible payload:
        // - extension UI expects `backlogAdded` as a number
        // - and `backlogAddedDetail` as an object
        backlogAdded: backlogAdded.added,
        backlogAddedDetail: {
          added: backlogAdded.added,
          reopened: backlogAdded.reopened,
          skipped: backlogAdded.skipped
        },
        ...(backlogError && { backlogError })
      },
      { status: 200, headers }
    )
  } catch (error) {
    if (error instanceof Error && error.message === 'Authentication required') {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401, headers }
      )
    }
    console.error('Extension scan API error:', error)
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500, headers }
    )
  }
}
