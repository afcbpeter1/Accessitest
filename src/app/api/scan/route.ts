import { NextRequest, NextResponse } from 'next/server'
import { ScanService, ScanOptions } from '@/lib/scan-service'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query } from '@/lib/database'
import { getUserCredits, deductCredits } from '@/lib/credit-service'
import { NotificationService } from '@/lib/notification-service'
import { ScanToIssuesIntegration } from '@/lib/scan-to-issues-integration'

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)
    
    const { url, pagesToScan, includeSubdomains, scanType, wcagLevel, selectedTags } = await request.json()

    if (!url || !pagesToScan || pagesToScan.length === 0) {
      return NextResponse.json({ error: 'URL and pages to scan are required' }, { status: 400 })
    }

    const scanId = `web_scan_${Date.now()}`

    // Check and deduct credits (organization credits - same as top bar and document scan)
    const creditInfo = await getUserCredits(user.userId)
    if (!creditInfo.unlimited_credits && creditInfo.credits_remaining < 1) {
      await NotificationService.notifyInsufficientCredits(user.userId)
      return NextResponse.json(
        { error: 'Insufficient credits', canScan: false },
        { status: 402 }
      )
    }

    const deductResult = await deductCredits(user.userId, 1, `Web scan: ${url}`, scanId)
    if (!deductResult.success) {
      await NotificationService.notifyInsufficientCredits(user.userId)
      return NextResponse.json(
        { error: deductResult.error ?? 'Insufficient credits', canScan: false },
        { status: 402 }
      )
    }

    if (deductResult.credits_remaining <= 1 && deductResult.credits_remaining > 0) {
      await NotificationService.notifyLowCredits(user.userId, deductResult.credits_remaining)
    }

    // Create scan options
    const scanOptions: ScanOptions = {
      url,
      includeSubdomains: includeSubdomains ?? true,
      deepCrawl: false, // We're scanning specific pages, not crawling
      maxPages: pagesToScan.length,
      scanType: 'full'
    }

    // Initialize the scan service
    const scanService = new ScanService()

    // Scan each selected page individually
    const results: any[] = []
    
    for (let i = 0; i < pagesToScan.length; i++) {
      const pageUrl = pagesToScan[i]
      
      // Create scan options for this specific page
      const pageScanOptions: ScanOptions = {
        url: pageUrl,
        includeSubdomains: includeSubdomains ?? true,
        deepCrawl: false,
        maxPages: 1,
        scanType: 'full'
      }
      
      try {
        const pageResults = await scanService.startScan(pageScanOptions, (progress) => {

        })
        results.push(...pageResults)
      } catch (error) {
        console.error(`Failed to scan ${pageUrl}:`, error)
        // Continue with other pages
      }
    }

    // Calculate compliance summary
    const complianceSummary = {
      totalIssues: results.reduce((sum: number, result: any) => sum + (result.summary?.total || 0), 0),
      criticalIssues: results.reduce((sum: number, result: any) => sum + (result.summary?.critical || 0), 0),
      seriousIssues: results.reduce((sum: number, result: any) => sum + (result.summary?.serious || 0), 0),
      moderateIssues: results.reduce((sum: number, result: any) => sum + (result.summary?.moderate || 0), 0),
      minorIssues: results.reduce((sum: number, result: any) => sum + (result.summary?.minor || 0), 0),
      pagesScanned: results.length
    }

    // Process AI suggestions into remediation report format
    const remediationReport = []
    for (const result of results) {
      if (result.issues && result.issues.length > 0) {
        for (const issue of result.issues) {
          // Check if this issue has AI suggestions
          if (issue.suggestions && issue.suggestions.length > 0) {
            // Transform the issue into DetailedReport format
            const report = {
              issueId: issue.id,
              ruleName: issue.description || issue.id,
              description: issue.description || 'Accessibility issue detected',
              impact: issue.impact || 'moderate',
              wcag22Level: 'A', // Default to A, could be enhanced to detect actual level
              help: issue.help || 'Please review and fix this accessibility issue',
              helpUrl: issue.helpUrl || 'https://www.w3.org/WAI/WCAG21/quickref/',
              totalOccurrences: issue.nodes?.length || 1,
              affectedUrls: [result.url],
              offendingElements: issue.nodes?.map((node: any) => ({
                html: node.html || `<${node.target?.[0] || 'element'}>`,
                target: node.target || [],
                failureSummary: node.failureSummary || issue.description,
                impact: issue.impact || 'moderate',
                url: result.url,
                screenshot: node.screenshot,
                boundingBox: node.boundingBox
              })) || [],
              suggestions: issue.suggestions.map((suggestion: any) => ({
                type: 'fix',
                description: suggestion.description || suggestion.text || 'AI-generated accessibility fix',
                codeExample: suggestion.codeExample || suggestion.code || '',
                priority: suggestion.priority || 'medium'
              })),
              priority: issue.priority || 'medium',
              screenshots: result.screenshots || null
            }
            remediationReport.push(report)
          }
        }
      }
    }

    // Integrate with issues board
    let issuesBoardIntegration = null
    try {
      issuesBoardIntegration = await ScanToIssuesIntegration.processScanResults(scanId, {
        results,
        complianceSummary,
        remediationReport
      })

    } catch (error) {
      console.error('Issues board integration failed:', error)
      // Don't fail the scan if issues board integration fails
    }

    return NextResponse.json({
      url,
      pagesScanned: results.length,
      results,
      complianceSummary,
      remediationReport,
      issuesBoardIntegration
    })

  } catch (error) {
    console.error('Scan failed:', error)
    return NextResponse.json(
      { error: 'Scan failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
