import { query } from '@/lib/database'
import { getUserCredits } from './credit-service'

export interface PageTrackingInfo {
  pages_scanned_this_month: number
  monthly_page_limit: number
  pages_remaining: number
  last_page_reset_date: string
  is_unlimited: boolean
}

/**
 * Get page tracking information for a user.
 * Monthly page limits are no longer enforced (AI is not run on every scan).
 * Always returns unlimited so any remaining UI can hide limit display.
 */
export async function getPageTrackingInfo(userId: string): Promise<PageTrackingInfo> {
  return {
    pages_scanned_this_month: 0,
    monthly_page_limit: 0,
    pages_remaining: 999999,
    last_page_reset_date: new Date().toISOString(),
    is_unlimited: true
  }
}

/**
 * Check if user can scan the requested number of pages.
 * Monthly page limits are no longer enforced; always allows scanning.
 */
export async function canScanPages(userId: string, numberOfPages: number): Promise<{
  canScan: boolean
  pagesRemaining: number
  error?: string
}> {
  return { canScan: true, pagesRemaining: 999999 }
}

/**
 * Deduct pages from user's monthly allowance.
 * Monthly page limits are no longer enforced; no-op, always succeeds.
 */
export async function deductPages(userId: string, numberOfPages: number, description?: string): Promise<{
  success: boolean
  pages_remaining: number
  error?: string
}> {
  return { success: true, pages_remaining: 999999 }
}

/**
 * Reset page counter for an organization
 * Called by Stripe webhook when payment is received
 */
export async function resetPageCounter(organizationId: string): Promise<void> {
  await query(
    `UPDATE organization_credits
     SET pages_scanned_this_month = 0,
         last_page_reset_date = NOW(),
         updated_at = NOW()
     WHERE organization_id = $1`,
    [organizationId]
  )
  console.log(`🔄 Reset page counter for organization ${organizationId} (payment received)`)
}

/**
 * Get organization ID from user ID
 */
async function getOrganizationId(userId: string): Promise<string | null> {
  const creditInfo = await getUserCredits(userId)
  return creditInfo.organization_id || null
}

/**
 * Reset page counter for a user (via organization)
 * Called by Stripe webhook when payment is received
 */
export async function resetPageCounterForUser(userId: string): Promise<void> {
  const orgId = await getOrganizationId(userId)
  if (orgId) {
    await resetPageCounter(orgId)
  }
}

