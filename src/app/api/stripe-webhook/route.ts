import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { query, queryOne } from '@/lib/database'
import { getStripe, getPlanTypeFromPriceId, getCreditAmountFromPriceId, CREDIT_AMOUNTS } from '@/lib/stripe-config'
import { sendReceiptEmail, ReceiptData } from '@/lib/receipt-email-service'
import { sendSubscriptionPaymentEmail, sendSubscriptionCancellationEmail } from '@/lib/subscription-email-service'
import { NotificationService } from '@/lib/notification-service'
import { addCredits, activateUnlimitedCredits, deactivateUnlimitedCredits, getUserCredits } from '@/lib/credit-service'
import { updateOrganizationSubscription, applyPendingSeatReduction } from '@/lib/organization-billing'

// Trim whitespace to avoid issues with .env file formatting
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || ''

// Disable body parsing - we need the raw body for signature verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Important: Don't parse the body as JSON - we need the raw string
export async function POST(request: NextRequest) {
  try {
    // Log immediately - this confirms the endpoint was hit
    console.log('='.repeat(80))
    console.log('🔔 WEBHOOK ENDPOINT HIT!')
    console.log('⏰ Timestamp:', new Date().toISOString())
    console.log('📍 URL:', request.url)
    console.log('📋 Method:', request.method)
    console.log('='.repeat(80))
    
    // Check webhook secret exists
    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET is not configured')
      return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 500 })
    }

    // Get raw body as text - this is critical for signature verification
    // Must use .text() not .json() to preserve exact formatting
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')

    if (!signature) {
      console.error('❌ Missing stripe-signature header')
      return NextResponse.json({ error: 'Missing signature header' }, { status: 400 })
    }

    console.log('📝 Body length:', body.length)
    console.log('🔐 Signature header present:', !!signature)
    console.log('🔑 Webhook secret configured:', !!webhookSecret)
    console.log('🔑 Webhook secret length:', webhookSecret.length)
    console.log('🔑 Webhook secret first 10 chars:', webhookSecret.substring(0, 10))
    console.log('🔑 Webhook secret last 10 chars:', webhookSecret.substring(webhookSecret.length - 10))
    console.log('🔑 Expected from CLI starts with: whsec_4a2b...')
    console.log('🔑 Expected from CLI ends with: ...73aa49')
    console.log('🔑 Secret matches CLI start?', webhookSecret.startsWith('whsec_4a2b'))
    console.log('🔑 Secret matches CLI end?', webhookSecret.endsWith('73aa49'))
    
    // Check for whitespace issues
    const trimmedSecret = webhookSecret.trim()
    if (trimmedSecret !== webhookSecret) {
      console.warn('⚠️ WARNING: Webhook secret has leading/trailing whitespace!')
      console.warn('⚠️ Original length:', webhookSecret.length, 'Trimmed length:', trimmedSecret.length)
    }

    let event: Stripe.Event

    try {
      event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
      console.log('✅ Webhook signature verified successfully')
    } catch (err: any) {
      console.error('❌ Webhook signature verification failed')
      console.error('Error type:', err.type)
      console.error('Error message:', err.message)
      console.error('Signature preview:', signature.substring(0, 50) + '...')
      
      // In development, provide more helpful error messages
      if (process.env.NODE_ENV === 'development') {
        console.error('\n💡 TROUBLESHOOTING TIPS:')
        console.error('1. If using Stripe CLI locally, use: stripe listen --forward-to localhost:3000/api/stripe-webhook')
        console.error('2. Copy the webhook signing secret from the CLI output (starts with whsec_)')
        console.error('3. Set it as STRIPE_WEBHOOK_SECRET in your .env file')
        console.error('4. If using Stripe Dashboard, use the webhook endpoint\'s signing secret')
        console.error('5. Make sure the webhook secret matches the endpoint you\'re testing')
      }
      
      return NextResponse.json({ 
        error: 'Invalid signature',
        message: process.env.NODE_ENV === 'development' 
          ? 'Check console for troubleshooting tips'
          : 'Signature verification failed'
      }, { status: 400 })
    }

    console.log('🔔 Received webhook event:', event.type, event.id)
    console.log('📋 Event object type:', typeof event.data.object)
    if (event.type === 'customer.subscription.updated') {
      const sub = event.data.object as Stripe.Subscription
      console.log('📋 Subscription ID:', sub.id, 'Status:', sub.status, 'Items:', sub.items.data.length)
    }

    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        console.log('📦 Event contains session object:', {
          id: session.id,
          status: session.status,
          payment_status: session.payment_status,
          metadata: session.metadata,
          hasMetadata: !!session.metadata && Object.keys(session.metadata).length > 0,
          customer_email: session.customer_email,
          subscription: session.subscription
        })
        await handleCheckoutSessionCompleted(session)
        // Also check if this is an organization subscription and handle it
        await handleOrganizationCheckoutCompleted(session)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        // Also check if this is an organization subscription
        await handleOrganizationSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        await handleOrganizationSubscriptionUpdated(event.data.object as Stripe.Subscription)
        // Also check if organization seats were added to owner's subscription
        await handleOwnerSubscriptionWithOrganizationSeats(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'payment_intent.succeeded':
        // Only process for direct API payments (not checkout sessions)
        // checkout.session.completed handles all checkout payments
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case 'charge.succeeded':
        // Log but don't process - checkout.session.completed handles all checkout payments
        // and payment_intent.succeeded handles direct API payments
        console.log('📋 Charge succeeded:', (event.data.object as Stripe.Charge).id, '- already handled by checkout.session.completed or payment_intent.succeeded')
        break

      case 'charge.updated':
        // Log but don't process - this is just a status update
        console.log('📋 Charge updated:', (event.data.object as Stripe.Charge).id, 'Status:', (event.data.object as Stripe.Charge).status)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    console.log('✅ Webhook processed successfully')
    console.log('='.repeat(80))
    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('='.repeat(80))
    console.error('❌ WEBHOOK ERROR:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('='.repeat(80))
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('🛒 Processing checkout session completed:', session.id)
  console.log('📋 Session metadata:', JSON.stringify(session.metadata, null, 2))
  console.log('📋 Session customer_email:', session.customer_email)
  console.log('📋 Session customer:', session.customer)
  console.log('📋 Session payment_status:', session.payment_status)
  console.log('📋 Session status:', session.status)
  
  // Validate session exists and is complete
  if (session.status !== 'complete') {
    console.warn(`⚠️ Session ${session.id} is not complete (status: ${session.status}). Skipping processing.`)
    return
  }
  
  if (session.payment_status !== 'paid') {
    console.warn(`⚠️ Session ${session.id} payment status is not 'paid' (status: ${session.payment_status}). Skipping processing.`)
    return
  }
  
  let { userId, priceId, type } = session.metadata || {}
  
  // If userId is missing or empty, try to look up user by email
  if (!userId || userId.trim() === '') {
    const sessionWithDetails = session as Stripe.Checkout.Session & { customer_details?: { email?: string | null } }
    const customerEmail = session.customer_email
      ?? sessionWithDetails.customer_details?.email
      ?? (session.customer
        ? (await getStripe().customers.retrieve(session.customer as string).then(c =>
            !c.deleted && 'email' in c ? c.email : null
          ).catch(() => null))
        : null)
    
    if (customerEmail) {
      console.log(`🔍 userId missing, looking up user by email: ${customerEmail}`)
      const userResult = await query(
        `SELECT id FROM users WHERE email = $1 LIMIT 1`,
        [customerEmail]
      )
      
      if (userResult.rows && userResult.rows.length > 0) {
        userId = userResult.rows[0].id
        console.log(`✅ Found user ${userId} by email ${customerEmail}`)
      } else {
        console.error(`❌ User not found with email: ${customerEmail}`)
      }
    } else {
      console.error(`❌ No customer email available to look up user`)
    }
  }
  
  // If priceId is missing, try to get it from line items
  if (!priceId) {
    console.log('⚠️ priceId missing in metadata, trying to get from line items')
    try {
      const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 })
      if (lineItems.data.length > 0 && lineItems.data[0].price) {
        priceId = lineItems.data[0].price.id
        console.log(`✅ Found priceId from line items: ${priceId}`)
      }
    } catch (error: any) {
      // Handle case where session doesn't exist (expired/deleted)
      if (error?.code === 'resource_missing' || error?.statusCode === 404) {
        console.error(`❌ Checkout session ${session.id} does not exist (may have expired or been deleted)`)
        console.error('⚠️ Cannot process webhook - session not found in Stripe')
        return // Exit early - can't process without a valid session
      }
      console.error('❌ Error retrieving line items:', error)
    }
  }
  
  // If type is missing, try to determine it from priceId
  if (!type && priceId) {
    const { isSubscriptionPriceId, isCreditPriceId } = await import('@/lib/stripe-config')
    if (isCreditPriceId(priceId)) {
      type = 'credits'
      console.log(`✅ Determined type as 'credits' from priceId`)
    } else if (isSubscriptionPriceId(priceId)) {
      type = 'subscription'
      console.log(`✅ Determined type as 'subscription' from priceId`)
    }
  }
  
  if (!userId || userId.trim() === '' || !priceId) {
    console.error('❌ Missing required metadata in checkout session:', { userId, priceId, type })
    console.error('⚠️ Cannot process purchase without userId. Customer email:', session.customer_email)
    console.error('⚠️ Session ID:', session.id)
    console.error('⚠️ This purchase will NOT be processed. Manual intervention required.')
    return
  }

  console.log(`🔍 Processing ${type} purchase for user ${userId}, priceId: ${priceId}`)

  if (type === 'credits') {
    // Get payment intent ID from session for idempotency
    let paymentIntentId: string | undefined = undefined
    if (session.payment_intent) {
      paymentIntentId = session.payment_intent as string
    }
    await handleCreditPurchase(userId, priceId, undefined, session.id, paymentIntentId)
  } else if (type === 'subscription') {
    // Handle subscription purchase - activate immediately just like credits
    console.log(`📋 Subscription purchase detected for user ${userId}, priceId: ${priceId}`)
    
    const planType = getPlanTypeFromPriceId(priceId)
    let subscriptionId: string | null = null
    
    // Try to get subscription ID from session
    if (session.subscription) {
      subscriptionId = session.subscription as string
      console.log(`✅ Subscription ID found in session: ${subscriptionId}`)
    } else {
      // If not in session, try to find it by looking up customer's subscriptions
      console.log('⚠️ Subscription ID not in session, looking up customer subscriptions')
      try {
        const customerId = session.customer as string
        if (customerId) {
          const subscriptions = await getStripe().subscriptions.list({
            customer: customerId,
            limit: 1,
            status: 'all'
          })
          
          if (subscriptions.data.length > 0) {
            // Get the most recent subscription
            const latestSubscription = subscriptions.data[0]
            subscriptionId = latestSubscription.id
            console.log(`✅ Found subscription ID from customer lookup: ${subscriptionId}`)
          }
        }
      } catch (error) {
        console.error('❌ Error looking up customer subscriptions:', error)
      }
    }
    
    // Activate subscription immediately - don't wait for subscription.created event
    // This makes it work just like credits - instant activation
    try {
      await query('BEGIN')
      try {
        // Update user plan immediately
        await query(
          `UPDATE users SET plan_type = $1, stripe_subscription_id = $2, updated_at = NOW() 
           WHERE id = $3`,
          [planType, subscriptionId || '', userId]
        )
        
        // Activate unlimited credits while preserving existing credits (organization-primary model)
        const creditResult = await activateUnlimitedCredits(userId)
        if (creditResult.success) {
          console.log(`✅ Activated unlimited credits for user ${userId}, preserved ${creditResult.credits_remaining} credits`)
        } else {
          console.warn(`⚠️ Failed to activate unlimited credits for user ${userId}`)
        }
        
        await query('COMMIT')
        console.log(`✅ User ${userId} upgraded to ${planType} with unlimited credits IMMEDIATELY (${creditResult.credits_remaining} credits saved)`)
        
        // Create notification
        await NotificationService.notifySubscriptionActivated(userId, planType)
      } catch (error) {
        await query('ROLLBACK')
        throw error
      }
    } catch (error) {
      console.error('❌ Error activating subscription immediately:', error)
      // If this fails, subscription.created event will handle it as fallback
    }
  }

  // Send receipt email (skip for organization checkouts - they get custom billing confirmation)
  const { organization_id } = session.metadata || {}
  if (!organization_id) {
    await sendReceiptEmailFromSession(session)
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('🔄 Processing subscription created:', subscription.id)
  console.log('📋 Subscription metadata:', subscription.metadata)
  
  let { userId, planType } = subscription.metadata || {}
  
  // If userId is missing, try to look up user by customer email
  if (!userId || userId.trim() === '') {
    console.log('⚠️ userId missing in subscription metadata, attempting to look up by customer email')
    
    try {
      const customer = await getStripe().customers.retrieve(subscription.customer as string)
      if (!customer.deleted && 'email' in customer && customer.email) {
        console.log(`🔍 Looking up user by email: ${customer.email}`)
        const userResult = await query(
          `SELECT id FROM users WHERE email = $1 LIMIT 1`,
          [customer.email]
        )
        
        if (userResult.rows && userResult.rows.length > 0) {
          userId = userResult.rows[0].id
          console.log(`✅ Found user ${userId} by email ${customer.email}`)
        } else {
          console.error(`❌ User not found with email: ${customer.email}`)
        }
      }
    } catch (error) {
      console.error('❌ Error looking up user by customer email:', error)
    }
  }
  
  // If planType is missing, try to determine it from the subscription price
  if (!planType) {
    console.log('⚠️ planType missing in subscription metadata, attempting to determine from price')
    if (subscription.items && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id
      planType = getPlanTypeFromPriceId(priceId)
      console.log(`📋 Determined planType: ${planType} from priceId: ${priceId}`)
    }
  }
  
  if (!userId || userId.trim() === '' || !planType) {
    console.error('❌ Missing required information in subscription:', { userId, planType })
    console.error('⚠️ Subscription ID:', subscription.id)
    console.error('⚠️ Customer ID:', subscription.customer)
    return
  }

  try {
    // Check if user already has this plan (might have been set by checkout.session.completed)
    const existingUser = await queryOne(
      `SELECT plan_type, stripe_subscription_id FROM users WHERE id = $1`,
      [userId]
    )
    
    // Only update if plan hasn't been set yet or subscription ID doesn't match
    if (existingUser.plan_type !== planType || existingUser.stripe_subscription_id !== subscription.id) {
      // Start transaction to update user plan and set unlimited credits
      await query('BEGIN')
      
      try {
        // Update user's plan in database
        await query(
          `UPDATE users SET plan_type = $1, stripe_subscription_id = $2, updated_at = NOW() 
           WHERE id = $3`,
          [planType, subscription.id, userId]
        )

        // Activate unlimited credits while preserving existing credits (organization-primary model)
        const creditResult = await activateUnlimitedCredits(userId)
        if (creditResult.success) {
          console.log(`✅ Activated unlimited credits for user ${userId}, preserved ${creditResult.credits_remaining} credits`)
        } else {
          console.warn(`⚠️ Failed to activate unlimited credits for user ${userId}`)
        }

        await query('COMMIT')
        console.log(`✅ Updated user ${userId} to plan ${planType} with unlimited credits (from subscription.created, ${creditResult.credits_remaining} credits saved)`)
      } catch (error) {
        await query('ROLLBACK')
        throw error
      }
    } else {
      console.log(`ℹ️ User ${userId} already has plan ${planType} - skipping update`)
    }

    // Create notification for subscription activation (only if not already done)
    await NotificationService.notifySubscriptionActivated(userId, planType)

    // Send receipt email for subscription
    await sendReceiptEmailFromSubscription(subscription)
  } catch (error) {
    console.error('❌ Error updating user subscription:', error)
  }
}

/** Format Stripe current_period_end (Unix s) as "19 March 2026" in UTC so email matches settings page */
function formatAccessEndDateUTC(currentPeriodEnd: number): string {
  const d = new Date(currentPeriodEnd * 1000)
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const day = d.getUTCDate()
  const month = months[d.getUTCMonth()]
  const year = d.getUTCFullYear()
  return `${day} ${month} ${year}`
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing subscription updated:', subscription.id)
  
  let { userId, planType } = subscription.metadata || {}
  
  // If userId is missing, try to look up user by subscription ID
  if (!userId) {
    console.log('⚠️ userId missing in subscription metadata, attempting to look up by subscription ID')
    try {
      const userResult = await query(
        `SELECT id, email FROM users WHERE stripe_subscription_id = $1 LIMIT 1`,
        [subscription.id]
      )
      
      if (userResult.rows && userResult.rows.length > 0) {
        userId = userResult.rows[0].id
        console.log(`✅ Found user ${userId} by subscription ID ${subscription.id}`)
      } else {
        // Try to get user by customer email
        try {
          const customer = await getStripe().customers.retrieve(subscription.customer as string)
          if (!customer.deleted && 'email' in customer && customer.email) {
            console.log(`🔍 Looking up user by email: ${customer.email}`)
            const userResult = await query(
              `SELECT id FROM users WHERE email = $1 LIMIT 1`,
              [customer.email]
            )
            
            if (userResult.rows && userResult.rows.length > 0) {
              userId = userResult.rows[0].id
              console.log(`✅ Found user ${userId} by email ${customer.email}`)
            }
          }
        } catch (error) {
          console.error('❌ Error looking up user by customer email:', error)
        }
      }
    } catch (error) {
      console.error('❌ Error looking up user by subscription ID:', error)
    }
  }
  
  if (!userId) {
    console.error('❌ Missing userId - cannot process subscription update')
    return
  }

  try {
    // Check if subscription is being cancelled (cancel_at_period_end is true)
    const isCancelling = subscription.cancel_at_period_end === true
    const wasCancelling = subscription.status === 'canceled' || subscription.status === 'unpaid'
    
    // Get plan name from subscription
    let planName = 'Unlimited Access'
    if (subscription.items && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id
      planName = getPlanNameFromPriceId(priceId)
    }
    
    // If planType is missing, try to determine it from the subscription price
    if (!planType && subscription.items && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id
      planType = getPlanTypeFromPriceId(priceId)
      console.log(`📋 Determined planType: ${planType} from priceId: ${priceId}`)
    }
    
    // Update subscription status in database
    // Keep plan_type as 'complete_access' if subscription is active OR cancelled but still in period
    // Only set to 'free' if subscription is actually ended (canceled, unpaid, past_due, etc.)
    const isActuallyEnded = subscription.status === 'canceled' || 
                           subscription.status === 'unpaid' || 
                           subscription.status === 'past_due' ||
                           subscription.status === 'incomplete_expired'
    const newPlanType = isActuallyEnded ? 'free' : (planType || 'complete_access')
    
    await query(
      `UPDATE users SET plan_type = $1, updated_at = NOW() 
       WHERE stripe_subscription_id = $2`,
      [newPlanType, subscription.id]
    )

    // When subscription is no longer active (e.g. past_due, unpaid, canceled), turn off unlimited credits
    // so the user can only scan with saved credits until they pay
    if (isActuallyEnded) {
      try {
        const creditResult = await deactivateUnlimitedCredits(userId)
        if (creditResult.success) {
          console.log(`✅ Deactivated unlimited credits for user ${userId} (subscription ${subscription.status}); ${creditResult.credits_remaining} saved credits remain`)
        }
      } catch (creditError) {
        console.warn('⚠️ Could not deactivate unlimited credits on subscription update:', creditError)
      }
    }

    console.log(`✅ Updated subscription ${subscription.id} status: ${subscription.status}, cancel_at_period_end: ${isCancelling}`)
    
    // If subscription is being cancelled, send cancellation email (unless account was deleted - they get a different email)
    const isAccountDeletion = subscription.metadata?.cancel_reason === 'account_deletion'
    if (isCancelling && !wasCancelling && !isAccountDeletion) {
      console.log('📧 Subscription cancellation detected - sending cancellation email')
      
      // Get user email and name
      let userEmail: string | null = null
      let userName: string | null = null
      let savedCredits = 0
      
      try {
        const userData = await queryOne(
          `SELECT u.email, u.first_name, u.last_name
           FROM users u
           WHERE u.id = $1`,
          [userId]
        )
        
        if (userData) {
          userEmail = userData.email
          // Get credits using credit service (organization-primary model)
          const creditInfo = await getUserCredits(userId)
          savedCredits = creditInfo.credits_remaining || 0
          // Combine first and last name if available
          const firstName = userData.first_name || ''
          const lastName = userData.last_name || ''
          if (firstName || lastName) {
            userName = `${firstName} ${lastName}`.trim()
          }
        }
      } catch (error) {
        console.error('❌ Error getting user data for cancellation email:', error)
      }
      
      if (userEmail) {
        const cancellationDate = new Date().toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })

        // Use subscription from Stripe so access end date matches settings page (same source as /api/subscription)
        let accessEndDate: string
        try {
          const stripe = getStripe()
          const fullSubscription = await stripe.subscriptions.retrieve(subscription.id) as Stripe.Subscription
          const periodEnd = fullSubscription.current_period_end
          if (periodEnd && fullSubscription.current_period_start && periodEnd > fullSubscription.current_period_start) {
            accessEndDate = formatAccessEndDateUTC(periodEnd)
            console.log(`📅 Using Stripe current_period_end (UTC): ${accessEndDate}`)
          } else {
            accessEndDate = formatAccessEndDateUTC(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60) // fallback ~1 month
            console.log('⚠️ current_period_end missing/invalid, using fallback:', accessEndDate)
          }
        } catch (retrieveErr) {
          console.warn('⚠️ Could not retrieve subscription from Stripe, using event object:', retrieveErr)
          if ((subscription as any).current_period_end) {
            accessEndDate = formatAccessEndDateUTC((subscription as any).current_period_end)
          } else {
            accessEndDate = formatAccessEndDateUTC(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)
          }
        }

        console.log('📧 Sending subscription cancellation email:', {
          to: userEmail,
          plan: planName,
          cancellationDate,
          accessEndDate,
          savedCredits
        })

        await sendSubscriptionCancellationEmail({
          customerEmail: userEmail,
          customerName: userName || undefined,
          planName,
          cancellationDate,
          accessEndDate,
          savedCredits: savedCredits > 0 ? savedCredits : undefined
        })
        
        console.log('✅ Subscription cancellation email sent successfully')
      } else {
        console.error('❌ No user email found - cannot send cancellation email')
      }
      
      // Create notification for subscription cancellation
      await NotificationService.notifySubscriptionCancelled(userId)
    }
  } catch (error) {
    console.error('❌ Error updating subscription:', error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing subscription deleted:', subscription.id)
  
  const { userId } = subscription.metadata || {}
  
  try {
    // Get user info before updating
    let userEmail: string | null = null
    let userName: string | null = null
    let savedCredits = 0
    let planName = 'Unlimited Access'
    
    if (userId) {
      const userData = await queryOne(
        `SELECT email, first_name, last_name FROM users WHERE id = $1`,
        [userId]
      )
      if (userData) {
        userEmail = userData.email
        const firstName = userData.first_name || ''
        const lastName = userData.last_name || ''
        if (firstName || lastName) userName = `${firstName} ${lastName}`.trim()
        const creditInfo = await getUserCredits(userId)
        savedCredits = creditInfo.credits_remaining ?? 0
      }
    } else {
      const userData = await queryOne(
        `SELECT id, email, first_name, last_name FROM users WHERE stripe_subscription_id = $1`,
        [subscription.id]
      )
      if (userData) {
        userEmail = userData.email
        const firstName = userData.first_name || ''
        const lastName = userData.last_name || ''
        if (firstName || lastName) userName = `${firstName} ${lastName}`.trim()
        const creditInfo = await getUserCredits(userData.id)
        savedCredits = creditInfo.credits_remaining ?? 0
      }
    }
    
    // Get plan name from subscription
    if (subscription.items && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id
      planName = getPlanNameFromPriceId(priceId)
    }

    // Start transaction to set user back to free plan and remove unlimited credits
    await query('BEGIN')
    
    try {
      // Get userId before updating (needed for credit service)
      const userResult = await queryOne(
        `SELECT id FROM users WHERE stripe_subscription_id = $1`,
        [subscription.id]
      )
      
      if (!userResult) {
        console.warn(`⚠️ No user found for subscription ${subscription.id}`)
        await query('ROLLBACK')
        return
      }
      
      const cancelledUserId = userResult.id
      
      // Set user back to free plan
      await query(
        `UPDATE users SET plan_type = 'free', stripe_subscription_id = NULL, updated_at = NOW() 
         WHERE stripe_subscription_id = $1`,
        [subscription.id]
      )

      // Deactivate unlimited credits while preserving existing saved credits (organization-primary model)
      const creditResult = await deactivateUnlimitedCredits(cancelledUserId)
      if (creditResult.success) {
        console.log(`✅ Deactivated unlimited credits for user ${cancelledUserId}, preserved ${creditResult.credits_remaining} credits`)
      } else {
        console.warn(`⚠️ Failed to deactivate unlimited credits for user ${cancelledUserId}`)
      }

      await query('COMMIT')
      console.log(`Set user ${cancelledUserId} with subscription ${subscription.id} back to free plan (${creditResult.credits_remaining} credits preserved)`)

      // Create notification for subscription cancellation (skip if account was deleted)
      const isAccountDeletion = subscription.metadata?.cancel_reason === 'account_deletion'
      if (userId && !isAccountDeletion) {
        await NotificationService.notifySubscriptionCancelled(userId)
      }
      
      // Send cancellation email (skip if account was deleted - they get account-deleted email instead)
      if (userEmail && !isAccountDeletion) {
        const cancellationDate = new Date().toLocaleDateString('en-GB', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })

        // Use same UTC formatting as settings so email matches (subscription deleted = use event object)
        let accessEndDate: string
        if ((subscription as any).current_period_end && (subscription as any).current_period_start && (subscription as any).current_period_end > (subscription as any).current_period_start) {
          accessEndDate = formatAccessEndDateUTC((subscription as any).current_period_end)
          console.log(`📅 Using Stripe current_period_end (UTC): ${accessEndDate}`)
        } else {
          accessEndDate = formatAccessEndDateUTC(Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60)
          console.log('⚠️ current_period_end missing/invalid, using fallback:', accessEndDate)
        }

        console.log('📧 Sending subscription cancellation email (from deleted handler):', {
          to: userEmail,
          plan: planName,
          cancellationDate,
          accessEndDate,
          savedCredits
        })

        await sendSubscriptionCancellationEmail({
          customerEmail: userEmail,
          customerName: userName || undefined,
          planName,
          cancellationDate,
          accessEndDate,
          savedCredits: savedCredits > 0 ? savedCredits : undefined
        })
      }
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error handling subscription deletion:', error)
  }
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  console.log('💳 Processing invoice.payment_succeeded:', invoice.id)
  
  const inv = invoice as any

  // Proration-only invoice (add seats – pay proration today, seat on renewal): add customer credit so renewal doesn't double-charge proration
  if (inv.metadata?.source === 'add_seats_proration_only' && inv.customer) {
    const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id
    const prorationCents = parseInt(inv.metadata?.proration_amount_cents || '0', 10)
    if (customerId && prorationCents > 0) {
      try {
        await getStripe().customers.createBalanceTransaction(customerId, {
          amount: prorationCents,
          currency: (invoice.currency || 'gbp').toLowerCase(),
          description: 'Credit for seat proration paid in advance'
        })
        console.log(`✅ Added customer credit of ${prorationCents / 100} for proration-only invoice ${invoice.id}`)
      } catch (err) {
        console.error('Failed to add customer credit for proration-only invoice:', err)
      }
    }
    return
  }

  // Only process subscription invoices (skip other one-time payments)
  if (!inv.subscription) {
    console.log('⚠️ Invoice is not for a subscription, skipping')
    return
  }

  try {
    // If this invoice was for adding org seats (full prorated pay – legacy), send billing confirmation
    const orgId = inv.metadata?.organization_id
    if (inv.metadata?.source === 'add_seats_prorated' && orgId) {
      const org = await queryOne(`SELECT id, name FROM organizations WHERE id = $1`, [orgId])
      const owner = await queryOne(
        `SELECT u.email FROM organization_members om INNER JOIN users u ON om.user_id = u.id
         WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true LIMIT 1`,
        [orgId]
      )
      if (org && owner?.email) {
        const amountPaid = (invoice.amount_paid || 0) / 100
        const { EmailService } = await import('@/lib/email-service')
        await EmailService.sendBillingConfirmation({
          email: owner.email,
          organizationName: org.name,
          numberOfUsers: parseInt(inv.metadata?.number_of_users || '1', 10),
          amount: `£${amountPaid.toFixed(2)}`,
          billingPeriod: (inv.metadata?.billing_period as 'monthly' | 'yearly') || 'yearly',
          subscriptionId: inv.subscription,
          billingDetails: {
            proratedAmount: amountPaid,
            nextPeriodAmount: 0,
            totalUpcomingInvoice: amountPaid,
            currency: (invoice.currency || 'gbp').toUpperCase(),
            nextBillingDate: null,
            numberOfUsers: parseInt(inv.metadata?.number_of_users || '1', 10),
            seatPrice: amountPaid / Math.max(1, parseInt(inv.metadata?.number_of_users || '1', 10))
          }
        })
        console.log(`✅ Sent billing confirmation (prorated pay) to ${owner.email} for org ${orgId}`)
      }
      return
    }

    // Get subscription details
    const subscription = await getStripe().subscriptions.retrieve(inv.subscription as string)

    // Seat-add invoice (addSeatsAndInvoiceNow): send receipt and clear metadata
    const seatAddInvoiceId = subscription.metadata?.last_seat_add_invoice_id
    if (seatAddInvoiceId === invoice.id) {
      const orgId = subscription.metadata?.organization_id
      const numberOfUsers = parseInt(subscription.metadata?.last_seat_add_count || '1', 10)
      const { EmailService } = await import('@/lib/email-service')
      const org = orgId ? await queryOne(`SELECT id, name FROM organizations WHERE id = $1`, [orgId]) : null
      const owner = orgId ? await queryOne(
        `SELECT u.email FROM organization_members om INNER JOIN users u ON om.user_id = u.id
         WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true LIMIT 1`,
        [orgId]
      ) : null
      if (org && owner?.email) {
        const amountPaid = (invoice.amount_paid || 0) / 100
        await EmailService.sendBillingConfirmation({
          email: owner.email,
          organizationName: org.name,
          numberOfUsers,
          amount: `£${amountPaid.toFixed(2)}`,
          billingPeriod: (subscription.items.data[0]?.price?.recurring?.interval === 'year') ? 'yearly' : 'monthly',
          subscriptionId: subscription.id,
          billingDetails: {
            proratedAmount: amountPaid,
            nextPeriodAmount: 0,
            totalUpcomingInvoice: amountPaid,
            currency: (invoice.currency || 'gbp').toUpperCase(),
            nextBillingDate: null,
            numberOfUsers,
            seatPrice: numberOfUsers > 0 ? amountPaid / numberOfUsers : 0
          }
        })
        console.log(`✅ Sent seat-add receipt to ${owner.email} for org ${orgId} (${numberOfUsers} seat(s), £${amountPaid.toFixed(2)})`)
      }
      await getStripe().subscriptions.update(subscription.id, {
        metadata: {
          ...subscription.metadata,
          last_seat_add_invoice_id: '',
          last_seat_add_count: ''
        }
      })
      return
    }
    
    // Apply pending seat reduction: take effect the month after the next payment (after this renewal is paid)
    if (invoice.billing_reason === 'subscription_cycle' && subscription.metadata?.pending_org_seat_quantity !== undefined && subscription.metadata?.pending_org_seat_quantity !== '') {
      try {
        const applied = await applyPendingSeatReduction(subscription)
        if (applied) {
          // Re-retrieve subscription after update for downstream logic
          const updated = await getStripe().subscriptions.retrieve(inv.subscription as string)
          Object.assign(subscription, updated)
        }
      } catch (err) {
        console.error('Failed to apply pending seat reduction:', err)
      }
    }
    
    // FIRST: Check if this is an organization subscription and handle it
    const customerId = subscription.customer as string
    if (customerId) {
      const org = await queryOne(
        `SELECT id, name, max_users FROM organizations WHERE stripe_customer_id = $1`,
        [customerId]
      )
      
      if (org) {
        console.log(`🏢 Organization subscription invoice paid for org ${org.id}`)
        
        // Get quantity from subscription
        const quantity = subscription.items.data[0]?.quantity || 1
        
        // Update organization max_users if needed
        const currentMaxUsers = org.max_users || 0
        if (quantity !== currentMaxUsers) {
          await updateOrganizationSubscription(org.id, subscription)
          console.log(`✅ Updated organization ${org.id} max_users from ${currentMaxUsers} to ${quantity} (from invoice payment)`)
        }
        
        // Get organization owner's email for confirmation
        const owner = await queryOne(
          `SELECT u.email
           FROM organization_members om
           INNER JOIN users u ON om.user_id = u.id
           WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
           LIMIT 1`,
          [org.id]
        )
        
        if (owner?.email) {
          // Get billing period and amount
          const price = subscription.items.data[0]?.price
          let amount = '£0.00'
          let billingPeriod: 'monthly' | 'yearly' = 'monthly'
          
          if (price?.unit_amount) {
            const unitPrice = price.unit_amount / 100
            const totalAmount = unitPrice * quantity
            amount = `£${totalAmount.toFixed(2)}`
            
            if (price.recurring?.interval === 'year') {
              billingPeriod = 'yearly'
            }
          }
          
          const { EmailService } = await import('@/lib/email-service')
          await EmailService.sendBillingConfirmation({
            email: owner.email,
            organizationName: org.name,
            numberOfUsers: quantity,
            amount,
            billingPeriod,
            subscriptionId: subscription.id
          })
          
          console.log(`✅ Sent billing confirmation email to ${owner.email} for ${quantity} user seat(s)`)
        }
        
        // Reset page counter for organization on subscription renewal
        if (invoice.billing_reason === 'subscription_cycle') {
          try {
            const { resetPageCounter } = await import('@/lib/page-tracking-service')
            await resetPageCounter(org.id)
            console.log(`🔄 Reset page counter for organization ${org.id} (subscription renewal)`)
          } catch (error) {
            console.error('❌ Error resetting page counter for organization:', error)
            // Don't fail the webhook if page reset fails
          }
        }
        
        // Return early - don't process as user subscription
        return
      }
    }
    
    // Get userId and planType from invoice line items metadata (for initial subscription)
    let userId: string | null = null
    let planType: string | null = null
    
    if (invoice.lines && invoice.lines.data.length > 0) {
      const lineItem = invoice.lines.data[0]
      if (lineItem.metadata) {
        userId = lineItem.metadata.userId || null
        planType = lineItem.metadata.planType || null
      }
    }
    
    // If not in line items, try subscription metadata
    if (!userId || !planType) {
      if (subscription.metadata) {
        userId = subscription.metadata.userId || userId
        planType = subscription.metadata.planType || planType
      }
    }
    
    // If still missing, try to get from subscription parent
    if (!userId || !planType) {
      if (invoice.parent && 'subscription_details' in invoice.parent) {
        const subDetails = invoice.parent.subscription_details
        if (subDetails && subDetails.metadata) {
          userId = subDetails.metadata.userId || userId
          planType = subDetails.metadata.planType || planType
        }
      }
    }
    
    // If planType still missing, determine from price
    if (!planType && subscription.items && subscription.items.data.length > 0) {
      const priceId = subscription.items.data[0].price.id
      planType = getPlanTypeFromPriceId(priceId)
      console.log(`📋 Determined planType: ${planType} from priceId: ${priceId}`)
    }
    
    // If userId missing, try to look up by customer email
    if (!userId) {
      const customerEmail = invoice.customer_email || (subscription.customer ? 
        (await getStripe().customers.retrieve(subscription.customer as string).then(c => 
          !c.deleted && 'email' in c ? c.email : null
        ).catch(() => null)) : null)
      
      if (customerEmail) {
        console.log(`🔍 userId missing, looking up user by email: ${customerEmail}`)
        const userResult = await query(
          `SELECT id FROM users WHERE email = $1 LIMIT 1`,
          [customerEmail]
        )
        
        if (userResult.rows && userResult.rows.length > 0) {
          userId = userResult.rows[0].id
          console.log(`✅ Found user ${userId} by email ${customerEmail}`)
        }
      }
    }
    
    // Activate subscription if this is the initial payment (billing_reason is subscription_create)
    console.log(`🔍 Checking subscription activation: billing_reason=${invoice.billing_reason}, userId=${userId}, planType=${planType}`)
    
    if (invoice.billing_reason === 'subscription_create' && userId && planType) {
      console.log(`🔄 Activating subscription for user ${userId}, planType: ${planType}, subscription: ${subscription.id}`)
      
      try {
        await query('BEGIN')
        try {
          // Update user's plan in database
          const userUpdateResult = await query(
            `UPDATE users SET plan_type = $1, stripe_subscription_id = $2, updated_at = NOW() 
             WHERE id = $3
             RETURNING id, plan_type`,
            [planType, subscription.id, userId]
          )
          console.log(`✅ Updated users table:`, userUpdateResult.rows[0])

          // Activate unlimited credits while preserving existing credits (organization-primary model)
          const creditResult = await activateUnlimitedCredits(userId)
          if (creditResult.success) {
            console.log(`✅ Activated unlimited credits for user ${userId}, preserved ${creditResult.credits_remaining} credits`)
          } else {
            console.warn(`⚠️ Failed to activate unlimited credits for user ${userId}`)
          }

          await query('COMMIT')
          console.log(`✅ User ${userId} upgraded to ${planType} with unlimited credits (from invoice.payment_succeeded, ${creditResult.credits_remaining} credits saved)`)
          
          // Verify the update worked
          const verifyUser = await queryOne(
            `SELECT u.plan_type 
             FROM users u 
             WHERE u.id = $1`,
            [userId]
          )
          const verifyCredits = await getUserCredits(userId)
          console.log(`🔍 Verification - User plan: ${verifyUser.plan_type}, Unlimited: ${verifyCredits.unlimited_credits}, Credits saved: ${verifyCredits.credits_remaining}`)
          
          // Create notification
          await NotificationService.notifySubscriptionActivated(userId, planType)
        } catch (error) {
          await query('ROLLBACK')
          console.error('❌ Database error in transaction:', error)
          throw error
        }
      } catch (error) {
        console.error('❌ Error activating subscription from invoice:', error)
        console.error('❌ Error details:', JSON.stringify(error, null, 2))
      }
    } else {
      console.log(`⚠️ Skipping subscription activation - billing_reason: ${invoice.billing_reason}, userId: ${userId}, planType: ${planType}`)
    }
    
    // Reset page counter on subscription renewal (monthly/yearly payment)
    if (invoice.billing_reason === 'subscription_cycle' && userId) {
      try {
        const { resetPageCounterForUser } = await import('@/lib/page-tracking-service')
        await resetPageCounterForUser(userId)
        console.log(`🔄 Reset page counter for user ${userId} (subscription renewal)`)
      } catch (error) {
        console.error('❌ Error resetting page counter:', error)
        // Don't fail the webhook if page reset fails
      }
    }
    
    // Get customer email for payment email
    let customerEmail: string | null = null
    let customerName: string | null = null
    if (invoice.customer_email) {
      customerEmail = invoice.customer_email
    } else if (subscription.customer) {
      try {
        const customer = await getStripe().customers.retrieve(subscription.customer as string)
        if (!customer.deleted && 'email' in customer && customer.email) {
          customerEmail = customer.email
        }
      } catch (error) {
        console.error('Error retrieving customer:', error)
      }
    }

    // Get customer name if we have userId
    if (userId && !customerName) {
      try {
        const userData = await queryOne(
          `SELECT first_name, last_name FROM users WHERE id = $1`,
          [userId]
        )
        if (userData) {
          const firstName = userData.first_name || ''
          const lastName = userData.last_name || ''
          if (firstName || lastName) {
            customerName = `${firstName} ${lastName}`.trim()
          }
        }
      } catch (error) {
        console.error('Error getting user name:', error)
      }
    }

    if (customerEmail) {
      // Get price details for email
      const price = subscription.items.data[0]?.price
      if (price) {
        const planName = getPlanNameFromPriceId(price.id)
        const amount = `£${(invoice.amount_paid || 0) / 100}`
        const billingPeriod = price.recurring?.interval === 'month' ? 'Monthly' : 'Yearly'
        
        // Calculate next billing date
        const nextBillingDate = (subscription as any).current_period_end
          ? new Date((subscription as any).current_period_end * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          : 'N/A'

        const paymentDate = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })

        console.log('📧 Sending subscription payment email:', {
          to: customerEmail,
          plan: planName,
          amount,
          billingPeriod
        })

        await sendSubscriptionPaymentEmail({
          customerEmail,
          customerName: customerName || undefined,
          planName,
          amount,
          billingPeriod: billingPeriod as 'Monthly' | 'Yearly',
          invoiceId: invoice.id || '',
          date: paymentDate,
          nextBillingDate
        })

        console.log('✅ Subscription payment email sent successfully')
      }
    }
  } catch (error) {
    console.error('❌ Error handling invoice payment:', error)
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('💳 Processing payment_intent.succeeded:', paymentIntent.id)
  
  // Skip if this payment intent is part of a checkout session
  // checkout.session.completed will handle those payments
  try {
    const sessions = await getStripe().checkout.sessions.list({
      payment_intent: paymentIntent.id,
      limit: 1
    })
    
    if (sessions.data.length > 0) {
      console.log('ℹ️ Payment intent is part of a checkout session - skipping (checkout.session.completed will handle it)')
      return
    }
  } catch (error) {
    console.log('Could not check for checkout session, proceeding with payment intent processing')
  }

  // Only process direct API payments (not checkout sessions)
  const { userId, creditAmount, priceId, type } = paymentIntent.metadata || {}
  
  if (!userId || !priceId) {
    console.log('ℹ️ Missing userId or priceId in payment intent metadata - skipping (likely not a credit purchase)')
    return
  }

  if (type === 'credits' || creditAmount) {
    const credits = creditAmount ? parseInt(creditAmount) : getCreditAmountFromPriceId(priceId)
    if (credits > 0) {
      await handleCreditPurchase(userId, priceId, credits, undefined, paymentIntent.id)
      await sendReceiptEmailFromPaymentIntent(paymentIntent)
    }
  }
}

async function handleCreditPurchase(userId: string, priceId: string, creditAmount?: number, sessionId?: string, paymentIntentId?: string) {
  try {
    console.log(`🎫 Processing credit purchase for user ${userId}, priceId: ${priceId}`)
    const credits = creditAmount || getCreditAmountFromPriceId(priceId)
    console.log(`💰 Credit amount: ${credits}`)
    console.log(`📋 Credit amount source: ${creditAmount ? 'provided parameter' : 'from priceId mapping'}`)
    
    if (credits <= 0) {
      console.error('❌ Invalid credit amount:', credits)
      console.error('❌ PriceId:', priceId)
      console.error('❌ This usually means the priceId is not in CREDIT_AMOUNTS mapping')
      console.error('❌ Available credit price IDs:', Object.keys(CREDIT_AMOUNTS).join(', '))
      return
    }

    // Get package name
    let packageName = getPlanNameFromPriceId(priceId)
    // Fallback: if priceId is empty, derive package name from credit amount
    if (packageName === 'Unknown Plan' && credits) {
      packageName = getPackageNameFromCreditAmount(credits)
    }

    // Simple idempotency: Check if we already processed this exact session or payment intent
    if (sessionId) {
      const existingSession = await queryOne(
        `SELECT id FROM credit_transactions 
         WHERE description LIKE $1 
         AND created_at > NOW() - INTERVAL '1 hour'
         LIMIT 1`,
        [`%session:${sessionId}%`]
      )
      if (existingSession) {
        console.log(`⚠️ Session ${sessionId} already processed - skipping duplicate`)
        return
      }
    }

    if (paymentIntentId) {
      const existingPayment = await queryOne(
        `SELECT id FROM credit_transactions 
         WHERE description LIKE $1 
         AND created_at > NOW() - INTERVAL '1 hour'
         LIMIT 1`,
        [`%payment_intent:${paymentIntentId}%`]
      )
      if (existingPayment) {
        console.log(`⚠️ Payment intent ${paymentIntentId} already processed - skipping duplicate`)
        return
      }
    }

    // Add session/payment intent to description for idempotency tracking
    let description = `Credit purchase: ${packageName}`
    if (sessionId) {
      description += ` (session:${sessionId})`
    }
    if (paymentIntentId) {
      description += ` (payment_intent:${paymentIntentId})`
    }

    // Add credits using the credit service (handles organization vs personal)
    const result = await addCredits(
      userId,
      credits,
      description,
      paymentIntentId
    )

    console.log(`✅ Added ${credits} credits to user ${userId}`)

    // Create notification for credit purchase
    await NotificationService.notifyCreditPurchase(userId, credits, packageName)
  } catch (error) {
    console.error('❌ Error adding credits to user:', error)
  }
}

async function sendReceiptEmailFromSession(session: Stripe.Checkout.Session) {
  try {
    console.log('📧 Starting receipt email process for session:', session.id)
    
    // Check if RESEND_API_KEY is configured first
    if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY === 'dummy-key-for-development') {
      console.warn('⚠️ RESEND_API_KEY not configured in environment variables')
      console.warn('⚠️ To enable receipt emails, add RESEND_API_KEY to your .env file')
      console.warn('⚠️ Get your API key from: https://resend.com/api-keys')
      return
    }

    // Get customer email - try from session first, then from Stripe customer if available
    let customerEmail = session.customer_email
    
    if (!customerEmail && session.customer) {
      try {
        const customer = await getStripe().customers.retrieve(session.customer as string)
        if (customer && !customer.deleted && 'email' in customer && customer.email) {
          customerEmail = customer.email
        }
      } catch (error) {
        console.log('Could not retrieve customer email from Stripe:', error)
      }
    }

    if (!customerEmail) {
      console.log('⚠️ No customer email available in session, skipping receipt email')
      console.log('📋 Session customer_email:', session.customer_email)
      console.log('📋 Session customer:', session.customer)
      return
    }

    let { type, priceId } = session.metadata || {}
    
    // Try to derive priceId from line items if metadata is missing
    if (!priceId && session.line_items) {
      try {
        const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 })
        if (lineItems.data.length > 0 && lineItems.data[0].price) {
          priceId = lineItems.data[0].price.id
          console.log(`📋 Derived priceId from line items: ${priceId}`)
        }
      } catch (error) {
        console.log('Could not retrieve line items for receipt email:', error)
      }
    }
    
    // If type is missing but we have a priceId, check if it's a credit purchase
    if (!type && priceId) {
      const { STRIPE_PRICE_IDS } = await import('@/lib/stripe-config')
      const allCreditPriceIds = Object.values(STRIPE_PRICE_IDS.credits)
      if (allCreditPriceIds.includes(priceId)) {
        type = 'credits'
        console.log(`📋 Derived type as 'credits' from priceId`)
      }
    }
    
    if (!type || !priceId) {
      console.log('⚠️ Missing metadata in session, skipping receipt email')
      console.log('📋 Session metadata:', session.metadata)
      console.log('📋 Session amount_total:', session.amount_total)
      return
    }

    // Get plan name and amount from priceId
    const planName = getPlanNameFromPriceId(priceId)
    const creditAmount = getCreditAmountFromPriceId(priceId)
    const amount = `£${(session.amount_total || 0) / 100}`

    // Get user name from database
    let customerName: string | undefined = undefined
    if (customerEmail) {
      try {
        const userData = await query(
          `SELECT first_name, last_name FROM users WHERE email = $1 LIMIT 1`,
          [customerEmail]
        )
        if (userData.rows && userData.rows.length > 0) {
          const firstName = userData.rows[0].first_name || ''
          const lastName = userData.rows[0].last_name || ''
          if (firstName || lastName) {
            customerName = `${firstName} ${lastName}`.trim()
          }
        }
      } catch (error) {
        console.error('Error getting user name for receipt email:', error)
      }
    }

    const receiptData: ReceiptData = {
      customerEmail,
      customerName,
      planName,
      amount,
      type: type as 'subscription' | 'credits',
      transactionId: session.id,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      billingPeriod: undefined, // Not applicable for one-time purchases
      creditAmount: type === 'credits' ? creditAmount : undefined
    }

    console.log('📧 Attempting to send receipt email:', {
      to: receiptData.customerEmail,
      plan: receiptData.planName,
      amount: receiptData.amount,
      type: receiptData.type
    })
    
    const result = await sendReceiptEmail(receiptData)
    if (result.success) {
      console.log('✅ Receipt email sent successfully! Message ID:', result.messageId)
    } else {
      console.error('❌ Receipt email failed:', result.error)
    }
  } catch (error) {
    console.error('❌ Error sending receipt email from session:', error)
  }
}

async function sendReceiptEmailFromSubscription(subscription: Stripe.Subscription) {
  try {
    // Get customer email from Stripe
    const customer = await getStripe().customers.retrieve(subscription.customer as string)
    if (!customer || customer.deleted || !('email' in customer) || !customer.email) {
      console.log('No customer email found for subscription, skipping receipt email')
      return
    }

    // Get price details
    const price = subscription.items.data[0]?.price
    if (!price) {
      console.log('No price information in subscription, skipping receipt email')
      return
    }

    const { planType } = subscription.metadata || {}
    const planName = getPlanNameFromPriceId(price.id)
    const amount = `£${(price.unit_amount || 0) / 100}`
    const billingPeriod = price.recurring ? 
      (price.recurring.interval === 'month' ? 'Monthly' : 'Yearly') : 
      undefined

    // Get user name from database
    let customerName: string | undefined = undefined
    if (customer.email) {
      try {
        const userData = await query(
          `SELECT first_name, last_name FROM users WHERE email = $1 LIMIT 1`,
          [customer.email]
        )
        if (userData.rows && userData.rows.length > 0) {
          const firstName = userData.rows[0].first_name || ''
          const lastName = userData.rows[0].last_name || ''
          if (firstName || lastName) {
            customerName = `${firstName} ${lastName}`.trim()
          }
        }
      } catch (error) {
        console.error('Error getting user name for receipt email:', error)
      }
    }

    const receiptData: ReceiptData = {
      customerEmail: customer.email,
      customerName,
      planName,
      amount,
      type: 'subscription',
      transactionId: subscription.id,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      billingPeriod
    }

    await sendReceiptEmail(receiptData)
  } catch (error) {
    console.error('Error sending receipt email from subscription:', error)
  }
}

// Removed handleChargeSucceeded - no longer needed
// checkout.session.completed handles all checkout payments
// payment_intent.succeeded handles direct API payments

async function sendReceiptEmailFromPaymentIntent(paymentIntent: Stripe.PaymentIntent) {
  try {
    const { userId, priceId, creditAmount, type } = paymentIntent.metadata || {}
    
    if (!type || type !== 'credits' || !priceId) {
      console.log('Not a credit purchase or missing priceId, skipping receipt email')
      return
    }

    // Get customer email from charge billing details
    let customerEmail: string | null = null
    
    if (paymentIntent.latest_charge) {
      try {
        const charge = await getStripe().charges.retrieve(paymentIntent.latest_charge as string)
        customerEmail = charge.billing_details?.email || null
      } catch (error) {
        console.log('Could not retrieve charge for email:', error)
      }
    }

    if (!customerEmail) {
      console.log('No customer email available for payment intent, skipping receipt email')
      return
    }

    const planName = getPlanNameFromPriceId(priceId)
    const amount = `£${(paymentIntent.amount || 0) / 100}`
    const credits = creditAmount ? parseInt(creditAmount) : undefined

    // Get user name from database (try userId first, then email)
    let customerName: string | undefined = undefined
    if (userId) {
      try {
        const userData = await query(
          `SELECT first_name, last_name FROM users WHERE id = $1 LIMIT 1`,
          [userId]
        )
        if (userData.rows && userData.rows.length > 0) {
          const firstName = userData.rows[0].first_name || ''
          const lastName = userData.rows[0].last_name || ''
          if (firstName || lastName) {
            customerName = `${firstName} ${lastName}`.trim()
          }
        }
      } catch (error) {
        console.error('Error getting user name for receipt email:', error)
      }
    } else if (customerEmail) {
      try {
        const userData = await query(
          `SELECT first_name, last_name FROM users WHERE email = $1 LIMIT 1`,
          [customerEmail]
        )
        if (userData.rows && userData.rows.length > 0) {
          const firstName = userData.rows[0].first_name || ''
          const lastName = userData.rows[0].last_name || ''
          if (firstName || lastName) {
            customerName = `${firstName} ${lastName}`.trim()
          }
        }
      } catch (error) {
        console.error('Error getting user name for receipt email:', error)
      }
    }

    const receiptData: ReceiptData = {
      customerEmail,
      customerName,
      planName,
      amount,
      type: 'credits',
      transactionId: paymentIntent.id,
      date: new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }),
      creditAmount: credits
    }

    console.log('📧 Sending receipt email from payment intent:', receiptData)
    const result = await sendReceiptEmail(receiptData)
    if (result.success) {
      console.log('✅ Receipt email sent successfully')
    } else {
      console.error('⚠️ Receipt email failed:', result.error)
    }
  } catch (error) {
    console.error('Error sending receipt email from payment intent:', error)
  }
}

function getPlanNameFromPriceId(priceId: string): string {
  // Map price IDs to plan names (TEST MODE)
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

function getPackageNameFromCreditAmount(credits: number): string {
  // Map credit amounts to package names (fallback when priceId is missing)
  const creditToPackage: Record<number, string> = {
    5: 'Starter Pack',
    7: 'Professional Pack',
    9: 'Business Pack',
    11: 'Enterprise Pack',
  }
  
  return creditToPackage[credits] || `${credits} Credit Pack`
}

/**
 * Handle organization subscription creation
 * This checks if a newly created subscription belongs to an organization and updates max_users
 */
async function handleOrganizationSubscriptionCreated(subscription: Stripe.Subscription) {
  try {
    console.log('🔍 Checking if new subscription is for an organization...')
    const customerId = subscription.customer as string
    
    if (!customerId) {
      return // Not an organization subscription
    }
    
    // Check if this customer ID belongs to an organization
    const org = await queryOne(
      `SELECT id, name, max_users FROM organizations WHERE stripe_customer_id = $1`,
      [customerId]
    )
    
    if (!org) {
      console.log('⚠️ Subscription customer not found in organizations:', customerId)
      return
    }
    
    console.log(`🆕 Processing new organization subscription for org ${org.id}`)
    
    // Get quantity from subscription
    const quantity = subscription.items.data[0]?.quantity || 1
    
    // Update organization subscription
    await updateOrganizationSubscription(org.id, subscription)
    
    console.log(`✅ Created organization ${org.id} subscription: max_users=${quantity}, status=${subscription.status}`)
    
    // Get organization owner's email for confirmation
    const owner = await queryOne(
      `SELECT u.email
       FROM organization_members om
       INNER JOIN users u ON om.user_id = u.id
       WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
       LIMIT 1`,
      [org.id]
    )
    
    if (owner?.email) {
      // Get billing period and amount
      const price = subscription.items.data[0]?.price
      let amount = '£0.00'
      let billingPeriod: 'monthly' | 'yearly' = 'monthly'
      
      if (price?.unit_amount) {
        const unitPrice = price.unit_amount / 100
        const totalAmount = unitPrice * quantity
        amount = `£${totalAmount.toFixed(2)}`
        
        if (price.recurring?.interval === 'year') {
          billingPeriod = 'yearly'
        }
      }
      
      const { EmailService } = await import('@/lib/email-service')
      await EmailService.sendBillingConfirmation({
        email: owner.email,
        organizationName: org.name,
        numberOfUsers: quantity,
        amount,
        billingPeriod,
        subscriptionId: subscription.id
      })
      
      console.log(`✅ Sent billing confirmation email to ${owner.email} for ${quantity} user seat(s)`)
    }
  } catch (error) {
    console.error('❌ Error handling organization subscription creation:', error)
    // Don't throw - this is a side effect
  }
}

/**
 * Handle organization subscription updates
 * This checks if the subscription belongs to an organization and updates max_users accordingly
 */
async function handleOrganizationSubscriptionUpdated(subscription: Stripe.Subscription) {
  try {
    console.log('🔍 Checking if subscription update is for an organization...')
    const customerId = subscription.customer as string
    
    if (!customerId) {
      return // Not an organization subscription
    }
    
    // Check if this customer ID belongs to an organization
    const org = await queryOne(
      `SELECT id, name FROM organizations WHERE stripe_customer_id = $1`,
      [customerId]
    )
    
    if (!org) {
      console.log('⚠️ Subscription customer not found in organizations:', customerId)
      return
    }
    
    console.log(`🔄 Processing organization subscription update for org ${org.id}`)
    
    // Get previous max_users to detect if this is a new purchase
    const previousOrg = await queryOne(
      `SELECT max_users FROM organizations WHERE id = $1`,
      [org.id]
    )
    const previousMaxUsers = previousOrg?.max_users || 0
    
    const newMaxUsers = subscription.items.data[0]?.quantity || 1
    const numberOfNewUsers = newMaxUsers - previousMaxUsers
    
    console.log(`📊 Organization ${org.id} subscription update: previous=${previousMaxUsers}, new=${newMaxUsers}, added=${numberOfNewUsers}`)
    
    // Update organization subscription
    await updateOrganizationSubscription(org.id, subscription)
    
    console.log(`✅ Updated organization ${org.id} subscription: status=${subscription.status}, quantity=${newMaxUsers}`)
    
    // If this is a new purchase (quantity increased), send billing confirmation email
    if (numberOfNewUsers > 0 && subscription.status === 'active') {
      // Get organization owner's email
      const owner = await queryOne(
        `SELECT u.email, u.stripe_subscription_id
         FROM organization_members om
         INNER JOIN users u ON om.user_id = u.id
         WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
         LIMIT 1`,
        [org.id]
      )
      
      if (owner?.email) {
        // Get billing period from owner's subscription
        let billingPeriod: 'monthly' | 'yearly' = 'monthly'
        if (owner.stripe_subscription_id) {
          try {
            const ownerSubscription = await getStripe().subscriptions.retrieve(owner.stripe_subscription_id)
            const price = ownerSubscription.items.data[0]?.price
            if (price?.recurring?.interval === 'year') {
              billingPeriod = 'yearly'
            }
          } catch (error) {
            console.error('Error checking owner subscription:', error)
          }
        }
        
      // Get amount from subscription
      // For subscriptions with quantity, unit_amount is per unit, so multiply by number of new users
      const price = subscription.items.data[0]?.price
      const unitAmount = price?.unit_amount || 0 // Price per unit in minor units (e.g., 700 = £7.00)
      const unitPrice = unitAmount / 100
      const totalAmountForNewUsers = unitPrice * numberOfNewUsers
      const amount = `£${totalAmountForNewUsers.toFixed(2)}`
        
        // Get billing period from the organization subscription price (not owner's subscription)
        const isYearly = price?.recurring?.interval === 'year'
        if (isYearly) {
          billingPeriod = 'yearly'
        }
        
        console.log(`💰 Billing calculation: ${numberOfNewUsers} seats × £${unitPrice.toFixed(2)} per seat = ${amount} ${billingPeriod}`)
        
        // Send billing confirmation email
        const { EmailService } = await import('@/lib/email-service')
        await EmailService.sendBillingConfirmation({
          email: owner.email,
          organizationName: org.name,
          numberOfUsers: numberOfNewUsers,
          amount,
          billingPeriod,
          subscriptionId: subscription.id
        })
        
        console.log(`✅ Sent billing confirmation email to ${owner.email} for ${numberOfNewUsers} new user seat(s)`)
      }
    }
  } catch (error) {
    console.error('❌ Error handling organization subscription update:', error)
    // Don't throw - this is a side effect, shouldn't break the main webhook
  }
}

/**
 * Handle organization checkout completion
 * This sends the billing confirmation email using the exact number of users and amount from checkout
 */
async function handleOrganizationCheckoutCompleted(session: Stripe.Checkout.Session) {
  try {
    console.log('🔍 Checking if this is an organization checkout...')
    console.log('📋 Session metadata:', JSON.stringify(session.metadata, null, 2))
    console.log('📋 Session ID:', session.id)
    console.log('📋 Session subscription:', session.subscription)
    
    const { organization_id, number_of_users, source } = session.metadata || {}
    
    if (!organization_id || !number_of_users) {
      console.log('⚠️ Not an organization checkout - missing metadata:', { organization_id, number_of_users })
      return
    }
    
    const numberOfUsers = parseInt(number_of_users, 10)
    if (isNaN(numberOfUsers) || numberOfUsers <= 0) {
      console.error('❌ Invalid number_of_users in checkout metadata:', number_of_users)
      return
    }
    
    // Proration-only payment: add seats only after successful payment, then send receipt (no subscription on session)
    if (source === 'add_seats_proration_only') {
      console.log(`🛒 Processing proration-only checkout: org=${organization_id}, users=${numberOfUsers} – adding seats and sending receipt`)
      const { addSeatsToOwnerSubscription } = await import('@/lib/organization-billing')
      const result = await addSeatsToOwnerSubscription(organization_id, numberOfUsers, undefined, { sendEmail: false })
      if (!result.success) {
        console.error('❌ Failed to add seats after proration payment:', result.message)
        return
      }
      // Add customer credit so next renewal doesn't double-charge the proration (Stripe will add proration for new seats; we already charged it here)
      const prorationCents = parseInt(session.metadata?.proration_amount_cents || '0', 10)
      if (prorationCents > 0 && session.customer) {
        const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
        if (customerId) {
          try {
            await getStripe().customers.createBalanceTransaction(customerId, {
              amount: prorationCents,
              currency: (session.currency || 'gbp').toLowerCase(),
              description: 'Credit for seat proration paid in advance'
            })
            console.log(`✅ Added customer credit of ${prorationCents / 100} for proration-only checkout ${session.id}`)
          } catch (err) {
            console.error('Failed to add customer credit for proration-only checkout:', err)
          }
        }
      }
      let amount = '£0.00'
      try {
        const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 })
        if (lineItems.data.length > 0 && lineItems.data[0].amount_total != null) {
          amount = `£${(lineItems.data[0].amount_total / 100).toFixed(2)}`
        }
      } catch (e) {
        console.warn('Could not get line items for receipt amount:', e)
      }
      const org = await queryOne(`SELECT id, name FROM organizations WHERE id = $1`, [organization_id])
      const owner = await queryOne(
        `SELECT u.email FROM organization_members om INNER JOIN users u ON om.user_id = u.id
         WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true LIMIT 1`,
        [organization_id]
      )
      if (org && owner?.email) {
        const { EmailService } = await import('@/lib/email-service')
        await EmailService.sendBillingConfirmation({
          email: owner.email,
          organizationName: org.name,
          numberOfUsers,
          amount,
          billingPeriod: 'monthly',
          subscriptionId: undefined,
          billingDetails: {
            proratedAmount: parseFloat(amount.replace(/[^0-9.]/g, '')) || 0,
            nextPeriodAmount: 0,
            totalUpcomingInvoice: parseFloat(amount.replace(/[^0-9.]/g, '')) || 0,
            currency: 'GBP',
            nextBillingDate: null,
            numberOfUsers,
            seatPrice: 0
          }
        })
        console.log(`✅ Sent receipt to ${owner.email} for proration payment (${numberOfUsers} seat(s), ${amount})`)
      }
      return
    }
    
    console.log('✅ Organization checkout detected:', { organization_id, number_of_users })
    console.log(`🛒 Processing organization checkout: org=${organization_id}, users=${numberOfUsers}`)
    
    // Get organization details
    const org = await queryOne(
      `SELECT id, name FROM organizations WHERE id = $1`,
      [organization_id]
    )
    
    if (!org) {
      console.error('❌ Organization not found:', organization_id)
      return
    }
    
    // Get organization owner's email
    const owner = await queryOne(
      `SELECT u.email, u.stripe_subscription_id
       FROM organization_members om
       INNER JOIN users u ON om.user_id = u.id
       WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
       LIMIT 1`,
      [org.id]
    )
    
    if (!owner?.email) {
      console.error('❌ Organization owner not found for org:', org.id)
      return
    }
    
    // Get line items to calculate amount accurately
    let amount = '£0.00'
    let billingPeriod: 'monthly' | 'yearly' = 'monthly'
    
    try {
      const lineItems = await getStripe().checkout.sessions.listLineItems(session.id, { limit: 1 })
      if (lineItems.data.length > 0) {
        const lineItem = lineItems.data[0]
        const price = lineItem.price
        const quantity = lineItem.quantity || numberOfUsers
        
        if (price?.unit_amount) {
          const unitPrice = price.unit_amount / 100
          const totalAmount = unitPrice * quantity
          amount = `£${totalAmount.toFixed(2)}`
          
          // Get billing period from price
          if (price.recurring?.interval === 'year') {
            billingPeriod = 'yearly'
          }
          
          console.log(`💰 Checkout calculation: ${quantity} seats × £${unitPrice.toFixed(2)} per seat = ${amount} ${billingPeriod}`)
        }
      }
    } catch (error) {
      console.error('❌ Error getting line items from checkout session:', error)
      // Fallback: try to calculate from subscription if available
      if (session.subscription) {
        try {
          const subscription = await getStripe().subscriptions.retrieve(session.subscription as string)
          const price = subscription.items.data[0]?.price
        if (price?.unit_amount) {
          const unitPrice = price.unit_amount / 100
          const totalAmount = unitPrice * numberOfUsers
          amount = `£${totalAmount.toFixed(2)}`
            
            if (price.recurring?.interval === 'year') {
              billingPeriod = 'yearly'
            }
          }
        } catch (subError) {
          console.error('❌ Error getting subscription for fallback calculation:', subError)
        }
      }
    }
    
    // Update organization subscription immediately if subscription is available
    if (session.subscription) {
      try {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription as string)
        console.log(`🔄 Updating organization ${org.id} subscription immediately from checkout`)
        await updateOrganizationSubscription(org.id, subscription)
        console.log(`✅ Updated organization ${org.id}: max_users=${subscription.items.data[0]?.quantity || numberOfUsers}, status=${subscription.status}`)
      } catch (subError) {
        console.error('❌ Error updating organization subscription from checkout:', subError)
        // Fallback: update max_users directly from metadata if subscription retrieval fails
        try {
          await query(
            `UPDATE organizations 
             SET max_users = $1, subscription_status = 'active', updated_at = NOW()
             WHERE id = $2`,
            [numberOfUsers, org.id]
          )
          console.log(`✅ Updated organization ${org.id} max_users to ${numberOfUsers} (fallback)`)
        } catch (updateError) {
          console.error('❌ Error updating organization max_users (fallback):', updateError)
        }
      }
    } else {
      // No subscription yet, update max_users directly (subscription will be created later)
      try {
        await query(
          `UPDATE organizations 
           SET max_users = $1, updated_at = NOW()
           WHERE id = $2`,
          [numberOfUsers, org.id]
        )
        console.log(`✅ Updated organization ${org.id} max_users to ${numberOfUsers} (awaiting subscription)`)
      } catch (updateError) {
        console.error('❌ Error updating organization max_users:', updateError)
      }
    }
    
    // Send billing confirmation email with the exact number from checkout
    const { EmailService } = await import('@/lib/email-service')
    await EmailService.sendBillingConfirmation({
      email: owner.email,
      organizationName: org.name,
      numberOfUsers: numberOfUsers, // Use the exact number from checkout metadata
      amount,
      billingPeriod,
      subscriptionId: session.subscription as string | undefined
    })
    
    console.log(`✅ Sent billing confirmation email to ${owner.email} for ${numberOfUsers} user seat(s) from checkout`)
  } catch (error) {
    console.error('❌ Error handling organization checkout completion:', error)
    // Don't throw - this is a side effect
  }
}

/**
 * Handle when organization seats are added to owner's personal subscription
 * This detects organization seats in the owner's subscription and updates the organization
 */
async function handleOwnerSubscriptionWithOrganizationSeats(subscription: Stripe.Subscription) {
  try {
    console.log('🔍 Checking if subscription has organization seats...')
    console.log('📋 Subscription ID:', subscription.id)
    console.log('📋 Subscription metadata:', JSON.stringify(subscription.metadata, null, 2))
    console.log('📋 Subscription items:', subscription.items.data.map(item => ({
      priceId: item.price.id,
      quantity: item.quantity
    })))
    
    // Check if this subscription has organization seats (check metadata or price IDs)
    const organizationSeatsAdded = subscription.metadata?.organization_seats_added
    const organizationId = subscription.metadata?.organization_id // Get specific organization ID if available
    const monthlySeatPriceId = process.env.STRIPE_PER_USER_PRICE_ID
    const yearlySeatPriceId = process.env.STRIPE_PER_USER_PRICE_ID_YEARLY
    
    console.log('🔑 Checking price IDs:', { monthlySeatPriceId, yearlySeatPriceId })
    console.log('🏢 Organization ID from metadata:', organizationId || 'NOT SET')
    
    if (!organizationSeatsAdded) {
      // Check if any line items match organization seat price IDs
      const hasOrgSeats = subscription.items.data.some(item => 
        item.price.id === monthlySeatPriceId || item.price.id === yearlySeatPriceId
      )
      
      console.log('🔍 Has organization seats (by price ID)?', hasOrgSeats)
      
      if (!hasOrgSeats) {
        console.log('⚠️ No organization seats found in subscription, skipping')
        return // No organization seats in this subscription
      }
    } else {
      console.log('✅ Found organization_seats_added in metadata:', organizationSeatsAdded)
    }
    
    // Find user by subscription ID
    console.log('🔍 Looking up user by subscription ID:', subscription.id)
    const user = await queryOne(
      `SELECT id, email FROM users WHERE stripe_subscription_id = $1 LIMIT 1`,
      [subscription.id]
    )
    
    if (!user) {
      console.log('⚠️ No user found with subscription ID:', subscription.id)
      return // Not a user subscription
    }
    
    console.log('✅ Found user:', user.id, user.email)
    
    // Find organizations owned by this user
    // If organization_id is in metadata, only update that specific organization
    let orgs
    if (organizationId) {
      console.log('🔍 Looking up specific organization from metadata:', organizationId)
      orgs = await query(
        `SELECT o.id, o.name, o.max_users
         FROM organizations o
         INNER JOIN organization_members om ON o.id = om.organization_id
         WHERE o.id = $1 AND om.user_id = $2 AND om.role = 'owner' AND om.is_active = true`,
        [organizationId, user.id]
      )
      console.log(`📊 Found ${orgs.rows?.length || 0} organization(s) matching metadata organization_id`)
    } else {
      console.log('🔍 Looking up all organizations owned by user:', user.id)
      orgs = await query(
        `SELECT o.id, o.name, o.max_users
         FROM organizations o
         INNER JOIN organization_members om ON o.id = om.organization_id
         WHERE om.user_id = $1 AND om.role = 'owner' AND om.is_active = true`,
        [user.id]
      )
      console.log(`📊 Found ${orgs.rows?.length || 0} organization(s) owned by user`)
    }
    
    if (!orgs.rows || orgs.rows.length === 0) {
      console.log('⚠️ No matching organizations found')
      return // No organizations found
    }
    
    // For each organization, calculate total seats from subscription
    // (monthlySeatPriceId and yearlySeatPriceId already defined above)
    
    for (const org of orgs.rows) {
      console.log(`🔄 Processing organization: ${org.id} (${org.name})`)
      
      // Count organization seat items in subscription
      let totalSeats = 0
      for (const item of subscription.items.data) {
        if (item.price.id === monthlySeatPriceId || item.price.id === yearlySeatPriceId) {
          totalSeats += item.quantity || 0
          console.log(`  📊 Found seat item: priceId=${item.price.id}, quantity=${item.quantity}, total=${totalSeats}`)
        }
      }
      
      console.log(`📊 Organization ${org.id}: current max_users=${org.max_users}, subscription seats=${totalSeats}`)
      
      if (totalSeats > 0) {
        // Update organization max_users to match subscription quantity
        const currentMaxUsers = org.max_users || 0
        if (totalSeats !== currentMaxUsers) {
          console.log(`🔄 Updating organization ${org.id}: ${currentMaxUsers} -> ${totalSeats}`)
          const updateResult = await query(
            `UPDATE organizations 
             SET max_users = $1, subscription_status = $2, updated_at = NOW()
             WHERE id = $3`,
            [totalSeats, subscription.status, org.id]
          )
          
          console.log(`✅ Updated organization ${org.id} max_users from ${currentMaxUsers} to ${totalSeats} (rows affected: ${updateResult.rowCount || 0})`)
          
          // Verify the update
          const verifyOrg = await queryOne(
            `SELECT max_users, subscription_status FROM organizations WHERE id = $1`,
            [org.id]
          )
          console.log(`✅ Verified organization ${org.id} update: max_users=${verifyOrg?.max_users}, status=${verifyOrg?.subscription_status}`)
          
          // Send billing confirmation email if seats increased
          if (totalSeats > currentMaxUsers) {
            const numberOfNewSeats = totalSeats - currentMaxUsers
            const price = subscription.items.data.find(item => 
              item.price.id === monthlySeatPriceId || item.price.id === yearlySeatPriceId
            )?.price
            
            let amount = '£0.00'
            let billingPeriod: 'monthly' | 'yearly' = 'monthly'
            
            if (price?.unit_amount) {
              const unitPrice = price.unit_amount / 100
              const totalAmount = unitPrice * numberOfNewSeats
              amount = `£${totalAmount.toFixed(2)}`
              
              if (price.recurring?.interval === 'year') {
                billingPeriod = 'yearly'
              }
            }
            
            const { EmailService } = await import('@/lib/email-service')
            await EmailService.sendBillingConfirmation({
              email: user.email,
              organizationName: org.name,
              numberOfUsers: numberOfNewSeats,
              amount,
              billingPeriod,
              subscriptionId: subscription.id
            })
            
            console.log(`✅ Sent billing confirmation email to ${user.email} for ${numberOfNewSeats} new seat(s)`)
          }
        }
      }
    }
  } catch (error) {
    console.error('❌ Error handling owner subscription with organization seats:', error)
    // Don't throw - this is a side effect
  }
}
