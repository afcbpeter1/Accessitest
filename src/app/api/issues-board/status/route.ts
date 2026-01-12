import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// PUT /api/issues-board/status - Update issue status, notes, and deferred reason
export async function PUT(request: NextRequest) {
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)

    const { issueId, status, notes, deferredReason } = await request.json()

    if (!issueId || !status) {

      return NextResponse.json(
        { error: 'Issue ID and status are required' },
        { status: 400 }
      )
    }

    // Update the issue in the database - only if it belongs to the user (prevent IDOR)
    const result = await pool.query(
      `UPDATE issues 
       SET status = $1, notes = $2, deferred_reason = $3, updated_at = NOW()
       WHERE id = $4 AND user_id = $5
       RETURNING id, status, notes, deferred_reason`,
      [status, notes || null, deferredReason || null, issueId, user.userId]
    )

    if (result.rows.length === 0) {

      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('❌ Error updating issue status:', error)
    return NextResponse.json(
      { error: 'Failed to update issue status' },
      { status: 500 }
    )
  }
}