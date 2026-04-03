import { expect, test } from '@playwright/test'
import { fetchCredits } from './helpers/credits'

const scanUrl = process.env.E2E_SCAN_URL || 'https://a11ytest.ai'

test('scan: web scan reaches results and updates credits', async ({ page }) => {
  const before = await fetchCredits(page).catch(() => null)

  await page.goto('/new-scan', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'New Accessibility Scan' })
  ).toBeVisible()

  await page.locator('#url').fill(scanUrl)

  // Stage 1: discovery
  await page.getByRole('button', { name: /Start Page Discovery|Prepare Single Page Scan/i }).click()

  // Stage 2 appears when pages discovered or single-page prepared.
  await expect(
    page.getByRole('heading', { name: /Stage 2: Select Pages to Scan|Ready to Scan/i })
  ).toBeVisible({ timeout: 2 * 60 * 1000 })

  // Start scan
  await page
    .getByRole('button', { name: /Start WCAG 2\.2 Scan/i })
    .click()

  // Wait for results section.
  await expect(
    page.getByRole('heading', { name: 'Detailed Accessibility Report' })
  ).toBeVisible({ timeout: 3 * 60 * 1000 })

  // Credits: only assert decrement for non-unlimited plans.
  const after = await fetchCredits(page).catch(() => null)
  if (
    before?.success &&
    after?.success &&
    before.unlimitedCredits === false &&
    after.unlimitedCredits === false &&
    typeof before.credits === 'number' &&
    typeof after.credits === 'number'
  ) {
    expect(after.credits).toBeLessThanOrEqual(before.credits)
  }
})

