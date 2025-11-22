import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { STRIPE_PRICE_IDS, getPlanTypeFromPriceId, getCreditAmountFromPriceId, isSubscriptionPriceId, isCreditPriceId } from '@/lib/stripe-config'
import { query } from '@/lib/database'

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

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
})

export async function POST(request: NextRequest) {
  try {
    console.log('🔑 Stripe Secret Key exists:', !!process.env.STRIPE_SECRET_KEY)
    console.log('🔑 Stripe Secret Key starts with:', process.env.STRIPE_SECRET_KEY?.substring(0, 7))
    
    // Get account info to verify we're connected to the right account
    try {
      const account = await stripe.accounts.retrieve()
      console.log('🏢 Connected to Stripe Account ID:', account.id)
      console.log('🏢 Account Type:', account.type)
    } catch (accountError) {
      console.log('❌ Could not retrieve account info:', accountError)
    }
    
    const { priceId, userId, userEmail, successUrl, cancelUrl } = await request.json()
    console.log('📦 Received priceId:', priceId)
    
    // Try to retrieve the specific price to see what error we get
    try {
      const price = await stripe.prices.retrieve(priceId)
      console.log('✅ Price found:', price.id, price.nickname || price.product)
    } catch (priceError) {
      console.log('❌ Price retrieval error:', priceError.message)
    }

    // List all prices to see what actually exists
    try {
      const prices = await stripe.prices.list({ limit: 20 })
      console.log('📋 Available prices in account:')
      prices.data.forEach(p => {
        console.log(`  - ${p.id} (${p.nickname || 'no nickname'}) - $${(p.unit_amount || 0) / 100}`)
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

    // Get price details for success URL
    const price = await stripe.prices.retrieve(priceId)
    const planName = getPlanNameFromPriceId(priceId)
    const amount = `$${(price.unit_amount || 0) / 100}`
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
    }

    // Add customer email if provided
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

    const session = await stripe.checkout.sessions.create(sessionParams)

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
