import { NextRequest, NextResponse } from 'next/server'
import { ScanService, ScanOptions } from '@/lib/scan-service'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'

// Store active discovery sessions
const activeDiscoveries = new Map<string, ScanService>()

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request).catch(() => null) // Optional auth for discovery
    const { url, includeSubdomains, deepCrawl, maxPages, discoveryId, saveDiscovery } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Create scan options for discovery only
    // Default to 100 pages (will be deduplicated to remove template duplicates)
    // Max 200 for large sites
    const requestedMaxPages = maxPages ?? 100
    const enforcedMaxPages = Math.min(requestedMaxPages, 200)
    
    const scanOptions: ScanOptions = {
      url,
      includeSubdomains: includeSubdomains ?? true,
      deepCrawl: deepCrawl ?? true,  // Default to true for page discovery
      maxPages: enforcedMaxPages,
      scanType: 'full',
      selectedTags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
    }

    // Initialize the scan service
    const scanService = new ScanService()
    const id = discoveryId || `discovery-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    // Store active discovery
    activeDiscoveries.set(id, scanService)

    try {
      // Discover pages only (no scanning)
      const discoveredUrls = await scanService.discoverPages(scanOptions, (progress) => {
        console.log(`Discovery Progress: ${progress.status} - ${progress.message}`)
      }, id)

      // Categorize discovered pages
      const categorizedPages = discoveredUrls.map(url => {
      const path = new URL(url).pathname.toLowerCase()
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
        url,
        title: path === '/' ? 'Homepage' : path.split('/').pop()?.replace(/-/g, ' ') || 'Page',
        category,
        priority
      }
    })

      // Save discovered pages to scan_history if user is authenticated and saveDiscovery is true
      if (user && saveDiscovery !== false) {
        try {
          // Check if a discovery record already exists for this URL
          const existing = await queryOne(`
            SELECT id FROM scan_history
            WHERE user_id = $1
              AND url = $2
              AND scan_type = 'web'
              AND scan_title LIKE 'Page Discovery:%'
            ORDER BY created_at DESC
            LIMIT 1
          `, [user.userId, url])

          const scanSettings = JSON.stringify({
            pagesToScan: discoveredUrls,
            includeSubdomains,
            deepCrawl,
            maxPages: enforcedMaxPages,
            discoveredPages: categorizedPages
          })

          if (existing) {
            // Update existing record
            await queryOne(`
              UPDATE scan_history
              SET scan_settings = $1,
                  pages_scanned = $2,
                  updated_at = NOW()
              WHERE id = $3
            `, [scanSettings, categorizedPages.length, existing.id])
          } else {
            // Insert new record (discovery has no accessibility results yet; scan_results NOT NULL so use empty object)
            await queryOne(`
              INSERT INTO scan_history (
                user_id, scan_type, scan_title, url,
                scan_results, scan_settings, pages_scanned, created_at, updated_at
              ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, NOW(), NOW())
            `, [
              user.userId,
              'web',
              `Page Discovery: ${url}`,
              url,
              '{}',
              scanSettings,
              categorizedPages.length
            ])
          }
        } catch (error) {
          console.error('Failed to save discovered pages:', error)
          // Don't fail the discovery if saving fails
        }
      }

      return NextResponse.json({
        url,
        discoveredPages: categorizedPages,
        totalPages: categorizedPages.length,
        discoveryId: id
      })
    } finally {
      // Clean up
      activeDiscoveries.delete(id)
    }

  } catch (error) {
    console.error('Page discovery failed:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check if it was cancelled
    if (errorMessage.includes('cancelled')) {
      return NextResponse.json(
        { error: 'Discovery cancelled', cancelled: true },
        { status: 200 } // Return 200 so frontend can handle gracefully
      )
    }
    
    return NextResponse.json(
      { error: 'Page discovery failed', details: errorMessage },
      { status: 500 }
    )
  }
}

// DELETE /api/discover - Cancel an active discovery
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const discoveryId = searchParams.get('id')

    if (!discoveryId) {
      return NextResponse.json({ error: 'Discovery ID required' }, { status: 400 })
    }

    const scanService = activeDiscoveries.get(discoveryId)
    if (scanService) {
      scanService.cancelDiscovery(discoveryId)
      return NextResponse.json({ success: true, message: 'Discovery cancelled' })
    }

    return NextResponse.json({ error: 'Discovery not found or already completed' }, { status: 404 })
  } catch (error) {
    console.error('Error cancelling discovery:', error)
    return NextResponse.json(
      { error: 'Failed to cancel discovery' },
      { status: 500 }
    )
  }
}

