import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import bcrypt from 'bcryptjs'

async function handleChangePassword(request: NextRequest, user: any) {
  try {
    const body = await request.json()
    const { currentPassword, newPassword } = body

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password and new password are required' },
        { status: 400 }
      )
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: 'New password must be at least 8 characters long' },
        { status: 400 }
      )
    }

    // Get current password hash
    const passwordData = await queryOne(
      'SELECT password_hash FROM user_passwords WHERE user_id = $1',
      [user.userId]
    )

    if (!passwordData) {
      return NextResponse.json(
        { success: false, error: 'Password data not found' },
        { status: 404 }
      )
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, passwordData.password_hash)

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Current password is incorrect' },
        { status: 401 }
      )
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12)

    // Update password
    await query(
      'UPDATE user_passwords SET password_hash = $1 WHERE user_id = $2',
      [hashedPassword, user.userId]
    )

    // Log password change
    try {
      await query(
        'INSERT INTO user_audit_log (user_id, action, details, ip_address) VALUES ($1, $2, $3, $4)',
        [
          user.userId,
          'password_change',
          JSON.stringify({ timestamp: new Date().toISOString() }),
          request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
        ]
      )
    } catch (error) {
      console.warn('Failed to log password change:', error)
    }

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully'
    })
  } catch (error) {
    console.error('Error changing password:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to change password' },
      { status: 500 }
    )
  }
}

export const POST = requireAuth(handleChangePassword)

