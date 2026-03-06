import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET
const JWT_SECRET_OR_FALLBACK = JWT_SECRET || 'your-secret-key-change-in-production'

function getSigningSecret(): string {
  if (process.env.NODE_ENV === 'production' && !JWT_SECRET) {
    // During `next build`, env vars may not be present even though they'll exist at runtime.
    // Avoid failing the build; still fail fast at runtime if missing.
    const isNextBuild =
      process.env.NEXT_PHASE === 'phase-production-build' ||
      process.env.NEXT_PHASE === 'phase-production-export'
    if (!isNextBuild) {
      throw new Error('JWT_SECRET must be set in production')
    }
  }
  return JWT_SECRET_OR_FALLBACK
}

export interface AuthenticatedUser {
  userId: string
  email: string
  plan: string
  emailVerified: boolean
}

export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, getSigningSecret()) as any

    return {
      userId: decoded.userId,
      email: decoded.email,
      plan: decoded.plan,
      emailVerified: decoded.emailVerified
    }
  } catch (error) {
    console.error('❌ JWT Token verification failed:', error)
    return null
  }
}

export function getAuthToken(request: NextRequest): string | null {
  // Check Authorization header first
  const authHeader = request.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // Check cookies
  const token = request.cookies.get('accessToken')?.value
  if (token) {
    return token
  }

  return null
}

export function requireAuth(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const token = getAuthToken(request)
    
    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }

    const user = verifyToken(token)
    
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      )
    }

    if (!user.emailVerified) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Email verification required',
          requiresVerification: true,
          email: user.email
        },
        { status: 403 }
      )
    }

    return handler(request, user)
  }
}

export function requireAuthOptional(handler: (request: NextRequest, user: AuthenticatedUser | null) => Promise<NextResponse>) {
  return async (request: NextRequest) => {
    const token = getAuthToken(request)
    let user: AuthenticatedUser | null = null

    if (token) {
      user = verifyToken(token)
    }

    return handler(request, user)
  }
}

// Direct function to get authenticated user (for use in API routes)
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser> {
  const token = getAuthToken(request)
  // Debug log
  
  if (!token) {
    // Debug log
    throw new Error('Authentication required')
  }

  const user = verifyToken(token)
  // Debug log
  
  if (!user) {
    // Debug log
    throw new Error('Invalid or expired token')
  }

  if (!user.emailVerified) {
    // Debug log
    throw new Error('Email verification required')
  }

  return user
}

