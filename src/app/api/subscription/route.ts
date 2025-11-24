import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
})

// Get subscription details
async function handleGetSubscription(request: NextRequest, user: any) {
  try {
    // Get user's subscription ID from database
    const userData = await queryOne(
      `SELECT stripe_subscription_id, plan_type FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData || !userData.stripe_subscription_id) {
      return NextResponse.json({
        success: true,
        subscription: null,
        message: 'No active subscription'
      })
    }

    // Get subscription details from Stripe
    const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id)

    // Get price details
    const price = subscription.items.data[0]?.price
    const billingPeriod = price?.recurring?.interval === 'month' ? 'monthly' : 'yearly'
    const amount = price ? `$${(price.unit_amount || 0) / 100}` : 'N/A'

    // Calculate next billing date
    const nextBillingDate = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null

    // Calculate access end date (when subscription will end)
    const accessEndDate = subscription.cancel_at_period_end && subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        planName: getPlanNameFromPriceId(price?.id || ''),
        amount,
        billingPeriod,
        nextBillingDate: nextBillingDate?.toISOString() || null,
        accessEndDate: accessEndDate?.toISOString() || null,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        currentPeriodStart: subscription.current_period_start
          ? new Date(subscription.current_period_start * 1000).toISOString()
          : null,
        currentPeriodEnd: subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toISOString()
          : null,
      }
    })
  } catch (error: any) {
    console.error('Error fetching subscription:', error)
    
    // If subscription not found in Stripe, return null
    if (error.type === 'StripeInvalidRequestError' && error.code === 'resource_missing') {
      return NextResponse.json({
        success: true,
        subscription: null,
        message: 'Subscription not found'
      })
    }

    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription details' },
      { status: 500 }
    )
  }
}

// Cancel subscription
async function handleCancelSubscription(request: NextRequest, user: any) {
  try {
    // Get user's subscription ID from database
    const userData = await queryOne(
      `SELECT stripe_subscription_id FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData || !userData.stripe_subscription_id) {
      return NextResponse.json(
        { success: false, error: 'No active subscription found' },
        { status: 404 }
      )
    }

    // Cancel subscription at period end (so user keeps access until period ends)
    const subscription = await stripe.subscriptions.update(
      userData.stripe_subscription_id,
      {
        cancel_at_period_end: true
      }
    )

    // Calculate access end date
    const accessEndDate = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000)
      : null

    return NextResponse.json({
      success: true,
      message: 'Subscription will be cancelled at the end of the current billing period',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
        accessEndDate: accessEndDate?.toISOString() || null,
      }
    })
  } catch (error: any) {
    console.error('Error cancelling subscription:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}

// Reactivate subscription (if cancelled but not yet ended)
async function handleReactivateSubscription(request: NextRequest, user: any) {
  try {
    // Get user's subscription ID from database
    const userData = await queryOne(
      `SELECT stripe_subscription_id FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData || !userData.stripe_subscription_id) {
      return NextResponse.json(
        { success: false, error: 'No subscription found' },
        { status: 404 }
      )
    }

    // Reactivate subscription by removing cancel_at_period_end
    const subscription = await stripe.subscriptions.update(
      userData.stripe_subscription_id,
      {
        cancel_at_period_end: false
      }
    )

    return NextResponse.json({
      success: true,
      message: 'Subscription reactivated successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      }
    })
  } catch (error: any) {
    console.error('Error reactivating subscription:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reactivate subscription' },
      { status: 500 }
    )
  }
}

function getPlanNameFromPriceId(priceId: string): string {
  const planNames: Record<string, string> = {
    'price_1SWNfpDlESHKijI261EHN47W': 'Unlimited Monthly',
    'price_1SWNgrDlESHKijI27OB0Qyg5': 'Unlimited Yearly',
  }
  return planNames[priceId] || 'Unknown Plan'
}

export const GET = requireAuth(handleGetSubscription)
export const DELETE = requireAuth(handleCancelSubscription)
export const POST = requireAuth(async (request: NextRequest, user: any) => {
  const body = await request.json()
  if (body.action === 'reactivate') {
    return handleReactivateSubscription(request, user)
  }
  return NextResponse.json(
    { success: false, error: 'Invalid action' },
    { status: 400 }
  )
})

