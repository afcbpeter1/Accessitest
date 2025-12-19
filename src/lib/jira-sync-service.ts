import { query, queryOne, queryMany } from './database'
import { JiraClient } from './jira-client'
import { mapIssueToJiraSimple } from './jira-mapping-service'

/**
 * Auto-sync issues to Jira after scan completion
 * Checks for existing tickets to prevent duplicates
 */
export async function autoSyncIssuesToJira(
  userId: string,
  issueIds: string[]
): Promise<{
  success: boolean
  created: number
  skipped: number
  errors: number
  results: Array<{
    issueId: string
    success: boolean
    ticketKey?: string
    error?: string
  }>
}> {
  const results: Array<{
    issueId: string
    success: boolean
    ticketKey?: string
    error?: string
  }> = []

  let created = 0
  let skipped = 0
  let errors = 0

  try {
    // Check if user has Jira integration with auto-sync enabled
    const integration = await queryOne(
      `SELECT jira_url, jira_email, encrypted_api_token, project_key, issue_type, auto_sync_enabled
      FROM jira_integrations 
      WHERE user_id = $1 AND is_active = true AND auto_sync_enabled = true`,
      [userId]
    )

    if (!integration) {
      // No integration or auto-sync disabled - skip silently
      return {
        success: true,
        created: 0,
        skipped: issueIds.length,
        errors: 0,
        results: issueIds.map(id => ({
          issueId: id,
          success: false,
          error: 'Jira auto-sync not enabled'
        }))
      }
    }

    // Create Jira client
    const client = new JiraClient({
      jiraUrl: integration.jira_url,
      email: integration.jira_email,
      encryptedApiToken: integration.encrypted_api_token
    })

    // Process each issue
    for (const issueId of issueIds) {
      try {
        // Check if issue already has a Jira ticket (duplication prevention)
        const existingMapping = await queryOne(
          `SELECT jira_ticket_key, jira_url 
          FROM jira_ticket_mappings 
          WHERE issue_id = $1 
          LIMIT 1`,
          [issueId]
        )

        if (existingMapping) {
          // Skip - already has a ticket
          skipped++
          results.push({
            issueId,
            success: true,
            ticketKey: existingMapping.jira_ticket_key
          })
          continue
        }

        // Get issue details
        const issue = await queryOne(
          `SELECT 
            id, issue_key, rule_id, rule_name, description, impact, wcag_level,
            priority, total_occurrences, affected_pages, help_url, help_text, notes
          FROM issues 
          WHERE id = $1`,
          [issueId]
        )

        if (!issue) {
          errors++
          results.push({
            issueId,
            success: false,
            error: 'Issue not found'
          })
          continue
        }

        // Map issue to Jira format
        const jiraIssue = mapIssueToJiraSimple(
          {
            id: issue.id,
            rule_name: issue.rule_name,
            description: issue.description,
            impact: issue.impact,
            priority: issue.priority,
            wcag_level: issue.wcag_level,
            total_occurrences: issue.total_occurrences,
            affected_pages: issue.affected_pages || [],
            help_url: issue.help_url,
            help_text: issue.help_text,
            notes: issue.notes,
            issue_key: issue.issue_key
          },
          integration.project_key,
          integration.issue_type
        )

        // Create ticket in Jira
        const createdTicket = await client.createIssue(jiraIssue)
        const ticketUrl = client.getTicketUrl(createdTicket.key)

        // Store mapping in database
        await query(
          `INSERT INTO jira_ticket_mappings 
          (issue_id, jira_ticket_key, jira_ticket_id, jira_url)
          VALUES ($1, $2, $3, $4)`,
          [issueId, createdTicket.key, createdTicket.id, ticketUrl]
        )

        // Update issue flags
        await query(
          `UPDATE issues 
          SET jira_synced = true, jira_ticket_key = $1, jira_sync_error = NULL 
          WHERE id = $2`,
          [createdTicket.key, issueId]
        )

        created++
        results.push({
          issueId,
          success: true,
          ticketKey: createdTicket.key
        })
      } catch (error) {
        errors++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Update issue with error
        await query(
          `UPDATE issues SET jira_sync_error = $1 WHERE id = $2`,
          [errorMessage, issueId]
        )

        results.push({
          issueId,
          success: false,
          error: errorMessage
        })
      }
    }

    return {
      success: true,
      created,
      skipped,
      errors,
      results
    }
  } catch (error) {
    console.error('Error in auto-sync to Jira:', error)
    return {
      success: false,
      created,
      skipped,
      errors: errors + issueIds.length,
      results
    }
  }
}

/**
 * Get issue IDs from scan history
 */
export async function getIssueIdsFromScan(scanHistoryId: string): Promise<string[]> {
  try {
    const issues = await queryMany(
      `SELECT id FROM issues WHERE first_seen_scan_id = $1`,
      [scanHistoryId]
    )
    return issues.map(i => i.id)
  } catch (error) {
    console.error('Error getting issue IDs from scan:', error)
    return []
  }
}

