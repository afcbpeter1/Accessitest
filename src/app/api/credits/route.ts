import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import { NotificationService } from '@/lib/notification-service'
import { getUserCredits, deductCredits, addCredits } from '@/lib/credit-service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    // Get user's credit information (organization or personal)
    const creditInfo = await getUserCredits(user.userId)
    
    // Get user info for plan type
    const userInfo = await queryOne(
      `SELECT plan_type, email FROM users WHERE id = $1`,
      [user.userId]
    )

    // Get recent scan history (include organization transactions)
    const scanHistory = await query(
      `SELECT * FROM credit_transactions 
       WHERE user_id = $1 AND transaction_type = 'usage'
       ORDER BY created_at DESC 
       LIMIT 10`,
      [user.userId]
    )

    const canScan = creditInfo.unlimited_credits || creditInfo.credits_remaining > 0

    return NextResponse.json({
      success: true,
      userId: user.userId,
      credits: creditInfo.credits_remaining,
      creditsRemaining: creditInfo.credits_remaining,
      unlimitedCredits: creditInfo.unlimited_credits,
      planType: userInfo?.plan_type || 'free',
      scanHistory: scanHistory.rows,
      canScan,
      isOrganization: creditInfo.is_organization,
      organizationId: creditInfo.organization_id
    })
  } catch (error) {
    console.error('❌ Error fetching user credits:', error)
    // Return 401 for authentication errors, 500 for other errors
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
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
    const creditInfo = await getUserCredits(user.userId)
    
    // Check if user has unlimited credits
    if (creditInfo.unlimited_credits) {
      // Unlimited user, log the scan but don't deduct credits
      await query(
        `INSERT INTO credit_transactions (user_id, organization_id, transaction_type, credits_amount, description)
         VALUES ($1, $2, $3, $4, $5)`,
        [user.userId, creditInfo.organization_id || null, 'usage', 0, `${scanType} scan: ${fileName || scanId}`]
      )
      
      return NextResponse.json({
        success: true,
        canScan: true,
        credits: creditInfo.credits_remaining,
        unlimitedCredits: true,
        message: 'Unlimited scan completed'
      })
    }
    
    // Check if user has enough credits
    if (creditInfo.credits_remaining < 1) {
      // Create notification for insufficient credits
      await NotificationService.notifyInsufficientCredits(user.userId)
      
      return NextResponse.json(
        { success: false, error: 'Insufficient credits', canScan: false },
        { status: 402 }
      )
    }
    
    // Deduct credits using the credit service
    const result = await deductCredits(
      user.userId,
      1,
      `${scanType} scan: ${fileName || scanId}`
    )
    
    if (!result.success) {
      // Create notification for insufficient credits
      await NotificationService.notifyInsufficientCredits(user.userId)
      
      return NextResponse.json(
        { success: false, error: result.error || 'Insufficient credits', canScan: false },
        { status: 402 }
      )
    }
    
    // Create notification for low credits if remaining credits are low
    if (result.credits_remaining <= 1 && result.credits_remaining > 0) {
      await NotificationService.notifyLowCredits(user.userId, result.credits_remaining)
    }
    
    return NextResponse.json({
      success: true,
      canScan: true,
      credits: result.credits_remaining,
      unlimitedCredits: false,
      message: 'Scan completed, 1 credit deducted'
    })
    
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
    
    // Add credits using the credit service
    const result = await addCredits(
      user.userId,
      creditsToAdd,
      `Credit purchase: ${packageName || 'Unknown Package'}`,
      stripePaymentIntentId
    )
    
    `)
    
    return NextResponse.json({
      success: true,
      credits: result.credits_remaining,
      message: `Successfully added ${creditsToAdd} credits`
    })
    
  } catch (error) {
    console.error('❌ Credit addition error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add credits' },
      { status: 500 }
    )
  }
}

