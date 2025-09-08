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

    return NextResponse.json({
      url,
      pagesScanned: results.length,
      results,
      complianceSummary,
      remediationReport: [] // Will be populated with AI suggestions later
    })

  } catch (error) {
    console.error('Scan failed:', error)
    return NextResponse.json(
      { error: 'Scan failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
