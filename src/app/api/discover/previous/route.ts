import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'

// GET /api/discover/previous - Get previous discovered pages for a URL
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Normalize URL (remove trailing slash, etc.)
    let normalizedUrl = url.trim().replace(/\/$/, '')
    // Also try with https:// prefix if not present
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`
    }

    // Find the most recent scan history for this URL that has discovered pages
    // Try exact match first, then try without protocol
    const baseUrl = normalizedUrl.replace(/^https?:\/\//, '')
    
    let scanHistory = await queryOne(`
      SELECT 
        id,
        url,
        scan_settings,
        created_at,
        pages_scanned
      FROM scan_history
      WHERE user_id = $1
        AND scan_type = 'web'
        AND (url = $2 OR url = $3 OR url LIKE $4)
        AND (
          scan_settings IS NOT NULL 
          OR pages_scanned IS NOT NULL
        )
      ORDER BY created_at DESC
      LIMIT 1
    `, [user.userId, normalizedUrl, baseUrl, `%${baseUrl}%`])
    
    // If not found, try looking for any scan with this domain
    if (!scanHistory) {
      scanHistory = await queryOne(`
        SELECT 
          id,
          url,
          scan_settings,
          created_at,
          pages_scanned
        FROM scan_history
        WHERE user_id = $1
          AND scan_type = 'web'
          AND scan_title LIKE 'Page Discovery:%'
          AND (
            scan_settings IS NOT NULL 
            OR pages_scanned IS NOT NULL
          )
        ORDER BY created_at DESC
        LIMIT 1
      `, [user.userId])
    }

    if (!scanHistory) {
      return NextResponse.json({
        success: false,
        message: 'No previous discovery found for this URL'
      })
    }

    // Try to extract discovered pages from scan_settings
    let discoveredPages: any[] = []
    
    if (scanHistory.scan_settings) {
      try {
        const settings = typeof scanHistory.scan_settings === 'string' 
          ? JSON.parse(scanHistory.scan_settings) 
          : scanHistory.scan_settings
        
        // Check if discoveredPages exists (preferred) or pagesToScan
        const pagesToConvert = settings.discoveredPages || settings.pagesToScan
        
        if (pagesToConvert && Array.isArray(pagesToConvert)) {
          // If it's already in discovered pages format, use it directly
          if (pagesToConvert[0] && typeof pagesToConvert[0] === 'object' && pagesToConvert[0].url) {
            discoveredPages = pagesToConvert
          } else {
            // Convert URLs to discovered pages format
            discoveredPages = pagesToConvert.map((pageUrl: string) => {
            const path = new URL(pageUrl).pathname.toLowerCase()
            let category: 'home' | 'content' | 'forms' | 'blog' | 'legal' | 'other' = 'other'
            let priority: 'high' | 'medium' | 'low' = 'medium'

            // Categorize based on URL patterns
            if (path === '/' || path === '/home' || path === '/index') {
              category = 'home'
              priority = 'high'
            } else if (path.includes('/blog') || path.includes('/news') || path.includes('/article')) {
              category = 'blog'
              priority = 'medium'
            } else if (path.includes('/contact') || path.includes('/form') || path.includes('/signup') || path.includes('/login')) {
              category = 'forms'
              priority = 'high'
            } else if (path.includes('/privacy') || path.includes('/terms') || path.includes('/legal') || path.includes('/policy')) {
              category = 'legal'
              priority = 'low'
            } else if (path.includes('/about') || path.includes('/services') || path.includes('/products') || path.includes('/help')) {
              category = 'content'
              priority = 'medium'
            }

              return {
                url: pageUrl,
                title: path === '/' ? 'Homepage' : path.split('/').pop()?.replace(/-/g, ' ') || 'Page',
                category,
                priority
              }
            })
          }
        }
      } catch (error) {
        console.error('Error parsing scan_settings:', error)
      }
    }

    if (discoveredPages.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No discovered pages found in previous scan'
      })
    }

    return NextResponse.json({
      success: true,
      discoveredPages,
      totalPages: discoveredPages.length,
      scanDate: scanHistory.created_at,
      scanId: scanHistory.id
    })

  } catch (error) {
    console.error('Error fetching previous discovery:', error)
    return NextResponse.json(
      { error: 'Failed to fetch previous discovery', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

