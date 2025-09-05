import puppeteer from 'puppeteer'

export interface ScreenshotResult {
  fullPage: string // base64 encoded screenshot
  viewport: string // base64 encoded viewport screenshot
  elements: Array<{
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
  private browser: puppeteer.Browser | null = null

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
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
      })
    }
  }

  async captureScreenshots(url: string, selectors: string[] = []): Promise<ScreenshotResult> {
    await this.initialize()
    
    if (!this.browser) {
      throw new Error('Browser not initialized')
    }

    const page = await this.browser.newPage()
    
    try {
      // Set viewport
      await page.setViewport({ width: 1920, height: 1080 })
      
      // Navigate to URL
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      })

      // Wait for page to load
      await page.waitForTimeout(2000)

      // Capture full page screenshot
      const fullPageScreenshot = await page.screenshot({
        fullPage: true,
        encoding: 'base64'
      }) as string

      // Capture viewport screenshot
      const viewportScreenshot = await page.screenshot({
        fullPage: false,
        encoding: 'base64'
      }) as string

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
