import { queryOne, query } from '@/lib/database'
import crypto from 'crypto'

/**
 * Auto-add document scan issues to product backlog
 */
export async function autoAddDocumentIssuesToBacklog(
  userId: string, 
  issues: any[], 
  scanHistoryId: string, 
  fileName: string
): Promise<{
  success: boolean
  total: number
  added: number
  skipped: number
  addedItems: any[]
  skippedItems: any[]
}> {
  try {
    console.log(`🔄 autoAddDocumentIssuesToBacklog called with:`, {
      userId,
      issuesCount: issues.length,
      scanHistoryId,
      fileName
    })
    
    const addedItems = []
    const skippedItems = []

    for (const issue of issues) {
      try {
        // Generate unique issue ID based on rule, element, and document
        // issue_key is VARCHAR(50) in database, so ensure it fits
        const issueKey = crypto.createHash('sha256')
          .update(`${issue.id || issue.description}|${issue.elementLocation || ''}|${fileName}`)
          .digest('hex').substring(0, 50) // VARCHAR(50) - use full 50 chars

        // Check if this issue already exists for this user
        // Use description/section for matching since rule_name now uses description
        const ruleNameForMatching = issue.description || issue.section || 'Accessibility Issue'
        const existingItem = await queryOne(`
          SELECT i.id, i.status, i.created_at, i.updated_at 
          FROM issues i
          JOIN scan_history sh ON i.first_seen_scan_id = sh.id
          WHERE sh.user_id = $1 AND i.rule_name = $2 AND sh.file_name = $3
        `, [userId, ruleNameForMatching, fileName])

        if (existingItem) {
          // Update last_scan_at for existing items
          await query(`
            UPDATE issues 
            SET updated_at = NOW()
            WHERE id = $1
          `, [existingItem.id])
          
          skippedItems.push({
            issueId: issue.id,
            ruleName: issue.description || issue.section || 'Accessibility Issue',
            reason: 'Already exists in backlog'
          })
          continue
        }

        // Get the next priority rank
        const maxRank = await queryOne(`
          SELECT COALESCE(MAX(rank), 0) as max_rank 
          FROM issues 
          WHERE first_seen_scan_id IN (
            SELECT id FROM scan_history WHERE user_id = $1
          )
        `, [userId])

        const nextRank = (maxRank?.max_rank || 0) + 1

        // Insert new issue
        // Truncate values to fit database constraints
        // status is VARCHAR(10) - must be one of: 'open', 'in_progress', 'resolved', 'closed'
        // NOTE: 'in_progress' is 12 chars but schema says VARCHAR(10) - this is a schema bug
        // For now, we'll use 'open' which is 4 chars and fits
        const status = 'open' // This is 4 chars, fits VARCHAR(10)
        
        // Map issue.type to priority (VARCHAR(20))
        let priority = 'low'
        if (issue.type === 'critical' || issue.type === 'serious') {
          priority = 'high'
        } else if (issue.type === 'moderate') {
          priority = 'medium'
        }
        const safePriority = String(priority).substring(0, 20) // VARCHAR(20)
        
        // wcag_level is VARCHAR(50) - truncate wcagCriterion
        const wcagLevel = String(issue.wcagCriterion || 'AA').substring(0, 50) // VARCHAR(50)
        
        // impact is VARCHAR(50) - truncate issue.type
        const impact = String(issue.type || 'moderate').substring(0, 50) // VARCHAR(50)
        const safeImpact = impact.substring(0, 50) // VARCHAR(50)
        
        // Ensure status fits VARCHAR(10) - use 'open' which is safe
        const safeStatus = 'open' // Hardcode to 'open' to ensure it fits VARCHAR(10)
        
        // Ensure all string values are properly converted and truncated
        const safeIssueKey = String(issueKey).substring(0, 50) // VARCHAR(50)
        const safeRuleId = String(issue.id || issue.description || '').substring(0, 255) // VARCHAR(255)
        const safeRuleName = String(issue.description || issue.section || 'Accessibility Issue').substring(0, 255) // VARCHAR(255)
        const safeDescription = String(issue.description || '').substring(0, 1000) // TEXT but truncate for safety
        const safeNotes = String(issue.recommendation || '').substring(0, 5000) // TEXT but truncate for safety
        
        const result = await queryOne(`
          INSERT INTO issues (
            issue_key, rule_id, rule_name, description, impact, wcag_level,
            total_occurrences, affected_pages, notes,
            status, priority, rank, story_points, remaining_points,
            first_seen_scan_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING *
        `, [
          safeIssueKey, // issue_key (VARCHAR(50))
          safeRuleId, // rule_id (VARCHAR(255))
          safeRuleName, // rule_name (VARCHAR(255))
          safeDescription, // description (TEXT)
          safeImpact, // impact (VARCHAR(50))
          wcagLevel, // wcag_level (VARCHAR(50))
          1, // total_occurrences
          [`Document: ${fileName}`], // affected_pages (TEXT[])
          safeNotes, // notes (TEXT)
          safeStatus, // status (VARCHAR(10)) - must be 'open' to fit
          safePriority, // priority (VARCHAR(20))
          nextRank, // rank (INTEGER)
          1, // story_points (INTEGER)
          1, // remaining_points (INTEGER)
          scanHistoryId, // first_seen_scan_id (UUID)
          new Date().toISOString(), // created_at
          new Date().toISOString() // updated_at
        ])

        addedItems.push({
          id: result.id,
          issueId: issue.id,
          ruleName: issue.description || issue.section || 'Accessibility Issue',
          impact: issue.type
        })
      } catch (error) {
        console.error(`Error processing document issue ${issue.id}:`, error)
        skippedItems.push({
          issueId: issue.id,
          ruleName: issue.description || issue.section || 'Accessibility Issue',
          reason: 'Error processing issue'
        })
      }
    }

    console.log('✅ Document backlog auto-creation result:', {
      total: issues.length,
      added: addedItems.length,
      skipped: skippedItems.length
    })
    
    // Return summary for API response
    return {
      success: true,
      total: issues.length,
      added: addedItems.length,
      skipped: skippedItems.length,
      addedItems,
      skippedItems
    }
  } catch (error) {
    console.error('Error auto-adding document issues to backlog:', error)
    throw error
  }
}

