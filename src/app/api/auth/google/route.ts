import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'
import { OAuth2Client } from 'google-auth-library'
import { queryOne, query } from '@/lib/database'
import { getUserCredits } from '@/lib/credit-service'
import { VPNDetector } from '@/lib/vpn-detector'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

function getGoogleClientId(): string | undefined {
  return (
    process.env.GOOGLE_CLIENT_ID?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim()
  )
}

function splitName(name: string | undefined, given?: string, family?: string) {
  if (given || family) {
    return {
      firstName: given?.trim() || 'User',
      lastName: family?.trim() || '',
    }
  }
  const parts = (name || '').trim().split(/\s+/)
  return {
    firstName: parts[0] || 'User',
    lastName: parts.slice(1).join(' ') || '',
  }
}

export async function POST(request: NextRequest) {
  const clientId = getGoogleClientId()
  if (!clientId) {
    return NextResponse.json(
      { success: false, error: 'Google sign-in is not configured' },
      { status: 503 }
    )
  }

  try {
    const body = await request.json()
    const credential = typeof body.credential === 'string' ? body.credential : ''
    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Missing Google credential' },
        { status: 400 }
      )
    }

    const oAuth2 = new OAuth2Client(clientId)
    const ticket = await oAuth2.verifyIdToken({
      idToken: credential,
      audience: clientId,
    })
    const payload = ticket.getPayload()
    if (!payload?.email) {
      return NextResponse.json(
        { success: false, error: 'Google did not return an email address' },
        { status: 400 }
      )
    }

    if (payload.email_verified === false) {
      return NextResponse.json(
        { success: false, error: 'This Google account email is not verified' },
        { status: 403 }
      )
    }

    const email = payload.email.trim()
    const { firstName, lastName } = splitName(
      payload.name,
      payload.given_name,
      payload.family_name
    )

    const clientIP =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'

    let user = await queryOne(
      'SELECT * FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    )

    if (!user) {
      const vpnDetector = VPNDetector.getInstance()
      const vpnResult = await vpnDetector.checkVPN(clientIP, {
        logToDatabase: true,
        actionType: 'registration',
      })
      if (vpnDetector.shouldBlockIP(vpnResult)) {
        return NextResponse.json(
          {
            success: false,
            error: `${vpnDetector.getBlockReason(vpnResult)}. Please disable VPN/proxy to continue.`,
          },
          { status: 403 }
        )
      }

      const recentRegistrations = await query(
        `SELECT COUNT(*) as count FROM users 
         WHERE created_at > NOW() - INTERVAL '24 hours' 
         AND last_ip = $1`,
        [clientIP]
      )
      if (Number(recentRegistrations.rows[0]?.count) > 2) {
        return NextResponse.json(
          {
            success: false,
            error: 'Too many registrations from this location. Please try again later.',
          },
          { status: 429 }
        )
      }

      await query('BEGIN')
      try {
        const userResult = await queryOne(
          `INSERT INTO users (email, first_name, last_name, company, plan_type, is_active, email_verified, last_ip, verification_code, verification_code_expires_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, NULL)
           RETURNING *`,
          [email, firstName, lastName, null, 'free', true, true, clientIP]
        )

        await query(
          `INSERT INTO registration_attempts (ip_address, email, success, user_id)
           VALUES ($1, $2, $3, $4)`,
          [clientIP, email, true, userResult.id]
        )

        const orgName = `${firstName} ${lastName}'s Organization`
        const org = await queryOne(
          `INSERT INTO organizations (name, subscription_status, max_teams)
           VALUES ($1, $2, $3)
           RETURNING *`,
          [orgName, 'active', 0]
        )

        await query(
          `INSERT INTO organization_members (user_id, organization_id, role, joined_at, is_active)
           VALUES ($1, $2, $3, NOW(), true)`,
          [userResult.id, org.id, 'owner']
        )

        await query(
          `INSERT INTO organization_credits (organization_id, credits_remaining, credits_used, unlimited_credits)
           VALUES ($1, $2, $3, $4)`,
          [org.id, 3, 0, false]
        )

        await query(
          `UPDATE users SET default_organization_id = $1 WHERE id = $2`,
          [org.id, userResult.id]
        )

        await query('COMMIT')
        user = userResult
      } catch (e) {
        await query('ROLLBACK')
        throw e
      }
    } else {
      if (!user.is_active) {
        return NextResponse.json(
          { success: false, error: 'This account is disabled' },
          { status: 403 }
        )
      }
      if (!user.email_verified) {
        await query(
          `UPDATE users SET email_verified = true, is_active = true, verification_code = NULL, verification_code_expires_at = NULL WHERE id = $1`,
          [user.id]
        )
        user = await queryOne('SELECT * FROM users WHERE id = $1', [user.id])
      }
      await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id])
    }

    const creditInfo = await getUserCredits(user.id)

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        plan: user.plan_type,
        emailVerified: user.email_verified,
        lastActivity: Date.now(),
      },
      JWT_SECRET,
      { expiresIn: '3h' }
    )

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
        company: user.company,
        plan: user.plan_type,
        credits: creditInfo.credits_remaining ?? 0,
        emailVerified: user.email_verified,
      },
      token,
    })
  } catch (error) {
    console.error('Google auth error:', error)
    return NextResponse.json(
      { success: false, error: 'Google sign-in failed' },
      { status: 500 }
    )
  }
}
