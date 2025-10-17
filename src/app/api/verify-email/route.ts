import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { queryOne, query } from '@/lib/database'
import { EmailService } from '@/lib/email-service'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, verificationCode, action } = body

    if (!email || !verificationCode) {
      return NextResponse.json(
        { success: false, error: 'Email and verification code are required' },
        { status: 400 }
      )
    }

    if (action === 'verify') {
      return await handleEmailVerification(email, verificationCode)
    } else if (action === 'resend') {
      return await handleResendVerification(email)
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('❌ Email verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    )
  }
}

async function handleEmailVerification(email: string, verificationCode: string) {
  try {
    // Find user with matching email and verification code
    const user = await queryOne(
      `SELECT id, email, first_name, last_name, company, plan_type, verification_code, verification_code_expires_at, email_verified
       FROM users 
       WHERE email = $1 AND verification_code = $2`,
      [email, verificationCode]
    )

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      )
    }

    // Check if code has expired
    const now = new Date()
    const expiresAt = new Date(user.verification_code_expires_at)
    
    if (now > expiresAt) {
      return NextResponse.json(
        { success: false, error: 'Verification code has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json(
        { success: false, error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Update user to mark email as verified and clear verification code
    await query(
      `UPDATE users 
       SET email_verified = true, verification_code = NULL, verification_code_expires_at = NULL, is_active = true
       WHERE id = $1`,
      [user.id]
    )

    // Generate JWT token for verified user
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        plan: user.plan_type,
        emailVerified: true
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    )

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully! Welcome to A11ytest.ai.',
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        company: user.company,
        plan: user.plan_type,
        emailVerified: true,
        credits: 2
      },
      token
    })
  } catch (error) {
    console.error('Email verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Verification failed' },
      { status: 500 }
    )
  }
}

async function handleResendVerification(email: string) {
  try {
    // Find user
    const user = await queryOne(
      `SELECT id, email, first_name, last_name, verification_code, verification_code_expires_at, email_verified
       FROM users 
       WHERE email = $1`,
      [email]
    )

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      )
    }

    // Check if already verified
    if (user.email_verified) {
      return NextResponse.json(
        { success: false, error: 'Email is already verified' },
        { status: 400 }
      )
    }

    // Generate new verification code
    const newVerificationCode = EmailService.generateVerificationCode()
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now

    // Update user with new verification code
    await query(
      `UPDATE users 
       SET verification_code = $1, verification_code_expires_at = $2
       WHERE id = $3`,
      [newVerificationCode, verificationExpires, user.id]
    )

    // Send new verification email
    const emailSent = await EmailService.sendVerificationEmail({
      email: user.email,
      verificationCode: newVerificationCode,
      firstName: user.first_name
    })

    if (!emailSent) {
      return NextResponse.json(
        { success: false, error: 'Failed to send verification email. Please try again.' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'New verification code sent to your email.'
    })
  } catch (error) {
    console.error('Resend verification error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to resend verification code' },
      { status: 500 }
    )
  }
}

