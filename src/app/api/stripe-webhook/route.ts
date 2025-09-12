import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { query } from '@/lib/database'
import { getPlanTypeFromPriceId, getCreditAmountFromPriceId } from '@/lib/stripe-config'
import { sendReceiptEmail, ReceiptData } from '@/lib/receipt-email-service'
import { NotificationService } from '@/lib/notification-service'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
})

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    console.log('🔔 Webhook received!')
    const body = await request.text()
    const signature = request.headers.get('stripe-signature')!

    let event: Stripe.Event

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
    } catch (err) {
      console.error('Webhook signature verification failed:', err)
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
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
  console.log('Processing checkout session completed:', session.id)
  
  const { userId, priceId, type } = session.metadata || {}
  
  if (!userId || !priceId) {
    console.error('Missing metadata in checkout session')
    return
  }

  if (type === 'credits') {
    await handleCreditPurchase(userId, priceId)
  }

  // Send receipt email
  await sendReceiptEmailFromSession(session)
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log('Processing subscription created:', subscription.id)
  
  const { userId, planType } = subscription.metadata || {}
  
  if (!userId || !planType) {
    console.error('Missing metadata in subscription')
    return
  }

  try {
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
      console.log(`Updated user ${userId} to plan ${planType} with unlimited credits`)

      // Create notification for subscription activation
      await NotificationService.notifySubscriptionActivated(userId, planType)

      // Send receipt email for subscription
      await sendReceiptEmailFromSubscription(subscription)
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error updating user subscription:', error)
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
  
  try {
    // Start transaction to set user back to free plan and remove unlimited credits
    await query('BEGIN')
    
    try {
      // Set user back to free plan
      await query(
        `UPDATE users SET plan_type = 'free', stripe_subscription_id = NULL, updated_at = NOW() 
         WHERE stripe_subscription_id = $1`,
        [subscription.id]
      )

      // Remove unlimited credits and give 3 free credits
      await query(
        `UPDATE user_credits 
         SET unlimited_credits = false, credits_remaining = 3, updated_at = NOW() 
         WHERE user_id = (SELECT id FROM users WHERE stripe_subscription_id = $1)`,
        [subscription.id]
      )

      await query('COMMIT')
      console.log(`Set user with subscription ${subscription.id} back to free plan with 3 credits`)

      // Create notification for subscription cancellation
      await NotificationService.notifySubscriptionCancelled(userId)
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error handling subscription deletion:', error)
  }
}

async function handlePaymentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing payment succeeded:', paymentIntent.id)
  
  const { userId, creditAmount } = paymentIntent.metadata || {}
  
  if (userId && creditAmount) {
    await handleCreditPurchase(userId, '', parseInt(creditAmount))
  }
}

async function handleCreditPurchase(userId: string, priceId: string, creditAmount?: number) {
  try {
    const credits = creditAmount || getCreditAmountFromPriceId(priceId)
    
    if (credits <= 0) {
      console.error('Invalid credit amount:', credits)
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

      // Log the credit purchase transaction (with fallback for missing columns)
      const packageName = getPlanNameFromPriceId(priceId)
      try {
        await query(
          `INSERT INTO credit_transactions (user_id, transaction_type, amount, description)
           VALUES ($1, $2, $3, $4)`,
          [userId, 'purchase', credits, `Credit purchase: ${packageName}`]
        )
      } catch (error) {
        // If amount column doesn't exist, try with credits_amount column
        if (error.message.includes('amount')) {
          console.log('Amount column missing, trying with credits_amount...')
          await query(
            `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
             VALUES ($1, $2, $3, $4)`,
            [userId, 'purchase', credits, `Credit purchase: ${packageName}`]
          )
        } else {
          throw error
        }
      }

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
    if (!session.customer_email) {
      console.log('No customer email in session, skipping receipt email')
      return
    }

    // Get the price details
    const lineItem = session.line_items?.data?.[0]
    if (!lineItem?.price) {
      console.log('No price information in session, skipping receipt email')
      return
    }

    const price = lineItem.price
    const { type } = session.metadata || {}
    
    // Get plan name from price
    const planName = getPlanNameFromPriceId(price.id)
    const amount = `$${(price.unit_amount || 0) / 100}`
    const billingPeriod = price.recurring ? 
      (price.recurring.interval === 'month' ? 'Monthly' : 'Yearly') : 
      undefined

    const receiptData: ReceiptData = {
      customerEmail: session.customer_email,
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
      billingPeriod,
      creditAmount: type === 'credits' ? getCreditAmountFromPriceId(price.id) : undefined
    }

    await sendReceiptEmail(receiptData)
  } catch (error) {
    console.error('Error sending receipt email from session:', error)
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

function getPlanNameFromPriceId(priceId: string): string {
  // Map price IDs to plan names
  const planNames: Record<string, string> = {
    'price_1S696uDlESHKijI24XIbzGdH': 'Web Scan Only - Monthly',
    'price_1S698gDlESHKijI2hVtPhtvZ': 'Web Scan Only - Yearly',
    'price_1S69A4DlESHKijI2LNv4j2SI': 'Document Scan Only - Monthly',
    'price_1S69CADlESHKijI2SMX0XF1k': 'Document Scan Only - Yearly',
    'price_1S69D4DlESHKijI2LG4FvwyO': 'Complete Access - Monthly',
    'price_1S69DvDlESHKijI2p2FIcY5a': 'Complete Access - Yearly',
    'price_1S69FNDlESHKijI2GkCApIWQ': 'Starter Pack',
    'price_1S69G7DlESHKijI2Eb3uIxHZ': 'Professional Pack',
    'price_1S69GqDlESHKijI2PsvK4k4o': 'Business Pack',
    'price_1S69HzDlESHKijI2K9H4o4FV': 'Enterprise Pack',
  }
  
  return planNames[priceId] || 'Unknown Plan'
}
