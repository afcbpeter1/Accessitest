import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    
    const periodicScans = await query(
      `SELECT 
        id, scan_type, scan_title, url, file_name, file_type,
        scan_settings, frequency, next_run_at, last_run_at, last_scan_id,
        is_active, created_at, updated_at
      FROM periodic_scans 
      WHERE user_id = $1 
      ORDER BY created_at DESC`,
      [user.userId]
    )

    return NextResponse.json({
      success: true,
      scans: periodicScans.rows
    })
  } catch (error) {
    console.error('Error fetching periodic scans:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch periodic scans' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()
    
    const {
      scanType,
      scanTitle,
      url,
      fileName,
      fileType,
      scanSettings,
      frequency
    } = body

    // Validate required fields
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
