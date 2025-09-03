import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

// Simple in-memory user database
// In production, this would be replaced with a real database like PostgreSQL, MongoDB, etc.
interface User {
  id: string
  email: string
  password: string
  name: string
  company?: string
  role: 'user' | 'admin'
  plan: 'free' | 'web-only' | 'document-only' | 'complete'
  credits: number
  createdAt: string
  lastLogin: string
}

const users = new Map<string, User>()

// Initialize some demo users
const demoUsers: User[] = [
  {
    id: '1',
    email: 'demo@accessitest.com',
    password: '$2a$10$demo.hash.for.demo.user.123456789012345678901234567890123456789012345678901234567890',
    name: 'Demo User',
    company: 'Demo Company',
    role: 'user',
    plan: 'complete',
    credits: 999999, // Unlimited
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  },
  {
    id: '2',
    email: 'admin@accessitest.com',
    password: '$2a$10$admin.hash.for.admin.user.123456789012345678901234567890123456789012345678901234567890',
    name: 'Admin User',
    company: 'AccessiTest',
    role: 'admin',
    plan: 'complete',
    credits: 999999, // Unlimited
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  }
]

// Add demo users to the map
demoUsers.forEach(user => {
  users.set(user.email, user)
})

// JWT secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, email, password, name, company } = body

    if (action === 'login') {
      return await handleLogin(email, password)
    } else if (action === 'register') {
      return await handleRegister(email, password, name, company)
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

  const user = users.get(email)
  if (!user) {
    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    )
  }

  // For demo users, allow login with any password
  // In production, verify with bcrypt.compare(password, user.password)
  const isValidPassword = user.email.includes('demo') || user.email.includes('admin') 
    ? true 
    : await bcrypt.compare(password, user.password)

  if (!isValidPassword) {
    return NextResponse.json(
      { success: false, error: 'Invalid email or password' },
      { status: 401 }
    )
  }

  // Update last login
  user.lastLogin = new Date().toISOString()
  users.set(email, user)

  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: user.id, 
      email: user.email, 
      role: user.role,
      plan: user.plan 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  return NextResponse.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      company: user.company,
      role: user.role,
      plan: user.plan,
      credits: user.credits
    },
    token
  })
}

async function handleRegister(email: string, password: string, name: string, company?: string) {
  if (!email || !password || !name) {
    return NextResponse.json(
      { success: false, error: 'Email, password, and name are required' },
      { status: 400 }
    )
  }

  if (users.has(email)) {
    return NextResponse.json(
      { success: false, error: 'User already exists' },
      { status: 409 }
    )
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 12)

  // Create new user
  const newUser: User = {
    id: Date.now().toString(),
    email,
    password: hashedPassword,
    name,
    company,
    role: 'user',
    plan: 'free',
    credits: 5, // Start with 5 free credits
    createdAt: new Date().toISOString(),
    lastLogin: new Date().toISOString()
  }

  users.set(email, newUser)

  // Generate JWT token
  const token = jwt.sign(
    { 
      userId: newUser.id, 
      email: newUser.email, 
      role: newUser.role,
      plan: newUser.plan 
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  )

  return NextResponse.json({
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      company: newUser.company,
      role: newUser.role,
      plan: newUser.plan,
      credits: newUser.credits
    },
    token
  })
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
export function getUserByEmail(email: string) {
  return users.get(email)
}

// Update user plan
export function updateUserPlan(email: string, plan: string) {
  const user = users.get(email)
  if (user) {
    user.plan = plan as any
    if (plan === 'complete') {
      user.credits = 999999 // Unlimited
    }
    users.set(email, user)
    return true
  }
  return false
}

