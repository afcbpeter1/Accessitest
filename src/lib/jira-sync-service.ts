import { query, queryOne, queryMany } from './database'
import { JiraClient } from './jira-client'
import { mapIssueToJiraSimple } from './jira-mapping-service'
import { getJiraIntegration } from './integration-selection-service'

/**
 * Download an image from a URL and return as Buffer
 */
async function downloadImageFromUrl(url: string): Promise<Buffer> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`)
  }
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

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
    // Process each issue to get team context
    for (const issueId of issueIds) {
      try {
        // Get issue context (team/organization) to find the right integration
        const issueContext = await queryOne(
          `SELECT team_id, organization_id FROM issues WHERE id = $1`,
          [issueId]
        )

        // Get the appropriate Jira integration (team > org > personal)
        const integration = await getJiraIntegration(
          userId,
          issueContext?.team_id,
          issueContext?.organization_id
        )

        if (!integration || !integration.auto_sync_enabled) {
          // No integration or auto-sync disabled - skip
          skipped++
          results.push({
            issueId,
            success: false,
            error: 'Jira auto-sync not enabled'
          })
          continue
        }

        // Check if team has an assigned project and issue type (overrides integration settings)
        let projectKeyToUse = integration.project_key
        let issueTypeToUse = integration.issue_type
        if (issueContext?.team_id) {
          const team = await queryOne(
            `SELECT jira_project_key, jira_issue_type FROM teams WHERE id = $1`,
            [issueContext.team_id]
          )
          if (team?.jira_project_key) {
            projectKeyToUse = team.jira_project_key
          }
          if (team?.jira_issue_type) {
            issueTypeToUse = team.jira_issue_type
          }
        }

        // Create Jira client
        const client = new JiraClient({
          jiraUrl: integration.jira_url,
          email: integration.jira_email,
          encryptedApiToken: integration.encrypted_api_token
        })

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

        // Get issue details with scan results for full remediation data
        // Also get the URL from scan_history to help match issues
        const issue = await queryOne(
          `SELECT 
            i.id, i.issue_key, i.rule_id, i.rule_name, i.description, i.impact, i.wcag_level,
            i.priority, i.total_occurrences, i.affected_pages, i.help_url, i.help_text, i.notes,
            sh.scan_results, sh.scan_type, sh.file_name, sh.url as scan_url
          FROM issues i
          JOIN scan_history sh ON i.first_seen_scan_id = sh.id
          WHERE i.id = $1`,
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

        // Check if this is a document scan
        const isDocumentScan = issue.scan_type === 'document' || 
                              issue.file_name !== null ||
                              (issue.affected_pages && issue.affected_pages.some((p: string) => typeof p === 'string' && p.startsWith('Document:')))

        // Extract remediation data from scan_results
        let remediationItem = null
        let offendingElements: any[] = []
        let suggestions: any[] = []
        let screenshots: any = null

        if (isDocumentScan) {
          // For document scans, AI recommendations are in the notes field
          // Structure them as suggestions
          if (issue.notes && issue.notes.trim().length > 0) {
            suggestions = [{
              type: 'fix',
              description: issue.notes,
              codeExample: '',
              priority: issue.priority || 'medium'
            }]
          }

          // For document scans, create offending elements from available data
          // Document scans have: pageNumber, lineNumber, elementLocation, context
          if (issue.affected_pages && issue.affected_pages.length > 0) {
            offendingElements = issue.affected_pages.map((page: string, index: number) => ({
              html: issue.description || '',
              target: [issue.rule_name || ''],
              failureSummary: issue.description || '',
              impact: issue.impact || 'moderate',
              url: page,
              pageNumber: index + 1
            }))
          }
        } else {
          // For web scans, extract from remediationReport
          if (issue.scan_results?.remediationReport) {
            // Try multiple matching strategies to find the remediation item
            // Strategy 1: Exact rule name match
            remediationItem = issue.scan_results.remediationReport.find((r: any) => 
              r.ruleName === issue.rule_name || 
              r.ruleName === issue.rule_id ||
              r.issueId === issue.id
            )

            // Strategy 2: Description match (case insensitive)
            if (!remediationItem && issue.description) {
              remediationItem = issue.scan_results.remediationReport.find((r: any) => 
                r.description && r.description.toLowerCase().trim() === issue.description.toLowerCase().trim()
              )
            }

            // Strategy 3: Partial description match
            if (!remediationItem && issue.description) {
              const descWords = issue.description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
              remediationItem = issue.scan_results.remediationReport.find((r: any) => 
                r.description && descWords.some((word: string) => r.description.toLowerCase().includes(word))
              )
            }

            // Strategy 4: Rule ID pattern matching (e.g., "region" matches "page content is contained by landmarks")
            if (!remediationItem) {
              const ruleIdPatterns: Record<string, string[]> = {
                'region': ['page content', 'contained by landmarks', 'landmark'],
                'color-contrast-enhanced': ['enhanced contrast', 'aaa contrast'],
                'color-contrast': ['minimum contrast', 'aa contrast', 'color contrast'],
                'heading-order': ['order of headings', 'heading order'],
                'landmark-unique': ['landmarks are unique', 'unique landmark'],
                'target-size': ['touch targets', 'target size']
              }
              
              const patterns = ruleIdPatterns[issue.rule_name as keyof typeof ruleIdPatterns] || []
              if (patterns.length > 0) {
                remediationItem = issue.scan_results.remediationReport.find((r: any) => 
                  patterns.some(pattern => 
                    r.ruleName?.toLowerCase().includes(pattern) ||
                    r.description?.toLowerCase().includes(pattern)
                  )
                )
              }
            }

            if (remediationItem) {
              offendingElements = remediationItem.offendingElements || []
              suggestions = remediationItem.suggestions || []
            } else {
              // Fallback: Extract from scan_results.results if remediationReport doesn't match
              // This handles cases where remediationReport structure is different
              if (issue.scan_results?.results) {
                for (const result of issue.scan_results.results) {
                  if (result.issues) {
                    for (const scanIssue of result.issues) {
                      // Match by rule ID, rule name, or description (with fuzzy matching)
                      const ruleMatches = scanIssue.id === issue.rule_name || 
                                         scanIssue.id === issue.rule_id ||
                                         scanIssue.ruleId === issue.rule_name ||
                                         scanIssue.ruleId === issue.rule_id
                      const descMatches = scanIssue.description && issue.description &&
                                         (scanIssue.description.toLowerCase().trim() === issue.description.toLowerCase().trim() ||
                                          scanIssue.description.toLowerCase().includes(issue.description.toLowerCase().substring(0, 20)) ||
                                          issue.description.toLowerCase().includes(scanIssue.description.toLowerCase().substring(0, 20)))
                      
                      if (ruleMatches || descMatches) {
                        // Extract offending elements from nodes
                        if (scanIssue.nodes && scanIssue.nodes.length > 0) {
                          offendingElements = scanIssue.nodes.map((node: any) => ({
                            html: node.html || `<${node.target?.[0] || 'element'}>`,
                            target: node.target || [],
                            failureSummary: node.failureSummary || scanIssue.description || issue.description,
                            impact: scanIssue.impact || issue.impact || 'moderate',
                            url: result.url || issue.scan_url || issue.affected_pages?.[0] || '',
                            screenshot: node.screenshot,
                            boundingBox: node.boundingBox
                          }))
                        }
                        
                        // Extract suggestions if available
                        if (scanIssue.suggestions && scanIssue.suggestions.length > 0) {
                          suggestions = scanIssue.suggestions.map((s: any) => ({
                            type: 'fix',
                            description: s.description || s.text || s.whatWillBeFixed || '',
                            codeExample: s.codeExample || s.code || '',
                            priority: s.priority || 'medium'
                          }))
                        }
                        
                        // If we found matching issue, break
                        if (offendingElements.length > 0 || suggestions.length > 0) {
                          break
                        }
                      }
                    }
                  }
                }
              }
              
              // Last resort: If we still don't have offending elements but have notes, 
              // create a basic offending element from the issue data
              if (offendingElements.length === 0 && issue.notes) {
                offendingElements = [{
                  html: issue.notes.split(':')[1]?.trim() || issue.description || '',
                  target: [issue.rule_name || ''],
                  failureSummary: issue.notes,
                  impact: issue.impact || 'moderate',
                  url: issue.affected_pages?.[0] || issue.scan_url || ''
                }]
              }
            }
          }

          // Get screenshots from scan results (web scans only)
          if (issue.scan_results?.results?.[0]?.screenshots) {
            screenshots = issue.scan_results.results[0].screenshots
          }
        }

        // Map issue to Jira format with full remediation data
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
            issue_key: issue.issue_key,
            offendingElements,
            suggestions,
            screenshots
          },
          projectKeyToUse,
          issueTypeToUse
        )

        // Create ticket in Jira
        const createdTicket = await client.createIssue(jiraIssue)
        const ticketUrl = client.getTicketUrl(createdTicket.key)

        // Upload screenshots as attachments and update description
        const uploadedAttachments: Array<{ id: string; filename: string }> = []
        
        if (screenshots) {
          try {
            // Upload full page screenshot if available
            if (screenshots.fullPage) {
              try {
                const imageBuffer = await downloadImageFromUrl(screenshots.fullPage)
                if (imageBuffer && imageBuffer.length > 0) {
                  const attachment = await client.addAttachment(
                    createdTicket.key,
                    imageBuffer,
                    `full-page-screenshot-${issueId.slice(-8)}.png`
                  )
                  uploadedAttachments.push(attachment)
                }
              } catch (err) {
                // Log but continue if screenshot upload fails
                console.warn(`Failed to upload full page screenshot for issue ${issueId}:`, err)
              }
            }

            // Upload element screenshots
            if (screenshots.elements && Array.isArray(screenshots.elements)) {
              for (let i = 0; i < screenshots.elements.length && i < 5; i++) {
                const element = screenshots.elements[i]
                if (element.screenshot) {
                  try {
                    const imageBuffer = await downloadImageFromUrl(element.screenshot)
                    if (imageBuffer && imageBuffer.length > 0) {
                      const selector = element.selector?.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30) || `element-${i}`
                      const attachment = await client.addAttachment(
                        createdTicket.key,
                        imageBuffer,
                        `${selector}-screenshot-${issueId.slice(-8)}.png`
                      )
                      uploadedAttachments.push(attachment)
                    }
                  } catch (err) {
                    // Log but continue if screenshot upload fails
                    console.warn(`Failed to upload element screenshot ${i} for issue ${issueId}:`, err)
                  }
                }
              }
            }

            // Update description with media nodes if we uploaded any attachments
            if (uploadedAttachments.length > 0) {
              try {
                const { addMediaNodesToDescription } = await import('./jira-mapping-service')
                const jiraBaseUrl = integration.jira_url.replace(/\/$/, '')
                const updatedDescription = addMediaNodesToDescription(
                  jiraIssue.fields.description, 
                  uploadedAttachments,
                  jiraBaseUrl
                )
                await client.updateIssue(createdTicket.key, {
                  description: updatedDescription
                })
              } catch (updateErr) {
                // Log but don't fail - attachments are still uploaded even if description update fails
                console.warn(`Failed to update description with media nodes for issue ${issueId}:`, updateErr)
              }
            }
          } catch (screenshotError) {
            // Don't fail the whole sync if screenshots fail
            console.warn(`Screenshot processing failed for issue ${issueId}:`, screenshotError)
          }
        }

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


