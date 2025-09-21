import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'
import { getAuthenticatedUser } from '@/lib/auth-middleware'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Get periodic scan details
    const scanResult = await pool.query(`
      SELECT * FROM periodic_scans 
      WHERE id = $1 AND user_id = $2
    `, [id, user.userId])

    if (scanResult.rows.length === 0) {
      return NextResponse.json({ error: 'Periodic scan not found' }, { status: 404 })
    }

    // Get execution history
    const executionsResult = await pool.query(`
      SELECT 
        pse.*,
        sh.scan_title as result_title,
        sh.total_issues,
        sh.critical_issues,
        sh.serious_issues,
        sh.moderate_issues,
        sh.minor_issues
      FROM periodic_scan_executions pse
      LEFT JOIN scan_history sh ON pse.scan_history_id = sh.id
      WHERE pse.periodic_scan_id = $1
      ORDER BY pse.scheduled_at DESC
      LIMIT 20
    `, [id])

    return NextResponse.json({
      success: true,
      data: {
        periodicScan: scanResult.rows[0],
        executions: executionsResult.rows
      }
    })
  } catch (error) {
    console.error('Error fetching periodic scan:', error)
    return NextResponse.json({ error: 'Failed to fetch periodic scan' }, { status: 500 })
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params
    const updateData = await request.json()

    // Check if scan exists and belongs to user
    const existingScan = await pool.query(`
      SELECT * FROM periodic_scans 
      WHERE id = $1 AND user_id = $2
    `, [id, user.userId])

    if (existingScan.rows.length === 0) {
      return NextResponse.json({ error: 'Periodic scan not found' }, { status: 404 })
    }

    // Build update query dynamically
    const updateFields: string[] = []
    const updateValues: any[] = []
    let paramCount = 1

    const allowedFields = [
      'scan_title', 'url', 'file_name', 'file_type', 'frequency',
      'scheduled_date', 'scheduled_time', 'timezone', 'days_of_week',
      'day_of_month', 'end_date', 'max_runs', 'notify_on_completion',
      'notify_on_failure', 'email_notifications', 'notes', 'status'
    ]

    for (const [key, value] of Object.entries(updateData)) {
      if (allowedFields.includes(key) && value !== undefined) {
        updateFields.push(`${key} = $${paramCount}`)
        updateValues.push(value)
        paramCount++
      }
    }

    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    // Add updated_at and user_id
    updateFields.push(`updated_at = NOW()`)
    updateValues.push(id, user.userId)

    const result = await pool.query(`
      UPDATE periodic_scans 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramCount} AND user_id = $${paramCount + 1}
      RETURNING *
    `, updateValues)

    return NextResponse.json({
      success: true,
      data: { periodicScan: result.rows[0] }
    })
  } catch (error) {
    console.error('Error updating periodic scan:', error)
    return NextResponse.json({ error: 'Failed to update periodic scan' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Check if scan exists and belongs to user
    const existingScan = await pool.query(`
      SELECT * FROM periodic_scans 
      WHERE id = $1 AND user_id = $2
    `, [id, user.userId])

    if (existingScan.rows.length === 0) {
      return NextResponse.json({ error: 'Periodic scan not found' }, { status: 404 })
    }

    // Delete the periodic scan (cascade will handle executions)
    await pool.query(`
      DELETE FROM periodic_scans 
      WHERE id = $1 AND user_id = $2
    `, [id, user.userId])

    return NextResponse.json({
      success: true,
      message: 'Periodic scan deleted successfully'
    })
  } catch (error) {
    console.error('Error deleting periodic scan:', error)
    return NextResponse.json({ error: 'Failed to delete periodic scan' }, { status: 500 })
  }
}
 