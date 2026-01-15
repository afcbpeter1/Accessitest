import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { getOrganization } from '@/lib/organization-service'

/**
 * GET /api/organization/[id]
 * Get organization details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    const organization = await getOrganization(params.id, user.userId)
    
    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found or access denied' },
        { status: 404 }
      )
    }
    
    return NextResponse.json({
      success: true,
      organization
    })
  } catch (error) {
    console.error('Error fetching organization:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch organization'
      },
      { status: 500 }
    )
  }
}






