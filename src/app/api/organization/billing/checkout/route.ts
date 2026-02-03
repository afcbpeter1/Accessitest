import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { createCheckoutSession, canAddUser, addSeatsToOwnerSubscription, createProrationCheckoutSession, reduceSeatsFromOwnerSubscription, getSeatPriceInfo, getOwnerBillingPeriod, getOwnerBillingStatus } from '@/lib/organization-billing'
import { checkPermission } from '@/lib/role-service'

/**
 * POST /api/organization/billing/checkout
 * Add users: when payProratedNow is true, create Stripe Checkout (one-time payment) for proration and return URL.
 * Otherwise (legacy), add seats and add proration to next invoice.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, numberOfUsers, billingPeriod, payProratedNow } = body

    if (!organizationId || !numberOfUsers) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and number of users are required' },
        { status: 400 }
      )
    }

    const hasPermission = await checkPermission(user.userId, organizationId, 'canManageBilling')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to manage billing' },
        { status: 403 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const successUrl = `${baseUrl}/organization?tab=billing&success=true&seats=${numberOfUsers}&type=proration`
    const cancelUrl = `${baseUrl}/organization?tab=billing&canceled=true`

    if (payProratedNow === true) {
      const { url } = await createProrationCheckoutSession(organizationId, numberOfUsers, successUrl, cancelUrl)
      return NextResponse.json({
        success: true,
        url,
        payProratedNow: true
      })
    }

    const session = await createCheckoutSession(
      organizationId,
      numberOfUsers,
      successUrl,
      `${baseUrl}/organization?tab=billing&canceled=true`,
      true,
      undefined
    )

    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url,
      billingDetails: (session as any).billingDetails || null
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session'
    
    // Return 400 for subscription requirement or proration errors (user should use Add at renewal)
    const statusCode = errorMessage.includes('must have an active') ||
                       errorMessage.includes('subscription is not active') ||
                       errorMessage.includes('Proration is zero') ||
                       errorMessage.includes('below the minimum') ||
                       errorMessage.includes('Add at renewal')
                       ? 400
                       : 500
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage
      },
      { status: statusCode }
    )
  }
}

/**
 * GET /api/organization/billing/checkout
 * Check if organization can add more users
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      )
    }
    
    // Check permission
    const hasPermission = await checkPermission(user.userId, organizationId, 'canViewBilling')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to view billing information' },
        { status: 403 }
      )
    }
    
    const status = await canAddUser(organizationId)
    
    // Get owner's billing period and status (next billing date, pending reduction)
    const ownerBillingPeriod = await getOwnerBillingPeriod(organizationId)
    const ownerBillingStatus = await getOwnerBillingStatus(organizationId)
    
    // Get price information for the detected billing period
    let pricing = null
    if (ownerBillingPeriod) {
      try {
        pricing = await getSeatPriceInfo(ownerBillingPeriod)
      } catch (error) {
        console.error(`Error getting ${ownerBillingPeriod} price:`, error)
      }
    }
    
    // Build pricing object with proper typing
    let pricingObject: { monthly?: { priceId: string; amount: number; currency: string }; yearly?: { priceId: string; amount: number; currency: string } } | null = null
    if (pricing && ownerBillingPeriod) {
      if (ownerBillingPeriod === 'monthly') {
        pricingObject = { monthly: pricing }
      } else if (ownerBillingPeriod === 'yearly') {
        pricingObject = { yearly: pricing }
      }
    }
    
    return NextResponse.json({
      success: true,
      ...status,
      ownerBillingPeriod, // The billing period from owner's subscription
      pricing: pricingObject,
      nextBillingDate: ownerBillingStatus?.nextBillingDate ?? null,
      pendingSeatsAfterRenewal: ownerBillingStatus?.pendingSeatsAfterRenewal ?? null,
      reductionEffectiveDate: ownerBillingStatus?.reductionEffectiveDate ?? null
    })
  } catch (error) {
    console.error('Error checking user limit:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check user limit'
      },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/organization/billing/checkout
 * Update organization seats (add or reduce)
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, numberOfUsers, action } = body
    
    if (!organizationId || numberOfUsers === undefined) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and number of users are required' },
        { status: 400 }
      )
    }
    
    if (numberOfUsers <= 0) {
      return NextResponse.json(
        { success: false, error: 'Number of users must be greater than 0' },
        { status: 400 }
      )
    }
    
    // Check permission
    const hasPermission = await checkPermission(user.userId, organizationId, 'canManageBilling')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to manage billing' },
        { status: 403 }
      )
    }
    
    // Determine action: 'add' or 'reduce' (default to 'add' for backward compatibility)
    const isReduce = action === 'reduce' || action === 'remove'
    
    if (isReduce) {
      // Reduce seats
      const result = await reduceSeatsFromOwnerSubscription(organizationId, numberOfUsers)
      return NextResponse.json(result)
    } else {
      // Add seats at renewal (no payment today) - do not send receipt; receipts only after payment is confirmed on Stripe
      try {
        const result = await addSeatsToOwnerSubscription(organizationId, numberOfUsers, undefined, { sendEmail: false })
        return NextResponse.json(result)
      } catch (error) {
        // If owner doesn't have subscription, return error instead of falling back
        const errorMessage = error instanceof Error ? error.message : 'Failed to add seats'
        
        if (errorMessage.includes('does not have an active subscription')) {
          return NextResponse.json(
            {
              success: false,
              error: 'You must have an active monthly or yearly subscription before you can add users to your organization. Please subscribe first.'
            },
            { status: 400 }
          )
        } else if (errorMessage.includes('subscription is not active')) {
          return NextResponse.json(
            {
              success: false,
              error: 'Your subscription is not active. Please activate your subscription before adding users.'
            },
            { status: 400 }
          )
        } else {
          // Re-throw other errors
          throw error
        }
      }
    }
  } catch (error) {
    console.error('Error updating organization seats:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update seats'
      },
      { status: 500 }
    )
  }
}

