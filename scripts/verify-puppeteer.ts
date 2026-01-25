/**
 * Verifies Puppeteer + Chromium work with the project's server config.
 * - Windows/Mac: uses getLaunchOptionsForServerAsync (bundled Chromium or PUPPETEER_EXECUTABLE_PATH).
 * - Linux: same logic as Railway (system Chromium first, then @sparticuz/chromium).
 *
 * Run from repo root:  npx tsx scripts/verify-puppeteer.ts
 * Or:  npm run test:puppeteer
 *
 * To test the Linux path locally: run in a Linux container, e.g.:
 *   docker run --rm -v "$(pwd):/app" -w /app node:20-bookworm bash -c "apt-get update && apt-get install -y chromium && npm ci && npm run test:puppeteer"
 * On Railway, hit GET /api/test-puppeteer after deploy to confirm in production.
 */
import { getLaunchOptionsForServerAsync } from '../src/lib/puppeteer-config'

const puppeteer =
  process.platform === 'linux'
    ? require('puppeteer-core')
    : require('puppeteer')

async function main() {
  console.log('Platform:', process.platform)
  console.log('Resolving launch options...')
  const opts = await getLaunchOptionsForServerAsync({
    args: [
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-dev-shm-usage',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
    ],
  })
  console.log('Launching browser...')
  const browser = await puppeteer.launch(opts)
  try {
    const page = await browser.newPage()
    await page.goto('https://example.com', {
      waitUntil: 'domcontentloaded',
      timeout: 10000,
    })
    const title = await page.title()
    console.log('Page title:', title)
    console.log('OK – Puppeteer + Chromium are working.')
  } finally {
    await browser.close()
  }
}

main().catch((err) => {
  console.error('Puppeteer verification failed:', err)
  process.exit(1)
})
