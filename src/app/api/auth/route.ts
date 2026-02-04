import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { queryOne, query } from '@/lib/database'
import { getUserCredits, activateUnlimitedCredits } from '@/lib/credit-service'
import { VPNDetector } from '@/lib/vpn-detector'
import { EmailService } from '@/lib/email-service'
import { acceptInvitation } from '@/lib/organization-service'

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
      const invitationToken = body.invitationToken
      return await handleRegister(email, password, name, company, request, invitationToken)
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

    // Get user credits (organization-level, same as rest of app)
    const creditInfo = await getUserCredits(user.id)

    // Generate JWT token with sliding expiration
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email, 
        plan: user.plan_type,
        emailVerified: user.email_verified,
        lastActivity: Date.now()  // Track last activity for sliding expiration
      },
      JWT_SECRET,
      { expiresIn: '15m' }  // 15 minutes of inactivity
    )

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`,
        company: user.company,
        plan: user.plan_type,
        credits: creditInfo.credits_remaining ?? 0,
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

async function handleRegister(email: string, password: string, name: string, company?: string, request?: NextRequest, invitationToken?: string) {
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

      // Check if user is signing up via invitation
      let invitedOrganizationId: string | null = null
      if (invitationToken) {
        // Find the invitation
        const invitation = await queryOne(
          `SELECT organization_id, role, invited_email
           FROM organization_members
           WHERE invitation_token = $1 AND invited_email = $2 AND is_active = false`,
          [invitationToken, email]
        )
        
        if (invitation) {
          invitedOrganizationId = invitation.organization_id
          // Update the invitation to link this user (but don't activate yet - wait for email verification)
          await query(
            `UPDATE organization_members
             SET user_id = $1, updated_at = NOW()
             WHERE invitation_token = $2 AND invited_email = $3`,
            [userResult.id, invitationToken, email]
          )
          
          // Set user's default organization to the invited one
          await query(
            `UPDATE users SET default_organization_id = $1 WHERE id = $2`,
            [invitedOrganizationId, userResult.id]
          )
          
          console.log(`✅ User ${userResult.id} linked to organization ${invitedOrganizationId} via invitation (pending verification)`)
        } else {
          console.warn(`⚠️ Invitation token ${invitationToken} not found for email ${email}`)
        }
      }
      
      // Only create new organization if NOT signing up via invitation
      if (!invitedOrganizationId) {
        // Auto-create organization for the user (organization-primary model)
        // Every user gets their own organization, which holds their credits
        const orgName = company || `${firstName} ${lastName}'s Organization`
        const org = await queryOne(
          `INSERT INTO organizations (name, subscription_status, max_teams)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [orgName, 'active', 0] // Start with 0 teams (free tier)
        )
        
        // Set user as owner of their organization
        await query(
          `INSERT INTO organization_members (user_id, organization_id, role, joined_at, is_active)
           VALUES ($1, $2, $3, NOW(), true)`,
          [userResult.id, org.id, 'owner']
        )
        
        // Create organization credits (organization-primary model - credits live at org level)
        await query(
          `INSERT INTO organization_credits (organization_id, credits_remaining, credits_used, unlimited_credits)
           VALUES ($1, $2, $3, $4)`,
          [org.id, 3, 0, false]
        )
        
        // Set as user's default organization
        await query(
          `UPDATE users SET default_organization_id = $1 WHERE id = $2`,
          [org.id, userResult.id]
        )
      }

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
      const u = await queryOne('SELECT id FROM users WHERE email = $1', [email])
      if (u?.id) {
        await activateUnlimitedCredits(u.id)
      }
    }

    return (result.rowCount ?? 0) > 0
  } catch (error) {
    console.error('Error updating user plan:', error)
    return false
  }
}

