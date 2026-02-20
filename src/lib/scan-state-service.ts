import { queryOne, query } from './database'

export interface ScanProgress {
  type: string
  message: string
  currentPage: number
  totalPages: number
  currentUrl?: string
  status: string
  results?: any
}

export interface ActiveScan {
  id: string
  scanId: string
  userId: string
  scanType: 'web' | 'document'
  url?: string
  fileName?: string
  status: 'running' | 'completed' | 'failed' | 'cancelled'
  progress: ScanProgress | null
  totalPages: number
  currentPage: number
  startedAt: Date
  completedAt?: Date
}

/** Parse progress from DB: pg returns JSONB as object in some setups, or as string */
function parseProgress(progress: unknown): ScanProgress | null {
  if (progress == null) return null
  if (typeof progress === 'object') return progress as ScanProgress
  if (typeof progress === 'string') {
    try {
      return JSON.parse(progress) as ScanProgress
    } catch {
      return null
    }
  }
  return null
}

export class ScanStateService {
  // Register a new scan
  static async registerScan(
    scanId: string,
    userId: string,
    scanType: 'web' | 'document',
    url?: string,
    fileName?: string,
    totalPages: number = 0
  ): Promise<void> {
    await query(
      `INSERT INTO active_scans (scan_id, user_id, scan_type, url, file_name, total_pages, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'running')
       ON CONFLICT (scan_id) DO UPDATE SET
         status = 'running',
         total_pages = $6,
         updated_at = NOW()`,
      [scanId, userId, scanType, url, fileName, totalPages]
    )
  }

  // Update scan progress
  static async updateProgress(
    scanId: string,
    progress: ScanProgress
  ): Promise<void> {
    await query(
      `UPDATE active_scans 
       SET progress = $1, current_page = $2, updated_at = NOW()
       WHERE scan_id = $3`,
      [JSON.stringify(progress), progress.currentPage, scanId]
    )
  }

  // Mark scan as completed
  static async markCompleted(
    scanId: string,
    results?: any
  ): Promise<void> {
    const finalProgress = results ? {
      type: 'complete',
      message: 'Scan completed successfully',
      status: 'complete',
      results
    } : null

    await query(
      `UPDATE active_scans 
       SET status = 'completed', 
           progress = $1,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE scan_id = $2`,
      [finalProgress ? JSON.stringify(finalProgress) : null, scanId]
    )
  }

  // Mark scan as failed
  static async markFailed(
    scanId: string,
    error: string
  ): Promise<void> {
    const errorProgress = {
      type: 'error',
      message: `Scan failed: ${error}`,
      status: 'error'
    }

    await query(
      `UPDATE active_scans 
       SET status = 'failed', 
           progress = $1,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE scan_id = $2`,
      [JSON.stringify(errorProgress), scanId]
    )
  }

  // Mark scan as cancelled
  static async markCancelled(scanId: string): Promise<void> {
    const cancelledProgress = {
      type: 'cancelled',
      message: 'Scan was cancelled',
      status: 'cancelled'
    }

    await query(
      `UPDATE active_scans 
       SET status = 'cancelled', 
           progress = $1,
           completed_at = NOW(),
           updated_at = NOW()
       WHERE scan_id = $2`,
      [JSON.stringify(cancelledProgress), scanId]
    )
  }

  // Get active scans for a user
  static async getActiveScans(userId: string): Promise<ActiveScan[]> {
    const result = await query(
      `SELECT * FROM active_scans 
       WHERE user_id = $1 AND status = 'running'
       ORDER BY started_at DESC`,
      [userId]
    )

    return result.rows.map(row => ({
      id: row.id,
      scanId: row.scan_id,
      userId: row.user_id,
      scanType: row.scan_type,
      url: row.url,
      fileName: row.file_name,
      status: row.status,
      progress: parseProgress(row.progress),
      totalPages: row.total_pages,
      currentPage: row.current_page,
      startedAt: row.started_at,
      completedAt: row.completed_at
    }))
  }

  // Get a specific scan by scanId
  static async getScan(scanId: string): Promise<ActiveScan | null> {
    const result = await queryOne(
      `SELECT * FROM active_scans WHERE scan_id = $1`,
      [scanId]
    )

    if (!result) return null

    return {
      id: result.id,
      scanId: result.scan_id,
      userId: result.user_id,
      scanType: result.scan_type,
      url: result.url,
      fileName: result.file_name,
      status: result.status,
      progress: parseProgress(result.progress),
      totalPages: result.total_pages,
      currentPage: result.current_page,
      startedAt: result.started_at,
      completedAt: result.completed_at
    }
  }

  // Clean up old scans
  static async cleanupOldScans(): Promise<void> {
    await query(
      `DELETE FROM active_scans 
       WHERE status IN ('completed', 'failed', 'cancelled') 
       AND completed_at < NOW() - INTERVAL '24 hours'`
    )
  }
}
