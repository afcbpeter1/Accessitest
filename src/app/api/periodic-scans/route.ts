import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/database'
import { getAuthenticatedUser } from '@/lib/auth-middleware'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = `
      SELECT 
        ps.*,
        COUNT(pse.id) as execution_count,
        MAX(pse.completed_at) as last_completed_at
      FROM periodic_scans ps
      LEFT JOIN periodic_scan_executions pse ON ps.id = pse.periodic_scan_id
      WHERE ps.user_id = $1
    `
    
    const params: any[] = [user.userId]
    
    if (status) {
      query += ' AND ps.status = $2'
      params.push(status)
    }
    
    query += `
      GROUP BY ps.id
      ORDER BY ps.created_at DESC
      LIMIT $${params.length + 1}
    `
    params.push(limit)

    const result = await pool.query(query, params)

    return NextResponse.json({ 
      success: true, 
      data: { 
        periodicScans: result.rows,
        total: result.rows.length
      } 
    })
  } catch (error) {
    console.error('Error fetching periodic scans:', error)
    return NextResponse.json({ error: 'Failed to fetch periodic scans' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const {
      scanType,
      scanTitle,
      url,
      fileName,
      fileType,
      frequency,
      scheduledDate,
      scheduledTime,
      timezone,
      daysOfWeek,
      dayOfMonth,
      endDate,
      maxRuns,
      notifyOnCompletion,
      notifyOnFailure,
      emailNotifications,
      notes
    } = await request.json()

    // Validate required fields
    if (!scanTitle || !frequency || !scheduledDate || !scheduledTime) {
      return NextResponse.json({ 
        error: 'Missing required fields' 
      }, { status: 400 })
    }

    if (scanType === 'web' && !url) {
      return NextResponse.json({ 
        error: 'URL is required for web scans' 
      }, { status: 400 })
    }

    if (scanType === 'document' && !fileName) {
      return NextResponse.json({ 
        error: 'File name is required for document scans' 
      }, { status: 400 })
    }

    // Calculate next run time
    const scheduledDateTime = new Date(`${scheduledDate}T${scheduledTime}`)
    const nextRunAt = calculateNextRunTime({
      frequency,
      scheduledDateTime,
      daysOfWeek: daysOfWeek || [],
      dayOfMonth: dayOfMonth || 1,
      timezone: timezone || 'UTC'
    })

    const result = await pool.query(`
      INSERT INTO periodic_scans (
        user_id, scan_type, scan_title, url, file_name, file_type,
        frequency, scheduled_date, scheduled_time, timezone,
        days_of_week, day_of_month, end_date, max_runs,
        notify_on_completion, notify_on_failure, email_notifications,
        notes, next_run_at, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      user.userId,
      scanType,
      scanTitle,
      url || null,
      fileName || null,
      fileType || null,
      frequency,
      scheduledDate,
      scheduledTime,
      timezone || 'UTC',
      daysOfWeek || null,
      dayOfMonth || null,
      endDate || null,
      maxRuns || null,
      notifyOnCompletion !== false,
      notifyOnFailure !== false,
      emailNotifications !== false,
      notes || null,
      nextRunAt,
      'scheduled'
    ])

    return NextResponse.json({ 
      success: true, 
      data: { periodicScan: result.rows[0] } 
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating periodic scan:', error)
    return NextResponse.json({ error: 'Failed to create periodic scan' }, { status: 500 })
  }
}

function calculateNextRunTime({
  frequency,
  scheduledDateTime,
  daysOfWeek,
  dayOfMonth,
  timezone
}: {
  frequency: string
  scheduledDateTime: Date
  daysOfWeek: number[]
  dayOfMonth: number
  timezone: string
}): Date {
  const now = new Date()
  
  if (frequency === 'once') {
    return scheduledDateTime
  }
  
  if (frequency === 'daily') {
    // Next occurrence at the same time
    const next = new Date(scheduledDateTime)
    while (next <= now) {
      next.setDate(next.getDate() + 1)
    }
    return next
  }
  
  if (frequency === 'weekly' && daysOfWeek.length > 0) {
    // Find next occurrence on one of the specified days
    const next = new Date(scheduledDateTime)
    const targetDay = daysOfWeek[0] // Use first selected day for simplicity
    
    // Find next occurrence of this day
    while (next <= now || next.getDay() !== targetDay) {
      next.setDate(next.getDate() + 1)
    }
    return next
  }
  
  if (frequency === 'monthly') {
    // Next occurrence on the same day of next month
    const next = new Date(scheduledDateTime)
    next.setMonth(next.getMonth() + 1)
    while (next <= now) {
      next.setMonth(next.getMonth() + 1)
    }
    return next
  }
  
  // Default to scheduled time if in the future, otherwise tomorrow
  return scheduledDateTime > now ? scheduledDateTime : new Date(now.getTime() + 24 * 60 * 60 * 1000)
}
    if (!scanType || !scanTitle || !scanSettings || !frequency) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Calculate next run time based on frequency
    const now = new Date()
    let nextRunAt: Date

    switch (frequency) {
      case 'daily':
        nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000) // 24 hours from now
        break
      case 'weekly':
        nextRunAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
        break
      case 'monthly':
        nextRunAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate()) // Next month
        break
      default:
        return NextResponse.json(
          { success: false, error: 'Invalid frequency' },
          { status: 400 }
        )
    }

    const result = await queryOne(
      `INSERT INTO periodic_scans (
        user_id, scan_type, scan_title, url, file_name, file_type,
        scan_settings, frequency, next_run_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        user.userId,
        scanType,
        scanTitle,
        url || null,
        fileName || null,
        fileType || null,
        JSON.stringify(scanSettings),
        frequency,
        nextRunAt.toISOString()
      ]
    )

    return NextResponse.json({
      success: true,
      scanId: result.id
    })
  } catch (error) {
    console.error('Error creating periodic scan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create periodic scan' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    
    const { scanId, isActive, frequency } = body

    if (!scanId) {
      return NextResponse.json(
        { success: false, error: 'Scan ID is required' },
        { status: 400 }
      )
    }

    let updateQuery = 'UPDATE periodic_scans SET updated_at = NOW()'
    const updateParams: any[] = []
    let paramIndex = 1

    if (typeof isActive === 'boolean') {
      updateQuery += `, is_active = $${paramIndex}`
      updateParams.push(isActive)
      paramIndex++
    }

    if (frequency) {
      // Recalculate next run time if frequency changes
      const now = new Date()
      let nextRunAt: Date

      switch (frequency) {
        case 'daily':
          nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          break
        case 'weekly':
          nextRunAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          break
        case 'monthly':
          nextRunAt = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate())
          break
        default:
          return NextResponse.json(
            { success: false, error: 'Invalid frequency' },
            { status: 400 }
          )
      }

      updateQuery += `, frequency = $${paramIndex}, next_run_at = $${paramIndex + 1}`
      updateParams.push(frequency, nextRunAt.toISOString())
      paramIndex += 2
    }

    updateQuery += ` WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}`
    updateParams.push(scanId, user.userId)

    await query(updateQuery, updateParams)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating periodic scan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update periodic scan' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    
    const { scanId } = body

    if (!scanId) {
      return NextResponse.json(
        { success: false, error: 'Scan ID is required' },
        { status: 400 }
      )
    }

    await query(
      'DELETE FROM periodic_scans WHERE id = $1 AND user_id = $2',
      [scanId, user.userId]
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting periodic scan:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete periodic scan' },
      { status: 500 }
    )
  }
}
