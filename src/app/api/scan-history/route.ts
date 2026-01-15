import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { ScanHistoryService } from '@/lib/scan-history-service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '10')
    const offset = parseInt(url.searchParams.get('offset') || '0')
    const scanId = url.searchParams.get('scanId')

    if (scanId) {
      // Get specific scan details
      const scanDetails = await ScanHistoryService.getScanDetails(scanId, user.userId)
      
      if (!scanDetails) {
        return NextResponse.json(
          { success: false, error: 'Scan not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        success: true,
        scan: scanDetails
      })
    } else {
      // Get scan history list with pagination
      const { scans, total } = await ScanHistoryService.getScanHistoryPaginated(user.userId, limit, offset)
      
      return NextResponse.json({
        success: true,
        scans,
        total,
        limit,
        offset
      })
    }
  } catch (error) {
    console.error('Error fetching scan history:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to fetch scan history'
    let statusCode = 500
    const errorDetails = error instanceof Error ? error.message : String(error)
    
    if (errorDetails.includes('Authentication required')) {
      errorMessage = 'Authentication required'
      statusCode = 401
    } else if (errorDetails.includes('relation "scan_history" does not exist')) {
      errorMessage = 'Scan history table not found. Please contact support.'
      statusCode = 500
    } else if (errorDetails.includes('connection')) {
      errorMessage = 'Database connection error. Please try again.'
      statusCode = 503
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage, details: errorDetails },
      { status: statusCode }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    const deleted = await ScanHistoryService.deleteScan(scanId, user.userId)
    
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Scan not found or could not be deleted' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Scan deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting scan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete scan' },
      { status: 500 }
    )
  }
}
