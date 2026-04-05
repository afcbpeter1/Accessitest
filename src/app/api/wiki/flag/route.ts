import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'

export async function POST(request: NextRequest) {
  let user
  try {
    user = await getAuthenticatedUser(request)
  } catch {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { revisionId, reason } = body as { revisionId?: string; reason?: string }

    if (!revisionId || !reason?.trim()) {
      return NextResponse.json(
        { success: false, error: 'revisionId and reason are required' },
        { status: 400 }
      )
    }

    const check = await queryOne(`SELECT 1 AS ok FROM wiki_revisions WHERE id = $1`, [revisionId])
    if (!check) {
      return NextResponse.json({ success: false, error: 'Revision not found' }, { status: 404 })
    }

    await query(
      `INSERT INTO wiki_flags (revision_id, flagged_by, reason) VALUES ($1, $2, $3)`,
      [revisionId, user.userId, reason.trim().slice(0, 2000)]
    )

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Wiki flag error:', e)
    return NextResponse.json({ success: false, error: 'Failed to submit flag' }, { status: 500 })
  }
}
