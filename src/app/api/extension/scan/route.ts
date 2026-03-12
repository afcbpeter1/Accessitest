import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { ScanHistoryService } from '@/lib/scan-history-service'
import { getUserCredits, deductCredits } from '@/lib/credit-service'
import { NotificationService } from '@/lib/notification-service'
import { autoCreateBacklogItemsWithHistoryId } from '@/lib/backlog-from-scan'
import { AccessibilityScanner } from '@/lib/accessibility-scanner'
import type { AccessibilityIssue } from '@/lib/accessibility-scanner'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization'
}

function isValidUrl(s: string): boolean {
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
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
    const { url, issues = [], summary = {} } = body

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

    const creditData = await getUserCredits(user.userId)
    if (!creditData.unlimited_credits && creditData.credits_remaining < 1) {
      await NotificationService.notifyInsufficientCredits(user.userId)
      return NextResponse.json(
        { success: false, error: 'Insufficient credits', canScan: false },
        { status: 402, headers }
      )
    }
    const scanId = `extension_scan_${Date.now()}`
    await deductCredits(user.userId, 1, `Extension scan: ${url}`, scanId)

    // Normalize issues to AccessibilityIssue shape and generate suggestions (AI or rule-based)
    const scanner = new AccessibilityScanner()
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

    for (let i = 0; i < normalizedIssues.length; i++) {
      try {
        const suggestions = await scanner.generateRemediationSuggestions(normalizedIssues[i])
        if (suggestions.length > 0) {
          (normalizedIssues[i] as any).suggestions = suggestions
        }
        if (i < normalizedIssues.length - 1) {
          await new Promise((r) => setTimeout(r, 500))
        }
      } catch (err) {
        console.error('Extension scan: suggestion generation failed for', normalizedIssues[i].id, err)
      }
    }

    const remediationReport: any[] = []
    for (const issue of normalizedIssues) {
      const sugg = (issue as any).suggestions
      if (sugg && Array.isArray(sugg) && sugg.length > 0) {
        remediationReport.push({
          issueId: issue.id,
          ruleName: issue.description || issue.id,
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

    const finalResults = {
      url,
      pagesScanned: 1,
      results,
      complianceSummary,
      remediationReport
    }

    const scanHistoryId = await ScanHistoryService.storeScanResult(user.userId, 'web', {
      scanTitle: `Extension: ${url}`,
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
      scanSettings: { source: 'extension' }
    })

    let backlogAdded = { added: 0, reopened: 0, skipped: 0 }
    let backlogError: string | null = null
    try {
      backlogAdded = await autoCreateBacklogItemsWithHistoryId(user.userId, results, scanHistoryId)
    } catch (backlogErr) {
      console.error('Extension scan: backlog creation error', backlogErr)
      backlogError = backlogErr instanceof Error ? backlogErr.message : 'Backlog creation failed'
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
        backlogAdded: {
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
