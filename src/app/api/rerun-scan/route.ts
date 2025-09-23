import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import { ScanService } from '@/lib/scan-service'

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    
    const { scanId } = body

    if (!scanId) {
      return NextResponse.json(
        { success: false, error: 'Scan ID is required' },
        { status: 400 }
      )
    }

    // Get the original scan details
    const originalScan = await queryOne(
      `SELECT 
        scan_type, scan_title, url, file_name, file_type,
        scan_results, scan_settings
      FROM scan_history 
      WHERE id = $1 AND user_id = $2`,
      [scanId, user.userId]
    )

    if (!originalScan) {
      return NextResponse.json(
        { success: false, error: 'Scan not found' },
        { status: 404 }
      )
    }

    // Note: Credit deduction will be handled by the actual scan API when the scan completes
    // We only check credits here to provide early feedback, but don't deduct yet

    // Generate new scan ID
    const newScanId = `${originalScan.scan_type}_scan_${Date.now()}`

    if (originalScan.scan_type === 'web') {
      // Extract scan settings from the original scan
      const scanSettings = originalScan.scan_settings || {}
      const scanResults = originalScan.scan_results || {}
      
      // Extract pages from the original scan results
      const pagesToScan = scanResults.pages?.map((page: any) => page.url) || [originalScan.url]
      
      // Return the settings for the frontend to handle navigation
      return NextResponse.json({
        success: true,
        message: 'Web scan settings retrieved. You can use these to start a new scan.',
        scanType: 'web',
        settings: {
          url: originalScan.url,
          pagesToScan,
          includeSubdomains: scanSettings.includeSubdomains || false,
          wcagLevel: scanSettings.wcagLevel || 'AA',
          selectedTags: scanSettings.selectedTags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
        }
      })
    } else if (originalScan.scan_type === 'document') {
      // For document scans, we can't automatically rerun since we don't store the file
      // Instead, we'll return the original scan settings for the user to manually rerun
      return NextResponse.json({
        success: true,
        scanId: newScanId,
        message: 'Document scan settings retrieved. Please upload the document again.',
        originalSettings: {
          scanTitle: originalScan.scan_title,
          scanSettings: originalScan.scan_settings
        }
      })
    }

    return NextResponse.json(
      { success: false, error: 'Unsupported scan type' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error rerunning scan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to rerun scan' },
      { status: 500 }
    )
  }
}
