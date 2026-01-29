import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import Stripe from 'stripe'
import { sendSubscriptionReactivationEmail } from '@/lib/subscription-email-service'
import { getStripe, getPlanTypeFromPriceId } from '@/lib/stripe-config'

// Get subscription details
async function handleGetSubscription(request: NextRequest, user: any) {
  try {
    // Get user's subscription ID from database
    const userData = await queryOne(
      `SELECT stripe_subscription_id, plan_type, email FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData || !userData.stripe_subscription_id) {
      return NextResponse.json({
        success: true,
        subscription: null,
        message: 'No active subscription'
      })
    }

    // First, verify the subscription exists and get it from Stripe
    let subscription: Stripe.Subscription
    let subscriptionFound = false
    
    try {
      subscription = await getStripe().subscriptions.retrieve(userData.stripe_subscription_id, {
        expand: ['latest_invoice', 'customer']
      })
      
      // Verify this subscription is actually active and belongs to this user
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        subscriptionFound = true
      }
    } catch (error: any) {
      console.error('❌ Subscription not found in Stripe:', error.message)
      
      // If subscription not found, try to find it by customer email
      if (userData.email) {
        try {
          const customers = await getStripe().customers.list({
            email: userData.email,
            limit: 1
          })
          
          if (customers.data.length > 0) {
            const customer = customers.data[0]
            
            // Get active subscriptions for this customer
            const subscriptions = await getStripe().subscriptions.list({
              customer: customer.id,
              status: 'all',
              limit: 10
            })
            
            // Find the most recent active subscription
            const activeSubscription = subscriptions.data.find(sub => 
              sub.status === 'active' || sub.status === 'trialing'
            ) || subscriptions.data[0]
            
            if (activeSubscription) {
              subscription = await getStripe().subscriptions.retrieve(activeSubscription.id, {
                expand: ['latest_invoice', 'customer']
              })
              
              // Update database with correct subscription ID
              await queryOne(
                `UPDATE users SET stripe_subscription_id = $1, updated_at = NOW() WHERE id = $2`,
                [activeSubscription.id, user.userId]
              )
            } else {
              return NextResponse.json({
                success: true,
                subscription: null,
                message: 'No active subscription found'
              })
            }
          } else {
            return NextResponse.json({
              success: true,
              subscription: null,
              message: 'No customer found in Stripe'
            })
          }
        } catch (searchError) {
          console.error('❌ Error searching for subscription:', searchError)
          return NextResponse.json({
            success: true,
            subscription: null,
            message: 'Subscription not found in Stripe'
          })
        }
      } else {
        return NextResponse.json({
          success: true,
          subscription: null,
          message: 'Subscription not found in Stripe'
        })
      }
    }
    
    // Always verify we have the most recent active subscription
    if (userData.email) {
      try {
        // Get customer by email to find the correct subscription
        const customers = await getStripe().customers.list({
          email: userData.email,
          limit: 1
        })
        
        if (customers.data.length > 0) {
          const customer = customers.data[0]
          const allSubscriptions = await getStripe().subscriptions.list({
            customer: customer.id,
            status: 'all',
            limit: 10
          })
          
          // Find the most recent active subscription (sort by created date, most recent first)
          const activeSubscriptions = allSubscriptions.data
            .filter(sub => sub.status === 'active' || sub.status === 'trialing')
            .sort((a, b) => b.created - a.created) // Most recent first
          
          if (activeSubscriptions.length > 0) {
            const mostRecentActive = activeSubscriptions[0]
            
            // If it's different from what we have, use the correct one
            if (mostRecentActive.id !== subscription.id) {
              subscription = await getStripe().subscriptions.retrieve(mostRecentActive.id, {
                expand: ['latest_invoice', 'customer']
              })
              
              // Update database with correct subscription ID
              await queryOne(
                `UPDATE users SET stripe_subscription_id = $1, updated_at = NOW() WHERE id = $2`,
                [mostRecentActive.id, user.userId]
              )
            }
          }
        }
      } catch (verifyError) {
        console.error('Error verifying subscription:', verifyError)
      }
    }
    
    // ALWAYS get dates from UPCOMING invoice - it shows the CURRENT billing period
    // The latest paid invoice only shows the period that was just paid, not the current period
    let invoicePeriodStart: number | null = null
    let invoicePeriodEnd: number | null = null
    let invoiceSource = 'none'
    
    try {
      // ALWAYS use upcoming invoice - it shows the current billing period (25 Nov to 25 Dec)
      // The latest invoice shows the period that was just paid (which might be the same start/end)
      let invoiceToUse: Stripe.Invoice | null = null
      
      try {
        const upcomingInvoice = await (getStripe().invoices as any).retrieveUpcoming({
          subscription: subscription.id
        })
        invoiceToUse = upcomingInvoice
        invoiceSource = 'upcoming_invoice'
      } catch (upcomingError: any) {
        // If upcoming invoice fails, try to calculate from subscription + billing interval
        const billingInterval = subscription.items.data[0]?.price?.recurring?.interval
        const billingIntervalCount = subscription.items.data[0]?.price?.recurring?.interval_count || 1
        
        // Use subscription created date or current period start if available
        const periodStart = (subscription as any).current_period_start || subscription.created
        
        if (periodStart && billingInterval === 'month') {
          const startDate = new Date(periodStart * 1000)
          const endDate = new Date(startDate)
          endDate.setMonth(endDate.getMonth() + billingIntervalCount)
          
          invoicePeriodStart = periodStart
          invoicePeriodEnd = Math.floor(endDate.getTime() / 1000)
          invoiceSource = 'calculated_from_subscription'
        }
      }
      
      if (invoiceToUse) {
        invoicePeriodStart = invoiceToUse.period_start || null
        invoicePeriodEnd = invoiceToUse.period_end || null
        
        // Validate that dates are different
        if (invoicePeriodStart && invoicePeriodEnd && invoicePeriodStart === invoicePeriodEnd) {
          // Calculate from subscription
          const billingInterval = subscription.items.data[0]?.price?.recurring?.interval
          const billingIntervalCount = subscription.items.data[0]?.price?.recurring?.interval_count || 1
          
          if (billingInterval === 'month' && invoicePeriodStart) {
            const startDate = new Date(invoicePeriodStart * 1000)
            const endDate = new Date(startDate)
            endDate.setMonth(endDate.getMonth() + billingIntervalCount)
            invoicePeriodEnd = Math.floor(endDate.getTime() / 1000)
            invoiceSource = 'calculated_from_invoice_start'
          }
        }
      }
    } catch (invoiceError) {
      console.error('Error getting invoice:', invoiceError)
    }

    // Get price details
    const price = subscription.items.data[0]?.price
    const billingPeriod = price?.recurring?.interval === 'month' ? 'monthly' : 'yearly'
    const amount = price ? `£${(price.unit_amount || 0) / 100}` : 'N/A'

    // Get dates from Stripe - ALWAYS prioritize invoice dates as they're more reliable
    let currentPeriodStart: string | null = null
    let currentPeriodEnd: string | null = null
    
    // Use invoice dates if available (more reliable than subscription object)
    if (invoicePeriodStart && invoicePeriodEnd) {
      currentPeriodStart = new Date(invoicePeriodStart * 1000).toISOString()
      currentPeriodEnd = new Date(invoicePeriodEnd * 1000).toISOString()
    } else {
      // Fallback to subscription dates if invoice dates not available
      if ((subscription as any).current_period_start && typeof (subscription as any).current_period_start === 'number') {
        currentPeriodStart = new Date((subscription as any).current_period_start * 1000).toISOString()
      } else if ((subscription as any).current_period_start) {
        currentPeriodStart = new Date((subscription as any).current_period_start as any).toISOString()
      }
      
      if ((subscription as any).current_period_end && typeof (subscription as any).current_period_end === 'number') {
        currentPeriodEnd = new Date((subscription as any).current_period_end * 1000).toISOString()
      } else if ((subscription as any).current_period_end) {
        currentPeriodEnd = new Date((subscription as any).current_period_end as any).toISOString()
      }
    }

    // Next billing date is the same as current period end for active subscriptions
    const nextBillingDate = !subscription.cancel_at_period_end && currentPeriodEnd
      ? currentPeriodEnd
      : null

    // Access end date is when subscription will end if cancelled
    const accessEndDate = subscription.cancel_at_period_end && currentPeriodEnd
      ? currentPeriodEnd
      : null

    const subscriptionData = {
      id: subscription.id,
      status: subscription.status,
      planName: getPlanNameFromPriceId(price?.id || ''),
      amount,
      billingPeriod,
      nextBillingDate,
      accessEndDate,
      cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
      currentPeriodStart,
      currentPeriodEnd,
    }

    return NextResponse.json({
      success: true,
      subscription: subscriptionData
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
    const subscription = await getStripe().subscriptions.update(
      userData.stripe_subscription_id,
      {
        cancel_at_period_end: true
      }
    )

    // Calculate access end date
    const accessEndDate = (subscription as any).current_period_end
      ? new Date((subscription as any).current_period_end * 1000)
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
    // Get user's subscription ID, email, and name from database
    const userData = await queryOne(
      `SELECT stripe_subscription_id, email, first_name, last_name FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData || !userData.stripe_subscription_id) {
      return NextResponse.json(
        { success: false, error: 'No subscription found' },
        { status: 404 }
      )
    }

    // Reactivate subscription by removing cancel_at_period_end
    const subscription = await getStripe().subscriptions.update(
      userData.stripe_subscription_id,
      {
        cancel_at_period_end: false
      }
    )

    // Get subscription details for email
    const price = subscription.items.data[0]?.price
    const planName = getPlanNameFromPriceId(price?.id || '')
    const billingPeriod = price?.recurring?.interval === 'month' ? 'Monthly' : 'Yearly'
    
    // Calculate next billing date - try multiple sources
    let nextBillingDate: string | null = null
    
    // First, try to get from current_period_end
    if ((subscription as any).current_period_end) {
      nextBillingDate = new Date((subscription as any).current_period_end * 1000).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } else {
      // Try to get from upcoming invoice
      try {
        const upcomingInvoice = await (getStripe().invoices as any).retrieveUpcoming({
          subscription: subscription.id
        })
        if (upcomingInvoice.period_end) {
          nextBillingDate = new Date(upcomingInvoice.period_end * 1000).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        }
      } catch (invoiceError) {

      }
      
      // If still no date, calculate from billing interval
      if (!nextBillingDate && (subscription as any).current_period_start) {
        const billingInterval = price?.recurring?.interval || 'month'
        const intervalCount = price?.recurring?.interval_count || 1
        const periodStart = new Date((subscription as any).current_period_start * 1000)
        const periodEnd = new Date(periodStart)
        
        if (billingInterval === 'month') {
          periodEnd.setMonth(periodEnd.getMonth() + intervalCount)
        } else if (billingInterval === 'year') {
          periodEnd.setFullYear(periodEnd.getFullYear() + intervalCount)
        }
        
        nextBillingDate = periodEnd.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
      }
    }

    const reactivationDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    // Send reactivation email
    if (userData.email) {
      // Get user's name
      const firstName = userData.first_name || ''
      const lastName = userData.last_name || ''
      const customerName = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : undefined

      await sendSubscriptionReactivationEmail({
        customerEmail: userData.email,
        customerName,
        planName,
        reactivationDate,
        nextBillingDate: nextBillingDate || undefined,
        billingPeriod: billingPeriod as 'Monthly' | 'Yearly'
      })

    }

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
    'price_1StEUBRYsgNlHbsUvQSjyHmc': 'Unlimited Access Monthly',
    'price_1StEV9RYsgNlHbsUKYgQYc9Y': 'Unlimited Access Yearly',
  }
  return planNames[priceId] || 'Unknown Plan'
}

// Sync/verify subscription link with Stripe
async function handleSyncSubscription(request: NextRequest, user: any) {
  try {
    // Get user data
    const userData = await queryOne(
      `SELECT stripe_subscription_id, plan_type, email FROM users WHERE id = $1`,
      [user.userId]
    )

    if (!userData || !userData.email) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Find customer in Stripe by email
    const customers = await getStripe().customers.list({
      email: userData.email,
      limit: 1
    })

    if (customers.data.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No customer found in Stripe',
        message: 'No Stripe customer exists for this email'
      })
    }

    const customer = customers.data[0]

    // Get all subscriptions for this customer
    const subscriptions = await getStripe().subscriptions.list({
      customer: customer.id,
      status: 'all',
      limit: 10
    })

    // Find the most recent active subscription
    const activeSubscription = subscriptions.data.find(sub => 
      sub.status === 'active' || sub.status === 'trialing'
    ) || subscriptions.data.find(sub => sub.status !== 'canceled' && sub.status !== 'unpaid')

    if (!activeSubscription) {
      return NextResponse.json({
        success: false,
        error: 'No active subscription found',
        message: 'No active subscription found in Stripe for this customer'
      })
    }

    // Get full subscription details
    const subscription = await getStripe().subscriptions.retrieve(activeSubscription.id, {
      expand: ['latest_invoice', 'customer']
    })

    // Determine plan type from subscription price
    const priceId = subscription.items.data[0]?.price?.id
    const planType = priceId ? getPlanTypeFromPriceId(priceId) : 'complete_access'

    // Update database with subscription ID AND activate the plan
    await query('BEGIN')
    try {
      // Update user's plan and subscription ID
      await query(
        `UPDATE users SET plan_type = $1, stripe_subscription_id = $2, updated_at = NOW() 
         WHERE id = $3`,
        [planType, subscription.id, user.userId]
      )

      // Set unlimited credits for subscription users
      // First ensure user_credits row exists
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
      console.log(`✅ Synced and activated subscription for user ${user.userId}: plan_type=${planType}, subscription_id=${subscription.id}`)
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }

    return NextResponse.json({
      success: true,
      message: 'Subscription synced and activated successfully',
      subscription: {
        id: subscription.id,
        status: subscription.status,
        currentPeriodStart: (subscription as any).current_period_start
          ? new Date((subscription as any).current_period_start * 1000).toISOString()
          : null,
        currentPeriodEnd: (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toISOString()
          : null,
      }
    })
  } catch (error: any) {
    console.error('Error syncing subscription:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to sync subscription' },
      { status: 500 }
    )
  }
}

export const GET = requireAuth(handleGetSubscription)
export const DELETE = requireAuth(handleCancelSubscription)
export const POST = requireAuth(async (request: NextRequest, user: any) => {
  const body = await request.json()
  if (body.action === 'reactivate') {
    return handleReactivateSubscription(request, user)
  } else if (body.action === 'sync') {
    return handleSyncSubscription(request, user)
  }
  return NextResponse.json(
    { success: false, error: 'Invalid action' },
    { status: 400 }
  )
})


