import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { STRIPE_PRICE_IDS, getStripe, getPlanTypeFromPriceId, getCreditAmountFromPriceId, isSubscriptionPriceId, isCreditPriceId } from '@/lib/stripe-config'
import { query } from '@/lib/database'

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
  
  return planNames[priceId] || 'Unknown Plan'
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔑 Stripe Secret Key exists:', !!process.env.STRIPE_SECRET_KEY)
    console.log('🔑 Stripe Secret Key starts with:', process.env.STRIPE_SECRET_KEY?.substring(0, 7))
    
    // Get account info to verify we're connected to the right account
    try {
      const account = await getStripe().accounts.retrieve()
      console.log('🏢 Connected to Stripe Account ID:', account.id)
      console.log('🏢 Account Type:', account.type)
    } catch (accountError) {
      console.log('❌ Could not retrieve account info:', accountError)
    }
    
    const { priceId, userId, userEmail, successUrl, cancelUrl } = await request.json()
    console.log('📦 Received priceId:', priceId)
    
    // Try to retrieve the specific price to see what error we get
    try {
      const price = await getStripe().prices.retrieve(priceId)
      console.log('✅ Price found:', price.id, price.nickname || price.product)
    } catch (priceError: any) {
      console.log('Price retrieval error:', priceError.message)
    }

    // List all prices to see what actually exists
    try {
      const prices = await getStripe().prices.list({ limit: 20 })
      console.log('📋 Available prices in account:')
      prices.data.forEach(p => {
        console.log(`  - ${p.id} (${p.nickname || 'no nickname'}) - £${(p.unit_amount || 0) / 100}`)
      })
    } catch (listError: any) {
      console.log('❌ Could not list prices:', listError.message)
    }

    if (!priceId) {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 })
    }

    // Validate price ID exists in our configuration
    const allPriceIds = [
      ...Object.values(STRIPE_PRICE_IDS.subscriptions),
      ...Object.values(STRIPE_PRICE_IDS.credits)
    ]

    if (!allPriceIds.includes(priceId)) {
      return NextResponse.json({ error: 'Invalid price ID' }, { status: 400 })
    }

    // Determine if this is a subscription or one-time payment
    const isSubscription = isSubscriptionPriceId(priceId)
    const isCredit = isCreditPriceId(priceId)

    // For subscriptions, check if user already has an active subscription
    if (isSubscription && userId) {
      const userData = await query(
        `SELECT stripe_subscription_id, plan_type FROM users WHERE id = $1`,
        [userId]
      )
      
      if (userData.rows && userData.rows.length > 0 && userData.rows[0].stripe_subscription_id) {
        const existingSubscriptionId = userData.rows[0].stripe_subscription_id
        
        try {
          // Check if the existing subscription is still active
          const existingSubscription = await getStripe().subscriptions.retrieve(existingSubscriptionId)
          
          if (existingSubscription.status === 'active' || existingSubscription.status === 'trialing') {
            return NextResponse.json({ 
              error: 'You already have an active subscription. Please cancel your current subscription before starting a new one.',
              existingSubscriptionId: existingSubscriptionId
            }, { status: 400 })
          }
        } catch (error) {
          // Subscription not found in Stripe, user can create a new one
          console.log('Existing subscription not found in Stripe, allowing new subscription creation')
        }
      }
    }

    // Get price details for success URL
    const price = await getStripe().prices.retrieve(priceId)
    const planName = getPlanNameFromPriceId(priceId)
    const amount = `£${(price.unit_amount || 0) / 100}`
    const billingPeriod = price.recurring ? 
      (price.recurring.interval === 'month' ? 'Monthly' : 'Yearly') : 
      undefined

    // Create success URL with purchase details
    const successUrlWithDetails = successUrl || 
      `${process.env.NEXT_PUBLIC_BASE_URL}/thank-you?success=true&plan=${encodeURIComponent(planName)}&amount=${encodeURIComponent(amount)}&type=${isSubscription ? 'subscription' : isCredit ? 'credits' : 'one-time'}${billingPeriod ? `&billing=${encodeURIComponent(billingPeriod)}` : ''}`

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      mode: isSubscription ? 'subscription' : 'payment',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrlWithDetails,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_BASE_URL}/pricing?canceled=true`,
      metadata: {
        userId: userId || '',
        priceId,
        type: isSubscription ? 'subscription' : isCredit ? 'credits' : 'one-time',
      },
      // Enable automatic receipt emails from Stripe
      // Note: Receipt emails must also be enabled in Stripe Dashboard → Settings → Emails → Receipts
      payment_intent_data: isSubscription ? undefined : {
        receipt_email: userEmail || undefined,
      },
    }

    // Add customer email if provided (required for Stripe receipt emails)
    if (userEmail) {
      sessionParams.customer_email = userEmail
    }

    // For subscriptions, add trial period if needed
    if (isSubscription) {
      sessionParams.subscription_data = {
        metadata: {
          userId: userId || '',
          planType: getPlanTypeFromPriceId(priceId),
        },
      }
    }

    // For credit purchases, add metadata
    if (isCredit) {
      sessionParams.payment_intent_data = {
        metadata: {
          userId: userId || '',
          priceId: priceId,
          creditAmount: getCreditAmountFromPriceId(priceId).toString(),
          type: 'credits',
        },
      }
    }

    const session = await getStripe().checkout.sessions.create(sessionParams)

    console.log('✅ Checkout session created:', session.id)
    console.log('📋 Session URL:', session.url)
    console.log('📋 Session mode:', session.mode)
    console.log('📋 Session metadata:', JSON.stringify(session.metadata, null, 2))
    console.log('📋 Session status:', session.status)
    console.log('📋 Session payment status:', session.payment_status)

    return NextResponse.json({ 
      success: true, 
      sessionId: session.id,
      url: session.url 
    })

  } catch (error) {
    console.error('Stripe checkout session error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}
