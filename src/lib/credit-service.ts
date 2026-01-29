import { query, queryOne } from '@/lib/database'
import { getUserOrganizations } from './organization-service'
import { getStripe } from './stripe-config'

export interface CreditInfo {
  credits_remaining: number
  credits_used: number
  unlimited_credits: boolean
  is_organization: boolean
  organization_id?: string
}

/**
 * Get user's credit information (organization-primary model)
 * Users can be owners of their own organization OR members of another organization
 * Credits are always stored at organization level
 * Priority: 1) Organization they're a member of (if invited), 2) Organization they own
 */
export async function getUserCredits(userId: string): Promise<CreditInfo> {
  // First, check if user has a default_organization_id set (from invitation)
  const userData = await queryOne(
    `SELECT default_organization_id FROM users WHERE id = $1`,
    [userId]
  )
  
  // Get user's organization (prioritize default_organization_id if set, otherwise find any active membership)
  let primaryOrg = null
  
  if (userData?.default_organization_id) {
    // Check if user is an active member of this organization
    primaryOrg = await queryOne(
      `SELECT om.organization_id, om.role, o.id
       FROM organization_members om
       INNER JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1 
       AND om.organization_id = $2
       AND om.is_active = true
       LIMIT 1`,
      [userId, userData.default_organization_id]
    )
  }
  
  // If no default org or not a member, find any organization they're a member of (member or owner)
  if (!primaryOrg) {
    primaryOrg = await queryOne(
      `SELECT om.organization_id, om.role, o.id
       FROM organization_members om
       INNER JOIN organizations o ON om.organization_id = o.id
       WHERE om.user_id = $1 
       AND om.is_active = true
       ORDER BY 
         CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END,
         om.joined_at ASC
       LIMIT 1`,
      [userId]
    )
  }
  
  // Check if user has an active subscription (fallback for unlimited credits)
  const userSubscriptionData = await queryOne(
    `SELECT plan_type, stripe_subscription_id FROM users WHERE id = $1`,
    [userId]
  )
  
  // Verify subscription is actually active in Stripe
  let hasActiveSubscription = false
  if (userSubscriptionData?.plan_type === 'complete_access' && userSubscriptionData?.stripe_subscription_id) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(userSubscriptionData.stripe_subscription_id)
      hasActiveSubscription = subscription.status === 'active' || subscription.status === 'trialing'
    } catch (error) {
      // Subscription not found or error - treat as inactive
      console.warn(`Could not verify subscription for user ${userId}:`, error)
    }
  }
  
  if (primaryOrg?.organization_id) {
    // Use organization credits (primary model - all credits are organization-level)
    const orgCredits = await queryOne(
      `SELECT credits_remaining, credits_used, unlimited_credits
       FROM organization_credits
       WHERE organization_id = $1`,
      [primaryOrg.organization_id]
    )
    
    if (orgCredits) {
      // If user has active subscription but unlimited_credits is false, update it
      // This handles cases where webhook didn't fire or migration wasn't run
      if (hasActiveSubscription && !orgCredits.unlimited_credits) {
        console.log(`⚠️ User ${userId} has active subscription but unlimited_credits is false - updating`)
        await query(
          `UPDATE organization_credits
           SET unlimited_credits = true, updated_at = NOW()
           WHERE organization_id = $1`,
          [primaryOrg.organization_id]
        )
        orgCredits.unlimited_credits = true
      }
      
      return {
        ...orgCredits,
        is_organization: true,
        organization_id: primaryOrg.organization_id
      }
    }
    
    // If organization exists but no credits record, create one
    // Set unlimited_credits = true if user has active subscription
    await query(
      `INSERT INTO organization_credits (organization_id, credits_remaining, credits_used, unlimited_credits)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id) DO NOTHING`,
      [primaryOrg.organization_id, 3, 0, hasActiveSubscription || false]
    )
    
    // Return the newly created credits
    const newOrgCredits = await queryOne(
      `SELECT credits_remaining, credits_used, unlimited_credits
       FROM organization_credits
       WHERE organization_id = $1`,
      [primaryOrg.organization_id]
    )
    
    if (newOrgCredits) {
      return {
        ...newOrgCredits,
        is_organization: true,
        organization_id: primaryOrg.organization_id
      }
    }
  }
  
  // Fallback: If user has no organization, this shouldn't happen after migration
  // But we'll create one to prevent errors
  console.warn(`User ${userId} has no primary organization - creating one`)
  
  // Create organization for user
  const orgName = await queryOne(
    `SELECT COALESCE(company, first_name || ' ' || last_name || '''s Organization', 'My Organization') as name
     FROM users WHERE id = $1`,
    [userId]
  )
  
  const newOrg = await queryOne(
    `INSERT INTO organizations (name, subscription_status, max_users, max_teams)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [orgName?.name || 'My Organization', 'active', 999, 0]
  )
  
  // Add user as owner
  await query(
    `INSERT INTO organization_members (user_id, organization_id, role, joined_at, is_active)
     VALUES ($1, $2, $3, NOW(), true)`,
    [userId, newOrg.id, 'owner']
  )
  
  // Create organization credits
  // Set unlimited_credits = true if user has active subscription
  await query(
    `INSERT INTO organization_credits (organization_id, credits_remaining, credits_used, unlimited_credits)
     VALUES ($1, $2, $3, $4)`,
    [newOrg.id, 3, 0, hasActiveSubscription || false]
  )
  
  // Update user's default_organization_id
  await query(
    `UPDATE users SET default_organization_id = $1 WHERE id = $2`,
    [newOrg.id, userId]
  )
  
  return {
    credits_remaining: 3,
    credits_used: 0,
    unlimited_credits: hasActiveSubscription || false,
    is_organization: true,
    organization_id: newOrg.id
  }
}

/**
 * Check if user can perform a scan (has credits)
 */
export async function canScan(userId: string): Promise<boolean> {
  const creditInfo = await getUserCredits(userId)
  return creditInfo.unlimited_credits || creditInfo.credits_remaining > 0
}

/**
 * Deduct credits for a scan
 */
export async function deductCredits(
  userId: string,
  amount: number = 1,
  description: string = 'Scan usage',
  scanId?: string
): Promise<{ success: boolean; credits_remaining: number; error?: string }> {
  await query('BEGIN')
  
  try {
    const creditInfo = await getUserCredits(userId)
    
    // Unlimited credits - just log, don't deduct
    if (creditInfo.unlimited_credits) {
      await query(
        `INSERT INTO credit_transactions (user_id, organization_id, transaction_type, credits_amount, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, creditInfo.organization_id || null, 'usage', 0, description]
      )
      
      await query('COMMIT')
      return {
        success: true,
        credits_remaining: creditInfo.credits_remaining
      }
    }
    
    // Check if user has enough credits
    if (creditInfo.credits_remaining < amount) {
      await query('ROLLBACK')
      return {
        success: false,
        credits_remaining: creditInfo.credits_remaining,
        error: 'Insufficient credits'
      }
    }
    
    // Deduct credits (organization-primary model - all credits are organization-level)
    if (!creditInfo.organization_id) {
      await query('ROLLBACK')
      return {
        success: false,
        credits_remaining: 0,
        error: 'User has no organization'
      }
    }
    
    // Deduct from organization credits
    await query(
      `UPDATE organization_credits
       SET credits_remaining = credits_remaining - $1,
           credits_used = credits_used + $1,
           updated_at = NOW()
       WHERE organization_id = $2`,
      [amount, creditInfo.organization_id]
    )
    
    // Log transaction
    await query(
      `INSERT INTO credit_transactions (user_id, organization_id, transaction_type, credits_amount, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, creditInfo.organization_id, 'usage', amount, description]
    )
    
    // Get updated credits
    const updatedCredits = await getUserCredits(userId)
    
    await query('COMMIT')
    return {
      success: true,
      credits_remaining: updatedCredits.credits_remaining
    }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Add credits (for purchases)
 */
export async function addCredits(
  userId: string,
  amount: number,
  description: string = 'Credit purchase',
  stripePaymentIntentId?: string
): Promise<{ success: boolean; credits_remaining: number }> {
  await query('BEGIN')
  
  try {
    const creditInfo = await getUserCredits(userId)
    
    // Organization-primary model - all credits are organization-level
    if (!creditInfo.organization_id) {
      await query('ROLLBACK')
      return {
        success: false,
        credits_remaining: 0
      }
    }
    
    // Add to organization credits
    await query(
      `UPDATE organization_credits
       SET credits_remaining = credits_remaining + $1,
           updated_at = NOW()
       WHERE organization_id = $2`,
      [amount, creditInfo.organization_id]
    )
    
    // Log transaction (stripe_payment_intent_id optional - add column via fix_database_schema.sql if you want it)
    await query(
      `INSERT INTO credit_transactions (user_id, organization_id, transaction_type, credits_amount, description)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, creditInfo.organization_id, 'purchase', amount, description]
    )
    
    // Get updated credits
    const updatedCredits = await getUserCredits(userId)
    
    await query('COMMIT')
    return {
      success: true,
      credits_remaining: updatedCredits.credits_remaining
    }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Activate unlimited credits (for subscriptions) while preserving existing credits
 * This allows credits to be "saved" for when subscription ends
 */
export async function activateUnlimitedCredits(userId: string): Promise<{ success: boolean; credits_remaining: number }> {
  await query('BEGIN')
  
  try {
    const creditInfo = await getUserCredits(userId)
    
    // Organization-primary model - all credits are organization-level
    if (!creditInfo.organization_id) {
      await query('ROLLBACK')
      return {
        success: false,
        credits_remaining: 0
      }
    }
    
    // Set unlimited_credits = true but PRESERVE existing credits_remaining
    // This way credits are "saved" for when subscription ends
    await query(
      `UPDATE organization_credits
       SET unlimited_credits = true,
           updated_at = NOW()
       WHERE organization_id = $1`,
      [creditInfo.organization_id]
    )
    
    // Get updated credits (should still have the same credits_remaining)
    const updatedCredits = await getUserCredits(userId)
    
    await query('COMMIT')
    return {
      success: true,
      credits_remaining: updatedCredits.credits_remaining
    }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Deactivate unlimited credits (when subscription ends) - credits are already preserved
 */
export async function deactivateUnlimitedCredits(userId: string): Promise<{ success: boolean; credits_remaining: number }> {
  await query('BEGIN')
  
  try {
    const creditInfo = await getUserCredits(userId)
    
    if (!creditInfo.organization_id) {
      await query('ROLLBACK')
      return {
        success: false,
        credits_remaining: 0
      }
    }
    
    // Set unlimited_credits = false - credits_remaining is already preserved
    await query(
      `UPDATE organization_credits
       SET unlimited_credits = false,
           updated_at = NOW()
       WHERE organization_id = $1`,
      [creditInfo.organization_id]
    )
    
    const updatedCredits = await getUserCredits(userId)
    
    await query('COMMIT')
    return {
      success: true,
      credits_remaining: updatedCredits.credits_remaining
    }
  } catch (error) {
    await query('ROLLBACK')
    throw error
  }
}

/**
 * Get organization credits
 */
export async function getOrganizationCredits(organizationId: string) {
  return await queryOne(
    `SELECT credits_remaining, credits_used, unlimited_credits
     FROM organization_credits
     WHERE organization_id = $1`,
    [organizationId]
  )
}






