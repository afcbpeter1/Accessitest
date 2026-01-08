import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'
import { JiraClient } from '@/lib/jira-client'
import { mapIssueToJiraSimple } from '@/lib/jira-mapping-service'
import { getJiraIntegration, getIssueContext } from '@/lib/integration-selection-service'

/**
 * POST /api/jira/tickets
 * Create Jira ticket from issue (with duplication prevention)
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const body = await request.json()

    const { issueId } = body

    if (!issueId) {
      return NextResponse.json(
        {
          success: false,
          error: 'issueId is required'
        },
        { status: 400 }
      )
    }

    // Get issue context (team/organization)
    const issueContext = await getIssueContext(issueId)
    
    // Get the appropriate Jira integration (team > org > personal)
    const integration = await getJiraIntegration(
      user.userId,
      issueContext?.teamId,
      issueContext?.organizationId
    )

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Jira integration not configured. Please set up Jira in settings first.'
        },
        { status: 404 }
      )
    }

    // Check if issue already has a Jira ticket (duplication prevention)
    // Also verify the ticket still exists in Jira
    const existingMapping = await queryOne(
      `SELECT jtm.*, i.jira_ticket_key 
      FROM jira_ticket_mappings jtm
      JOIN issues i ON jtm.issue_id = i.id
      WHERE jtm.issue_id = $1
      LIMIT 1`,
      [issueId]
    )

    if (existingMapping) {
      // Verify the ticket still exists in Jira before returning it
      console.log(`Found existing mapping for issue ${issueId} -> ticket ${existingMapping.jira_ticket_key}, verifying it exists in Jira...`)
      try {
        const tempClient = new JiraClient({
          jiraUrl: integration.jira_url,
          email: integration.jira_email,
          encryptedApiToken: integration.encrypted_api_token
        })
        const existingTicket = await tempClient.getIssue(existingMapping.jira_ticket_key)
        
        // Ticket exists, return it (don't create duplicate)
        console.log(`✅ Ticket ${existingMapping.jira_ticket_key} exists in Jira, returning existing mapping`)
        return NextResponse.json({
          success: true,
          ticket: {
            key: existingMapping.jira_ticket_key,
            id: existingMapping.jira_ticket_id,
            url: existingMapping.jira_url
          },
          existing: true,
          message: 'Issue already has a Jira ticket'
        })
      } catch (verifyError) {
        // Ticket doesn't exist in Jira anymore (deleted or not found)
        // Delete the stale mapping and continue to create a new one
        const errorMsg = verifyError instanceof Error ? verifyError.message : 'Unknown error'
        console.log(`❌ Ticket ${existingMapping.jira_ticket_key} not found in Jira (${errorMsg}), deleting stale mapping and creating new ticket`)
        
        try {
          await query(
            `DELETE FROM jira_ticket_mappings WHERE issue_id = $1`,
            [issueId]
          )
          await query(
            `UPDATE issues SET jira_synced = false, jira_ticket_key = NULL WHERE id = $1`,
            [issueId]
          )
          console.log(`✅ Deleted stale mapping for issue ${issueId}, will create new ticket`)
        } catch (deleteError) {
          console.error(`Failed to delete stale mapping:`, deleteError)
          // Continue anyway - we'll try to create a new ticket
        }
        // Continue to create a new ticket below
      }
    } else {
      console.log(`No existing mapping found for issue ${issueId}, will create new ticket`)
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
      return NextResponse.json(
        {
          success: false,
          error: 'Issue not found'
        },
        { status: 404 }
      )
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

        // Strategy 2: Description match (case insensitive)
        if (!remediationItem && issue.description) {
          remediationItem = issue.scan_results.remediationReport.find((r: any) => 
            r.description && r.description.toLowerCase().trim() === issue.description.toLowerCase().trim()
          )
        }

        // Strategy 3: Partial description match
        if (!remediationItem && issue.description) {
          const descWords = issue.description.toLowerCase().split(/\s+/).filter(w => w.length > 3)
          remediationItem = issue.scan_results.remediationReport.find((r: any) => 
            r.description && descWords.some((word: string) => r.description.toLowerCase().includes(word))
          )
        }

        // Strategy 4: Rule ID pattern matching
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
        console.log(`Found screenshots in scan_results:`, {
          hasFullPage: !!screenshots.fullPage,
          hasElements: !!screenshots.elements,
          elementsCount: screenshots.elements?.length || 0
        })
      } else {
        console.log(`No screenshots found in scan_results for issue ${issueId}`)
      }
    }

    // Create Jira client
    const client = new JiraClient({
      jiraUrl: integration.jira_url,
      email: integration.jira_email,
      encryptedApiToken: integration.encrypted_api_token
    })

    // Map issue to Jira format with full remediation data
    // Pass screenshots directly so they can be linked in the description
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
        screenshots // Pass Cloudinary URLs directly
      },
      projectKeyToUse,
      issueTypeToUse
    )

    // Double-check for existing mapping right before creating (prevent race condition)
    const finalCheck = await queryOne(
      `SELECT jira_ticket_key FROM jira_ticket_mappings WHERE issue_id = $1 LIMIT 1`,
      [issueId]
    )
    
    if (finalCheck) {
      // Another request created a ticket between our check and now
      console.log(`⚠️ Race condition detected: mapping found for issue ${issueId} -> ${finalCheck.jira_ticket_key}, verifying...`)
      try {
        const tempClient = new JiraClient({
          jiraUrl: integration.jira_url,
          email: integration.jira_email,
          encryptedApiToken: integration.encrypted_api_token
        })
        const existingTicket = await tempClient.getIssue(finalCheck.jira_ticket_key)
        console.log(`✅ Found existing ticket ${finalCheck.jira_ticket_key}, returning it instead of creating duplicate`)
        return NextResponse.json({
          success: true,
          ticket: {
            key: finalCheck.jira_ticket_key,
            id: existingTicket.id,
            url: client.getTicketUrl(finalCheck.jira_ticket_key)
          },
          existing: true,
          message: 'Issue already has a Jira ticket (created by another request)'
        })
      } catch (verifyError) {
        // Ticket doesn't exist, delete stale mapping and continue
        console.log(`❌ Stale mapping found, deleting and continuing...`)
        await query(`DELETE FROM jira_ticket_mappings WHERE issue_id = $1`, [issueId])
      }
    }

    // Create ticket in Jira
    let createdTicket
    try {
      console.log(`Creating Jira ticket for issue ${issueId}`)
      createdTicket = await client.createIssue(jiraIssue)
      console.log(`✅ Successfully created Jira ticket: ${createdTicket.key}`)
    } catch (error) {
      // Update issue with error
      const errorMessage = error instanceof Error ? error.message : 'Failed to create Jira ticket'
      await query(
        `UPDATE issues SET jira_sync_error = $1 WHERE id = $2`,
        [errorMessage, issueId]
      )

      return NextResponse.json(
        {
          success: false,
          error: errorMessage
        },
        { status: 400 } // Return 400 if it's a validation error from Jira
      )
    }

    // Build ticket URL
    const ticketUrl = client.getTicketUrl(createdTicket.key)

    // Store mapping in database FIRST (before screenshots) so we have a record even if screenshots fail
    // Use ON CONFLICT to handle race conditions - if another request created a ticket, update instead of failing
    try {
      console.log(`Storing Jira mapping for issue ${issueId} -> ticket ${createdTicket.key}`)
      
      // Check one more time if a mapping was created by another request
      const lastCheck = await queryOne(
        `SELECT jira_ticket_key FROM jira_ticket_mappings WHERE issue_id = $1 LIMIT 1`,
        [issueId]
      )
      
      if (lastCheck && lastCheck.jira_ticket_key !== createdTicket.key) {
        // Another request created a different ticket - this is a race condition
        // Delete the ticket we just created and return the existing one
        console.log(`⚠️ Race condition: Another ticket ${lastCheck.jira_ticket_key} was created, deleting our ticket ${createdTicket.key}`)
        try {
          // Try to delete the ticket we just created (optional - Jira might not allow this)
          // For now, just return the existing mapping
          const existingMapping = await queryOne(
            `SELECT * FROM jira_ticket_mappings WHERE issue_id = $1 LIMIT 1`,
            [issueId]
          )
          if (existingMapping) {
            return NextResponse.json({
              success: true,
              ticket: {
                key: existingMapping.jira_ticket_key,
                id: existingMapping.jira_ticket_id,
                url: existingMapping.jira_url
              },
              existing: true,
              message: 'Issue already has a Jira ticket (created by another request)'
            })
          }
        } catch (cleanupError) {
          console.error('Error during race condition cleanup:', cleanupError)
        }
      }
      
      // Delete any existing mappings for this issue_id first (prevent duplicates)
      // The constraint allows multiple tickets per issue, but we only want one
      await query(
        `DELETE FROM jira_ticket_mappings WHERE issue_id = $1`,
        [issueId]
      )
      
      // Insert new mapping
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
      console.log(`✅ Successfully stored mapping for issue ${issueId}`)
    } catch (dbError) {
      // Log but don't fail - ticket is already created in Jira
      console.error(`❌ Failed to store Jira mapping in database for issue ${issueId}:`, dbError)
    }

    // Screenshots are now linked directly in the description via Cloudinary URLs
    // No need to upload as attachments - the links are already in the description
    console.log(`Screenshots are linked directly in description via Cloudinary URLs`)

    // Always return success if ticket was created, even if screenshots failed
    console.log(`✅ Returning success for Jira ticket creation: ${createdTicket.key}`)
    return NextResponse.json({
      success: true,
      ticket: {
        key: createdTicket.key,
        id: createdTicket.id,
        url: ticketUrl
      },
      existing: false
    })
  } catch (error) {
    console.error('Error creating Jira ticket:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Jira ticket'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/jira/tickets/check/:issueId
 * Check if issue already has a Jira ticket
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request)
    const { searchParams } = new URL(request.url)
    const issueId = searchParams.get('issueId')

    if (!issueId) {
      return NextResponse.json(
        {
          success: false,
          error: 'issueId query parameter is required'
        },
        { status: 400 }
      )
    }

    // Check if issue has a Jira ticket
    const mapping = await queryOne(
      `SELECT jtm.jira_ticket_key, jtm.jira_url, i.jira_synced
      FROM jira_ticket_mappings jtm
      JOIN issues i ON jtm.issue_id = i.id
      WHERE jtm.issue_id = $1
      LIMIT 1`,
      [issueId]
    )

    if (mapping) {
      return NextResponse.json({
        success: true,
        hasTicket: true,
        ticketKey: mapping.jira_ticket_key,
        ticketUrl: mapping.jira_url
      })
    }

    return NextResponse.json({
      success: true,
      hasTicket: false
    })
  } catch (error) {
    console.error('Error checking Jira ticket:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check Jira ticket'
      },
      { status: 500 }
    )
  }
}

