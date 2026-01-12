import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { IssuesBoardDataService } from '@/lib/issues-board-data-service'
import pool from '@/lib/database'

// PUT /api/issues-board/ranks - Update issue ranks for drag and drop
export async function PUT(request: NextRequest) {
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)

    const { rankUpdates } = await request.json()

    if (!rankUpdates || !Array.isArray(rankUpdates)) {

      return NextResponse.json(
        { error: 'Invalid rank updates data' },
        { status: 400 }
      )
    }

    // Validate rank updates
    for (const update of rankUpdates) {
      if (!update.issueId || typeof update.rank !== 'number') {

        return NextResponse.json(
          { error: 'Invalid rank update format' },
          { status: 400 }
        )
      }
    }

    // Verify all issues belong to the user before updating (prevent IDOR)
    const issueIds = rankUpdates.map(u => u.issueId)
    const verifyResult = await pool.query(
      'SELECT id FROM issues WHERE id = ANY($1::uuid[]) AND user_id = $2',
      [issueIds, user.userId]
    )
    
    if (verifyResult.rows.length !== issueIds.length) {
      console.warn('⚠️ Some issues do not belong to user or do not exist')
      return NextResponse.json(
        { error: 'Some issues not found or access denied' },
        { status: 403 }
      )
    }

    // Update ranks (with user ID to prevent IDOR)

    await IssuesBoardDataService.updateIssueRanks(rankUpdates, user.userId)

    return NextResponse.json({
      success: true,
      message: 'Issue ranks updated successfully'
    })

  } catch (error) {
    console.error('❌ Error updating issue ranks:', error)
    return NextResponse.json(
      { error: 'Failed to update issue ranks' },
      { status: 500 }
    )
  }
}