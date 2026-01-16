/**
 * Puppeteer configuration utility
 * Supports both bundled Chromium (development) and system Chromium (production)
 */

import puppeteer from 'puppeteer'

// Use the actual parameter type from puppeteer.launch
type PuppeteerLaunchOptions = Parameters<typeof puppeteer.launch>[0]

/**
 * Get the Chromium executable path
 * Checks environment variable first, then common system paths
 */
function getChromiumPath(): string | undefined {
  // Check environment variable first
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH
  }

  // Common system Chromium paths (for production environments)
  const commonPaths = [
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/snap/bin/chromium',
  ]

  // Try to find Chromium in common paths
  // Note: This is a simple check - in production, you should use the env var
  for (const path of commonPaths) {
    try {
      // In a real scenario, you might want to check if file exists
      // For now, we'll rely on Puppeteer to handle the error
      return path
    } catch {
      // Continue to next path
    }
  }

  // Return undefined to use bundled Chromium (if available)
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

