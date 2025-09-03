import { NextRequest, NextResponse } from 'next/server'

// Simple in-memory credit system
// In production, this would be stored in a database with user authentication
const userCredits = new Map<string, number>()
const scanHistory = new Map<string, any[]>()

// Initialize some demo users
userCredits.set('demo-user', 10)
userCredits.set('premium-user', 999999) // Unlimited

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = searchParams.get('userId') || 'demo-user'
  
  const credits = userCredits.get(userId) || 0
  const userScans = scanHistory.get(userId) || []
  
  return NextResponse.json({
    success: true,
    userId,
    credits,
    scanHistory: userScans,
    canScan: credits > 0 || credits === 999999 // 999999 represents unlimited
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, scanType, scanId, fileName } = body
    
    if (!userId || !scanType || !scanId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const currentCredits = userCredits.get(userId) || 0
    
    // Check if user has unlimited credits
    if (currentCredits === 999999) {
      // Unlimited user, log the scan but don't deduct credits
      const userScans = scanHistory.get(userId) || []
      userScans.push({
        scanId,
        scanType,
        fileName,
        timestamp: new Date().toISOString(),
        creditsUsed: 0
      })
      scanHistory.set(userId, userScans)
      
      return NextResponse.json({
        success: true,
        canScan: true,
        credits: currentCredits,
        message: 'Unlimited scan completed'
      })
    }
    
    // Check if user has enough credits
    if (currentCredits < 1) {
      return NextResponse.json(
        { success: false, error: 'Insufficient credits', canScan: false },
        { status: 402 }
      )
    }
    
    // Deduct 1 credit for the scan
    const newCredits = currentCredits - 1
    userCredits.set(userId, newCredits)
    
    // Log the scan
    const userScans = scanHistory.get(userId) || []
    userScans.push({
      scanId,
      scanType,
      fileName,
      timestamp: new Date().toISOString(),
      creditsUsed: 1
    })
    scanHistory.set(userId, userScans)
    
    return NextResponse.json({
      success: true,
      canScan: true,
      credits: newCredits,
      message: 'Scan completed, 1 credit deducted'
    })
    
  } catch (error) {
    console.error('❌ Credit deduction error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process scan' },
      { status: 500 }
    )
  }
}

// Add credits (for purchases)
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { userId, creditsToAdd, packageName } = body
    
    if (!userId || !creditsToAdd) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    const currentCredits = userCredits.get(userId) || 0
    const newCredits = currentCredits + creditsToAdd
    userCredits.set(userId, newCredits)
    
    console.log(`💳 Credits added for user ${userId}: +${creditsToAdd} credits (${packageName})`)
    
    return NextResponse.json({
      success: true,
      credits: newCredits,
      message: `Successfully added ${creditsToAdd} credits`
    })
    
  } catch (error) {
    console.error('❌ Credit addition error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add credits' },
      { status: 500 }
    )
  }
}

