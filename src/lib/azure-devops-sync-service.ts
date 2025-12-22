import { query, queryOne, queryMany } from './database'
import { AzureDevOpsClient } from './azure-devops-client'
import { mapIssueToAzureDevOps } from './azure-devops-mapping-service'

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
 * Auto-sync issues to Azure DevOps after scan completion
 * Checks for existing work items to prevent duplicates
 */
export async function autoSyncIssuesToAzureDevOps(
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
    workItemId?: number
    error?: string
  }>
}> {
  const results: Array<{
    issueId: string
    success: boolean
    workItemId?: number
    error?: string
  }> = []

  let created = 0
  let skipped = 0
  let errors = 0

  try {
    // Check if user has Azure DevOps integration with auto-sync enabled
    const integration = await queryOne(
      `SELECT organization, project, encrypted_pat, work_item_type, area_path, iteration_path, auto_sync_enabled
      FROM azure_devops_integrations 
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
          error: 'Azure DevOps auto-sync not enabled'
        }))
      }
    }

    // Create Azure DevOps client
    const client = new AzureDevOpsClient({
      organization: integration.organization,
      encryptedPat: integration.encrypted_pat
    })

    // Process each issue
    for (const issueId of issueIds) {
      try {
        // Check if issue already has an Azure DevOps work item (duplication prevention)
        const existingMapping = await queryOne(
          `SELECT work_item_id, work_item_url 
          FROM azure_devops_work_item_mappings 
          WHERE issue_id = $1 
          LIMIT 1`,
          [issueId]
        )

        if (existingMapping) {
          // Skip - already has a work item
          skipped++
          results.push({
            issueId,
            success: true,
            workItemId: existingMapping.work_item_id
          })
          continue
        }

        // Get issue details with scan results for full remediation data
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

        // Extract remediation data from scan_results (same logic as Jira sync)
        let remediationItem = null
        let offendingElements: any[] = []
        let suggestions: any[] = []
        let screenshots: any = null

        if (isDocumentScan) {
          // For document scans, AI recommendations are in the notes field
          if (issue.notes && issue.notes.trim().length > 0) {
            suggestions = [{
              type: 'fix',
              description: issue.notes,
              codeExample: '',
              priority: issue.priority || 'medium'
            }]
          }

          // For document scans, create offending elements from available data
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
            remediationItem = issue.scan_results.remediationReport.find((r: any) => 
              r.ruleName === issue.rule_name || 
              r.ruleName === issue.rule_id ||
              r.issueId === issue.id
            )

            if (!remediationItem && issue.description) {
              remediationItem = issue.scan_results.remediationReport.find((r: any) => 
                r.description && r.description.toLowerCase().trim() === issue.description.toLowerCase().trim()
              )
            }

            if (!remediationItem && issue.description) {
              const descWords = issue.description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
              remediationItem = issue.scan_results.remediationReport.find((r: any) => 
                r.description && descWords.some((word: string) => r.description.toLowerCase().includes(word))
              )
            }

            if (remediationItem) {
              offendingElements = remediationItem.offendingElements || []
              suggestions = remediationItem.suggestions || []
            } else {
              // Fallback: Extract from scan_results.results
              if (issue.scan_results?.results) {
                for (const result of issue.scan_results.results) {
                  if (result.issues) {
                    for (const scanIssue of result.issues) {
                      const ruleMatches = scanIssue.id === issue.rule_name || 
                                         scanIssue.id === issue.rule_id ||
                                         scanIssue.ruleId === issue.rule_name ||
                                         scanIssue.ruleId === issue.rule_id
                      const descMatches = scanIssue.description && issue.description &&
                                         (scanIssue.description.toLowerCase().trim() === issue.description.toLowerCase().trim() ||
                                          scanIssue.description.toLowerCase().includes(issue.description.toLowerCase().substring(0, 20)) ||
                                          issue.description.toLowerCase().includes(scanIssue.description.toLowerCase().substring(0, 20)))
                      
                      if (ruleMatches || descMatches) {
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
                        
                        if (scanIssue.suggestions && scanIssue.suggestions.length > 0) {
                          suggestions = scanIssue.suggestions.map((s: any) => ({
                            type: 'fix',
                            description: s.description || s.text || s.whatWillBeFixed || '',
                            codeExample: s.codeExample || s.code || '',
                            priority: s.priority || 'medium'
                          }))
                        }
                        
                        if (offendingElements.length > 0 || suggestions.length > 0) {
                          break
                        }
                      }
                    }
                  }
                }
              }
              
              // Last resort: create basic offending element from notes
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

        // Map issue to Azure DevOps format
        const patches = mapIssueToAzureDevOps(
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
          integration.work_item_type || 'Bug',
          integration.area_path,
          integration.iteration_path
        )

        // Create work item in Azure DevOps
        const createdWorkItem = await client.createWorkItem(
          integration.project,
          integration.work_item_type || 'Bug',
          patches
        )
        const workItemUrl = client.getWorkItemUrl(integration.project, createdWorkItem.id)

        // Upload screenshots as attachments (optional - Azure DevOps supports attachments)
        // Note: Screenshots are also linked in description, so attachments are optional
        if (screenshots) {
          try {
            // Upload full page screenshot if available
            if (screenshots.fullPage) {
              try {
                const imageBuffer = await downloadImageFromUrl(screenshots.fullPage)
                if (imageBuffer && imageBuffer.length > 0) {
                  await client.addAttachment(
                    integration.project,
                    createdWorkItem.id,
                    imageBuffer,
                    `full-page-screenshot-${issueId.slice(-8)}.png`
                  )
                }
              } catch (err) {
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
                      await client.addAttachment(
                        integration.project,
                        createdWorkItem.id,
                        imageBuffer,
                        `${selector}-screenshot-${issueId.slice(-8)}.png`
                      )
                    }
                  } catch (err) {
                    console.warn(`Failed to upload element screenshot ${i} for issue ${issueId}:`, err)
                  }
                }
              }
            }
          } catch (screenshotError) {
            // Don't fail the whole sync if screenshots fail
            console.warn(`Screenshot processing failed for issue ${issueId}:`, screenshotError)
          }
        }

        // Store mapping in database
        await query(
          `INSERT INTO azure_devops_work_item_mappings 
          (issue_id, work_item_id, work_item_url)
          VALUES ($1, $2, $3)`,
          [issueId, createdWorkItem.id, workItemUrl]
        )

        // Update issue flags
        await query(
          `UPDATE issues 
          SET azure_devops_synced = true, azure_devops_work_item_id = $1, azure_devops_sync_error = NULL 
          WHERE id = $2`,
          [createdWorkItem.id, issueId]
        )

        created++
        results.push({
          issueId,
          success: true,
          workItemId: createdWorkItem.id
        })
      } catch (error) {
        errors++
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        
        // Update issue with error
        await query(
          `UPDATE issues SET azure_devops_sync_error = $1 WHERE id = $2`,
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
    console.error('Error in auto-sync to Azure DevOps:', error)
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

