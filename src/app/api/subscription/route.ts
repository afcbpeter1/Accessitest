import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { getStripe } from '@/lib/stripe-config'

/**
 * GET /api/subscription
 * Get user's subscription details
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    const userData = await queryOne(
      `SELECT stripe_subscription_id, plan_type, email FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // If user has no subscription, return null
    if (!userData.stripe_subscription_id) {
      return NextResponse.json({
        success: true,
        subscription: null
      })
    }

    // Get subscription from Stripe
    try {
      const subscription = await getStripe().subscriptions.retrieve(userData.stripe_subscription_id)
      const price = subscription.items.data[0]?.price
      const billingPeriod = price?.recurring?.interval === 'month' ? 'monthly' : 'yearly'
      
      const subscriptionData = {
        id: subscription.id,
        status: subscription.status,
        billingPeriod,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        currentPeriodEnd: (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null,
        planType: userData.plan_type
      }

      return NextResponse.json({
        success: true,
        subscription: subscriptionData
      })
    } catch (stripeError: any) {
      // Subscription not found in Stripe, return null
      if (stripeError.code === 'resource_missing') {
        return NextResponse.json({
          success: true,
          subscription: null
        })
      }
      throw stripeError
    }
  } catch (error) {
    console.error('Error fetching subscription:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch subscription details'
      },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/subscription
 * Cancel subscription (set to cancel at period end)
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    const userData = await queryOne(
      `SELECT stripe_subscription_id FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (!userData.stripe_subscription_id) {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 400 }
      )
    }

    // Cancel subscription at period end
    const subscription = await getStripe().subscriptions.update(userData.stripe_subscription_id, {
      cancel_at_period_end: true
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the billing period',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    })
  } catch (error) {
    console.error('Error cancelling subscription:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel subscription'
      },
      { status: 500 }
    )
  }
}

/**
 * POST /api/subscription
 * Reactivate a cancelled subscription
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { action } = await request.json()

    if (action !== 'reactivate') {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }

    const userData = await queryOne(
      `SELECT stripe_subscription_id FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    if (!userData.stripe_subscription_id) {
      return NextResponse.json(
        { success: false, error: 'No subscription found' },
        { status: 400 }
      )
    }

    // Reactivate subscription by removing cancel_at_period_end
    const subscription = await getStripe().subscriptions.update(userData.stripe_subscription_id, {
      cancel_at_period_end: false
    })

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end
      }
    })
  } catch (error) {
    console.error('Error reactivating subscription:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to reactivate subscription'
      },
      { status: 500 }
    )
  }
}
