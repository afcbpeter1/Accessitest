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

    // Update burndown data after removing issue
    await updateBurndownData(sprintId)

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

// Helper function to update burndown data for a sprint
async function updateBurndownData(sprintId: string) {
  try {
    // Get current sprint issues with their column status
    const issuesResult = await pool.query(`
      SELECT 
        COALESCE(SUM(i.story_points), 0) as total_points,
        COALESCE(SUM(
          CASE 
            WHEN sc.is_done_column = true THEN 0 
            ELSE COALESCE(i.remaining_points, i.story_points) 
          END
        ), 0) as remaining_points
      FROM sprint_issues si
      JOIN issues i ON si.issue_id = i.id
      JOIN sprint_columns sc ON si.column_id = sc.id
      WHERE si.sprint_id = $1
    `, [sprintId])

    const totalPoints = parseInt(issuesResult.rows[0]?.total_points || '0')
    const remainingPoints = parseInt(issuesResult.rows[0]?.remaining_points || totalPoints.toString())
    const completedPoints = totalPoints - remainingPoints

    // Insert or update burndown data for today
    const today = new Date().toISOString().split('T')[0]
    
    await pool.query(`
      INSERT INTO sprint_burndown_data (sprint_id, date, total_story_points, remaining_story_points, completed_story_points)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (sprint_id, date) DO UPDATE SET
        remaining_story_points = EXCLUDED.remaining_story_points,
        completed_story_points = EXCLUDED.completed_story_points,
        updated_at = CURRENT_TIMESTAMP
    `, [sprintId, today, totalPoints, remainingPoints, completedPoints])

  } catch (error) {
    console.error('❌ Error updating burndown data:', error)
    // Don't throw error - burndown update failure shouldn't break issue removal
  }
}
