import { NextRequest, NextResponse } from 'next/server'
import { ScanService, ScanOptions } from '@/lib/scan-service'

export async function POST(request: NextRequest) {
  try {
    const { url, pagesToScan, includeSubdomains, scanType, wcagLevel, selectedTags } = await request.json()

    console.log('Scan API received:', { url, pagesToScan, pagesToScanLength: pagesToScan?.length })

    if (!url || !pagesToScan || pagesToScan.length === 0) {
      return NextResponse.json({ error: 'URL and pages to scan are required' }, { status: 400 })
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

    // Normalize URLs to remove fragments and duplicates
    const normalizedUrls = pagesToScan.map((url: string) => {
      try {
        const urlObj = new URL(url);
        // Remove fragments (#content, #section, etc.) and normalize
        urlObj.hash = '';
        return urlObj.href;
      } catch {
        return url;
      }
    }).filter((url: string, index: number, arr: string[]) => arr.indexOf(url) === index); // Remove duplicates

    console.log(`🔍 Normalized ${pagesToScan.length} URLs to ${normalizedUrls.length} unique pages`);

    // Scan each unique page individually
    const results: any[] = []
    
    for (let i = 0; i < normalizedUrls.length; i++) {
      const pageUrl = normalizedUrls[i]
      
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
          console.log(`Scan Progress for ${pageUrl}: ${progress.status} - ${progress.message}`)
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

    // Create a proper remediation report structure with smart deduplication
    const issueMap = new Map<string, any>();
    
    results.forEach(result => {
      result.issues?.forEach((issue: any) => {
        const issueKey = `${issue.id}-${issue.impact}`;
        
        if (issueMap.has(issueKey)) {
          // Merge with existing issue
          const existingIssue = issueMap.get(issueKey);
          existingIssue.totalOccurrences += issue.nodes.length;
          existingIssue.affectedUrls.push(result.url);
          existingIssue.offendingElements.push(...issue.nodes.map((node: any) => ({
            html: node.html,
            target: node.target,
            failureSummary: node.failureSummary,
            impact: node.impact,
            url: result.url
          })));
        } else {
          // Create new issue entry
          issueMap.set(issueKey, {
            issueId: issue.id,
            ruleName: issue.description,
            description: issue.description,
            impact: issue.impact,
            wcag22Level: 'A', // Default, could be enhanced later
            help: issue.help,
            helpUrl: issue.helpUrl,
            totalOccurrences: issue.nodes.length,
            affectedUrls: [result.url],
            offendingElements: issue.nodes.map((node: any) => ({
              html: node.html,
              target: node.target,
              failureSummary: node.failureSummary,
              impact: node.impact,
              url: result.url
            })),
            suggestions: (issue as any).suggestions || [{
              type: 'fix' as const,
              description: issue.help,
              priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
            }],
            priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
          });
        }
      });
    });

    const remediationReport = Array.from(issueMap.values());

    console.log(`🎉 Web scan completed with ${remediationReport.length} AI-enhanced reports`);

    return NextResponse.json({
      url,
      pagesScanned: results.length,
      results,
      complianceSummary,
      remediationReport
    })

  } catch (error) {
    console.error('Scan failed:', error)
    return NextResponse.json(
      { error: 'Scan failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
