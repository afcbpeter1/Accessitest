import { NextRequest, NextResponse } from 'next/server'
import { query, queryOne } from './database'

interface RateLimitEntry {
  ip: string
  attempts: number
  firstAttempt: Date
  lastAttempt: Date
  blocked: boolean
  blockUntil?: Date
}

// In-memory rate limiter (for production, use Redis)
const rateLimitStore = new Map<string, RateLimitEntry>()

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    // Remove entries older than 1 hour
    if (now - entry.lastAttempt.getTime() > 60 * 60 * 1000) {
      rateLimitStore.delete(key)
    }
  }
}, 5 * 60 * 1000)

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwarded.split(',')[0].trim()
  }
  
  if (realIP) {
    return realIP.trim()
  }
  
  return 'unknown'
}

/**
 * Check if IP is rate limited for authentication attempts
 * @param request - The incoming request
 * @param maxAttempts - Maximum attempts allowed (default: 5)
 * @param windowMinutes - Time window in minutes (default: 15)
 * @returns Object with isLimited flag and remaining attempts
 */
export async function checkAuthRateLimit(
  request: NextRequest,
  maxAttempts: number = 5,
  windowMinutes: number = 15
): Promise<{ isLimited: boolean; remainingAttempts: number; retryAfter?: number }> {
  const ip = getClientIP(request)
  const now = new Date()
  const key = `auth:${ip}`
  
  let entry = rateLimitStore.get(key)
  
  // Check if IP is currently blocked
  if (entry?.blocked && entry.blockUntil && entry.blockUntil > now) {
    const retryAfter = Math.ceil((entry.blockUntil.getTime() - now.getTime()) / 1000)
    return {
      isLimited: true,
      remainingAttempts: 0,
      retryAfter
    }
  }
  
  // Reset if block period has expired
  if (entry?.blocked && entry.blockUntil && entry.blockUntil <= now) {
    entry.blocked = false
    entry.attempts = 0
    entry.firstAttempt = now
  }
  
  // Initialize or reset if window has passed
  if (!entry || (now.getTime() - entry.firstAttempt.getTime()) > windowMinutes * 60 * 1000) {
    entry = {
      ip,
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now,
      blocked: false
    }
    rateLimitStore.set(key, entry)
  }
  
  // Check if limit exceeded
  if (entry.attempts >= maxAttempts) {
    // Block for the remaining window time
    entry.blocked = true
    entry.blockUntil = new Date(now.getTime() + windowMinutes * 60 * 1000)
    rateLimitStore.set(key, entry)
    
    const retryAfter = windowMinutes * 60
    return {
      isLimited: true,
      remainingAttempts: 0,
      retryAfter
    }
  }
  
  const remainingAttempts = maxAttempts - entry.attempts
  
  return {
    isLimited: false,
    remainingAttempts
  }
}

/**
 * Record a failed authentication attempt
 */
export async function recordFailedAuthAttempt(request: NextRequest): Promise<void> {
  const ip = getClientIP(request)
  const key = `auth:${ip}`
  const now = new Date()
  
  let entry = rateLimitStore.get(key)
  
  if (!entry) {
    entry = {
      ip,
      attempts: 0,
      firstAttempt: now,
      lastAttempt: now,
      blocked: false
    }
  }
  
  entry.attempts++
  entry.lastAttempt = now
  rateLimitStore.set(key, entry)
  
  // Also log to database for persistent tracking
  try {
    await query(
      `INSERT INTO auth_rate_limits (ip_address, attempts, first_attempt, last_attempt)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (ip_address) 
       DO UPDATE SET attempts = auth_rate_limits.attempts + 1, last_attempt = $4`,
      [ip, entry.attempts, entry.firstAttempt, entry.lastAttempt]
    )
  } catch (error) {
    // If table doesn't exist, continue without database logging
    // This allows the rate limiter to work even without the table
    console.warn('Could not log rate limit to database:', error)
  }
}

/**
 * Reset rate limit for an IP (for successful authentication)
 */
export async function resetAuthRateLimit(request: NextRequest): Promise<void> {
  const ip = getClientIP(request)
  const key = `auth:${ip}`
  rateLimitStore.delete(key)
  
  // Also reset in database
  try {
    await query(
      'DELETE FROM auth_rate_limits WHERE ip_address = $1',
      [ip]
    )
  } catch (error) {
    // Ignore if table doesn't exist
    console.warn('Could not reset rate limit in database:', error)
  }
}

/**
 * Middleware to enforce rate limiting on authentication endpoints
 */
export function withAuthRateLimit(
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const rateLimit = await checkAuthRateLimit(request)
    
    if (rateLimit.isLimited) {
      return NextResponse.json(
        {
          success: false,
          error: 'Too many authentication attempts. Please try again later.',
          retryAfter: rateLimit.retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': rateLimit.retryAfter?.toString() || '900',
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(Date.now() + (rateLimit.retryAfter || 900) * 1000).toISOString()
          }
        }
      )
    }
    
    // Add rate limit headers to response
    const response = await handler(request)
    
    // If authentication failed, record the attempt
    if (response.status === 401 || response.status === 403) {
      await recordFailedAuthAttempt(request)
    } else if (response.status === 200) {
      // If authentication succeeded, reset rate limit
      await resetAuthRateLimit(request)
    }
    
    // Add rate limit headers
    response.headers.set('X-RateLimit-Limit', '5')
    response.headers.set('X-RateLimit-Remaining', rateLimit.remainingAttempts.toString())
    
    return response
  }
}

