import { NextRequest, NextResponse } from 'next/server'
import { ScanService, ScanOptions } from '@/lib/scan-service'

export async function POST(request: NextRequest) {
  try {
    const { url, includeSubdomains, deepCrawl, maxPages } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Create scan options for discovery only
    // Enforce maximum of 200 pages for web crawling (free service)
    const requestedMaxPages = maxPages ?? 50
    const enforcedMaxPages = Math.min(requestedMaxPages, 200)
    
    const scanOptions: ScanOptions = {
      url,
      includeSubdomains: includeSubdomains ?? true,
      deepCrawl: deepCrawl ?? true,  // Default to true for page discovery
      maxPages: enforcedMaxPages,
      scanType: 'discover',
      wcagLevel: 'AA',
      selectedTags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
    }

    // Initialize the scan service
    const scanService = new ScanService()

    // Discover pages only (no scanning)
    const discoveredUrls = await scanService.discoverPages(scanOptions, (progress) => {
    })

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

    return NextResponse.json({
      url,
      discoveredPages: categorizedPages,
      totalPages: categorizedPages.length
    })

  } catch (error) {
    console.error('Page discovery failed:', error)
    return NextResponse.json(
      { error: 'Page discovery failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

