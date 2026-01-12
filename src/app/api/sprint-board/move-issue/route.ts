import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// PUT /api/sprint-board/move-issue - Move issue between columns
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { sprintId, issueId, columnId, newColumnId, toSprintId } = await request.json()

    // Handle moving to different sprint
    if (toSprintId && toSprintId !== sprintId) {

      // Verify the target sprint belongs to the user
      const targetSprintCheck = await pool.query(
        'SELECT id FROM sprints WHERE id = $1 AND user_id = $2',
        [toSprintId, user.userId]
      )

      if (targetSprintCheck.rows.length === 0) {
        return NextResponse.json(
          { error: 'Target sprint not found or access denied' },
          { status: 404 }
        )
      }

      // Get the current column of the issue in the source sprint
      const currentIssue = await pool.query(`
        SELECT si.column_id, sc.name as column_name, sc.position as column_position
        FROM sprint_issues si
        JOIN sprint_columns sc ON si.column_id = sc.id
        WHERE si.sprint_id = $1 AND si.issue_id = $2
      `, [sprintId, issueId])

      if (currentIssue.rows.length === 0) {
        return NextResponse.json(
          { error: 'Issue not found in source sprint' },
          { status: 404 }
        )
      }

      const currentColumn = currentIssue.rows[0]

      // Find equivalent column in target sprint by position
      const targetColumn = await pool.query(`
        SELECT id, name, position FROM sprint_columns 
        WHERE sprint_id = $1 
        ORDER BY position ASC
      `, [toSprintId])
      
      if (targetColumn.rows.length === 0) {
        return NextResponse.json(
          { error: 'No columns found for target sprint' },
          { status: 400 }
        )
      }

      // Find the column at the same position, or the closest one
      let finalTargetColumn = targetColumn.rows.find(col => col.position === currentColumn.column_position)
      if (!finalTargetColumn) {
        // If exact position not found, use the column at the same index
        const columnIndex = Math.min(currentColumn.column_position - 1, targetColumn.rows.length - 1)
        finalTargetColumn = targetColumn.rows[columnIndex]
      }

      // Remove from current sprint
      await pool.query(
        'DELETE FROM sprint_issues WHERE sprint_id = $1 AND issue_id = $2',
        [sprintId, issueId]
      )

      // Add to target sprint in the equivalent column
      const maxPosition = await pool.query(`
        SELECT COALESCE(MAX(position), 0) as max_pos
        FROM sprint_issues 
        WHERE sprint_id = $1 AND column_id = $2
      `, [toSprintId, finalTargetColumn.id])

      const newPosition = (maxPosition.rows[0].max_pos || 0) + 1

      await pool.query(`
        INSERT INTO sprint_issues (sprint_id, issue_id, column_id, position, story_points)
        VALUES ($1, $2, $3, $4, 1)
      `, [toSprintId, issueId, finalTargetColumn.id, newPosition])

      return NextResponse.json({
        success: true,
        message: `Issue moved to different sprint in ${finalTargetColumn.name} column`
      })
    }
    
    // Use newColumnId if provided, otherwise use columnId
    const targetColumnId = newColumnId || columnId

    if (!sprintId || !issueId || !targetColumnId) {
      return NextResponse.json(
        { error: 'Sprint ID, Issue ID, and Column ID are required' },
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

    // If no targetColumnId provided, get the first column (To Do)
    let finalColumnId = targetColumnId
    if (!finalColumnId) {
      const firstColumn = await pool.query(`
        SELECT id FROM sprint_columns 
        WHERE sprint_id = $1 
        ORDER BY position ASC 
        LIMIT 1
      `, [sprintId])
      
      if (firstColumn.rows.length === 0) {
        return NextResponse.json(
          { error: 'No columns found for this sprint' },
          { status: 400 }
        )
      }
      finalColumnId = firstColumn.rows[0].id
    }

    // Check if issue is already in the sprint
    const existingIssue = await pool.query(`
      SELECT id, column_id, position
      FROM sprint_issues 
      WHERE sprint_id = $1 AND issue_id = $2
    `, [sprintId, issueId])

    if (existingIssue.rows.length === 0) {
      // Add issue to sprint
      const maxPosition = await pool.query(`
        SELECT COALESCE(MAX(position), 0) as max_pos
        FROM sprint_issues 
        WHERE sprint_id = $1 AND column_id = $2
      `, [sprintId, finalColumnId])

      const newPosition = (maxPosition.rows[0].max_pos || 0) + 1

      await pool.query(`
        INSERT INTO sprint_issues (sprint_id, issue_id, column_id, position, story_points)
        VALUES ($1, $2, $3, $4, 1)
      `, [sprintId, issueId, finalColumnId, newPosition])

      // Update remaining_points in issues table based on column
      const isDoneColumn = await pool.query(`
        SELECT is_done_column FROM sprint_columns WHERE id = $1
      `, [finalColumnId])

      if (isDoneColumn.rows.length > 0 && isDoneColumn.rows[0].is_done_column) {
        // Set remaining points to 0 for issues added to Done column
        await pool.query(`
          UPDATE issues 
          SET remaining_points = 0, updated_at = NOW()
          WHERE id = $1
        `, [issueId])
      } else {
        // Only set remaining_points to story_points if it's currently NULL
        await pool.query(`
          UPDATE issues 
          SET remaining_points = story_points, updated_at = NOW()
          WHERE id = $1 AND remaining_points IS NULL
        `, [issueId])
      }

    } else {
      // Move issue to new column
      const maxPosition = await pool.query(`
        SELECT COALESCE(MAX(position), 0) as max_pos
        FROM sprint_issues 
        WHERE sprint_id = $1 AND column_id = $2
      `, [sprintId, finalColumnId])

      const newPosition = (maxPosition.rows[0].max_pos || 0) + 1

      await pool.query(`
        UPDATE sprint_issues 
        SET column_id = $1, position = $2, updated_at = NOW()
        WHERE sprint_id = $3 AND issue_id = $4
      `, [finalColumnId, newPosition, sprintId, issueId])

      // Update remaining_points in issues table based on column
      const isDoneColumn = await pool.query(`
        SELECT is_done_column FROM sprint_columns WHERE id = $1
      `, [finalColumnId])

      if (isDoneColumn.rows.length > 0 && isDoneColumn.rows[0].is_done_column) {
        // Set remaining points to 0 for issues moved to Done column
        await pool.query(`
          UPDATE issues 
          SET remaining_points = 0, updated_at = NOW()
          WHERE id = $1
        `, [issueId])
      }
      // Note: We don't modify remaining_points when moving to non-Done columns
      // This preserves the existing remaining_points value

    }

    // Update burndown data after moving issue
    await updateBurndownData(sprintId)

    return NextResponse.json({
      success: true,
      message: 'Issue moved successfully'
    })

  } catch (error) {
    console.error('❌ Error moving issue:', error)
    return NextResponse.json(
      { error: 'Failed to move issue' },
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
        ), 0) as remaining_points,
        COALESCE(SUM(
          CASE 
            WHEN sc.is_done_column = true THEN i.story_points 
            ELSE 0 
          END
        ), 0) as completed_points
      FROM sprint_issues si
      JOIN issues i ON si.issue_id = i.id
      JOIN sprint_columns sc ON si.column_id = sc.id
      WHERE si.sprint_id = $1
    `, [sprintId])

    const totalPoints = parseInt(issuesResult.rows[0]?.total_points || '0')
    const remainingPoints = parseInt(issuesResult.rows[0]?.remaining_points || totalPoints.toString())
    const completedPoints = parseInt(issuesResult.rows[0]?.completed_points || '0')

    // Debug logging

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
    // Don't throw error - burndown update failure shouldn't break issue movement
  }
}