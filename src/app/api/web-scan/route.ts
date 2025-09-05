import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory database for web scan history
const webScanDatabase = new Map<string, any>()

export async function GET() {
  try {
    // Get all web scans
    const scans = Array.from(webScanDatabase.values())
    return NextResponse.json({ scans })
  } catch (error) {
    console.error('Failed to get web scan history:', error)
    return NextResponse.json({ scans: [] })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scanId, url, scanResults, wcag22Compliance, scanDuration, pagesAnalyzed } = body

    // Save web scan to database
    const scanRecord = {
      id: scanId,
      type: 'web',
      url,
      scanDate: new Date().toISOString(),
      status: 'completed',
      wcag22Compliance,
      scanResults,
      scanDuration,
      pagesAnalyzed,
      scanId
    }

    webScanDatabase.set(scanId, scanRecord)

    return NextResponse.json({ success: true, scanId })
  } catch (error) {
    console.error('Failed to save web scan:', error)
    return NextResponse.json({ error: 'Failed to save web scan' }, { status: 500 })
  }
}
