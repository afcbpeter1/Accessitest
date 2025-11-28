import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/database'

/**
 * TEST-ONLY ENDPOINT: Auto-verify test users
 * This endpoint bypasses email verification for testing purposes
 * Only works in development/test environments
 */
export async function POST(request: NextRequest) {
  // SECURITY: Only allow in development/test environments
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_VERIFICATION !== 'true') {
    return NextResponse.json(
      { success: false, error: 'This endpoint is not available in production' },
      { status: 403 }
    )
  }
  
  try {
    const body = await request.json()
    const { userId, email } = body
    
    if (!userId && !email) {
      return NextResponse.json(
        { success: false, error: 'userId or email is required' },
        { status: 400 }
      )
    }
    
    // Find user by ID or email
    let user
    if (userId) {
      user = await query(
        'SELECT id, email FROM users WHERE id = $1',
        [userId]
      )
      if (user.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }
    } else if (email) {
      user = await query(
        'SELECT id, email FROM users WHERE email = $1',
        [email]
      )
      if (user.rows.length === 0) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        )
      }
    }
    
    const targetUserId = user.rows[0].id
    
    // Auto-verify the user (bypass email verification)
    await query(
      `UPDATE users 
       SET email_verified = true, 
           is_active = true, 
           verification_code = NULL,
           verification_code_expires_at = NULL
       WHERE id = $1`,
      [targetUserId]
    )
    
    return NextResponse.json({
      success: true,
      message: 'User verified successfully (test mode)',
      userId: targetUserId
    })
    
  } catch (error) {
    console.error('Test verify user error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to verify user' },
      { status: 500 }
    )
  }
}

