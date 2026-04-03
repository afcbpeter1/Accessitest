import { expect, type Page } from '@playwright/test'

export async function assertLoggedIn(page: Page) {
  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' })
  await expect(
    page.getByRole('heading', { name: 'Accessibility Dashboard' })
  ).toBeVisible()
}

export async function getAccessToken(page: Page): Promise<string> {
  const token = await page.evaluate(() => localStorage.getItem('accessToken'))
  if (!token) throw new Error('Missing accessToken in localStorage')
  return token
}

