import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query } from '@/lib/database'

// GET /api/discover/history - Get list of previous discoveries/scans
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '10')

    // Get previous web scans/discoveries
    const scanHistory = await query(`
      SELECT 
        id,
        url,
        scan_title,
        scan_settings,
        pages_scanned,
        created_at,
        updated_at
      FROM scan_history
      WHERE user_id = $1
        AND scan_type = 'web'
        AND (
          scan_settings IS NOT NULL 
          OR pages_scanned IS NOT NULL
        )
      ORDER BY created_at DESC
      LIMIT $2
    `, [user.userId, limit])

    const discoveries = scanHistory.rows.map(row => {
      let pageCount = row.pages_scanned || 0
      let discoveredPages: any[] = []

      // Try to extract page count and discovered pages from scan_settings
      if (row.scan_settings) {
        try {
          const settings = typeof row.scan_settings === 'string' 
            ? JSON.parse(row.scan_settings) 
            : row.scan_settings
          
          if (settings.discoveredPages && Array.isArray(settings.discoveredPages)) {
            discoveredPages = settings.discoveredPages
            pageCount = discoveredPages.length
          } else if (settings.pagesToScan && Array.isArray(settings.pagesToScan)) {
            pageCount = settings.pagesToScan.length
          }
        } catch (error) {
          console.error('Error parsing scan_settings:', error)
        }
      }

      return {
        id: row.id,
        url: row.url,
        title: row.scan_title || `Scan: ${row.url}`,
        pageCount,
        discoveredPages,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    })

    return NextResponse.json({
      success: true,
      discoveries,
      total: discoveries.length
    })

  } catch (error) {
    console.error('Error fetching discovery history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch discovery history', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


