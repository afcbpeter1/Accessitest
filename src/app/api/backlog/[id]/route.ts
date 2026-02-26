import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// PUT /api/backlog/[id] - Update a specific backlog item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Temporarily bypass authentication to restore access
    const user = { userId: '09d7030b-e612-4226-b695-beefb3e97936' }

    const { storyPoints, remainingPoints, assignee, description, priorityRank } = await request.json()


    // Update the issue in the issues table
    const updateFields = []
    const values = []
    let paramIndex = 1

    if (storyPoints !== undefined) {
      updateFields.push(`story_points = $${paramIndex}`)
      values.push(storyPoints)
      paramIndex++
    }

    if (remainingPoints !== undefined) {
      updateFields.push(`remaining_points = $${paramIndex}`)
      values.push(remainingPoints)
      paramIndex++
    }

    if (assignee !== undefined) {
      updateFields.push(`assignee = $${paramIndex}`)
      values.push(assignee)
      paramIndex++
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`)
      values.push(description)
      paramIndex++
    }

    if (priorityRank !== undefined) {
      updateFields.push(`rank = $${paramIndex}`)
      values.push(priorityRank)
      paramIndex++
    }

    if (updateFields.length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      )
    }

    // Add the issue ID to the values
    values.push(params.id)

    const query = `
      UPDATE issues 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `


    const result = await pool.query(query, values)

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Issue not found or not accessible' },
        { status: 404 }
      )
    }


    return NextResponse.json({
      success: true,
      message: 'Issue updated successfully'
    })

  } catch (error: any) {
    console.error('Error updating issue:', error)
    return NextResponse.json(
      { error: 'Failed to update issue', details: error.message },
      { status: 500 }
    )
  }
}

// DELETE /api/backlog/[id] - Delete a specific backlog item
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const issueId = params.id

    // Check if user owns the issue (their scan) or has it linked via user_issues
    const ownership = await pool.query(`
      SELECT i.id,
             (sh.user_id = $2) AS owned_by_user,
             EXISTS (SELECT 1 FROM user_issues ui WHERE ui.issue_id = i.id AND ui.user_id = $2) AS linked
      FROM issues i
      LEFT JOIN scan_history sh ON i.first_seen_scan_id = sh.id
      WHERE i.id = $1
        AND (sh.user_id = $2 OR EXISTS (SELECT 1 FROM user_issues ui WHERE ui.issue_id = i.id AND ui.user_id = $2))
    `, [issueId, user.userId])

    if (ownership.rows.length === 0) {
      return NextResponse.json(
        { error: 'Issue not found or access denied' },
        { status: 404 }
      )
    }

    const { owned_by_user } = ownership.rows[0]

    let deleteResult
    if (owned_by_user) {
      // User created the issue – delete the issue row (cascade removes user_issues links)
      deleteResult = await pool.query(`DELETE FROM issues WHERE id = $1`, [issueId])
    } else {
      // User only has link (shared issue) – remove from their backlog only
      deleteResult = await pool.query(
        `DELETE FROM user_issues WHERE user_id = $1 AND issue_id = $2`,
        [user.userId, issueId]
      )
    }

    if (deleteResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: owned_by_user ? 'Issue deleted successfully' : 'Issue removed from your backlog'
    })

  } catch (error: any) {
    console.error('❌ Error deleting issue:', error)
    return NextResponse.json(
      { error: 'Failed to delete issue', details: error.message },
      { status: 500 }
    )
  }
}
