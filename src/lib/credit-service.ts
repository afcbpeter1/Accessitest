import { query, queryOne } from '@/lib/database'
import { getUserOrganizations } from './organization-service'

export interface CreditInfo {
  credits_remaining: number
  credits_used: number
  unlimited_credits: boolean
  is_organization: boolean
  organization_id?: string
}

/**
 * Get user's credit information (organization-primary model)
 * Every user has a primary organization (the one they own)
 * Credits are always stored at organization level
 */
export async function getUserCredits(userId: string): Promise<CreditInfo> {
  // Get user's primary organization (the one they own)
  const primaryOrg = await queryOne(
    `SELECT om.organization_id, o.id
     FROM organization_members om
     INNER JOIN organizations o ON om.organization_id = o.id
     WHERE om.user_id = $1 
     AND om.role = 'owner' 
     AND om.is_active = true
     ORDER BY om.joined_at ASC
     LIMIT 1`,
    [userId]
  )
  
  if (primaryOrg?.organization_id) {
    // Use organization credits (primary model - all credits are organization-level)
    const orgCredits = await queryOne(
      `SELECT credits_remaining, credits_used, unlimited_credits
       FROM organization_credits
       WHERE organization_id = $1`,
      [primaryOrg.organization_id]
    )
    
    if (orgCredits) {
      return {
        ...orgCredits,
        is_organization: true,
        organization_id: primaryOrg.organization_id
      }
    }
    
    // If organization exists but no credits record, create one
    await query(
      `INSERT INTO organization_credits (organization_id, credits_remaining, credits_used, unlimited_credits)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id) DO NOTHING`,
      [primaryOrg.organization_id, 3, 0, false]
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
  await query(
    `INSERT INTO organization_credits (organization_id, credits_remaining, credits_used, unlimited_credits)
     VALUES ($1, $2, $3, $4)`,
    [newOrg.id, 3, 0, false]
  )
  
  // Update user's default_organization_id
  await query(
    `UPDATE users SET default_organization_id = $1 WHERE id = $2`,
    [newOrg.id, userId]
  )
  
  return {
    credits_remaining: 3,
    credits_used: 0,
    unlimited_credits: false,
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






