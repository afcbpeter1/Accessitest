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

    const { issueId, teamId } = body

    if (!issueId) {
      return NextResponse.json(
        {
          success: false,
          error: 'issueId is required'
        },
        { status: 400 }
      )
    }

    const issueIdRaw = String(issueId)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(issueIdRaw)
    const isIssueKeyLike =
      /^[0-9a-f]{16}$/i.test(issueIdRaw) ||
      issueIdRaw.startsWith('issue_') ||
      issueIdRaw.startsWith('iso_compliance_issue_')
    let issueUuid = issueIdRaw
    if (!isUuid) {
      if (isIssueKeyLike) {
        const resolved = await queryOne(`SELECT id FROM issues WHERE issue_key = $1 LIMIT 1`, [issueIdRaw])
        if (!resolved?.id) {
          return NextResponse.json(
            { success: false, error: `No issue found for issue_key "${issueIdRaw}".` },
            { status: 404 }
          )
        }
        issueUuid = resolved.id
      } else {
        return NextResponse.json(
          { success: false, error: `issueId must be a UUID (issues.id) or an issue_key. Received: "${issueIdRaw}"` },
          { status: 400 }
        )
      }
    }

    // Get issue context (team/organization)
    let issueContext = await getIssueContext(issueUuid)
    
    // If teamId is provided, update the issue's team_id first
    if (teamId) {
      // Verify user has permission to assign issues to this team
      const team = await queryOne(
        `SELECT t.organization_id, om.role
         FROM teams t
         INNER JOIN organization_members om ON t.organization_id = om.organization_id
         WHERE t.id = $1 AND om.user_id = $2 AND om.is_active = true`,
        [teamId, user.userId]
      )
      
      if (team) {
        // Update issue with team_id and organization_id
        await query(
          `UPDATE issues 
           SET team_id = $1, organization_id = $2 
           WHERE id = $3`,
          [teamId, team.organization_id, issueUuid]
        )
        // Update context for this request
        issueContext = {
          teamId: teamId,
          organizationId: team.organization_id
        }
      }
    } else if (!issueContext?.teamId) {
      // If no teamId provided and issue doesn't have one, use user's team
      // Prioritize teams that have a Jira project assigned (like Azure DevOps)
      const userTeam = await queryOne(
        `SELECT om.team_id, om.organization_id, t.jira_project_key
         FROM organization_members om
         INNER JOIN teams t ON om.team_id = t.id
         WHERE om.user_id = $1 AND om.is_active = true AND om.team_id IS NOT NULL
         ORDER BY 
           CASE WHEN t.jira_project_key IS NOT NULL AND t.jira_project_key != '' THEN 0 ELSE 1 END,
           om.joined_at DESC
         LIMIT 1`,
        [user.userId]
      )
      
      if (userTeam?.team_id) {
        // Update issue with user's team
        await query(
          `UPDATE issues 
           SET team_id = $1, organization_id = $2 
           WHERE id = $3`,
          [userTeam.team_id, userTeam.organization_id, issueUuid]
        )
        // Update context for this request
        issueContext = {
          teamId: userTeam.team_id,
          organizationId: userTeam.organization_id
        }
        console.log(`✅ Assigned issue ${issueId} to user's team ${userTeam.team_id} for Jira ticket creation`)
      }
    }
    
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
          error: "Your team hasn't connected Jira yet. Ask your admin to set it up in Organisation settings."
        },
        { status: 404 }
      )
    }

    // Decide which project/issueType we should use for THIS request
    // (team settings override integration defaults)
    let projectKeyToUse = integration.project_key
    let issueTypeToUse = integration.issue_type
    if (issueContext?.teamId) {
      const team = await queryOne(
        `SELECT jira_project_key, jira_issue_type FROM teams WHERE id = $1`,
        [issueContext.teamId]
      )
      if (team?.jira_project_key) {
        projectKeyToUse = team.jira_project_key
        console.log(`✅ Using team's Jira project: ${team.jira_project_key} for team ${issueContext.teamId}`)
      }
      if (team?.jira_issue_type) {
        issueTypeToUse = team.jira_issue_type
      }
    }

    // Check if issue already has a Jira ticket (duplication prevention)
    // Also verify the ticket still exists in Jira
    let existingMapping = await queryOne(
      `SELECT jtm.*, i.jira_ticket_key 
      FROM jira_ticket_mappings jtm
      JOIN issues i ON jtm.issue_id = i.id
      WHERE jtm.issue_id = $1
      LIMIT 1`,
      [issueUuid]
    )

    if (existingMapping) {
      // If the existing ticket is in a different Jira project than the team we are creating for,
      // do not treat it as "already synced" — create a new ticket in the correct project.
      if (projectKeyToUse && existingMapping.jira_ticket_key && typeof existingMapping.jira_ticket_key === 'string') {
        const prefix = `${String(projectKeyToUse).trim()}-`
        if (prefix !== '-' && !existingMapping.jira_ticket_key.startsWith(prefix)) {
          existingMapping = null
        }
      }
    }

    if (existingMapping) {
      // Verify the ticket still exists in Jira before returning it

      try {
        const tempClient = new JiraClient({
          jiraUrl: integration.jira_url,
          email: integration.jira_email,
          encryptedApiToken: integration.encrypted_api_token
        })
        const existingTicket = await tempClient.getIssue(existingMapping.jira_ticket_key)
        
        // Ticket exists, return it (don't create duplicate)

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
        const errorMsg = verifyError instanceof Error ? verifyError.message : 'Unknown error'

        // If we can't decrypt the token, do NOT delete mappings; user must reconnect integration / fix key.
        if (/Failed to decrypt token/i.test(errorMsg)) {
          return NextResponse.json(
            {
              success: false,
              error: errorMsg
            },
            { status: 400 }
          )
        }

        // Ticket doesn't exist in Jira anymore (deleted or not found)
        // Delete the stale mapping and continue to create a new one
        console.log(`Ticket verification failed: ${errorMsg}, deleting stale mapping and creating new ticket`)
        
        try {
          await query(
            `DELETE FROM jira_ticket_mappings WHERE issue_id = $1`,
            [issueUuid]
          )
          await query(
            `UPDATE issues SET jira_synced = false, jira_ticket_key = NULL WHERE id = $1`,
            [issueUuid]
          )

        } catch (deleteError) {
          console.error(`Failed to delete stale mapping:`, deleteError)
          // Continue anyway - we'll try to create a new ticket
        }
        // Continue to create a new ticket below
      }
    } else {

    }

    // Get issue details with scan results for full remediation data (LEFT JOIN so we still get the issue if scan is missing)
    const issue = await queryOne(
      `SELECT 
        i.id, i.issue_key, i.rule_id, i.rule_name, i.description, i.impact, i.wcag_level, i.standard_tags,
        i.priority, i.total_occurrences, i.affected_pages, i.help_url, i.help_text, i.notes,
        sh.scan_results, sh.scan_type, sh.file_name, sh.url as scan_url
      FROM issues i
      LEFT JOIN scan_history sh ON i.first_seen_scan_id = sh.id
      WHERE i.id = $1`,
      [issueUuid]
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

    const affectedPages: string[] = (() => {
      const raw = (issue as any).affected_pages
      if (Array.isArray(raw)) return raw.filter((p: any) => typeof p === 'string')
      if (typeof raw === 'string') {
        try {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed)) return parsed.filter((p: any) => typeof p === 'string')
        } catch {
          // ignore parse errors and fall back to empty
        }
      }
      return []
    })()

    // Check if this is a document scan
    const isDocumentScan = issue.scan_type === 'document' || 
                          issue.file_name !== null ||
                          (affectedPages.length > 0 && affectedPages.some((p: string) => p.startsWith('Document:')))

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
      if (affectedPages.length > 0) {
        offendingElements = affectedPages.map((page: string, index: number) => ({
          html: issue.description || '',
          target: [issue.rule_name || ''],
          failureSummary: issue.description || '',
          impact: issue.impact || 'moderate',
          url: page,
          pageNumber: index + 1
        }))
      }
    } else {
      // For web scans, extract from remediationReport when present,
      // but ALWAYS fall back to raw scan_results.results so every rule can be ticketed with full detail.
      let scanResults: any = issue.scan_results
      if (typeof scanResults === 'string') {
        try { scanResults = JSON.parse(scanResults) } catch { scanResults = null }
      }

      if (scanResults?.remediationReport) {
        // Try multiple matching strategies to find the remediation item
        remediationItem = issue.scan_results.remediationReport.find((r: any) => 
          r.ruleName === issue.rule_name || 
          r.ruleName === issue.rule_id ||
          r.issueId === issue.rule_name ||
          r.issueId === issue.rule_id
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
        }
      }

      // Fallback: Extract from scan_results.results even when remediationReport is missing.
      if (offendingElements.length === 0 && scanResults?.results) {
        for (const result of scanResults.results) {
          if (!result?.issues) continue
          for (const scanIssue of result.issues) {
            const ruleMatches = scanIssue.id === issue.rule_name || 
                               scanIssue.id === issue.rule_id ||
                               scanIssue.ruleId === issue.rule_name ||
                               scanIssue.ruleId === issue.rule_id
            const descMatches = scanIssue.description && issue.description &&
                               (scanIssue.description.toLowerCase().trim() === issue.description.toLowerCase().trim() ||
                                scanIssue.description.toLowerCase().includes(issue.description.toLowerCase().substring(0, 20)) ||
                                issue.description.toLowerCase().includes(scanIssue.description.toLowerCase().substring(0, 20)))
            if (!ruleMatches && !descMatches) continue

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

            if (suggestions.length === 0 && scanIssue.suggestions && scanIssue.suggestions.length > 0) {
              suggestions = scanIssue.suggestions.map((s: any) => ({
                type: 'fix',
                description: s.description || s.text || s.whatWillBeFixed || '',
                codeExample: s.codeExample || s.code || '',
                priority: s.priority || 'medium'
              }))
            }

            if (offendingElements.length > 0 || suggestions.length > 0) break
          }
          if (offendingElements.length > 0 || suggestions.length > 0) break
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

      // Get screenshots from scan results (web scans only)
      const scanScreenshots =
        scanResults?.results?.[0]?.screenshots ||
        scanResults?.[0]?.screenshots ||
        null
      if (scanScreenshots) {
        const ruleId = String(issue.rule_name || issue.rule_id || '').trim()
        const els = Array.isArray(scanScreenshots?.elements) ? scanScreenshots.elements : []
        screenshots = {
          ...scanScreenshots,
          elements: ruleId ? els.filter((e: any) => e && e.issueId === ruleId) : els
        }
      }
    }

    // Create Jira client
    let client: JiraClient
    try {
      client = new JiraClient({
        jiraUrl: integration.jira_url,
        email: integration.jira_email,
        encryptedApiToken: integration.encrypted_api_token
      })
    } catch (clientError) {
      const msg = clientError instanceof Error ? clientError.message : 'Failed to create Jira client'
      if (/Failed to decrypt token/i.test(msg)) {
        return NextResponse.json({ success: false, error: msg }, { status: 400 })
      }
      throw clientError
    }

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
        affected_pages: affectedPages,
        help_url: issue.help_url,
        help_text: issue.help_text,
        notes: issue.notes,
        issue_key: issue.issue_key,
        offendingElements,
        suggestions,
        screenshots // Pass Cloudinary URLs directly
      },
      projectKeyToUse || 'PROJ',
      issueTypeToUse || 'Bug'
    )

    // Double-check for existing mapping right before creating (prevent race condition)
    const finalCheck = await queryOne(
      `SELECT jira_ticket_key FROM jira_ticket_mappings WHERE issue_id = $1 LIMIT 1`,
      [issueUuid]
    )
    
    if (finalCheck) {
      // Another request created a ticket between our check and now

      try {
        const tempClient = new JiraClient({
          jiraUrl: integration.jira_url,
          email: integration.jira_email,
          encryptedApiToken: integration.encrypted_api_token
        })
        const existingTicket = await tempClient.getIssue(finalCheck.jira_ticket_key)

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

        await query(`DELETE FROM jira_ticket_mappings WHERE issue_id = $1`, [issueUuid])
      }
    }

    // Create ticket in Jira
    let createdTicket
    try {

      createdTicket = await client.createIssue(jiraIssue)

    } catch (error) {
      // Update issue with error
      const errorMessage = error instanceof Error ? error.message : 'Failed to create Jira ticket'
      await query(
        `UPDATE issues SET jira_sync_error = $1 WHERE id = $2`,
        [errorMessage, issueUuid]
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

      // Check one more time if a mapping was created by another request
      const lastCheck = await queryOne(
        `SELECT jira_ticket_key FROM jira_ticket_mappings WHERE issue_id = $1 LIMIT 1`,
        [issueUuid]
      )
      
      if (lastCheck && lastCheck.jira_ticket_key !== createdTicket.key) {
        // Another request created a different ticket - this is a race condition
        // Delete the ticket we just created and return the existing one

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
        [issueUuid]
      )
      
      // Insert new mapping
      await query(
        `INSERT INTO jira_ticket_mappings 
        (issue_id, jira_ticket_key, jira_ticket_id, jira_url)
        VALUES ($1, $2, $3, $4)`,
        [issueUuid, createdTicket.key, createdTicket.id, ticketUrl]
      )

      // Update issue flags
      await query(
        `UPDATE issues 
        SET jira_synced = true, jira_ticket_key = $1, jira_sync_error = NULL 
        WHERE id = $2`,
        [createdTicket.key, issueUuid]
      )

    } catch (dbError) {
      // Log but don't fail - ticket is already created in Jira
      console.error(`❌ Failed to store Jira mapping in database for issue ${issueId}:`, dbError)
    }

    // Screenshots are now linked directly in the description via Cloudinary URLs
    // No need to upload as attachments - the links are already in the description

    // Always return success if ticket was created, even if screenshots failed

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

    const issueIdRaw = String(issueId)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(issueIdRaw)
    const isIssueKeyLike =
      /^[0-9a-f]{16}$/i.test(issueIdRaw) ||
      issueIdRaw.startsWith('issue_') ||
      issueIdRaw.startsWith('iso_compliance_issue_')
    let issueUuid = issueIdRaw
    if (!isUuid && isIssueKeyLike) {
      const resolved = await queryOne(`SELECT id FROM issues WHERE issue_key = $1 LIMIT 1`, [issueIdRaw])
      if (resolved?.id) issueUuid = resolved.id
    }

    // Check if issue has a Jira ticket
    const mapping = await queryOne(
      `SELECT jtm.jira_ticket_key, jtm.jira_url, i.jira_synced
      FROM jira_ticket_mappings jtm
      JOIN issues i ON jtm.issue_id = i.id
      WHERE jtm.issue_id = $1
      LIMIT 1`,
      [issueUuid]
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

