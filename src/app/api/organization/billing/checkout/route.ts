import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { createCheckoutSession, canAddUser, addSeatsToOwnerSubscription, reduceSeatsFromOwnerSubscription, getSeatPriceInfo } from '@/lib/organization-billing'
import { checkPermission } from '@/lib/role-service'

/**
 * POST /api/organization/billing/checkout
 * Create Stripe checkout session for adding users
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, numberOfUsers, billingPeriod } = body
    
    if (!organizationId || !numberOfUsers) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and number of users are required' },
        { status: 400 }
      )
    }
    
    // Validate billing period
    const validBillingPeriod = billingPeriod === 'yearly' ? 'yearly' : 'monthly'
    
    // Check permission
    const hasPermission = await checkPermission(user.userId, organizationId, 'canManageBilling')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to manage billing' },
        { status: 403 }
      )
    }
    
    // Check if owner has a subscription before allowing user additions
    // This is required - users can only be added if owner has an active subscription
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const session = await createCheckoutSession(
      organizationId,
      numberOfUsers,
      `${baseUrl}/organization?tab=billing&success=true`,
      `${baseUrl}/organization?tab=billing&canceled=true`,
      true, // useOwnerSubscription - this will throw if owner doesn't have subscription
      validBillingPeriod
    )
    
    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session'
    
    // Return 400 for subscription requirement errors (user needs to subscribe first)
    const statusCode = errorMessage.includes('must have an active') || 
                       errorMessage.includes('subscription is not active') 
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
    
    // Get price information for both billing periods
    let monthlyPrice, yearlyPrice
    try {
      monthlyPrice = await getSeatPriceInfo('monthly')
    } catch (error) {
      console.error('Error getting monthly price:', error)
    }
    
    try {
      yearlyPrice = await getSeatPriceInfo('yearly')
    } catch (error) {
      console.error('Error getting yearly price:', error)
    }
    
    return NextResponse.json({
      success: true,
      ...status,
      pricing: {
        monthly: monthlyPrice,
        yearly: yearlyPrice
      }
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
      return NextResponse.json({
        success: true,
        ...result
      })
    } else {
      // Add seats - requires owner to have an active subscription
      try {
        const result = await addSeatsToOwnerSubscription(organizationId, numberOfUsers)
        return NextResponse.json({
          success: true,
          ...result
        })
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

