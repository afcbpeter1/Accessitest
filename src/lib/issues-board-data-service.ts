import pool from './database'

interface IssueData {
  id: string
  rule_id: string
  rule_name: string
  description: string
  impact: string
  status: string
  priority: string
  assignee_name?: string
  labels: string[]
  total_occurrences: number
  last_seen: string
  created_at: string
  affected_pages: string[]
  rank?: number
}

export class IssuesBoardDataService {
  /**
   * Get all issues for the issues board with deduplication
   */
  static async getAllIssues(filters: any = {}): Promise<{
    issues: IssueData[]
    total: number
    stats: any
  }> {
    try {
      // Build dynamic WHERE clause
      let whereConditions = ['1=1']
      let queryParams: any[] = []
      let paramIndex = 1

      if (filters.status) {
        whereConditions.push(`i.status = $${paramIndex}`)
        queryParams.push(filters.status)
        paramIndex++
      }

      if (filters.priority) {
        whereConditions.push(`i.priority = $${paramIndex}`)
        queryParams.push(filters.priority)
        paramIndex++
      }

      if (filters.impact) {
        whereConditions.push(`i.impact = $${paramIndex}`)
        queryParams.push(filters.impact)
        paramIndex++
      }

      if (filters.search) {
        whereConditions.push(`(
          i.rule_name ILIKE $${paramIndex} OR 
          i.description ILIKE $${paramIndex} OR 
          i.notes ILIKE $${paramIndex}
        )`)
        queryParams.push(`%${filters.search}%`)
        paramIndex++
      }

      const whereClause = whereConditions.join(' AND ')

      // Get issues with all related data
      const issuesQuery = `
        SELECT 
          i.id,
          i.rule_id,
          i.rule_name,
          i.description,
          i.impact,
          i.status,
          i.priority,
          i.assignee_id,
          i.labels,
          i.total_occurrences as occurrence_count,
          i.affected_pages,
          i.created_at,
          i.updated_at as last_seen,
          i.rank,
          u.name as assignee_name,
          u.email as assignee_email,
          array_agg(DISTINCT il.name) as label_names,
          array_agg(DISTINCT il.color) as label_colors
        FROM issues i
        LEFT JOIN users u ON i.assignee_id = u.id
        LEFT JOIN issue_label_assignments ila ON i.id = ila.issue_id
        LEFT JOIN issue_labels il ON ila.label_id = il.id
        WHERE ${whereClause}
        GROUP BY i.id, u.name, u.email
        ORDER BY 
          CASE WHEN i.rank IS NOT NULL THEN i.rank ELSE 999999 END,
          i.priority DESC,
          i.impact DESC,
          i.created_at DESC
      `

      const result = await pool.query(issuesQuery, queryParams)

      // Get statistics
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

      const statsResult = await pool.query(statsQuery)

      return {
        issues: result.rows,
        total: result.rows.length,
        stats: statsResult.rows[0]
      }
    } catch (error) {
      console.error('Error fetching issues:', error)
      throw error
    }
  }

  /**
   * Update issue rank for drag and drop
   */
  static async updateIssueRank(issueId: string, newRank: number): Promise<void> {
    try {
      await pool.query(
        'UPDATE issues SET rank = $1, updated_at = NOW() WHERE id = $2',
        [newRank, issueId]
      )
    } catch (error) {
      console.error('Error updating issue rank:', error)
      throw error
    }
  }

  /**
   * Bulk update ranks for drag and drop reordering
   */
  static async updateIssueRanks(rankUpdates: Array<{ issueId: string; rank: number }>): Promise<void> {
    try {
      console.log('🔄 Updating issue ranks:', rankUpdates)
      await pool.query('BEGIN')
      
      for (const update of rankUpdates) {
        console.log(`📝 Updating issue ${update.issueId} to rank ${update.rank}`)
        const result = await pool.query(
          'UPDATE issues SET rank = $1, updated_at = NOW() WHERE id = $2',
          [update.rank, update.issueId]
        )
        console.log(`✅ Updated ${result.rowCount} rows for issue ${update.issueId}`)
      }
      
      await pool.query('COMMIT')
      console.log('✅ All ranks updated successfully')
    } catch (error) {
      await pool.query('ROLLBACK')
      console.error('❌ Error updating issue ranks:', error)
      throw error
    }
  }

  /**
   * Get issues from recent scans (fallback if no issues board data)
   */
  static async getIssuesFromRecentScans(limit: number = 50): Promise<IssueData[]> {
    try {
      const query = `
        SELECT DISTINCT
          CONCAT('scan-', sh.id, '-', result_index, '-', issue_index) as id,
          issue->>'id' as rule_id,
          issue->>'description' as rule_name,
          issue->>'description' as description,
          issue->>'impact' as impact,
          'open' as status,
          CASE 
            WHEN issue->>'impact' = 'critical' THEN 'critical'
            WHEN issue->>'impact' = 'serious' THEN 'high'
            ELSE 'medium'
          END as priority,
          NULL as assignee_name,
          ARRAY[]::text[] as labels,
          1 as occurrence_count,
          ARRAY[result->>'url'] as affected_pages,
          sh.created_at,
          sh.created_at as last_seen,
          NULL as rank
        FROM scan_history sh
        CROSS JOIN LATERAL jsonb_array_elements(sh.scan_results) AS results(result, result_index)
        CROSS JOIN LATERAL jsonb_array_elements(results.result->'issues') AS issues(issue, issue_index)
        WHERE sh.scan_results IS NOT NULL
          AND results.result->'issues' IS NOT NULL
          AND jsonb_array_length(results.result->'issues') > 0
        ORDER BY sh.created_at DESC
        LIMIT $1
      `

      const result = await pool.query(query, [limit])
      return result.rows
    } catch (error) {
      console.error('Error fetching issues from scans:', error)
      throw error
    }
  }

  /**
   * Create issues from scan data if issues board is empty
   */
  static async populateIssuesFromScans(): Promise<{ created: number; linked: number }> {
    try {
      // Check if issues board has any data
      const countResult = await pool.query('SELECT COUNT(*) as count FROM issues')
      const issueCount = parseInt(countResult.rows[0].count)

      if (issueCount > 0) {
        return { created: 0, linked: 0 }
      }

      // Get recent scans and create issues
      const recentScansQuery = `
        SELECT id, scan_results, created_at
        FROM scan_history 
        WHERE scan_results IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 10
      `

      const scansResult = await pool.query(recentScansQuery)
      let created = 0
      let linked = 0

      for (const scan of scansResult.rows) {
        if (!scan.scan_results || !Array.isArray(scan.scan_results)) continue

        for (const result of scan.scan_results) {
          if (!result.issues || !Array.isArray(result.issues)) continue

          for (const issue of result.issues) {
            // Check if similar issue already exists
            const existingQuery = `
              SELECT id FROM issues 
              WHERE rule_id = $1 AND impact = $2
              LIMIT 1
            `
            const existing = await pool.query(existingQuery, [
              issue.id || issue.rule_id,
              issue.impact
            ])

            if (existing.rows.length > 0) {
              // Link to existing issue
              const linkQuery = `
                INSERT INTO scan_issue_occurrences (issue_id, scan_id, page_url, element_selector, html_snippet, failure_summary)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (issue_id, scan_id, page_url, element_selector) DO NOTHING
              `
              
              for (const node of issue.nodes || []) {
                await pool.query(linkQuery, [
                  existing.rows[0].id,
                  scan.id,
                  result.url,
                  node.target?.join(' ') || null,
                  node.html || null,
                  node.failureSummary || null
                ])
              }
              linked++
            } else {
              // Create new issue
              const createQuery = `
                INSERT INTO issues (
                  issue_key, rule_id, rule_name, description, impact, wcag_level,
                  help_text, help_url, first_seen_scan_id, last_seen_scan_id,
                  total_occurrences, affected_pages
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                RETURNING id
              `

              const issueKey = `${issue.id || issue.rule_id}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`
              const newIssue = await pool.query(createQuery, [
                issueKey,
                issue.id || issue.rule_id,
                issue.description,
                issue.description,
                issue.impact,
                'A', // Default WCAG level
                issue.help,
                issue.helpUrl,
                scan.id,
                scan.id,
                issue.nodes?.length || 1,
                [result.url]
              ])

              // Add occurrences
              for (const node of issue.nodes || []) {
                await pool.query(`
                  INSERT INTO scan_issue_occurrences (issue_id, scan_id, page_url, element_selector, html_snippet, failure_summary)
                  VALUES ($1, $2, $3, $4, $5, $6)
                `, [
                  newIssue.rows[0].id,
                  scan.id,
                  result.url,
                  node.target?.join(' ') || null,
                  node.html || null,
                  node.failureSummary || null
                ])
              }
              created++
            }
          }
        }
      }

      return { created, linked }
    } catch (error) {
      console.error('Error populating issues from scans:', error)
      throw error
    }
  }
}