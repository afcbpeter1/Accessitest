import type { Browser } from 'puppeteer'
import { getLaunchOptionsForServerAsync } from './puppeteer-config'

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

export interface ScreenshotResult {
  fullPage?: string // base64 encoded screenshot
  viewport?: string // base64 encoded viewport screenshot
  elements?: Array<{
    selector: string
    screenshot: string // base64 encoded element screenshot
    boundingBox: {
      x: number
      y: number
      width: number
      height: number
    }
  }>
}

export class ScreenshotService {
  private browser: Browser | null = null

  async initialize() {
    if (!this.browser) {
      const puppeteerModule = await getPuppeteer();
      this.browser = await puppeteerModule.launch(await getLaunchOptionsForServerAsync({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ]
      })) as Browser
    }
  }

  private async waitForStableDom(timeoutMs: number = 20000, quietMs: number = 1500, puppeteerPage: any): Promise<void> {
    await puppeteerPage.evaluate(
      ({ timeoutMs, quietMs }: { timeoutMs: number; quietMs: number }) =>
        new Promise<void>((resolve) => {
          let settled = false
          let timeoutHandle: any = null
          let quietHandle: any = null
          let obs: MutationObserver | null = null

          const done = () => {
            if (settled) return
            settled = true
            if (timeoutHandle) clearTimeout(timeoutHandle)
            if (quietHandle) clearTimeout(quietHandle)
            if (obs) obs.disconnect()
            resolve()
          }

          timeoutHandle = setTimeout(done, timeoutMs)
          obs = new MutationObserver(() => {
            if (quietHandle) clearTimeout(quietHandle)
            quietHandle = setTimeout(done, quietMs)
          })

          try {
            obs.observe(document.documentElement || document.body, {
              subtree: true,
              childList: true,
              attributes: true,
              characterData: true
            })
          } catch {
            // If observation fails, fall back to timeout only.
          }

          // Start the quiet timer immediately.
          quietHandle = setTimeout(done, quietMs)
        }),
      { timeoutMs, quietMs }
    )
  }

  private async applyRedactionMasks(puppeteerPage: any): Promise<void> {
    await puppeteerPage.evaluate(() => {
      const existing = document.getElementById('__accessscan_mask_layer')
      if (existing) existing.remove()

      const layer = document.createElement('div')
      layer.id = '__accessscan_mask_layer'
      layer.setAttribute('aria-hidden', 'true')
      layer.style.position = 'absolute'
      layer.style.left = '0'
      layer.style.top = '0'
      layer.style.width = '100%'
      layer.style.height = '100%'
      layer.style.zIndex = '2147483647'
      layer.style.pointerEvents = 'none'

      const selectors = ['input', 'textarea', 'select', 'input[type="password"]']
      const els = Array.from(document.querySelectorAll(selectors.join(','))).slice(0, 40) as HTMLElement[]

      for (const el of els) {
        const rect = el.getBoundingClientRect()
        const style = window.getComputedStyle(el)
        if (!rect || rect.width <= 0 || rect.height <= 0) continue
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue

        const left = rect.left + window.scrollX
        const top = rect.top + window.scrollY

        const box = document.createElement('div')
        box.style.position = 'absolute'
        box.style.left = `${left}px`
        box.style.top = `${top}px`
        box.style.width = `${rect.width}px`
        box.style.height = `${rect.height}px`
        box.style.background = 'rgba(0,0,0,0.85)'
        box.style.borderRadius = '2px'

        layer.appendChild(box)
      }

      // Ensure there's a parent to attach to even if body isn't ready.
      const host = document.body || document.documentElement
      host.appendChild(layer)
    })
  }

  private async removeRedactionMasks(puppeteerPage: any): Promise<void> {
    await puppeteerPage.evaluate(() => {
      const existing = document.getElementById('__accessscan_mask_layer')
      if (existing) existing.remove()
    })
  }

  async captureScreenshots(
    url: string,
    selectors: string[] = [],
    options: { fullPage?: boolean; viewport?: boolean } = { fullPage: true, viewport: true }
  ): Promise<ScreenshotResult> {
    // Allow disabling screenshots entirely (CI cost control / privacy / stability).
    // When disabled, return an empty result so callers can proceed without images.
    if (process.env.DISABLE_SCREENSHOTS === 'true') {
      return {}
    }

    await this.initialize()
    
    if (!this.browser) {
      throw new Error('Browser not initialized')
    }

    const page = await this.browser.newPage()
    // Avoid "Requesting main frame too early!" in Docker/Railway
    await new Promise((r) => setTimeout(r, 800))

    try {
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 })
      
      // Navigate to URL
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      })

      // Wait for page content to settle (avoids LOADING placeholders)
      await this.waitForStableDom(20000, 1500, page)

      // Add redaction masks before capturing "page reference" screenshots.
      // This is best-effort: we mask common sensitive fields (input/textarea/select/password).
      await this.applyRedactionMasks(page)
      await page.waitForTimeout(150)

      // Capture full page screenshot (optional)
      const fullPageScreenshot =
        options.fullPage === false
          ? undefined
          : ((await page.screenshot({
            fullPage: true,
            encoding: 'base64'
          })) as string)

      // Capture viewport screenshot (optional)
      const viewportScreenshot =
        options.viewport === false
          ? undefined
          : ((await page.screenshot({
            fullPage: false,
            encoding: 'base64'
          })) as string)

      // Remove masks before element screenshots so we can still show the affected element.
      await this.removeRedactionMasks(page)

      // Capture element screenshots
      const elementScreenshots = []
      for (const selector of selectors) {
        try {
          const element = await page.$(selector)
          if (element) {
            const boundingBox = await element.boundingBox()
            if (boundingBox) {
              const elementScreenshot = await element.screenshot({
                encoding: 'base64'
              }) as string

              elementScreenshots.push({
                selector,
                screenshot: elementScreenshot,
                boundingBox
              })
            }
          }
        } catch (error) {
          console.warn(`Failed to capture screenshot for selector: ${selector}`, error)
        }
      }

      return {
        fullPage: fullPageScreenshot,
        viewport: viewportScreenshot,
        elements: elementScreenshots
      }

    } finally {
      await page.close()
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }
}

// Singleton instance
export const screenshotService = new ScreenshotService()
