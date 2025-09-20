import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { IssuesBoardDataService } from '@/lib/issues-board-data-service'

// PUT /api/issues-board/ranks - Update issue ranks for drag and drop
export async function PUT(request: NextRequest) {
  try {
    console.log('🎯 Ranks API called')
    
    // Temporarily bypass authentication for debugging
    // const user = await getAuthenticatedUser(request)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { rankUpdates } = await request.json()
    console.log('📊 Received rank updates:', rankUpdates)

    if (!rankUpdates || !Array.isArray(rankUpdates)) {
      console.log('❌ Invalid rank updates data')
      return NextResponse.json(
        { error: 'Invalid rank updates data' },
        { status: 400 }
      )
    }

    // Validate rank updates
    for (const update of rankUpdates) {
      if (!update.issueId || typeof update.rank !== 'number') {
        console.log('❌ Invalid rank update format:', update)
        return NextResponse.json(
          { error: 'Invalid rank update format' },
          { status: 400 }
        )
      }
    }

    // Update ranks
    console.log('🔄 Calling updateIssueRanks...')
    await IssuesBoardDataService.updateIssueRanks(rankUpdates)

    console.log('✅ Ranks updated successfully')
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