import { NextRequest, NextResponse } from 'next/server'
import { getLaunchOptionsForServerAsync } from '@/lib/puppeteer-config'

// Lazy load puppeteer based on platform (ESM-compatible)
let puppeteer: any = null;
async function getPuppeteer() {
  if (!puppeteer) {
    if (process.platform === 'linux') {
      puppeteer = await import('puppeteer-core');
    } else {
      puppeteer = await import('puppeteer');
    }
  }
  return puppeteer.default || puppeteer;
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
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

    // Launch browser and scan the homepage directly (uses system Chromium on Railway/Linux or @sparticuz/chromium)
    const puppeteerModule = await getPuppeteer();
    const browser = await puppeteerModule.launch(await getLaunchOptionsForServerAsync({
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
    }))

    try {
      const page = await browser.newPage()
      // Avoid "Requesting main frame too early!" in Docker/Railway
      await new Promise((r) => setTimeout(r, 800))

      // Set user agent to avoid blocking
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
      
      // Navigate to the URL with fallback for www/non-www
      let finalUrl = normalizedUrl
      try {
        await page.goto(normalizedUrl, { 
          waitUntil: 'domcontentloaded',
          timeout: 30000 
        })
        finalUrl = page.url() // Use the actual URL after navigation (handles redirects)
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
          await page.goto(alternativeUrl, { 
            waitUntil: 'domcontentloaded',
            timeout: 30000 
          })
          finalUrl = page.url()
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
      await page.waitForFunction(() => typeof (window as any).axe !== 'undefined', { timeout: 10000 })

      // Run basic accessibility scan
      const results = await page.evaluate(async () => {
        const axe = (window as any).axe
        
        // Run axe-core analysis
        const results = await axe.run({
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
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
      
      try {
        // Take a full page screenshot (optimized)
        const fullPageScreenshot = await page.screenshot({
          fullPage: true,
          encoding: 'base64',
          quality: 80,
          type: 'jpeg'
        }) as string

        // Take a viewport screenshot (optimized)
        const viewportScreenshot = await page.screenshot({
          fullPage: false,
          encoding: 'base64',
          quality: 80,
          type: 'jpeg'
        }) as string

        // Capture screenshots of elements with issues
        const elementScreenshots = []
        for (const violation of results.violations.slice(0, 5)) {
          for (const node of violation.nodes || []) {
            const selector = node.target?.[0]
            if (selector) {
              try {
                // Try to find and screenshot the element
                const element = await page.$(selector)
                if (element) {
                  const elementScreenshot = await element.screenshot({
                    encoding: 'base64',
                    quality: 80,
                    type: 'jpeg'
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

        // For free scans, keep screenshots as base64 data URLs for immediate display
        screenshots = {
          fullPage: fullPageScreenshot ? `data:image/jpeg;base64,${fullPageScreenshot}` : null,
          viewport: viewportScreenshot ? `data:image/jpeg;base64,${viewportScreenshot}` : null,
          elements: elementScreenshots.map((element) => ({
            ...element,
            screenshot: `data:image/jpeg;base64,${element.screenshot}`
          }))
        }

      } catch (screenshotError) {
        console.warn('Failed to capture screenshots:', screenshotError)
        // Continue without screenshots
      }

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
        topIssues: results.violations.slice(0, 10).map((violation: any) => ({
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
        screenshots: screenshots || {
          fullPage: null,
          viewport: null,
          elements: []
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
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Scan failed. Please check the URL and try again.' 
      },
      { status: 500 }
    )
  }
}
