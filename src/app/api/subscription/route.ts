import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'
import { getStripe } from '@/lib/stripe-config'
import { sendSubscriptionReactivationEmail } from '@/lib/subscription-email-service'

function getPlanNameFromPriceId(priceId: string): string {
  // Map price IDs to plan names
  const planNames: Record<string, string> = {
    'price_1StEUBRYsgNlHbsUvQSjyHmc': 'Unlimited Access Monthly',
    'price_1StEV9RYsgNlHbsUKYgQYc9Y': 'Unlimited Access Yearly',
    'price_1StELRRYsgNlHbsUNKrVhV17': 'Starter Pack',
    'price_1StEMlRYsgNlHbsUuG03eTvT': 'Professional Pack',
    'price_1StENrRYsgNlHbsUhxHMd8pf': 'Business Pack',
    'price_1StEOSRYsgNlHbsU5jXg5PWx': 'Enterprise Pack',
  }
  
  // Add per-user pricing (organization seats) - check environment variables
  const perUserMonthlyPriceId = process.env.STRIPE_PER_USER_PRICE_ID
  const perUserYearlyPriceId = process.env.STRIPE_PER_USER_PRICE_ID_YEARLY
  
  if (perUserMonthlyPriceId && priceId === perUserMonthlyPriceId) {
    return 'Per User Seat (Monthly)'
  }
  
  if (perUserYearlyPriceId && priceId === perUserYearlyPriceId) {
    return 'Per User Seat (Yearly)'
  }
  
  return planNames[priceId] || 'Unknown Plan'
}

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

    // If user has no subscription ID in database, return null
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
      
      // Get plan name and amount from price
      const planName = price?.id ? getPlanNameFromPriceId(price.id) : 'Unknown Plan'
      const amount = price?.unit_amount ? `£${(price.unit_amount / 100).toFixed(2)}` : 'N/A'
      
      // Fix plan_type if it's wrong (e.g., set to 'free' when subscription is still active)
      // Subscription is still active if status is 'active' or 'trialing', even if cancel_at_period_end is true
      const isActuallyEnded = subscription.status === 'canceled' || 
                              subscription.status === 'unpaid' || 
                              subscription.status === 'past_due' ||
                              subscription.status === 'incomplete_expired'
      const shouldBeCompleteAccess = !isActuallyEnded
      
      if (shouldBeCompleteAccess && userData.plan_type !== 'complete_access') {
        console.log(`⚠️ Fixing plan_type: user has active subscription but plan_type is '${userData.plan_type}', updating to 'complete_access'`)
        await queryOne(
          `UPDATE users SET plan_type = 'complete_access', updated_at = NOW() WHERE id = $1`,
          [user.userId]
        )
        userData.plan_type = 'complete_access'
      } else if (!shouldBeCompleteAccess && userData.plan_type === 'complete_access') {
        console.log(`⚠️ Fixing plan_type: subscription is ended but plan_type is 'complete_access', updating to 'free'`)
        await queryOne(
          `UPDATE users SET plan_type = 'free', updated_at = NOW() WHERE id = $1`,
          [user.userId]
        )
        userData.plan_type = 'free'
      }
      
      console.log(`📋 Subscription API: Found subscription ${subscription.id}, status: ${subscription.status}, cancel_at_period_end: ${subscription.cancel_at_period_end}, planName: ${planName}, plan_type: ${userData.plan_type}`)
      
      // Calculate next billing date (same as current period end if not cancelled)
      const nextBillingDate = subscription.cancel_at_period_end 
        ? null 
        : ((subscription as any).current_period_end 
          ? new Date((subscription as any).current_period_end * 1000).toISOString() 
          : null)
      
      // Calculate access end date (current period end if cancelled, null if active)
      const accessEndDate = subscription.cancel_at_period_end 
        ? ((subscription as any).current_period_end 
          ? new Date((subscription as any).current_period_end * 1000).toISOString() 
          : null)
        : null
      
      const subscriptionData = {
        id: subscription.id,
        status: subscription.status,
        planName,
        amount,
        billingPeriod,
        nextBillingDate,
        accessEndDate,
        cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
        currentPeriodStart: (subscription as any).current_period_start
          ? new Date((subscription as any).current_period_start * 1000).toISOString()
          : null,
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

    // Send reactivation confirmation email (fire-and-forget; don't fail the request)
    const userDetails = await queryOne(
      `SELECT email, first_name, last_name FROM users WHERE id = $1`,
      [user.userId]
    )
    if (userDetails?.email) {
      const price = subscription.items.data[0]?.price
      const planName = price?.id ? getPlanNameFromPriceId(price.id) : 'Unlimited Access'
      const billingPeriod = price?.recurring?.interval === 'year' ? 'Yearly' : 'Monthly'
      const reactivationDate = new Date().toLocaleDateString('en-GB', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
      const sub = subscription as { current_period_end?: number }
      const nextBillingDate = sub.current_period_end
        ? (() => {
            const d = new Date(sub.current_period_end * 1000)
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
            return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`
          })()
        : undefined
      const firstName = userDetails.first_name || ''
      const lastName = userDetails.last_name || ''
      const customerName = `${firstName} ${lastName}`.trim() || undefined
      sendSubscriptionReactivationEmail({
        customerEmail: userDetails.email,
        customerName,
        planName,
        reactivationDate,
        nextBillingDate,
        billingPeriod
      }).catch((err) => console.error('Failed to send reactivation email:', err))
    }

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
