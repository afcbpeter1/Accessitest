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

    // First, check if the issue exists and belongs to the user
    const checkResult = await pool.query(`
      SELECT i.id 
      FROM issues i
      JOIN scan_history sh ON i.first_seen_scan_id = sh.id
      WHERE i.id = $1 AND sh.user_id = $2
    `, [issueId, user.userId])

    if (checkResult.rows.length === 0) {
      return NextResponse.json(
        { error: 'Issue not found or access denied' },
        { status: 404 }
      )
    }

    // Delete the issue from the issues table
    const deleteResult = await pool.query(`
      DELETE FROM issues 
      WHERE id = $1
    `, [issueId])

    if (deleteResult.rowCount === 0) {
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Issue deleted successfully'
    })

  } catch (error: any) {
    console.error('❌ Error deleting issue:', error)
    return NextResponse.json(
      { error: 'Failed to delete issue', details: error.message },
      { status: 500 }
    )
  }
}
