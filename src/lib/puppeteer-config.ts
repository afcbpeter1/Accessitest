/**
 * Puppeteer configuration utility
 * - Local (Win/Mac): bundled Chromium or PUPPETEER_EXECUTABLE_PATH
 * - Linux (Railway): use system Chromium from nixpacks/apt if present, else @sparticuz/chromium
 */

import fs from 'node:fs'
import path from 'node:path'
import puppeteer from 'puppeteer'

// Use the actual parameter type from puppeteer.launch
type PuppeteerLaunchOptions = Parameters<typeof puppeteer.launch>[0]

const SERVER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
  '--no-first-run',
  '--no-zygote',
]

/**
 * Get the Chromium executable path (sync)
 * Only uses environment variable - does not guess paths
 */
function getChromiumPath(): string | undefined {
  const envPath = process.env.PUPPETEER_EXECUTABLE_PATH?.trim()
  if (envPath) return envPath
  return undefined
}

/**
 * On Linux, find system Chromium if nixpacks/apt installed it.
 * Returns the first path that exists.
 */
function findSystemChromiumOnLinux(): string | undefined {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH?.trim(),
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
  ].filter(Boolean) as string[]
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p
    } catch {
      continue
    }
  }
  return undefined
}

/**
 * Launch options for server/Railway.
 * On Linux: use system Chromium (from nixpacks) if present; otherwise @sparticuz/chromium.
 * Call with puppeteer-core on Linux.
 */
export async function getLaunchOptionsForServerAsync(
  customOptions: Partial<PuppeteerLaunchOptions> = {}
): Promise<PuppeteerLaunchOptions> {
  const isLinux = process.platform === 'linux'
  if (isLinux) {
    const systemPath = findSystemChromiumOnLinux()
    if (systemPath) {
      return {
        ...customOptions,
        headless: (customOptions.headless as 'new') ?? 'new',
        executablePath: systemPath,
        args: [
          ...SERVER_ARGS,
          ...(Array.isArray(customOptions.args) ? customOptions.args : []),
        ],
      }
    }
    const chromium = (await import('@sparticuz/chromium')).default
    // Use process.cwd() for bin dir: require.resolve() is replaced with a numeric module id in the
    // Next.js server bundle, so path.dirname(require.resolve(...)) can throw ERR_INVALID_ARG_TYPE.
    const binDir = path.join(process.cwd(), 'node_modules', '@sparticuz', 'chromium', 'bin')
    if (!fs.existsSync(binDir)) {
      throw new Error(
        'No Chromium found on Linux. Install system Chromium (e.g. nixpacks apt chromium) or set PUPPETEER_EXECUTABLE_PATH. @sparticuz/chromium bin not found at ' + binDir
      )
    }
    const executablePath = await chromium.executablePath(binDir)
    const args = [
      ...chromium.args,
      ...SERVER_ARGS,
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

