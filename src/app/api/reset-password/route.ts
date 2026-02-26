import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { queryOne, query } from '@/lib/database'
import { validatePassword } from '@/lib/password-validation'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, newPassword } = body

    if (!token || !newPassword) {
      return NextResponse.json(
        { success: false, error: 'Reset link and new password are required' },
        { status: 400 }
      )
    }

    let payload: { email?: string; purpose?: string }
    try {
      payload = jwt.verify(token, JWT_SECRET) as { email?: string; purpose?: string }
    } catch {
      return NextResponse.json(
        { success: false, error: 'This reset link is invalid or has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    if (payload.purpose !== 'password-reset' || !payload.email) {
      return NextResponse.json(
        { success: false, error: 'This reset link is invalid. Please request a new one.' },
        { status: 400 }
      )
    }

    const passwordValidation = validatePassword(newPassword)
    if (!passwordValidation.valid) {
      return NextResponse.json(
        { success: false, error: passwordValidation.error },
        { status: 400 }
      )
    }

    const user = await queryOne(
      'SELECT id FROM users WHERE email = $1 AND is_active = true',
      [payload.email]
    )

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Account not found. Please request a new reset link.' },
        { status: 404 }
      )
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12)
    await query(
      'UPDATE user_passwords SET password_hash = $1 WHERE user_id = $2',
      [hashedPassword, user.id]
    )

    return NextResponse.json({
      success: true,
      message: 'Your password has been reset. You can now sign in with your new password.'
    })
  } catch (error) {
    console.error('❌ Reset password error:', error)
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
