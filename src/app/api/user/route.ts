import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'

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
        lastLogin: userData.last_login
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

