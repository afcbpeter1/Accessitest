import { NextRequest, NextResponse } from 'next/server'
import { queryOne } from '@/lib/database'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id
    if (!id) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 })
    }
    if (!UUID_REGEX.test(id)) {
      return NextResponse.json({ error: 'Invalid report ID format' }, { status: 400 })
    }

    const row = await queryOne(
      `SELECT data, created_at FROM ci_scan_reports WHERE id = $1`,
      [id]
    )

    if (!row) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 })
    }

    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data
    return NextResponse.json({
      ...data,
      createdAt: row.created_at
    })
  } catch (err) {
    console.error('Report fetch error:', err)
    return NextResponse.json({ error: 'Failed to load report' }, { status: 500 })
  }
}
