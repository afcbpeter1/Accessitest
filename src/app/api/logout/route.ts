import { NextRequest, NextResponse } from 'next/server'
import { verifyToken } from '@/app/api/auth/route'
import { query } from '@/lib/database'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'No token provided' },
        { status: 401 }
      )
    }

    // Verify the token to get user info
    const user = verifyToken(token)
    
    if (user) {
      // Log the logout event (optional)
      try {
        await query(
          'INSERT INTO user_audit_log (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
          [
            user.userId,
            'logout',
            JSON.stringify({ timestamp: new Date().toISOString() }),
            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
          ]
        )
      } catch (error) {
        // Don't fail logout if audit logging fails
        console.warn('Failed to log logout event:', error)
      }
    }

    // Return success - the client will handle clearing localStorage
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully'
    })
  } catch (error) {
    console.error('Logout error:', error)
    return NextResponse.json(
      { success: false, error: 'Logout failed' },
      { status: 500 }
    )
  }
}

