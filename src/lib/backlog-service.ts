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
    const addedItems = []
    const skippedItems = []

    for (const issue of issues) {
      try {
        // Generate unique issue ID based on rule, element, and document
        // issue_key is VARCHAR(50) in database, so ensure it fits
        const issueKeyRaw = crypto.createHash('sha256')
          .update(`${issue.id || issue.description}|${issue.elementLocation || ''}|${fileName}`)
          .digest('hex')
        // Truncate to exactly 50 chars to fit VARCHAR(50)
        const issueKey = String(issueKeyRaw).substring(0, 50)
        
        // Check if this issue already exists for this user
        // Use issue_key for exact duplicate detection (more reliable than rule_name + file_name)
        // Also check by rule_name + file_name as fallback
        const ruleNameForMatching = issue.description || issue.section || 'Accessibility Issue'
        const existingItem = await queryOne(`
          SELECT i.id, i.status, i.created_at, i.updated_at 
          FROM issues i
          JOIN scan_history sh ON i.first_seen_scan_id = sh.id
          WHERE sh.user_id = $1 
            AND (i.issue_key = $2 OR (i.rule_name = $3 AND sh.file_name = $4))
        `, [userId, issueKey, ruleNameForMatching, fileName])

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
        // status is VARCHAR(10) - must be one of: 'open', 'in_progress', 'resolved', 'closed', 'backlog'
        // Use 'backlog' to match web scan issues and ensure they appear in product backlog
        const status = 'backlog' // This is 7 chars, fits VARCHAR(10)
        
        // Map issue.type to priority (VARCHAR(20))
        let priority = 'low'
        if (issue.type === 'critical' || issue.type === 'serious') {
          priority = 'high'
        } else if (issue.type === 'moderate') {
          priority = 'medium'
        }
        
        // wcag_level is VARCHAR(50) - truncate wcagCriterion to 50 chars
        const wcagLevel = String(issue.wcagCriterion || 'AA').substring(0, 50).trim() // VARCHAR(50)
        
        // impact is VARCHAR(50) - truncate issue.type to 50 chars
        const impact = String(issue.type || 'moderate').substring(0, 50).trim() // VARCHAR(50)
        
        // Ensure all string values are properly converted and truncated
        const safeIssueKey = String(issueKey).substring(0, 50).trim() // VARCHAR(50)
        const safeRuleId = String(issue.id || issue.description || '').substring(0, 255).trim() // VARCHAR(255)
        const safeRuleName = String(issue.description || issue.section || 'Accessibility Issue').substring(0, 255).trim() // VARCHAR(255)
        const safeDescription = String(issue.description || '').substring(0, 1000).trim() // TEXT but truncate for safety
        const safeNotes = String(issue.recommendation || '').substring(0, 5000).trim() // TEXT but truncate for safety
        const safePriority = String(priority).substring(0, 20).trim() // VARCHAR(20)
        
        // Final values for INSERT - ensure all VARCHAR fields are within exact limits
        // Use Math.min to ensure we never exceed limits, even after trim
        // Use 'backlog' status as intended (7 chars, fits VARCHAR(10))
        const finalStatus = String(status).substring(0, Math.min(10, String(status).length)).trim().substring(0, 10) // VARCHAR(10)
        const finalWcagLevel = String(wcagLevel || 'AA').trim().substring(0, Math.min(50, String(wcagLevel || 'AA').trim().length)) // VARCHAR(50)
        const finalImpact = String(impact || 'moderate').trim().substring(0, Math.min(50, String(impact || 'moderate').trim().length)) // VARCHAR(50)
        const finalPriority = String(safePriority || 'medium').trim().substring(0, Math.min(20, String(safePriority || 'medium').trim().length)) // VARCHAR(20)
        
        // Double-check lengths after all processing
        const finalStatusSafe = finalStatus.length <= 10 ? finalStatus : finalStatus.substring(0, 10)
        const finalWcagLevelSafe = finalWcagLevel.length <= 50 ? finalWcagLevel : finalWcagLevel.substring(0, 50)
        const finalImpactSafe = finalImpact.length <= 50 ? finalImpact : finalImpact.substring(0, 50)
        const finalPrioritySafe = finalPriority.length <= 20 ? finalPriority : finalPriority.substring(0, 20)
        
        // Final validation - ensure no field exceeds its database limit
        if (finalStatusSafe.length > 10) throw new Error(`Status too long: "${finalStatusSafe}" (${finalStatusSafe.length} chars, max 10)`)
        if (finalWcagLevelSafe.length > 50) throw new Error(`WCAG level too long: "${finalWcagLevelSafe}" (${finalWcagLevelSafe.length} chars, max 50)`)
        if (finalImpactSafe.length > 50) throw new Error(`Impact too long: "${finalImpactSafe}" (${finalImpactSafe.length} chars, max 50)`)
        if (finalPrioritySafe.length > 20) throw new Error(`Priority too long: "${finalPrioritySafe}" (${finalPrioritySafe.length} chars, max 20)`)
        if (safeIssueKey.length > 50) throw new Error(`Issue key too long: ${safeIssueKey.length} chars (max 50)`)
        if (safeRuleId.length > 255) throw new Error(`Rule ID too long: ${safeRuleId.length} chars (max 255)`)
        if (safeRuleName.length > 255) throw new Error(`Rule name too long: ${safeRuleName.length} chars (max 255)`)
        
        // Get occurrences count from issue if it's a grouped/duplicate issue
        const occurrencesCount = issue.occurrences || issue.total_occurrences || 1
        
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
          finalImpactSafe, // impact (VARCHAR(50)) - truncated to 50 chars
          finalWcagLevelSafe, // wcag_level (VARCHAR(50)) - truncated to 50 chars
          occurrencesCount, // total_occurrences - use from issue if grouped/duplicate
          [`Document: ${fileName}`], // affected_pages (TEXT[])
          safeNotes, // notes (TEXT)
          finalStatusSafe, // status (VARCHAR(10)) - 'backlog' is 7 chars, safe
          finalPrioritySafe, // priority (VARCHAR(20)) - truncated to 20 chars
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
        console.error(`❌ Error processing document issue ${issue.id || 'unknown'}:`, error)
        if (error instanceof Error) {
          console.error(`❌ Error details: ${error.message}`)
          console.error(`❌ Error stack: ${error.stack}`)
        }
        skippedItems.push({
          issueId: issue.id,
          ruleName: issue.description || issue.section || 'Accessibility Issue',
          reason: `Error processing issue: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }

    return {
      success: true,
      total: addedItems.length + skippedItems.length,
      added: addedItems.length,
      skipped: skippedItems.length,
      addedItems: addedItems,
      skippedItems: skippedItems.map(item => ({ issueId: item.issueId, reason: item.reason }))
    }
    
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

