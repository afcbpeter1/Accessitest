import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { createCheckoutSession, canAddUser } from '@/lib/organization-billing'
import { checkPermission } from '@/lib/role-service'

/**
 * POST /api/organization/billing/checkout
 * Create Stripe checkout session for adding users
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, numberOfUsers } = body
    
    if (!organizationId || !numberOfUsers) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and number of users are required' },
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
    
    // Create checkout session
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const session = await createCheckoutSession(
      organizationId,
      numberOfUsers,
      `${baseUrl}/organization?tab=billing&success=true`,
      `${baseUrl}/organization?tab=billing&canceled=true`
    )
    
    return NextResponse.json({
      success: true,
      sessionId: session.sessionId,
      url: session.url
    })
  } catch (error) {
    console.error('Error creating checkout session:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create checkout session'
      },
      { status: 500 }
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
    
    return NextResponse.json({
      success: true,
      ...status
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

