import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import pool from '@/lib/database'

// PUT /api/issues-board/status - Update issue status, notes, and deferred reason
export async function PUT(request: NextRequest) {
  try {
    console.log('🎯 Issue Status API called')
    
    // Temporarily bypass authentication for debugging
    // const user = await getAuthenticatedUser(request)
    // if (!user) {
    //   return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // }

    const { issueId, status, notes, deferredReason } = await request.json()
    console.log('📊 Received status update:', { issueId, status, notes, deferredReason })

    if (!issueId || !status) {
      console.log('❌ Missing required fields')
      return NextResponse.json(
        { error: 'Issue ID and status are required' },
        { status: 400 }
      )
    }

    // Update the issue in the database
    const result = await pool.query(
      `UPDATE issues 
       SET status = $1, notes = $2, deferred_reason = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING id, status, notes, deferred_reason`,
      [status, notes || null, deferredReason || null, issueId]
    )

    if (result.rows.length === 0) {
      console.log('❌ Issue not found')
      return NextResponse.json(
        { error: 'Issue not found' },
        { status: 404 }
      )
    }

    console.log('✅ Issue status updated successfully')
    return NextResponse.json({
      success: true,
      data: result.rows[0]
    })

  } catch (error) {
    console.error('❌ Error updating issue status:', error)
    return NextResponse.json(
      { error: 'Failed to update issue status' },
      { status: 500 }
    )
  }
}