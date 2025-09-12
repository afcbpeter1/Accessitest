import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { ScanStateService } from '@/lib/scan-state-service'

// Get active scans for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const activeScans = await ScanStateService.getActiveScans(user.userId)

    return NextResponse.json({
      success: true,
      scans: activeScans
    })
  } catch (error) {
    console.error('Error fetching active scans:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch active scans' },
      { status: 401 }
    )
  }
}

// Cancel a specific scan
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const scanId = searchParams.get('scanId')

    if (!scanId) {
      return NextResponse.json(
        { success: false, error: 'Scan ID is required' },
        { status: 400 }
      )
    }

    // Verify the scan belongs to the user
    const scan = await ScanStateService.getScan(scanId)
    if (!scan || scan.userId !== user.userId) {
      return NextResponse.json(
        { success: false, error: 'Scan not found or access denied' },
        { status: 404 }
      )
    }

    // Mark scan as cancelled
    await ScanStateService.markCancelled(scanId)

    return NextResponse.json({
      success: true,
      message: 'Scan cancelled successfully'
    })
  } catch (error) {
    console.error('Error cancelling scan:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel scan' },
      { status: 401 }
    )
  }
}
