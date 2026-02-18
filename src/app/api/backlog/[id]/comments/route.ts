import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query } from '@/lib/database'

// GET /api/backlog/[id]/comments - Get comments for a backlog item
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await query(
      'SELECT * FROM issue_comments WHERE issue_id = $1 ORDER BY created_at DESC',
      [params.id]
    )

    return NextResponse.json({ success: true, comments: result.rows })
  } catch (error: any) {
    console.error('Error fetching comments:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch comments' },
      { status: 500 }
    )
  }
}

// POST /api/backlog/[id]/comments - Add a comment to a backlog item
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { comment } = await request.json()

    const result = await query(
      'INSERT INTO issue_comments (issue_id, user_id, comment, created_at) VALUES ($1, $2, $3, NOW()) RETURNING *',
      [params.id, user.userId, comment]
    )

    return NextResponse.json({ success: true, comment: result.rows[0] })
  } catch (error: any) {
    console.error('Error adding comment:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to add comment' },
      { status: 500 }
    )
  }
}












