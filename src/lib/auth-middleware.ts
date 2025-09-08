import { NextRequest, NextResponse } from 'next/server'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export interface AuthenticatedUser {
  userId: string
  email: string
  plan: string
  emailVerified: boolean
}

export function verifyToken(token: string): AuthenticatedUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    return {
      userId: decoded.userId,
      email: decoded.email,
      plan: decoded.plan,
      emailVerified: decoded.emailVerified
    }
  } catch (error) {
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

