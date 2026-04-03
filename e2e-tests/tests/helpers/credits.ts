import { type APIResponse, type Page } from '@playwright/test'
import { getAccessToken } from './auth'

export type CreditsResponse = {
  success: boolean
  credits?: number
  unlimitedCredits?: boolean
  planType?: string
}

export async function fetchCredits(page: Page): Promise<CreditsResponse> {
  const token = await getAccessToken(page)
  const resp: APIResponse = await page.request.get('/api/credits', {
    headers: { Authorization: `Bearer ${token}` },
  })
  return (await resp.json()) as CreditsResponse
}

