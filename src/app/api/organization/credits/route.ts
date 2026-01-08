import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { getOrganizationCredits } from '@/lib/organization-service'

/**
 * GET /api/organization/credits
 * Get organization credits
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const organizationId = searchParams.get('organization_id')
    
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      )
    }
    
    const credits = await getOrganizationCredits(organizationId)
    
    if (!credits) {
      return NextResponse.json(
        { success: false, error: 'Organization credits not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      credits
    })
  } catch (error) {
    console.error('Error fetching organization credits:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organization credits'
      },
      { status: 500 }
    )
  }
}


