import { query, queryOne } from '@/lib/database'
import { getUserCredits } from './credit-service'

export interface PageTrackingInfo {
  pages_scanned_this_month: number
  monthly_page_limit: number
  pages_remaining: number
  last_page_reset_date: string
  is_unlimited: boolean
}

/**
 * Get page tracking information for a user
 * Returns pages scanned this month, limit, and remaining pages
 */
export async function getPageTrackingInfo(userId: string): Promise<PageTrackingInfo> {
  const creditInfo = await getUserCredits(userId)
  
  // Only track pages for unlimited subscription users
  if (!creditInfo.unlimited_credits || !creditInfo.organization_id) {
    return {
      pages_scanned_this_month: 0,
      monthly_page_limit: 0,
      pages_remaining: 999999, // Unlimited for non-subscription users
      last_page_reset_date: new Date().toISOString(),
      is_unlimited: true
    }
  }

  // Check if we need to reset the counter (new month)
  await checkAndResetMonthlyCounter(creditInfo.organization_id)

  const orgCredits = await queryOne(
    `SELECT pages_scanned_this_month, monthly_page_limit, last_page_reset_date
     FROM organization_credits
     WHERE organization_id = $1`,
    [creditInfo.organization_id]
  )

  if (!orgCredits) {
    return {
      pages_scanned_this_month: 0,
      monthly_page_limit: 200,
      pages_remaining: 200,
      last_page_reset_date: new Date().toISOString(),
      is_unlimited: false
    }
  }

  const pagesRemaining = Math.max(0, orgCredits.monthly_page_limit - orgCredits.pages_scanned_this_month)

  return {
    pages_scanned_this_month: orgCredits.pages_scanned_this_month || 0,
    monthly_page_limit: orgCredits.monthly_page_limit || 200,
    pages_remaining: pagesRemaining,
    last_page_reset_date: orgCredits.last_page_reset_date || new Date().toISOString(),
    is_unlimited: false
  }
}

/**
 * Check if we need to reset the monthly page counter
 * Resets if it's a new month since last reset
 */
async function checkAndResetMonthlyCounter(organizationId: string): Promise<void> {
  const orgCredits = await queryOne(
    `SELECT last_page_reset_date FROM organization_credits WHERE organization_id = $1`,
    [organizationId]
  )

  if (!orgCredits || !orgCredits.last_page_reset_date) {
    return
  }

  const lastReset = new Date(orgCredits.last_page_reset_date)
  const now = new Date()

  // Check if we're in a new month (or new year)
  const needsReset = 
    now.getMonth() !== lastReset.getMonth() ||
    now.getFullYear() !== lastReset.getFullYear()

  if (needsReset) {
    await query(
      `UPDATE organization_credits
       SET pages_scanned_this_month = 0,
           last_page_reset_date = NOW()
       WHERE organization_id = $1`,
      [organizationId]
    )
    console.log(`🔄 Reset page counter for organization ${organizationId} (new month)`)
  }
}

/**
 * Check if user can scan the requested number of pages
 * Returns true if they have enough pages remaining
 */
export async function canScanPages(userId: string, numberOfPages: number): Promise<{
  canScan: boolean
  pagesRemaining: number
  error?: string
}> {
  const pageInfo = await getPageTrackingInfo(userId)

  // Unlimited users (non-subscription) can always scan
  if (pageInfo.is_unlimited) {
    return { canScan: true, pagesRemaining: 999999 }
  }

  // Check if they have enough pages remaining
  if (pageInfo.pages_remaining < numberOfPages) {
    return {
      canScan: false,
      pagesRemaining: pageInfo.pages_remaining,
      error: `You have reached your monthly page limit (${pageInfo.monthly_page_limit} pages). Your limit will reset on your next billing date.`
    }
  }

  return { canScan: true, pagesRemaining: pageInfo.pages_remaining }
}

/**
 * Deduct pages from user's monthly allowance
 * Only deducts for unlimited subscription users
 */
export async function deductPages(userId: string, numberOfPages: number, description?: string): Promise<{
  success: boolean
  pages_remaining: number
  error?: string
}> {
  const creditInfo = await getUserCredits(userId)

  // Only track pages for unlimited subscription users
  if (!creditInfo.unlimited_credits || !creditInfo.organization_id) {
    return {
      success: true,
      pages_remaining: 999999 // Unlimited
    }
  }

  // Check if we need to reset (new month)
  await checkAndResetMonthlyCounter(creditInfo.organization_id)

  // Check if they have enough pages
  const canScanResult = await canScanPages(userId, numberOfPages)
  if (!canScanResult.canScan) {
    return {
      success: false,
      pages_remaining: canScanResult.pagesRemaining,
      error: canScanResult.error
    }
  }

  // Deduct pages
  const result = await queryOne(
    `UPDATE organization_credits
     SET pages_scanned_this_month = pages_scanned_this_month + $1,
         updated_at = NOW()
     WHERE organization_id = $2
     RETURNING pages_scanned_this_month, monthly_page_limit`,
    [numberOfPages, creditInfo.organization_id]
  )

  if (!result) {
    return {
      success: false,
      pages_remaining: 0,
      error: 'Failed to update page count'
    }
  }

  const pagesRemaining = Math.max(0, result.monthly_page_limit - result.pages_scanned_this_month)

  return {
    success: true,
    pages_remaining: pagesRemaining
  }
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

