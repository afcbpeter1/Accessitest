import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
})

async function handleGetUser(request: NextRequest, user: any) {
  try {
    // Get full user data from database
    const userData = await queryOne(
      `SELECT u.*, uc.credits_remaining, uc.credits_used, uc.unlimited_credits
       FROM users u
       LEFT JOIN user_credits uc ON u.id = uc.user_id
       WHERE u.id = $1`,
      [user.userId]
    )

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Get subscription details if user has one
    let subscriptionDetails = null
    if (userData.stripe_subscription_id) {
      try {
        const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id)
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
        creditsRemaining: userData.credits_remaining || 0,
        creditsUsed: userData.credits_used || 0,
        unlimitedCredits: userData.unlimited_credits || false,
        createdAt: userData.created_at,
        lastLogin: userData.last_login,
        subscription: subscriptionDetails
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

