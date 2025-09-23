import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import { NotificationService } from '@/lib/notification-service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    // Get user's credit information from database
    let creditData = await queryOne(
      `SELECT uc.*, u.plan_type, u.email
       FROM user_credits uc
       JOIN users u ON uc.user_id = u.id
       WHERE uc.user_id = $1`,
      [user.userId]
    )

    // If user doesn't have credit data, create it with 3 free credits
    if (!creditData) {
      await query(
        `INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, 3, 0, false]
      )
      
      // Get the newly created credit data
      creditData = await queryOne(
        `SELECT uc.*, u.plan_type, u.email
         FROM user_credits uc
         JOIN users u ON uc.user_id = u.id
         WHERE uc.user_id = $1`,
        [user.userId]
      )
    }

    // Get recent scan history
    const scanHistory = await query(
      `SELECT * FROM credit_transactions 
       WHERE user_id = $1 AND transaction_type = 'usage'
       ORDER BY created_at DESC 
       LIMIT 10`,
      [user.userId]
    )

    const canScan = creditData.unlimited_credits || creditData.credits_remaining > 0

    return NextResponse.json({
      success: true,
      userId: user.userId,
      credits: creditData.credits_remaining,
      unlimitedCredits: creditData.unlimited_credits,
      planType: creditData.plan_type,
      scanHistory: scanHistory.rows,
      canScan
    })
  } catch (error) {
    console.error('❌ Error fetching user credits:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch credit information' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { scanType, scanId, fileName } = body
    
    if (!scanType || !scanId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Get user's current credit information
    let creditData = await queryOne(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [user.userId]
    )

    // If user doesn't have credit data, create it with 3 free credits
    if (!creditData) {
      await query(
        `INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, 3, 0, false]
      )
      
      // Get the newly created credit data
      creditData = await queryOne(
        'SELECT * FROM user_credits WHERE user_id = $1',
        [user.userId]
      )
    }
    
    // Check if user has unlimited credits
    if (creditData.unlimited_credits) {
      // Unlimited user, log the scan but don't deduct credits
      await query(
        `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, 'usage', 0, `${scanType} scan: ${fileName || scanId}`]
      )
      
      return NextResponse.json({
        success: true,
        canScan: true,
        credits: creditData.credits_remaining,
        unlimitedCredits: true,
        message: 'Unlimited scan completed'
      })
    }
    
    // Check if user has enough credits
    if (creditData.credits_remaining < 1) {
      // Create notification for insufficient credits
      await NotificationService.notifyInsufficientCredits(user.userId)
      
      return NextResponse.json(
        { success: false, error: 'Insufficient credits', canScan: false },
        { status: 402 }
      )
    }
    
    // Start transaction to deduct credit and log usage
    await query('BEGIN')
    
    try {
      // Deduct 1 credit for the scan
      await query(
        `UPDATE user_credits 
         SET credits_remaining = credits_remaining - 1, 
             credits_used = credits_used + 1,
             updated_at = NOW()
         WHERE user_id = $1`,
        [user.userId]
      )
      
      // Log the scan transaction
      await query(
        `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, 'usage', -1, `${scanType} scan: ${fileName || scanId}`]
      )
      
      await query('COMMIT')
      
      const newCredits = creditData.credits_remaining - 1
      
      // Create notification for low credits if remaining credits are low
      if (newCredits <= 1 && newCredits > 0) {
        await NotificationService.notifyLowCredits(user.userId, newCredits)
      }
      
      return NextResponse.json({
        success: true,
        canScan: true,
        credits: newCredits,
        unlimitedCredits: false,
        message: 'Scan completed, 1 credit deducted'
      })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
    
  } catch (error) {
    console.error('❌ Credit deduction error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process scan' },
      { status: 500 }
    )
  }
}

// Add credits (for purchases)
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { creditsToAdd, packageName, stripePaymentIntentId } = body
    
    if (!creditsToAdd || creditsToAdd <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid credit amount' },
        { status: 400 }
      )
    }
    
    // Start transaction to add credits and log purchase
    await query('BEGIN')
    
    try {
      // Add credits to user's account
      await query(
        `UPDATE user_credits 
         SET credits_remaining = credits_remaining + $1, 
             updated_at = NOW()
         WHERE user_id = $2`,
        [creditsToAdd, user.userId]
      )
      
      // Log the credit purchase transaction
      await query(
        `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description, stripe_payment_intent_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.userId, 'purchase', creditsToAdd, `Credit purchase: ${packageName || 'Unknown Package'}`, stripePaymentIntentId]
      )
      
      await query('COMMIT')
      
      // Get updated credit information
      const updatedCredits = await queryOne(
        'SELECT credits_remaining FROM user_credits WHERE user_id = $1',
        [user.userId]
      )
      
      console.log(`💳 Credits added for user ${user.userId}: +${creditsToAdd} credits (${packageName})`)
      
      return NextResponse.json({
        success: true,
        credits: updatedCredits.credits_remaining,
        message: `Successfully added ${creditsToAdd} credits`
      })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
    
  } catch (error) {
    console.error('❌ Credit addition error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add credits' },
      { status: 500 }
    )
  }
}

