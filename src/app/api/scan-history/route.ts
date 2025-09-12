import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { ScanHistoryService } from '@/lib/scan-history-service'

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Scan history API called')
    const user = await getAuthenticatedUser(request)
    console.log('✅ User authenticated:', user.email)
    
    const url = new URL(request.url)
    const limit = parseInt(url.searchParams.get('limit') || '50')
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
      // Get scan history list
      console.log('📋 Fetching scan history for user:', user.userId)
      const scanHistory = await ScanHistoryService.getScanHistory(user.userId, limit)
      console.log('✅ Found', scanHistory.length, 'scans in history')
      
      return NextResponse.json({
        success: true,
        scans: scanHistory
      })
    }
  } catch (error) {
    console.error('Error fetching scan history:', error)
    
    // Provide more specific error messages
    let errorMessage = 'Failed to fetch scan history'
    let statusCode = 500
    
    if (error.message?.includes('Authentication required')) {
      errorMessage = 'Authentication required'
      statusCode = 401
    } else if (error.message?.includes('relation "scan_history" does not exist')) {
      errorMessage = 'Scan history table not found. Please contact support.'
      statusCode = 500
    } else if (error.message?.includes('connection')) {
      errorMessage = 'Database connection error. Please try again.'
      statusCode = 503
    }
    
    return NextResponse.json(
      { success: false, error: errorMessage, details: error.message },
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
