import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'

// PUT /api/sprint-board/move-issue - Move issue between columns
export async function PUT(request: NextRequest) {
  try {
    const { sprintId, issueId, columnId } = await request.json()

    if (!sprintId || !issueId || !columnId) {
      return NextResponse.json(
        { error: 'Sprint ID, Issue ID, and Column ID are required' },
        { status: 400 }
      )
    }

    // If no columnId provided, get the first column (To Do)
    let targetColumnId = columnId
    if (!targetColumnId) {
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
      targetColumnId = firstColumn.rows[0].id
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
      `, [sprintId, targetColumnId])

      const newPosition = (maxPosition.rows[0].max_pos || 0) + 1

      await pool.query(`
        INSERT INTO sprint_issues (sprint_id, issue_id, column_id, position, story_points)
        VALUES ($1, $2, $3, $4, 1)
      `, [sprintId, issueId, targetColumnId, newPosition])

    } else {
      // Move issue to new column
      const maxPosition = await pool.query(`
        SELECT COALESCE(MAX(position), 0) as max_pos
        FROM sprint_issues 
        WHERE sprint_id = $1 AND column_id = $2
      `, [sprintId, targetColumnId])

      const newPosition = (maxPosition.rows[0].max_pos || 0) + 1

      await pool.query(`
        UPDATE sprint_issues 
        SET column_id = $1, position = $2, moved_at = NOW()
        WHERE sprint_id = $3 AND issue_id = $4
      `, [targetColumnId, newPosition, sprintId, issueId])

    }

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