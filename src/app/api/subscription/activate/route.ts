import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'
import { getStripe, getPlanTypeFromPriceId } from '@/lib/stripe-config'

/**
 * Manually activate a subscription from Stripe
 * This is a fallback if webhooks don't fire
 */
export const POST = requireAuth(async (request: NextRequest, user: any) => {
  try {
    const { subscriptionId } = await request.json()

    if (!subscriptionId) {
      return NextResponse.json(
        { success: false, error: 'Subscription ID is required' },
        { status: 400 }
      )
    }

    // Get subscription from Stripe
    const subscription = await getStripe().subscriptions.retrieve(subscriptionId, {
      expand: ['customer']
    })

    // Verify this subscription belongs to the user
    const userData = await queryOne(
      `SELECT email FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData?.email) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if customer email matches
    const customer = await getStripe().customers.retrieve(subscription.customer as string)
    if (!customer.deleted && 'email' in customer && customer.email !== userData.email) {
      return NextResponse.json(
        { success: false, error: 'Subscription does not belong to this user' },
        { status: 403 }
      )
    }

    // Get plan type from subscription price
    const priceId = subscription.items.data[0]?.price?.id
    if (!priceId) {
      return NextResponse.json(
        { success: false, error: 'Could not determine plan from subscription' },
        { status: 400 }
      )
    }

    const planType = getPlanTypeFromPriceId(priceId)

    // Activate subscription
    await query('BEGIN')
    try {
      // Update user's plan and subscription ID
      await query(
        `UPDATE users SET plan_type = $1, stripe_subscription_id = $2, updated_at = NOW() 
         WHERE id = $3`,
        [planType, subscription.id, user.userId]
      )

      // Ensure user_credits row exists and set unlimited
      const existingCredits = await queryOne(
        `SELECT user_id FROM user_credits WHERE user_id = $1`,
        [user.userId]
      )

      if (!existingCredits) {
        await query(
          `INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
           VALUES ($1, $2, $3, $4)`,
          [user.userId, 0, 0, true]
        )
      } else {
        await query(
          `UPDATE user_credits 
           SET unlimited_credits = true, updated_at = NOW() 
           WHERE user_id = $1`,
          [user.userId]
        )
      }

      await query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Subscription activated successfully',
        planType,
        subscriptionId: subscription.id
      })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error: any) {
    console.error('Error activating subscription:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to activate subscription' },
      { status: 500 }
    )
  }
})
