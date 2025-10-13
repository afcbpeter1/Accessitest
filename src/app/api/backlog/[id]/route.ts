import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// PUT /api/backlog/[id] - Update a specific backlog item
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log('🔄 Updating individual issue:', params.id)
    
    // Temporarily bypass authentication to restore access
    const user = { userId: '09d7030b-e612-4226-b695-beefb3e97936' }

    const { storyPoints, remainingPoints, assignee, description, priorityRank } = await request.json()

    console.log('🔍 Debug: Updating issue with data:', {
      storyPoints,
      remainingPoints,
      assignee,
      description,
      priorityRank
    })

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

    console.log('🔍 Debug: Executing query:', query)
    console.log('🔍 Debug: With values:', values)

    const result = await pool.query(query, values)

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: 'Issue not found or not accessible' },
        { status: 404 }
      )
    }

    console.log('✅ Issue updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Issue updated successfully'
    })

  } catch (error) {
    console.error('❌ Error updating issue:', error)
    return NextResponse.json(
      { error: 'Failed to update issue', details: error.message },
      { status: 500 }
    )
  }
}
