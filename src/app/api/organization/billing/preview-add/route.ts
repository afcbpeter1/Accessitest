import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { previewAddSeats } from '@/lib/organization-billing'
import { checkPermission } from '@/lib/role-service'

/**
 * POST /api/organization/billing/preview-add
 * Preview prorated amount when adding seats (no subscription change).
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    const { organizationId, numberOfUsers } = body

    if (!organizationId || numberOfUsers == null || numberOfUsers < 1) {
      return NextResponse.json(
        { success: false, error: 'Organization ID and number of users (≥1) are required' },
        { status: 400 }
      )
    }

    const hasPermission = await checkPermission(user.userId, organizationId, 'canManageBilling')
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, error: 'You do not have permission to manage billing' },
        { status: 403 }
      )
    }

    const preview = await previewAddSeats(organizationId, numberOfUsers)
    return NextResponse.json({ success: true, ...preview })
  } catch (error) {
    console.error('Error previewing add seats:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to preview'
    const statusCode = errorMessage.includes('subscription') ? 400 : 500
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: statusCode }
    )
  }
}
