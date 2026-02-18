import { NextRequest, NextResponse } from 'next/server'
import { ScanService, ScanOptions } from '@/lib/scan-service'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Create scan options for a free single-page scan
    const scanOptions: ScanOptions = {
      url,
      includeSubdomains: false,
      deepCrawl: false,
      maxPages: 1, // Free scan only scans the single page
      scanType: 'quick',
      selectedTags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
    }

    // Initialize the scan service
    const scanService = new ScanService()

    // Perform the scan
    const results = await scanService.startScan(scanOptions)

    // Calculate basic statistics
    const totalIssues = results.reduce((sum, result) => sum + (result.issues?.length || 0), 0)
    const pagesAnalyzed = results.length

    // Return results in the format expected by the frontend
    return NextResponse.json({
      success: true,
      url,
      results,
      totalIssues,
      pagesAnalyzed,
      scanType: 'free'
    })
  } catch (error) {
    console.error('Free scan error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Scan failed. Please try again.'
      },
      { status: 500 }
    )
  }
}

