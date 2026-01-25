/**
 * Puppeteer configuration utility
 * - Local: bundled Chromium or PUPPETEER_EXECUTABLE_PATH
 * - Railway/server (Linux): @sparticuz/chromium so no system install is needed
 */

import path from 'node:path'
import puppeteer from 'puppeteer'

// Use the actual parameter type from puppeteer.launch
type PuppeteerLaunchOptions = Parameters<typeof puppeteer.launch>[0]

/**
 * Get the Chromium executable path (sync)
 * Only uses environment variable - does not guess paths
 */
function getChromiumPath(): string | undefined {
  const path = process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
  if (path) return path
  return undefined
}

/**
 * Launch options for server/Railway: use @sparticuz/chromium on Linux so
 * we don't depend on /usr/bin/chromium existing. Call this with puppeteer-core.
 */
export async function getLaunchOptionsForServerAsync(
  customOptions: Partial<PuppeteerLaunchOptions> = {}
): Promise<PuppeteerLaunchOptions> {
  const isLinux = process.platform === 'linux'
  if (isLinux) {
    const chromium = (await import('@sparticuz/chromium')).default
    // Pass explicit bin path: package uses __dirname by default, which becomes
    // .next/server (or similar) when bundled, so "/app/.next/server/bin" does not exist.
    const binDir = path.join(path.dirname(require.resolve('@sparticuz/chromium/package.json')), 'bin')
    const executablePath = await chromium.executablePath(binDir)
    const args = [
      ...chromium.args,
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      ...(Array.isArray(customOptions.args) ? customOptions.args : []),
    ]
    return {
      ...customOptions,
      headless: (customOptions.headless as 'new') ?? 'new',
      executablePath,
      args,
    }
  }
  return getPuppeteerLaunchOptions(customOptions)
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

