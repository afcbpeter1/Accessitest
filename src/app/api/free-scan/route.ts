import { NextRequest, NextResponse } from 'next/server'
import puppeteer from 'puppeteer'
import { query } from '@/lib/database'
import { VPNDetector } from '@/lib/vpn-detector'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Get client IP address
    const clientIP = request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'

    // Check for VPN/Proxy usage
    const vpnDetector = VPNDetector.getInstance()
    const vpnResult = await vpnDetector.checkVPN(clientIP, {
      logToDatabase: true,
      actionType: 'free_scan'
    })
    
    if (vpnDetector.shouldBlockIP(vpnResult)) {
      return NextResponse.json(
        { success: false, error: `${vpnDetector.getBlockReason(vpnResult)}. Please disable VPN/proxy to continue.` },
        { status: 403 }
      )
    }

    // Check for recent free scans from same IP (max 5 per hour)
    const recentScans = await query(
      `SELECT COUNT(*) as count FROM free_scan_usage 
       WHERE ip_address = $1 AND scanned_at > NOW() - INTERVAL '1 hour'`,
      [clientIP]
    )

    if (recentScans.rows[0].count >= 5) {
      return NextResponse.json(
        { success: false, error: 'Too many free scans from this location. Please try again later or sign up for unlimited access.' },
        { status: 429 }
      )
    }

    // Normalize URL - add https:// if no protocol is provided
    let normalizedUrl = url.trim()
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = 'https://' + normalizedUrl
    }

    // Validate URL format
    try {
      new URL(normalizedUrl)
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid URL format' },
        { status: 400 }
      )
    }

    // Launch browser and scan the homepage directly
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox', 
        '--disable-setuid-sandbox',
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--disable-dev-shm-usage',
        '--no-first-run',
        '--no-zygote',
        '--single-process'
      ]
    })

    try {
      const page = await browser.newPage()
      
      // Set user agent to avoid blocking
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
      
      // Navigate to the URL with fallback for www/non-www
      let finalUrl = normalizedUrl
      try {
        console.log(`Attempting to navigate to: ${normalizedUrl}`)
        await page.goto(normalizedUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        })
        console.log(`Successfully navigated to: ${normalizedUrl}`)
        finalUrl = normalizedUrl
      } catch (navigationError) {
        console.error('Navigation error:', navigationError)
        
        // Try alternative URL (www vs non-www)
        let alternativeUrl = normalizedUrl
        if (normalizedUrl.includes('www.')) {
          alternativeUrl = normalizedUrl.replace('www.', '')
        } else {
          alternativeUrl = normalizedUrl.replace('://', '://www.')
        }
        
        try {
          console.log(`Trying alternative URL: ${alternativeUrl}`)
          await page.goto(alternativeUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          })
          console.log(`Successfully navigated to: ${alternativeUrl}`)
          finalUrl = alternativeUrl
        } catch (alternativeError) {
          console.error('Alternative navigation error:', alternativeError)
          return NextResponse.json(
            { success: false, error: `Cannot access ${normalizedUrl} or ${alternativeUrl}. Please check the URL is correct and the website is online.` },
            { status: 400 }
          )
        }
      }

      // Load axe-core into the page
      await page.addScriptTag({
        url: 'https://unpkg.com/axe-core@4.8.2/axe.min.js'
      })

      // Wait for axe to be available
      await page.waitForFunction(() => typeof window.axe !== 'undefined')

      // Run basic accessibility scan
      const results = await page.evaluate(async () => {
        const axe = (window as any).axe
        
        // Run axe-core analysis
        const results = await axe.run({
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag22a', 'wcag22aa']
          }
        })

        return {
          violations: results.violations || [],
          passes: results.passes || []
        }
      })

      // Count issues by severity
      const criticalIssues = results.violations.filter((v: any) => v.impact === 'critical').length
      const seriousIssues = results.violations.filter((v: any) => v.impact === 'serious').length
      const moderateIssues = results.violations.filter((v: any) => v.impact === 'moderate').length
      const minorIssues = results.violations.filter((v: any) => v.impact === 'minor').length
      const totalIssues = results.violations.length

      // Capture basic screenshots and HTML source using the existing page instance
      let screenshots = null
      let htmlSource = null
      let elementScreenshots = null
      
      try {
        // Take a full page screenshot
        const fullPageScreenshot = await page.screenshot({
          fullPage: true,
          encoding: 'base64'
        }) as string

        // Take a viewport screenshot
        const viewportScreenshot = await page.screenshot({
          fullPage: false,
          encoding: 'base64'
        }) as string

        // Get the HTML source code
        htmlSource = await page.content()

        // Capture screenshots of elements with issues
        elementScreenshots = []
        for (const violation of results.violations.slice(0, 5)) {
          for (const node of violation.nodes || []) {
            const selector = node.target?.[0]
            if (selector) {
              try {
                // Try to find and screenshot the element
                const element = await page.$(selector)
                if (element) {
                  const elementScreenshot = await element.screenshot({
                    encoding: 'base64'
                  }) as string
                  
                  elementScreenshots.push({
                    selector,
                    issueId: violation.id,
                    severity: violation.impact,
                    screenshot: elementScreenshot,
                    boundingBox: await element.boundingBox()
                  })
                }
              } catch (elementError) {
                console.warn(`Failed to screenshot element ${selector}:`, elementError)
              }
            }
          }
        }

        screenshots = {
          fullPage: fullPageScreenshot,
          viewport: viewportScreenshot,
          elements: elementScreenshots
        }
      } catch (screenshotError) {
        console.warn('Failed to capture screenshots or HTML:', screenshotError)
        // Continue without screenshots
      }

      // Code analysis is not available for free scans - requires paid subscription

      // Log the free scan usage
      await query(
        `INSERT INTO free_scan_usage (ip_address, url_scanned)
         VALUES ($1, $2)`,
        [clientIP, finalUrl]
      )

      // Return limited results (no AI enhancements, basic issue info)
      return NextResponse.json({
        success: true,
        url: finalUrl,
        scanDate: new Date().toISOString(),
        summary: {
          totalIssues,
          criticalIssues,
          seriousIssues,
          moderateIssues,
          minorIssues
        },
        topIssues: results.violations.slice(0, 5).map((violation: any) => ({
          id: violation.id,
          type: violation.id,
          severity: violation.impact,
          title: violation.description,
          description: violation.help,
          helpUrl: violation.helpUrl,
          tags: violation.tags,
          nodes: violation.nodes?.length || 0,
          page: finalUrl
        })),
        screenshots: {
          fullPage: screenshots?.fullPage || null,
          viewport: screenshots?.viewport || null,
          elements: screenshots?.elements || []
        },
        requiresSignup: true,
        message: 'Sign up to see detailed recommendations and remediation steps'
      })

    } finally {
      await browser.close()
    }

  } catch (error) {
    console.error('Free scan error:', error)
    return NextResponse.json(
      { success: false, error: 'Scan failed. Please check the URL and try again.' },
      { status: 500 }
    )
  }
}
