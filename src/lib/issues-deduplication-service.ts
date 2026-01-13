import { pool } from './database'

interface ScanIssue {
  id: string
  rule_id: string
  rule_name: string
  description: string
  impact: string
  wcag_level: string
  help_text: string
  help_url: string
  nodes: Array<{
    html: string
    target: string[]
    failureSummary: string
    url: string
  }>
}

interface DeduplicationResult {
  issue_id: string
  is_new: boolean
  confidence: number
  reason: string
}

export class IssuesDeduplicationService {
  /**
   * Process scan results and link them to existing issues or create new ones
   */
  static async processScanResults(
    scanId: string,
    scanResults: any[]
  ): Promise<{ linked: number; created: number }> {
    let linked = 0
    let created = 0

    for (const result of scanResults) {
      if (!result.issues || !Array.isArray(result.issues)) continue

      for (const issue of result.issues) {
        const deduplicationResult = await this.findOrCreateIssue(
          scanId,
          result.url,
          issue
        )

        if (deduplicationResult.is_new) {
          created++
        } else {
          linked++
        }
      }
    }

    return { linked, created }
  }

  /**
   * Find existing issue or create new one
   */
  private static async findOrCreateIssue(
    scanId: string,
    pageUrl: string,
    issue: ScanIssue
  ): Promise<DeduplicationResult> {
    // Try to find existing issue using multiple strategies
    const existingIssue = await this.findExistingIssue(issue, pageUrl)

    if (existingIssue) {
      // Link to existing issue
      await this.linkToExistingIssue(existingIssue.id, scanId, pageUrl, issue)
      return {
        issue_id: existingIssue.id,
        is_new: false,
        confidence: existingIssue.confidence,
        reason: existingIssue.reason
      }
    } else {
      // Create new issue
      const newIssue = await this.createNewIssue(scanId, pageUrl, issue)
      return {
        issue_id: newIssue.id,
        is_new: true,
        confidence: 1.0,
        reason: 'No similar issue found'
      }
    }
  }

  /**
   * Find existing similar issue using multiple strategies
   */
  private static async findExistingIssue(
    issue: ScanIssue,
    pageUrl: string
  ): Promise<{ id: string; confidence: number; reason: string } | null> {
    // Strategy 1: Exact rule match on same page
    const exactMatch = await this.findExactMatch(issue, pageUrl)
    if (exactMatch) return exactMatch

    // Strategy 2: Same rule, similar element selector
    const selectorMatch = await this.findSelectorMatch(issue, pageUrl)
    if (selectorMatch) return selectorMatch

    // Strategy 3: Same rule, different page (global issue)
    const globalMatch = await this.findGlobalMatch(issue)
    if (globalMatch) return globalMatch

    // Strategy 4: Similar rule (for related issues)
    const similarMatch = await this.findSimilarMatch(issue)
    if (similarMatch) return similarMatch

    return null
  }

  /**
   * Strategy 1: Exact rule match on same page
   */
  private static async findExactMatch(
    issue: ScanIssue,
    pageUrl: string
  ): Promise<{ id: string; confidence: number; reason: string } | null> {
    const query = `
      SELECT DISTINCT i.id
      FROM issues i
      JOIN scan_issue_occurrences sio ON i.id = sio.issue_id
      WHERE i.rule_id = $1 
        AND sio.page_url = $2
        AND i.status != 'resolved'
      LIMIT 1
    `

    const result = await pool.query(query, [issue.rule_id, pageUrl])
    
    if (result.rows.length > 0) {
      return {
        id: result.rows[0].id,
        confidence: 0.95,
        reason: 'Exact rule match on same page'
      }
    }

    return null
  }

  /**
   * Strategy 2: Same rule, similar element selector
   */
  private static async findSelectorMatch(
    issue: ScanIssue,
    pageUrl: string
  ): Promise<{ id: string; confidence: number; reason: string } | null> {
    if (!issue.nodes || issue.nodes.length === 0) return null

    const selectors = issue.nodes.map(node => node.target?.join(' ') || '').filter(Boolean)
    if (selectors.length === 0) return null

    const query = `
      SELECT DISTINCT i.id, sio.element_selector
      FROM issues i
      JOIN scan_issue_occurrences sio ON i.id = sio.issue_id
      WHERE i.rule_id = $1 
        AND sio.page_url = $2
        AND sio.element_selector IS NOT NULL
        AND i.status != 'resolved'
    `

    const result = await pool.query(query, [issue.rule_id, pageUrl])
    
    for (const row of result.rows) {
      const similarity = this.calculateSelectorSimilarity(selectors, [row.element_selector])
      if (similarity > 0.8) {
        return {
          id: row.id,
          confidence: similarity,
          reason: 'Similar element selector match'
        }
      }
    }

    return null
  }

  /**
   * Strategy 3: Same rule, different page (global issue)
   */
  private static async findGlobalMatch(
    issue: ScanIssue
  ): Promise<{ id: string; confidence: number; reason: string } | null> {
    const query = `
      SELECT i.id, COUNT(DISTINCT sio.page_url) as page_count
      FROM issues i
      JOIN scan_issue_occurrences sio ON i.id = sio.issue_id
      WHERE i.rule_id = $1 
        AND i.status != 'resolved'
        AND i.impact = $2
      GROUP BY i.id
      HAVING COUNT(DISTINCT sio.page_url) > 1
      ORDER BY page_count DESC
      LIMIT 1
    `

    const result = await pool.query(query, [issue.rule_id, issue.impact])
    
    if (result.rows.length > 0) {
      return {
        id: result.rows[0].id,
        confidence: 0.85,
        reason: 'Global issue pattern match'
      }
    }

    return null
  }

  /**
   * Strategy 4: Similar rule (for related issues)
   */
  private static async findSimilarMatch(
    issue: ScanIssue
  ): Promise<{ id: string; confidence: number; reason: string } | null> {
    // This would require a more sophisticated similarity algorithm
    // For now, we'll look for issues with similar impact and WCAG level
    const query = `
      SELECT i.id, i.rule_id, i.rule_name
      FROM issues i
      WHERE i.impact = $1 
        AND i.wcag_level = $2
        AND i.status != 'resolved'
        AND i.rule_id != $3
      ORDER BY i.created_at DESC
      LIMIT 5
    `

    const result = await pool.query(query, [
      issue.impact, 
      issue.wcag_level, 
      issue.rule_id
    ])
    
    // For now, we'll use a simple text similarity
    for (const row of result.rows) {
      const similarity = this.calculateTextSimilarity(
        issue.description, 
        row.rule_name
      )
      if (similarity > 0.7) {
        return {
          id: row.id,
          confidence: similarity * 0.6, // Lower confidence for similar rules
          reason: 'Similar rule match'
        }
      }
    }

    return null
  }

  /**
   * Link scan occurrence to existing issue
   */
  private static async linkToExistingIssue(
    issueId: string,
    scanId: string,
    pageUrl: string,
    issue: ScanIssue
  ): Promise<void> {
    for (const node of issue.nodes || []) {
      const insertQuery = `
        INSERT INTO scan_issue_occurrences (
          issue_id, scan_id, page_url, element_selector, 
          html_snippet, failure_summary
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (issue_id, scan_id, page_url, element_selector) 
        DO UPDATE SET 
          html_snippet = EXCLUDED.html_snippet,
          failure_summary = EXCLUDED.failure_summary,
          created_at = NOW()
      `

      await pool.query(insertQuery, [
        issueId,
        scanId,
        pageUrl,
        node.target?.join(' ') || null,
        node.html || null,
        node.failureSummary || null
      ])
    }

    // Update last seen scan
    await pool.query(
      'UPDATE issues SET last_seen_scan_id = $1, updated_at = NOW() WHERE id = $2',
      [scanId, issueId]
    )
  }

  /**
   * Create new issue
   */
  private static async createNewIssue(
    scanId: string,
    pageUrl: string,
    issue: ScanIssue
  ): Promise<{ id: string }> {
    const issueKey = `${issue.rule_id}:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`
    
    const insertQuery = `
      INSERT INTO issues (
        issue_key, rule_id, rule_name, description, impact, wcag_level,
        help_text, help_url, first_seen_scan_id, last_seen_scan_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id
    `

    const result = await pool.query(insertQuery, [
      issueKey,
      issue.rule_id,
      issue.rule_name,
      issue.description,
      issue.impact,
      issue.wcag_level,
      issue.help_text,
      issue.help_url,
      scanId,
      scanId
    ])

    const issueId = result.rows[0].id

    // Add occurrences
    await this.linkToExistingIssue(issueId, scanId, pageUrl, issue)

    return { id: issueId }
  }

  /**
   * Calculate similarity between selectors
   */
  private static calculateSelectorSimilarity(
    selectors1: string[],
    selectors2: string[]
  ): number {
    // Simple Jaccard similarity for selectors
    const set1 = new Set(selectors1)
    const set2 = new Set(selectors2)
    const intersection = new Set(Array.from(set1).filter(x => set2.has(x)))
    const union = new Set(Array.from(set1).concat(Array.from(set2)))
    
    return intersection.size / union.size
  }

  /**
   * Calculate text similarity using simple algorithm
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    const words1 = text1.toLowerCase().split(/\s+/)
    const words2 = text2.toLowerCase().split(/\s+/)
    
    const set1 = new Set(words1)
    const set2 = new Set(words2)
    const intersection = new Set(Array.from(set1).filter(x => set2.has(x)))
    const union = new Set(Array.from(set1).concat(Array.from(set2)))
    
    return intersection.size / union.size
  }
}