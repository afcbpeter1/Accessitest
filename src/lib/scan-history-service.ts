import { query, queryOne } from './database'

export interface ScanHistoryItem {
  id: string
  scanType: 'web' | 'document'
  scanTitle: string
  url?: string
  fileName?: string
  fileType?: string
  totalIssues: number
  criticalIssues: number
  seriousIssues: number
  moderateIssues: number
  minorIssues: number
  pagesScanned?: number
  pagesAnalyzed?: number
  overallScore?: number
  is508Compliant?: boolean
  scanDurationSeconds?: number
  createdAt: string
  updatedAt: string
}

export interface ScanHistoryDetails extends ScanHistoryItem {
  scanResults: any
  complianceSummary: any
  remediationReport: any
  scanSettings?: any // Add scan settings for rerun functionality
}

export class ScanHistoryService {
  /**
   * Store a completed scan result in the database
   */
  static async storeScanResult(
    userId: string,
    scanType: 'web' | 'document',
    scanData: {
      scanTitle: string
      url?: string
      fileName?: string
      fileType?: string
      scanResults: any
      complianceSummary: any
      remediationReport: any
      totalIssues: number
      criticalIssues: number
      seriousIssues: number
      moderateIssues: number
      minorIssues: number
      pagesScanned?: number
      pagesAnalyzed?: number
      overallScore?: number
      is508Compliant?: boolean
      scanDurationSeconds?: number
      scanSettings?: any // Add scan settings for rerun functionality
    }
  ): Promise<string> {
    const result = await queryOne(
      `INSERT INTO scan_history (
        user_id, scan_type, scan_title, url, file_name, file_type,
        scan_results, compliance_summary, remediation_report,
        total_issues, critical_issues, serious_issues, moderate_issues, minor_issues,
        pages_scanned, pages_analyzed, overall_score, is_508_compliant, scan_duration_seconds, scan_settings
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING id`,
      [
        userId,
        scanType,
        scanData.scanTitle,
        scanData.url || null,
        scanData.fileName || null,
        scanData.fileType || null,
        JSON.stringify(scanData.scanResults),
        JSON.stringify(scanData.complianceSummary),
        JSON.stringify(scanData.remediationReport),
        scanData.totalIssues,
        scanData.criticalIssues,
        scanData.seriousIssues,
        scanData.moderateIssues,
        scanData.minorIssues,
        scanData.pagesScanned || null,
        scanData.pagesAnalyzed || null,
        scanData.overallScore || null,
        scanData.is508Compliant || null,
        scanData.scanDurationSeconds || null,
        scanData.scanSettings ? JSON.stringify(scanData.scanSettings) : null
      ]
    )

    return result.id
  }

  /**
   * Get scan history for a user (summary only)
   */
  static async getScanHistory(userId: string, limit: number = 50): Promise<ScanHistoryItem[]> {
    console.log('🔍 ScanHistoryService.getScanHistory called for user:', userId)
    
    try {
      const results = await query(
        `SELECT 
          id, scan_type, scan_title, url, file_name, file_type,
          total_issues, critical_issues, serious_issues, moderate_issues, minor_issues,
          pages_scanned, pages_analyzed, overall_score, is_508_compliant, scan_duration_seconds,
          created_at, updated_at
        FROM scan_history 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2`,
        [userId, limit]
      )
      
      console.log('✅ Query successful, found', results.rows.length, 'rows')
      return results.rows.map(row => ({
        id: row.id,
        scanType: row.scan_type,
        scanTitle: row.scan_title,
        url: row.url,
        fileName: row.file_name,
        fileType: row.file_type,
        totalIssues: row.total_issues,
        criticalIssues: row.critical_issues,
        seriousIssues: row.serious_issues,
        moderateIssues: row.moderate_issues,
        minorIssues: row.minor_issues,
        pagesScanned: row.pages_scanned,
        pagesAnalyzed: row.pages_analyzed,
        overallScore: row.overall_score,
        is508Compliant: row.is_508_compliant,
        scanDurationSeconds: row.scan_duration_seconds,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    } catch (error) {
      console.error('❌ Error in getScanHistory:', error)
      throw error
    }
  }

  /**
   * Get scan history for a user with pagination
   */
  static async getScanHistoryPaginated(userId: string, limit: number = 10, offset: number = 0): Promise<{ scans: ScanHistoryItem[], total: number }> {
    console.log('🔍 ScanHistoryService.getScanHistoryPaginated called for user:', userId, 'limit:', limit, 'offset:', offset)
    
    try {
      // Get total count
      const countResult = await queryOne(
        `SELECT COUNT(*) as total FROM scan_history WHERE user_id = $1`,
        [userId]
      )
      const total = parseInt(countResult.total || '0')

      // Get paginated results
      const results = await query(
        `SELECT 
          id, scan_type, scan_title, url, file_name, file_type,
          total_issues, critical_issues, serious_issues, moderate_issues, minor_issues,
          pages_scanned, pages_analyzed, overall_score, is_508_compliant, scan_duration_seconds,
          created_at, updated_at
        FROM scan_history 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3`,
        [userId, limit, offset]
      )
      
      console.log('✅ Query successful, found', results.rows.length, 'rows out of', total, 'total')
      const scans = results.rows.map(row => ({
        id: row.id,
        scanType: row.scan_type,
        scanTitle: row.scan_title,
        url: row.url,
        fileName: row.file_name,
        fileType: row.file_type,
        totalIssues: row.total_issues,
        criticalIssues: row.critical_issues,
        seriousIssues: row.serious_issues,
        moderateIssues: row.moderate_issues,
        minorIssues: row.minor_issues,
        pagesScanned: row.pages_scanned,
        pagesAnalyzed: row.pages_analyzed,
        overallScore: row.overall_score,
        is508Compliant: row.is_508_compliant,
        scanDurationSeconds: row.scan_duration_seconds,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))

      return { scans, total }
    } catch (error) {
      console.error('❌ Error in getScanHistoryPaginated:', error)
      throw error
    }
  }

  /**
   * Get detailed scan result by ID
   */
  static async getScanDetails(scanId: string, userId: string): Promise<ScanHistoryDetails | null> {
    const result = await queryOne(
      `SELECT * FROM scan_history 
       WHERE id = $1 AND user_id = $2`,
      [scanId, userId]
    )

    if (!result) {
      return null
    }

    return {
      id: result.id,
      scanType: result.scan_type,
      scanTitle: result.scan_title,
      url: result.url,
      fileName: result.file_name,
      fileType: result.file_type,
      totalIssues: result.total_issues,
      criticalIssues: result.critical_issues,
      seriousIssues: result.serious_issues,
      moderateIssues: result.moderate_issues,
      minorIssues: result.minor_issues,
      pagesScanned: result.pages_scanned,
      pagesAnalyzed: result.pages_analyzed,
      overallScore: result.overall_score,
      is508Compliant: result.is_508_compliant,
      scanDurationSeconds: result.scan_duration_seconds,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
      scanResults: result.scan_results,
      complianceSummary: result.compliance_summary,
      remediationReport: result.remediation_report,
      scanSettings: result.scan_settings
    }
  }

  /**
   * Delete a scan result
   */
  static async deleteScan(scanId: string, userId: string): Promise<boolean> {
    const result = await query(
      `DELETE FROM scan_history 
       WHERE id = $1 AND user_id = $2`,
      [scanId, userId]
    )

    return result.length > 0
  }

  /**
   * Get scan statistics for a user
   */
  static async getScanStats(userId: string): Promise<{
    totalScans: number
    webScans: number
    documentScans: number
    totalIssues: number
    criticalIssues: number
    lastScanDate: string | null
  }> {
    const result = await queryOne(
      `SELECT 
        COUNT(*) as total_scans,
        COUNT(CASE WHEN scan_type = 'web' THEN 1 END) as web_scans,
        COUNT(CASE WHEN scan_type = 'document' THEN 1 END) as document_scans,
        SUM(total_issues) as total_issues,
        SUM(critical_issues) as critical_issues,
        MAX(created_at) as last_scan_date
      FROM scan_history 
      WHERE user_id = $1`,
      [userId]
    )

    return {
      totalScans: parseInt(result.total_scans) || 0,
      webScans: parseInt(result.web_scans) || 0,
      documentScans: parseInt(result.document_scans) || 0,
      totalIssues: parseInt(result.total_issues) || 0,
      criticalIssues: parseInt(result.critical_issues) || 0,
      lastScanDate: result.last_scan_date
    }
  }
}
