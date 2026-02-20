import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { getPageTrackingInfo } from '@/lib/page-tracking-service'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    const pageInfo = await getPageTrackingInfo(user.userId)
    
    return NextResponse.json({
      success: true,
      ...pageInfo
    })
  } catch (error) {
    console.error('❌ Error fetching page tracking info:', error)
    if (error instanceof Error && error.message.includes('Authentication')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      )
    }
    return NextResponse.json(
      { success: false, error: 'Failed to fetch page tracking information' },
      { status: 500 }
    )
  }
}

