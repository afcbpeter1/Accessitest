import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { getUserCredits } from '@/lib/credit-service'
import { getStripe } from '@/lib/stripe-config'

async function handleGetUser(request: NextRequest, user: any) {
  try {
    // Get full user data from database
    const userData = await queryOne(
      `SELECT u.*
       FROM users u
       WHERE u.id = $1`,
      [user.userId]
    )

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get credit information using getUserCredits (handles organization vs personal credits)
    const creditInfo = await getUserCredits(user.userId)

    // Get user's role in their organization (if they're a member)
    let organizationRole: 'owner' | 'admin' | 'user' | null = null
    let organizationId: string | null = null
    if (userData.default_organization_id) {
      const member = await queryOne(
        `SELECT role FROM organization_members
         WHERE organization_id = $1 AND user_id = $2 AND is_active = true`,
        [userData.default_organization_id, user.userId]
      )
      if (member) {
        organizationRole = member.role as 'owner' | 'admin' | 'user'
        organizationId = userData.default_organization_id
      }
    }
    
    // If no default org, check if they're a member of any organization
    if (!organizationRole) {
      const member = await queryOne(
        `SELECT organization_id, role FROM organization_members
         WHERE user_id = $1 AND is_active = true
         ORDER BY joined_at ASC
         LIMIT 1`,
        [user.userId]
      )
      if (member) {
        organizationRole = member.role as 'owner' | 'admin' | 'user'
        organizationId = member.organization_id
      }
    }

    // Get subscription details if user has one
    let subscriptionDetails = null
    if (userData.stripe_subscription_id) {
      try {
        const subscription = await getStripe().subscriptions.retrieve(userData.stripe_subscription_id)
        const price = subscription.items.data[0]?.price
        const billingPeriod = price?.recurring?.interval === 'month' ? 'monthly' : 'yearly'
        
        subscriptionDetails = {
          id: subscription.id,
          status: subscription.status,
          billingPeriod,
          cancelAtPeriodEnd: subscription.cancel_at_period_end || false,
          currentPeriodEnd: (subscription as any).current_period_end
            ? new Date((subscription as any).current_period_end * 1000).toISOString()
            : null,
        }
      } catch (error) {
        // Subscription not found in Stripe, ignore

      }
    }

    return NextResponse.json({
      success: true,
      user: {
        id: userData.id,
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        name: `${userData.first_name} ${userData.last_name}`,
        company: userData.company,
        plan: userData.plan_type,
        isActive: userData.is_active,
        emailVerified: userData.email_verified,
        creditsRemaining: creditInfo.credits_remaining || 0,
        creditsUsed: creditInfo.credits_used || 0,
        unlimitedCredits: creditInfo.unlimited_credits || false,
        createdAt: userData.created_at,
        lastLogin: userData.last_login,
        subscription: subscriptionDetails,
        organizationRole: organizationRole,
        organizationId: organizationId
      }
    })
  } catch (error) {
    console.error('Error fetching user data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user data' },
      { status: 500 }
    )
  }
}

async function handleUpdateUser(request: NextRequest, user: any) {
  try {
    const body = await request.json()
    const { firstName, lastName, company } = body

    // Update user data
    await queryOne(
      `UPDATE users 
       SET first_name = $1, last_name = $2, company = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [firstName, lastName, company, user.userId]
    )

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully'
    })
  } catch (error) {
    console.error('Error updating user data:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    )
  }
}

export const GET = requireAuth(handleGetUser)
export const PUT = requireAuth(handleUpdateUser)

