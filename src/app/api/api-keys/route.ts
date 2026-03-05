import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { getUserOrganizations } from '@/lib/organization-service'
import { queryOne } from '@/lib/database'
import { createApiKey, listApiKeys } from '@/lib/api-key-service'

function getPrimaryOrganizationId(userId: string): Promise<string | null> {
  return queryOne(
    `SELECT om.organization_id
     FROM organization_members om
     INNER JOIN organizations o ON o.id = om.organization_id
     WHERE om.user_id = $1 AND om.is_active = true
     ORDER BY CASE WHEN om.role = 'owner' THEN 1 ELSE 2 END, om.joined_at ASC
     LIMIT 1`,
    [userId]
  ).then((row: any) => row?.organization_id ?? null)
}

async function ensureOrgHasApiAccess(organizationId: string): Promise<boolean> {
  const credits = await queryOne(
    `SELECT unlimited_credits FROM organization_credits WHERE organization_id = $1`,
    [organizationId]
  )
  return !!credits?.unlimited_credits
}

/**
 * GET /api/api-keys - List API keys for the current user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const organizationId = await getPrimaryOrganizationId(user.userId)
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'No organization found' },
        { status: 400 }
      )
    }
    const hasAccess = await ensureOrgHasApiAccess(organizationId)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'API access requires an active subscription' },
        { status: 403 }
      )
    }
    const keys = await listApiKeys(organizationId)
    return NextResponse.json({ success: true, apiKeys: keys })
  } catch (error) {
    if ((error as Error).message?.includes('Authentication')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    console.error('List API keys error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message ?? 'Failed to list API keys' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/api-keys - Create a new API key (returned once; store securely)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const organizationId = await getPrimaryOrganizationId(user.userId)
    if (!organizationId) {
      return NextResponse.json(
        { success: false, error: 'No organization found' },
        { status: 400 }
      )
    }
    const hasAccess = await ensureOrgHasApiAccess(organizationId)
    if (!hasAccess) {
      return NextResponse.json(
        { success: false, error: 'API access requires an active subscription' },
        { status: 403 }
      )
    }
    const body = await request.json().catch(() => ({}))
    const name = typeof body.name === 'string' ? body.name.trim() || null : null
    const created = await createApiKey(organizationId, name)
    return NextResponse.json({
      success: true,
      apiKey: created.key,
      id: created.id,
      key_prefix: created.key_prefix,
      name: created.name,
      created_at: created.created_at,
      message: 'Copy and store your API key securely. It will not be shown again.'
    })
  } catch (error) {
    if ((error as Error).message?.includes('Authentication')) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 })
    }
    console.error('Create API key error:', error)
    return NextResponse.json(
      { success: false, error: (error as Error).message ?? 'Failed to create API key' },
      { status: 500 }
    )
  }
}
