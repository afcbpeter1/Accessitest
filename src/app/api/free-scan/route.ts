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
      const navFailureMessage = 'We couldn\'t reach this address. Please check the URL is correct and the site is online.'
      try {
        await page.goto(normalizedUrl, {
          waitUntil: 'domcontentloaded',
          timeout: 30000
        })
        finalUrl = page.url()
      } catch (navigationError: any) {
        console.error('Navigation error:', navigationError?.message || navigationError)
        // Try alternative URL (www vs non-www) only if it might help (e.g. DNS vs timeout)
        const alternativeUrl = normalizedUrl.includes('www.')
          ? normalizedUrl.replace('www.', '')
          : normalizedUrl.replace('://', '://www.')
        try {
          await page.goto(alternativeUrl, {
            waitUntil: 'domcontentloaded',
            timeout: 30000
          })
          finalUrl = page.url()
        } catch (alternativeError: any) {
          console.error('Alternative navigation error:', alternativeError?.message || alternativeError)
          await page.close().catch(() => {})
          return NextResponse.json(
            { success: false, error: navFailureMessage },
            { status: 400 }
          )
        }
      }

      // Detect browser error page or bot/challenge page (Cloudflare etc.)
      try {
        const pageProblem = await page.evaluate(() => {
          const u = document.location?.href || ''
          const body = document.body?.innerText || ''
          const html = document.documentElement?.innerHTML || ''
          if (u.startsWith('chrome-error:') || u.startsWith('about:')) return 'unreachable'
          if (/(can't be reached|couldn't be found|not resolve|ERR_NAME_NOT_RESOLVED|connection was reset)/i.test(body)) return 'unreachable'
          if (/(security service|verify you are not a bot|performing security verification|cloudflare|_cf_chl|checking your browser)/i.test(body + html)) return 'bot_challenge'
          return null
        })
        if (pageProblem === 'unreachable') {
          await page.close().catch(() => {})
          return NextResponse.json(
            { success: false, error: navFailureMessage },
            { status: 400 }
          )
        }
        if (pageProblem === 'bot_challenge') {
          await page.close().catch(() => {})
          return NextResponse.json(
            { success: false, error: 'This site uses bot protection (e.g. Cloudflare) and we couldn\'t access the real page. Try a different URL or run a full scan when signed in.' },
            { status: 400 }
          )
        }
      } catch (e) {
        // Execution context may be invalid; treat as unreachable
        await page.close().catch(() => {})
        return NextResponse.json(
          { success: false, error: navFailureMessage },
          { status: 400 }
        )
      }

      // Load axe-core and run scan (wrap so context-destroyed / network errors return a clean JSON error)
      try {
        await page.addScriptTag({
          url: 'https://unpkg.com/axe-core@4.8.2/axe.min.js'
        })
      } catch (scriptError: any) {
        console.error('Free scan error:', scriptError)
        await page.close().catch(() => {})
        const msg = /destroyed|target closed|Protocol error/i.test(scriptError?.message || '')
          ? navFailureMessage
          : 'We couldn\'t load the page for scanning. Please try again or check the URL.'
        return NextResponse.json(
          { success: false, error: msg },
          { status: 400 }
        )
      }

      let results: { violations: any[]; passes: any[] }
      try {
        await page.waitForFunction(() => typeof (window as any).axe !== 'undefined', { timeout: 10000 })
        results = await page.evaluate(async () => {
          const axe = (window as any).axe
          const run = await axe.run({
            runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] }
          })
          return { violations: run.violations || [], passes: run.passes || [] }
        })
      } catch (scanError: any) {
        console.error('Free scan error:', scanError)
        await page.close().catch(() => {})
        const msg = /destroyed|target closed|Protocol error|Execution context/i.test(scanError?.message || '')
          ? navFailureMessage
          : 'We couldn\'t complete the scan. Please try again or check the URL.'
        return NextResponse.json(
          { success: false, error: msg },
          { status: 400 }
        )
      }

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

        // Capture screenshots of elements with issues (skip non-visible nodes: meta, 0-width, etc.)
        const elementScreenshots = []
        for (const violation of results.violations.slice(0, 5)) {
          for (const node of violation.nodes || []) {
            const selector = node.target?.[0]
            if (!selector) continue
            try {
              const element = await page.$(selector)
              if (!element) continue
              const box = await element.boundingBox()
              if (!box || box.width < 1 || box.height < 1) {
                await element.dispose().catch(() => {})
                continue
              }
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
                boundingBox: box
              })
              await element.dispose().catch(() => {})
            } catch {
              // Skip non-visible or non-HTML elements (e.g. meta, svg) without logging
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
