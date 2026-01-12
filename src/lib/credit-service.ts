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
 * Get user's credit information (organization or personal)
 */
export async function getUserCredits(userId: string): Promise<CreditInfo> {
  // Check if user has a default organization
  const user = await queryOne(
    `SELECT default_organization_id FROM users WHERE id = $1`,
    [userId]
  )
  
  if (user?.default_organization_id) {
    // Use organization credits
    const orgCredits = await queryOne(
      `SELECT credits_remaining, credits_used, unlimited_credits
       FROM organization_credits
       WHERE organization_id = $1`,
      [user.default_organization_id]
    )
    
    if (orgCredits) {
      return {
        ...orgCredits,
        is_organization: true,
        organization_id: user.default_organization_id
      }
    }
  }
  
  // Fall back to personal credits
  let personalCredits = await queryOne(
    `SELECT credits_remaining, credits_used, unlimited_credits
     FROM user_credits
     WHERE user_id = $1`,
    [userId]
  )
  
  // Create personal credits if they don't exist
  if (!personalCredits) {
    await query(
      `INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
       VALUES ($1, $2, $3, $4)`,
      [userId, 3, 0, false]
    )
    
    personalCredits = await queryOne(
      `SELECT credits_remaining, credits_used, unlimited_credits
       FROM user_credits
       WHERE user_id = $1`,
      [userId]
    )
  }
  
  return {
    ...personalCredits,
    is_organization: false
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
    
    // Deduct credits
    if (creditInfo.is_organization && creditInfo.organization_id) {
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
    } else {
      // Deduct from personal credits
      await query(
        `UPDATE user_credits
         SET credits_remaining = credits_remaining - $1,
             credits_used = credits_used + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [amount, userId]
      )
      
      // Log transaction
      await query(
        `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
         VALUES ($1, $2, $3, $4)`,
        [userId, 'usage', amount, description]
      )
    }
    
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
    
    if (creditInfo.is_organization && creditInfo.organization_id) {
      // Add to organization credits
      await query(
        `UPDATE organization_credits
         SET credits_remaining = credits_remaining + $1,
             updated_at = NOW()
         WHERE organization_id = $2`,
        [amount, creditInfo.organization_id]
      )
      
      // Log transaction
      await query(
        `INSERT INTO credit_transactions (user_id, organization_id, transaction_type, credits_amount, description, stripe_payment_intent_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, creditInfo.organization_id, 'purchase', amount, description, stripePaymentIntentId || null]
      )
    } else {
      // Add to personal credits
      await query(
        `UPDATE user_credits
         SET credits_remaining = credits_remaining + $1,
             updated_at = NOW()
         WHERE user_id = $2`,
        [amount, userId]
      )
      
      // Log transaction
      await query(
        `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description, stripe_payment_intent_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [userId, 'purchase', amount, description, stripePaymentIntentId || null]
      )
    }
    
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


