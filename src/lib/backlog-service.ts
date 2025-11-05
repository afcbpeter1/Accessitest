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
        const issueKey = crypto.createHash('sha256')
          .update(`${issue.id || issue.description}|${issue.elementLocation || ''}|${fileName}`)
          .digest('hex').substring(0, 16)

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
        const status = 'open' // VARCHAR(10) - should fit
        const priority = issue.type === 'critical' ? 'high' : issue.type === 'serious' ? 'high' : issue.type === 'moderate' ? 'medium' : 'low' // Map to priority
        const wcagLevel = (issue.wcagCriterion || 'AA').substring(0, 50) // Truncate if too long
        const impact = (issue.type || 'moderate').substring(0, 50) // Map type to impact, truncate to 50
        
        // Ensure all string fields are properly truncated
        const safeStatus = status.substring(0, 10) // Ensure it fits VARCHAR(10)
        const safePriority = priority.substring(0, 20) // Ensure it fits VARCHAR(20)
        const safeImpact = impact.substring(0, 50) // Ensure it fits VARCHAR(50)
        
        const result = await queryOne(`
          INSERT INTO issues (
            issue_key, rule_id, rule_name, description, impact, wcag_level,
            total_occurrences, affected_pages, notes,
            status, priority, rank, story_points, remaining_points,
            first_seen_scan_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING *
        `, [
          issueKey,
          (issue.id || issue.description || '').substring(0, 255), // rule_id (truncate)
          (issue.description || issue.section || 'Accessibility Issue').substring(0, 255), // rule_name (truncate)
          (issue.description || '').substring(0, 1000), // description (truncate)
          safeImpact, // impact (truncate to 50)
          wcagLevel.substring(0, 50), // wcag_level (truncate to 50)
          1, // total_occurrences
          [`Document: ${fileName}`], // affected_pages
          (issue.recommendation || '').substring(0, 5000), // notes (truncate)
          safeStatus, // status (truncate to 10)
          safePriority, // priority (truncate to 20)
          nextRank, 
          1, // story_points
          1, // remaining_points
          scanHistoryId, 
          new Date().toISOString(), 
          new Date().toISOString()
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

