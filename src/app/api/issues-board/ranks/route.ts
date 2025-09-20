import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { IssuesBoardDataService } from '@/lib/issues-board-data-service'

// PUT /api/issues-board/ranks - Update issue ranks for drag and drop
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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

    // Update ranks
    await IssuesBoardDataService.updateIssueRanks(rankUpdates)

    return NextResponse.json({
      success: true,
      message: 'Issue ranks updated successfully'
    })

  } catch (error) {
    console.error('Error updating issue ranks:', error)
    return NextResponse.json(
      { error: 'Failed to update issue ranks' },
      { status: 500 }
    )
  }
}