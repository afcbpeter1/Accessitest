import { IssuesDeduplicationService } from './issues-deduplication-service'
import { pool } from './database'

interface ScanResult {
  url: string
  issues: any[]
  summary: any
}

interface ScanResults {
  results: ScanResult[]
  complianceSummary: any
  remediationReport: any[]
}

export class ScanToIssuesIntegration {
  /**
   * Process scan results and integrate with issues board
   */
  static async processScanResults(
    scanId: string,
    scanResults: ScanResults
  ): Promise<{ linked: number; created: number }> {
    try {
      // Process each scan result through deduplication
      const deduplicationResult = await IssuesDeduplicationService.processScanResults(
        scanId,
        scanResults.results
      )

      // Update scan history with issues board integration
      await this.updateScanHistoryWithIssues(scanId, deduplicationResult)

      return deduplicationResult
    } catch (error) {
      console.error('Error integrating scan with issues board:', error)
      throw error
    }
  }

  /**
   * Update scan history record with issues board integration
   */
  private static async updateScanHistoryWithIssues(
    scanId: string,
    deduplicationResult: { linked: number; created: number }
  ): Promise<void> {
    const updateQuery = `
      UPDATE scan_history 
      SET 
        issues_board_integrated = true,
        issues_linked = $1,
        issues_created = $2,
        updated_at = NOW()
      WHERE id = $3
    `

    await pool.query(updateQuery, [
      deduplicationResult.linked,
      deduplicationResult.created,
      scanId
    ])
  }

  /**
   * Get issues board summary for a specific scan
   */
  static async getScanIssuesSummary(scanId: string): Promise<{
    totalIssues: number
    newIssues: number
    existingIssues: number
    criticalIssues: number
    seriousIssues: number
    moderateIssues: number
    minorIssues: number
  }> {
    const query = `
      SELECT 
        COUNT(DISTINCT i.id) as total_issues,
        COUNT(DISTINCT CASE WHEN i.first_seen_scan_id = $1 THEN i.id END) as new_issues,
        COUNT(DISTINCT CASE WHEN i.first_seen_scan_id != $1 THEN i.id END) as existing_issues,
        COUNT(DISTINCT CASE WHEN i.impact = 'critical' THEN i.id END) as critical_issues,
        COUNT(DISTINCT CASE WHEN i.impact = 'serious' THEN i.id END) as serious_issues,
        COUNT(DISTINCT CASE WHEN i.impact = 'moderate' THEN i.id END) as moderate_issues,
        COUNT(DISTINCT CASE WHEN i.impact = 'minor' THEN i.id END) as minor_issues
      FROM issues i
      JOIN scan_issue_occurrences sio ON i.id = sio.issue_id
      WHERE sio.scan_id = $1
    `

    const result = await pool.query(query, [scanId])
    return result.rows[0]
  }

  /**
   * Get issues board statistics
   */
  static async getIssuesBoardStats(): Promise<{
    totalIssues: number
    openIssues: number
    inProgressIssues: number
    resolvedIssues: number
    criticalIssues: number
    seriousIssues: number
    moderateIssues: number
    minorIssues: number
    issuesByStatus: Array<{ status: string; count: number }>
    issuesByImpact: Array<{ impact: string; count: number }>
    issuesByPriority: Array<{ priority: string; count: number }>
  }> {
    const statsQuery = `
      SELECT 
        COUNT(*) as total_issues,
        COUNT(CASE WHEN status = 'open' THEN 1 END) as open_issues,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_issues,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_issues,
        COUNT(CASE WHEN impact = 'critical' THEN 1 END) as critical_issues,
        COUNT(CASE WHEN impact = 'serious' THEN 1 END) as serious_issues,
        COUNT(CASE WHEN impact = 'moderate' THEN 1 END) as moderate_issues,
        COUNT(CASE WHEN impact = 'minor' THEN 1 END) as minor_issues
      FROM issues
    `

    const statusQuery = `
      SELECT status, COUNT(*) as count
      FROM issues
      GROUP BY status
      ORDER BY count DESC
    `

    const impactQuery = `
      SELECT impact, COUNT(*) as count
      FROM issues
      GROUP BY impact
      ORDER BY count DESC
    `

    const priorityQuery = `
      SELECT priority, COUNT(*) as count
      FROM issues
      GROUP BY priority
      ORDER BY count DESC
    `

    const [statsResult, statusResult, impactResult, priorityResult] = await Promise.all([
      pool.query(statsQuery),
      pool.query(statusQuery),
      pool.query(impactQuery),
      pool.query(priorityQuery)
    ])

    return {
      ...statsResult.rows[0],
      issuesByStatus: statusResult.rows,
      issuesByImpact: impactResult.rows,
      issuesByPriority: priorityResult.rows
    }
  }

  /**
   * Get recent issues activity
   */
  static async getRecentIssuesActivity(limit: number = 10): Promise<Array<{
    id: string
    activity_type: string
    old_value: string
    new_value: string
    comment: string
    created_at: string
    user_name: string
    user_email: string
    issue_rule_name: string
  }>> {
    const query = `
      SELECT 
        ia.id,
        ia.activity_type,
        ia.old_value,
        ia.new_value,
        ia.comment,
        ia.created_at,
        u.name as user_name,
        u.email as user_email,
        i.rule_name as issue_rule_name
      FROM issue_activity ia
      JOIN users u ON ia.user_id = u.id
      JOIN issues i ON ia.issue_id = i.id
      ORDER BY ia.created_at DESC
      LIMIT $1
    `

    const result = await pool.query(query, [limit])
    return result.rows
  }
}