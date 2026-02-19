import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import jwt from 'jsonwebtoken'
import { queryOne } from '@/lib/database'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  try {
    // Get the current user from the existing token
    const user = await getAuthenticatedUser(request)
    
    // Get fresh user data from database
    const userData = await queryOne(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [user.userId]
    )

    if (!userData) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Generate new token with updated lastActivity
    const newToken = jwt.sign(
      { 
        userId: userData.id, 
        email: userData.email, 
        plan: userData.plan_type,
        emailVerified: userData.email_verified,
        lastActivity: Date.now()  // Update last activity timestamp
      },
      JWT_SECRET,
      { expiresIn: '3h' }  // Fresh 3 hours
    )

    return NextResponse.json({
      success: true,
      token: newToken,
      expiresIn: 3 * 60 * 60 * 1000, // 3 hours in milliseconds
      message: 'Token refreshed successfully'
    })

  } catch (error) {
    console.error('❌ Token refresh error:', error)
    return NextResponse.json(
      { success: false, error: 'Token refresh failed' },
      { status: 401 }
    )
  }
}
