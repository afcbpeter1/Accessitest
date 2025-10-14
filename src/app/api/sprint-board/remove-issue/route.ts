import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// DELETE /api/sprint-board/remove-issue - Remove issue from sprint
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const sprintId = searchParams.get('sprintId')
    const issueId = searchParams.get('issueId')

    if (!sprintId || !issueId) {
      return NextResponse.json(
        { error: 'Sprint ID and Issue ID are required' },
        { status: 400 }
      )
    }

    // Verify the sprint belongs to the user
    const sprintCheck = await pool.query(
      'SELECT id FROM sprints WHERE id = $1 AND user_id = $2',
      [sprintId, user.userId]
    )

    if (sprintCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Sprint not found or access denied' },
        { status: 404 }
      )
    }

    // Remove the issue from the sprint
    const result = await pool.query(
      'DELETE FROM sprint_issues WHERE sprint_id = $1 AND issue_id = $2',
      [sprintId, issueId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Issue not found in sprint' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Issue removed from sprint successfully'
    })

  } catch (error) {
    console.error('❌ Error removing issue from sprint:', error)
    return NextResponse.json(
      { error: 'Failed to remove issue from sprint' },
      { status: 500 }
    )
  }
}
