import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { queryOne } from '@/lib/database'
import { EmailService } from '@/lib/email-service'
import { getAppBaseUrl } from '@/lib/email-links'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'
const RESET_EXPIRY = '1h'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    // Look up user; don't reveal whether the email exists (always return success)
    const user = await queryOne(
      'SELECT id, email, first_name FROM users WHERE email = $1 AND is_active = true',
      [normalizedEmail]
    )

    if (user) {
      const token = jwt.sign(
        { email: user.email, purpose: 'password-reset' },
        JWT_SECRET,
        { expiresIn: RESET_EXPIRY }
      )
      const baseUrl = getAppBaseUrl()
      const resetLink = `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`

      const firstName = user.first_name || 'User'
      await EmailService.sendPasswordResetEmail({
        email: user.email,
        resetLink,
        firstName
      })
    }

    // Always return success to avoid email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account exists for that email, you will receive a password reset link shortly.'
    })
  } catch (error) {
    console.error('❌ Forgot password error:', error)
    return NextResponse.json(
      { success: false, error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
