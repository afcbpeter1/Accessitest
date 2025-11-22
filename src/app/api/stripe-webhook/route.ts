import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { query } from '@/lib/database'
import { getPlanTypeFromPriceId, getCreditAmountFromPriceId, CREDIT_AMOUNTS } from '@/lib/stripe-config'
import { sendReceiptEmail, ReceiptData } from '@/lib/receipt-email-service'
import { sendSubscriptionPaymentEmail, sendSubscriptionCancellationEmail } from '@/lib/subscription-email-service'
import { NotificationService } from '@/lib/notification-service'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
})

// Trim whitespace to avoid issues with .env file formatting
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim() || ''

// Disable body parsing - we need the raw body for signature verification
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Important: Don't parse the body as JSON - we need the raw string
export async function POST(request: NextRequest) {
  try {
    console.log('🔔 Webhook received!')
    
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
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
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

    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object as Stripe.PaymentIntent)
        break

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Webhook error:', error)
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
  
  let { userId, priceId, type } = session.metadata || {}
  
  // If userId is missing or empty, try to look up user by email
  if (!userId || userId.trim() === '') {
    const customerEmail = session.customer_email || (session.customer ? 
      (await stripe.customers.retrieve(session.customer as string).then(c => 
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
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
      if (lineItems.data.length > 0 && lineItems.data[0].price) {
        priceId = lineItems.data[0].price.id
        console.log(`✅ Found priceId from line items: ${priceId}`)
      }
    } catch (error) {
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
    await handleCreditPurchase(userId, priceId)
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
          const subscriptions = await stripe.subscriptions.list({
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
        
        // Set unlimited credits immediately
        await query(
          `UPDATE user_credits 
           SET unlimited_credits = true, updated_at = NOW() 
           WHERE user_id = $1`,
          [userId]
        )
        
        await query('COMMIT')
        console.log(`✅ User ${userId} upgraded to ${planType} with unlimited credits IMMEDIATELY`)
        
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

  // Send receipt email
  await sendReceiptEmailFromSession(session)
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('🔄 Processing subscription created:', subscription.id)
  console.log('📋 Subscription metadata:', subscription.metadata)
  
  let { userId, planType } = subscription.metadata || {}
  
  // If userId is missing, try to look up user by customer email
  if (!userId || userId.trim() === '') {
    console.log('⚠️ userId missing in subscription metadata, attempting to look up by customer email')
    
    try {
      const customer = await stripe.customers.retrieve(subscription.customer as string)
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

        // Set unlimited credits for subscription users
        await query(
          `UPDATE user_credits 
           SET unlimited_credits = true, updated_at = NOW() 
           WHERE user_id = $1`,
          [userId]
        )

        await query('COMMIT')
        console.log(`✅ Updated user ${userId} to plan ${planType} with unlimited credits (from subscription.created)`)
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

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log('Processing subscription updated:', subscription.id)
  
  const { userId, planType } = subscription.metadata || {}
  
  if (!userId) {
    console.error('Missing userId in subscription metadata')
    return
  }

  try {
    // Update subscription status
    await query(
      `UPDATE users SET plan_type = $1, updated_at = NOW() 
       WHERE stripe_subscription_id = $2`,
      [subscription.status === 'active' ? planType : 'free', subscription.id]
    )

    console.log(`Updated subscription ${subscription.id} status: ${subscription.status}`)
  } catch (error) {
    console.error('Error updating subscription:', error)
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  console.log('Processing subscription deleted:', subscription.id)
  
  const { userId } = subscription.metadata || {}
  
  try {
    // Get user info before updating
    let userEmail: string | null = null
    let savedCredits = 0
    let planName = 'Unlimited Access'
    
    if (userId) {
      const userData = await query(
        `SELECT u.email, uc.credits_remaining, u.plan_type
         FROM users u
         LEFT JOIN user_credits uc ON u.id = uc.user_id
         WHERE u.id = $1`,
        [userId]
      )
      
      if (userData.rows && userData.rows.length > 0) {
        userEmail = userData.rows[0].email
        savedCredits = userData.rows[0].credits_remaining || 0
      }
    } else {
      // Try to get user by subscription ID
      const userData = await query(
        `SELECT u.id, u.email, uc.credits_remaining, u.plan_type
         FROM users u
         LEFT JOIN user_credits uc ON u.id = uc.user_id
         WHERE u.stripe_subscription_id = $1`,
        [subscription.id]
      )
      
      if (userData.rows && userData.rows.length > 0) {
        userEmail = userData.rows[0].email
        savedCredits = userData.rows[0].credits_remaining || 0
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
      // Set user back to free plan
      await query(
        `UPDATE users SET plan_type = 'free', stripe_subscription_id = NULL, updated_at = NOW() 
         WHERE stripe_subscription_id = $1`,
        [subscription.id]
      )

      // Remove unlimited credits but preserve existing saved credits exactly as they are
      await query(
        `UPDATE user_credits 
         SET unlimited_credits = false, updated_at = NOW() 
         WHERE user_id = (SELECT id FROM users WHERE stripe_subscription_id = $1)`,
        [subscription.id]
      )

      await query('COMMIT')
      console.log(`Set user with subscription ${subscription.id} back to free plan (credits preserved)`)

      // Create notification for subscription cancellation
      if (userId) {
        await NotificationService.notifySubscriptionCancelled(userId)
      }
      
      // Send cancellation email
      if (userEmail) {
        const cancellationDate = new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })
        const accessEndDate = subscription.current_period_end 
          ? new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })
          : cancellationDate
        
        await sendSubscriptionCancellationEmail({
          customerEmail: userEmail,
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
  
  // Only process subscription invoices (skip one-time payments)
  if (!invoice.subscription) {
    console.log('⚠️ Invoice is not for a subscription, skipping')
    return
  }

  try {
    // Get subscription details
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string)
    
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
        if (subDetails.metadata) {
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
        (await stripe.customers.retrieve(subscription.customer as string).then(c => 
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

          // First, ensure user_credits row exists
          const existingCredits = await queryOne(
            `SELECT user_id FROM user_credits WHERE user_id = $1`,
            [userId]
          )
          
          if (!existingCredits) {
            console.log(`⚠️ No user_credits row found for user ${userId}, creating one`)
            await query(
              `INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
               VALUES ($1, $2, $3, $4)`,
              [userId, 0, 0, true]
            )
            console.log(`✅ Created user_credits row for user ${userId} with unlimited_credits=true`)
          } else {
            // Set unlimited credits for subscription users
            const creditsUpdateResult = await query(
              `UPDATE user_credits 
               SET unlimited_credits = true, updated_at = NOW() 
               WHERE user_id = $1
               RETURNING user_id, unlimited_credits`,
              [userId]
            )
            console.log(`✅ Updated user_credits table:`, creditsUpdateResult.rows[0])
          }

          await query('COMMIT')
          console.log(`✅ User ${userId} upgraded to ${planType} with unlimited credits (from invoice.payment_succeeded)`)
          
          // Verify the update worked
          const verifyUser = await queryOne(
            `SELECT u.plan_type, uc.unlimited_credits 
             FROM users u 
             LEFT JOIN user_credits uc ON u.id = uc.user_id 
             WHERE u.id = $1`,
            [userId]
          )
          console.log(`🔍 Verification - User plan: ${verifyUser.plan_type}, Unlimited: ${verifyUser.unlimited_credits}`)
          
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
    
    // Get customer email for payment email
    let customerEmail: string | null = null
    if (invoice.customer_email) {
      customerEmail = invoice.customer_email
    } else if (subscription.customer) {
      try {
        const customer = await stripe.customers.retrieve(subscription.customer as string)
        if (!customer.deleted && 'email' in customer && customer.email) {
          customerEmail = customer.email
        }
      } catch (error) {
        console.error('Error retrieving customer:', error)
      }
    }

    if (customerEmail) {
      // Get price details for email
      const price = subscription.items.data[0]?.price
      if (price) {
        const planName = getPlanNameFromPriceId(price.id)
        const amount = `$${(invoice.amount_paid || 0) / 100}`
        const billingPeriod = price.recurring?.interval === 'month' ? 'Monthly' : 'Yearly'
        
        // Calculate next billing date
        const nextBillingDate = subscription.current_period_end
          ? new Date(subscription.current_period_end * 1000).toLocaleDateString('en-US', {
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
          planName,
          amount,
          billingPeriod: billingPeriod as 'Monthly' | 'Yearly',
          invoiceId: invoice.id,
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
  console.log('📋 Payment intent metadata:', paymentIntent.metadata)
  
  const { userId, creditAmount, priceId, type } = paymentIntent.metadata || {}
  
  if (!userId) {
    console.error('❌ Missing userId in payment intent metadata')
    return
  }

  // IMPORTANT: Skip credit processing here if this payment_intent was created via checkout.session
  // The checkout.session.completed event will handle credits to avoid double-processing
  // Only process credits here if this payment_intent was NOT part of a checkout session
  // (e.g., direct API payments that don't go through checkout)
  
  // For checkout sessions, we check if a checkout session exists for this payment intent
  // If it does, skip processing here to avoid duplicates
  try {
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntent.id,
      limit: 1
    })
    
    if (sessions.data.length > 0) {
      console.log('⚠️ Payment intent is part of a checkout session - skipping credit processing here to avoid duplicate')
      console.log('ℹ️ Credits will be processed by checkout.session.completed handler')
      return
    }
  } catch (error) {
    console.log('Could not check for checkout session, proceeding with payment intent processing')
  }

  // Only process credits if this payment intent is NOT part of a checkout session
  if (type === 'credits' && creditAmount) {
    const credits = parseInt(creditAmount)
    await handleCreditPurchase(userId, priceId || '', credits)
    
    // Send receipt email for credit purchase
    await sendReceiptEmailFromPaymentIntent(paymentIntent)
  } else if (creditAmount) {
    // Fallback: if creditAmount exists but no type, assume it's a credit purchase
    const credits = parseInt(creditAmount)
    await handleCreditPurchase(userId, priceId || '', credits)
    
    // Send receipt email for credit purchase
    await sendReceiptEmailFromPaymentIntent(paymentIntent)
  }
}

async function handleCreditPurchase(userId: string, priceId: string, creditAmount?: number) {
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

    // Start transaction to add credits and log purchase
    await query('BEGIN')
    
    try {
      // Add credits to user's account
      await query(
        `UPDATE user_credits 
         SET credits_remaining = credits_remaining + $1, updated_at = NOW() 
         WHERE user_id = $2`,
        [credits, userId]
      )

      // Log the credit purchase transaction
      let packageName = getPlanNameFromPriceId(priceId)
      // Fallback: if priceId is empty, derive package name from credit amount
      if (packageName === 'Unknown Plan' && credits) {
        packageName = getPackageNameFromCreditAmount(credits)
      }
      await query(
        `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
         VALUES ($1, $2, $3, $4)`,
        [userId, 'purchase', credits, `Credit purchase: ${packageName}`]
      )

      await query('COMMIT')
      console.log(`Added ${credits} credits to user ${userId}`)

      // Create notification for credit purchase
      await NotificationService.notifyCreditPurchase(userId, credits, packageName)
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error adding credits to user:', error)
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
        const customer = await stripe.customers.retrieve(session.customer as string)
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
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 1 })
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
    const amount = `$${(session.amount_total || 0) / 100}`

    const receiptData: ReceiptData = {
      customerEmail,
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
    const customer = await stripe.customers.retrieve(subscription.customer as string)
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
    const amount = `$${(price.unit_amount || 0) / 100}`
    const billingPeriod = price.recurring ? 
      (price.recurring.interval === 'month' ? 'Monthly' : 'Yearly') : 
      undefined

    const receiptData: ReceiptData = {
      customerEmail: customer.email,
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
        const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string)
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
    const amount = `$${(paymentIntent.amount || 0) / 100}`
    const credits = creditAmount ? parseInt(creditAmount) : undefined

    const receiptData: ReceiptData = {
      customerEmail,
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
  // Map price IDs to plan names
  const planNames: Record<string, string> = {
    'price_1SWNfpDlESHKijI261EHN47W': 'Unlimited Monthly',
    'price_1SWNgrDlESHKijI27OB0Qyg5': 'Unlimited Yearly',
    'price_1S69FNDlESHKijI2GkCApIWQ': 'Starter Pack',
    'price_1S69G7DlESHKijI2Eb3uIxHZ': 'Professional Pack',
    'price_1S69GqDlESHKijI2PsvK4k4o': 'Business Pack',
    'price_1S69HzDlESHKijI2K9H4o4FV': 'Enterprise Pack',
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
