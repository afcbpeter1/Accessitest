import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const scanId = searchParams.get('scanId')
    const issueId = searchParams.get('issueId')

    if (!scanId || !issueId) {
      return NextResponse.json({ success: false, error: 'Missing scanId or issueId' }, { status: 400 })
    }

    // Check if the scan belongs to the user
    const scanCheck = await queryOne(
      `SELECT id FROM scan_history WHERE id = $1 AND user_id = $2`,
      [scanId, user.userId]
    )

    if (!scanCheck) {
      return NextResponse.json({ success: false, error: 'Scan not found or unauthorized' }, { status: 404 })
    }

    // Get issue status
    const result = await queryOne(
      `SELECT status FROM issue_status 
       WHERE scan_id = $1 AND issue_id = $2 AND user_id = $3`,
      [scanId, issueId, user.userId]
    )

    if (result) {
      return NextResponse.json({ 
        success: true, 
        status: JSON.parse(result.status) 
      })
    } else {
      return NextResponse.json({ 
        success: true, 
        status: { status: 'unread' } 
      })
    }
  } catch (error: any) {
    console.error('Failed to get issue status:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { scanId, issueId, status } = await request.json()

    if (!scanId || !issueId || !status) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
    }

    // Check if the scan belongs to the user
    const scanCheck = await queryOne(
      `SELECT id FROM scan_history WHERE id = $1 AND user_id = $2`,
      [scanId, user.userId]
    )

    if (!scanCheck) {
      return NextResponse.json({ success: false, error: 'Scan not found or unauthorized' }, { status: 404 })
    }

    // Upsert issue status
    const result = await queryOne(
      `INSERT INTO issue_status (scan_id, issue_id, user_id, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, NOW(), NOW())
       ON CONFLICT (scan_id, issue_id, user_id)
       DO UPDATE SET 
         status = $4,
         updated_at = NOW()
       RETURNING id`,
      [scanId, issueId, user.userId, JSON.stringify(status)]
    )

    return NextResponse.json({ success: true, id: result.id })
  } catch (error: any) {
    console.error('Failed to update issue status:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { scanId, issueId } = await request.json()

    if (!scanId || !issueId) {
      return NextResponse.json({ success: false, error: 'Missing scanId or issueId' }, { status: 400 })
    }

    const result = await queryOne(
      `DELETE FROM issue_status 
       WHERE scan_id = $1 AND issue_id = $2 AND user_id = $3
       RETURNING id`,
      [scanId, issueId, user.userId]
    )

    if (!result) {
      return NextResponse.json({ success: false, error: 'Issue status not found or unauthorized' }, { status: 404 })
    }

    return NextResponse.json({ success: true, id: result.id })
  } catch (error: any) {
    console.error('Failed to delete issue status:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
