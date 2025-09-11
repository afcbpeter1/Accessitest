import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { queryOne, query } from '@/lib/database'
import { VPNDetector } from '@/lib/vpn-detector'
import { EmailService } from '@/lib/email-service'

// Database user interface
interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  company?: string
  plan_type: 'free' | 'web_only' | 'document_only' | 'complete_access'
  is_active: boolean
  email_verified: boolean
  created_at: string
  last_login?: string
}

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, email, password, name, company } = body

    if (action === 'login') {
      return await handleLogin(email, password)
    } else if (action === 'register') {
      return await handleRegister(email, password, name, company, request)
    } else {
      return NextResponse.json(
        { success: false, error: 'Invalid action' },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('❌ Authentication error:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication failed' },
      { status: 500 }
    )
  }
}

async function handleLogin(email: string, password: string) {
  if (!email || !password) {
    return NextResponse.json(
      { success: false, error: 'Email and password are required' },
      { status: 400 }
    )
  }

  try {
    // Get user from database
    const user = await queryOne(
      'SELECT * FROM users WHERE email = $1 AND is_active = true',
      [email]
    )

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Get password from separate table
    const passwordData = await queryOne(
      'SELECT * FROM user_passwords WHERE user_id = $1',
      [user.id]
    )

    if (!passwordData) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, passwordData.password_hash)

    if (!isValidPassword) {
      return NextResponse.json(
        { success: false, error: 'Invalid email or password' },
        { status: 401 }
      )
    }

    // Check if email is verified
    if (!user.email_verified) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Please verify your email address before logging in. Check your inbox for a verification code.',
          requiresVerification: true,
          email: user.email
        },
        { status: 403 }
      )
    }

    // Update last login
    await query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    )

    // Get user credits
    const creditData = await queryOne(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [user.id]
    )

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        plan: user.plan_type,
        emailVerified: user.email_verified
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    )

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        company: user.company,
        plan: user.plan_type,
        credits: creditData?.credits_remaining || 0,
        emailVerified: user.email_verified
      },
      token
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: 'Login failed' },
      { status: 500 }
    )
  }
}

async function handleRegister(email: string, password: string, name: string, company?: string, request?: NextRequest) {
  if (!email || !password || !name) {
    return NextResponse.json(
      { success: false, error: 'Email, password, and name are required' },
      { status: 400 }
    )
  }

  // Get client IP address
  const clientIP = request?.headers.get('x-forwarded-for') || 
                   request?.headers.get('x-real-ip') || 
                   'unknown'

  // Check for VPN/Proxy usage
  const vpnDetector = VPNDetector.getInstance()
  const vpnResult = await vpnDetector.checkVPN(clientIP, {
    logToDatabase: true,
    actionType: 'registration'
  })
  
  if (vpnDetector.shouldBlockIP(vpnResult)) {
    return NextResponse.json(
      { success: false, error: `${vpnDetector.getBlockReason(vpnResult)}. Please disable VPN/proxy to continue.` },
      { status: 403 }
    )
  }

  // Check for recent registrations from same IP (last 24 hours)
  const recentRegistrations = await query(
    `SELECT COUNT(*) as count FROM users 
     WHERE created_at > NOW() - INTERVAL '24 hours' 
     AND last_ip = $1`,
    [clientIP]
  )

  if (recentRegistrations.rows[0].count > 2) {
    return NextResponse.json(
      { success: false, error: 'Too many registrations from this location. Please try again later.' },
      { status: 429 }
    )
  }

  try {
    // Check if user already exists
    const existingUser = await queryOne(
      'SELECT id FROM users WHERE email = $1',
      [email]
    )

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'User already exists' },
        { status: 409 }
      )
    }

    // Split name into first and last
    const nameParts = name.trim().split(' ')
    const firstName = nameParts[0] || ''
    const lastName = nameParts.slice(1).join(' ') || ''

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12)
    const salt = 'default-salt' // In production, generate unique salt per user

    // Generate verification code
    const verificationCode = EmailService.generateVerificationCode()
    const verificationExpires = new Date(Date.now() + 15 * 60 * 1000) // 15 minutes from now

    // Start transaction
    await query('BEGIN')

    try {
      // Create new user with verification code
      const userResult = await queryOne(
        `INSERT INTO users (email, first_name, last_name, company, plan_type, is_active, email_verified, last_ip, verification_code, verification_code_expires_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *`,
        [email, firstName, lastName, company, 'free', false, false, clientIP, verificationCode, verificationExpires]
      )

      // Log registration attempt
      await query(
        `INSERT INTO registration_attempts (ip_address, email, success, user_id)
         VALUES ($1, $2, $3, $4)`,
        [clientIP, email, true, userResult.id]
      )

      // Store password separately
      await query(
        `INSERT INTO user_passwords (user_id, password_hash, salt)
         VALUES ($1, $2, $3)`,
        [userResult.id, hashedPassword, salt]
      )

      // Initialize user credits
      await query(
        `INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
         VALUES ($1, $2, $3, $4)`,
        [userResult.id, 2, 0, false]
      )

      // Commit transaction
      await query('COMMIT')

      // Send verification email
      const emailSent = await EmailService.sendVerificationEmail({
        email: userResult.email,
        verificationCode,
        firstName: userResult.first_name
      })

      if (!emailSent) {
        console.warn('Failed to send verification email, but user was created')
      }

      return NextResponse.json({
        success: true,
        message: 'Registration successful! Please check your email for a verification code.',
        requiresVerification: true,
        user: {
          id: userResult.id,
          email: userResult.email,
          name: `${userResult.first_name} ${userResult.last_name}`,
          company: userResult.company,
          plan: userResult.plan_type,
          emailVerified: false
        }
      })
    } catch (error) {
      await query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { success: false, error: 'Registration failed' },
      { status: 500 }
    )
  }
}

// Verify JWT token
export function verifyToken(token: string) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    return decoded
  } catch (error) {
    return null
  }
}

// Get user by email
export async function getUserByEmail(email: string) {
  try {
    return await queryOne(
      'SELECT * FROM users WHERE email = $1',
      [email]
    )
  } catch (error) {
    console.error('Error getting user by email:', error)
    return null
  }
}

// Update user plan
export async function updateUserPlan(email: string, plan: string) {
  try {
    const result = await query(
      'UPDATE users SET plan_type = $1 WHERE email = $2',
      [plan, email]
    )
    
    if (plan === 'complete_access') {
      await query(
        'UPDATE user_credits SET unlimited_credits = true WHERE user_id = (SELECT id FROM users WHERE email = $1)',
        [email]
      )
    }
    
    return (result.rowCount ?? 0) > 0
  } catch (error) {
    console.error('Error updating user plan:', error)
    return false
  }
}

