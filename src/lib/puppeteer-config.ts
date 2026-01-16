/**
 * Puppeteer configuration utility
 * Supports both bundled Chromium (development) and system Chromium (production)
 */

import puppeteer from 'puppeteer'

// Use the actual parameter type from puppeteer.launch
type PuppeteerLaunchOptions = Parameters<typeof puppeteer.launch>[0]

/**
 * Get the Chromium executable path
 * Only uses environment variable - does not guess paths
 * This prevents errors when paths don't exist
 */
function getChromiumPath(): string | undefined {
  // Only use environment variable - don't guess paths
  // This prevents ENOENT errors when paths don't exist
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  // Return undefined to use bundled Chromium (if available)
  // or let Puppeteer handle the error gracefully
  return undefined
}

/**
 * Get default Puppeteer launch options
 * Automatically configures for production environments
 */
export function getPuppeteerLaunchOptions(
  customOptions: Partial<PuppeteerLaunchOptions> = {}
): PuppeteerLaunchOptions {
  const executablePath = getChromiumPath()
  
  const defaultOptions: PuppeteerLaunchOptions = {
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
      '--single-process',
    ],
  }

  // Only set executablePath if we have a system Chromium path
  // This allows Puppeteer to use bundled Chromium in development
  if (executablePath) {
    defaultOptions.executablePath = executablePath
  }

  // Merge with custom options
  return {
    ...defaultOptions,
    ...customOptions,
    // Merge args arrays
    args: [
      ...(defaultOptions.args || []),
      ...(customOptions.args || []),
    ],
  }
}

/**
 * Get minimal Puppeteer launch options (for simple scans)
 */
export function getMinimalPuppeteerOptions(
  customOptions: Partial<PuppeteerLaunchOptions> = {}
): PuppeteerLaunchOptions {
  const executablePath = getChromiumPath()
  
  const minimalOptions: PuppeteerLaunchOptions = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  }

  if (executablePath) {
    minimalOptions.executablePath = executablePath
  }

  return {
    ...minimalOptions,
    ...customOptions,
    args: [
      ...(minimalOptions.args || []),
      ...(customOptions.args || []),
    ],
  }
}

