import { NextRequest, NextResponse } from 'next/server'
import { ScanService, ScanOptions } from '@/lib/scan-service'

export async function POST(request: NextRequest) {
  try {
    const { url, includeSubdomains, deepCrawl, maxPages } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Normalize URL - handle www., https://, and domain names
    let normalizedUrl = url.trim()
    
    // Remove any existing protocol
    normalizedUrl = normalizedUrl.replace(/^https?:\/\//i, '')
    
    // Remove trailing slash
    normalizedUrl = normalizedUrl.replace(/\/$/, '')
    
    // Add https:// protocol
    normalizedUrl = `https://${normalizedUrl}`
    
    // Validate URL
    try {
      const urlObj = new URL(normalizedUrl)
      if (!urlObj.hostname || urlObj.hostname === '') {
        throw new Error('Invalid hostname')
      }
      normalizedUrl = urlObj.href.replace(/\/$/, '') // Remove trailing slash
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format. Please provide a valid URL (e.g., example.com, www.example.com, or https://example.com)' },
        { status: 400 }
      )
    }

    // Create scan options for discovery only
    // Enforce maximum of 200 pages for web crawling (free service)
    const requestedMaxPages = maxPages ?? 50
    const enforcedMaxPages = Math.min(requestedMaxPages, 200)
    
    const scanOptions: ScanOptions = {
      url: normalizedUrl,
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
      console.log(`Discovery Progress: ${progress.status} - ${progress.message}`)
    })

    // Categorize discovered pages
    const categorizedPages = discoveredUrls.map(url => {
      let path = '/'
      try {
        const urlObj = new URL(url)
        path = urlObj.pathname.toLowerCase()
      } catch (error) {
        console.error(`Failed to parse URL for categorization: ${url}`, error)
        path = '/'
      }
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

