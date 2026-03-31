import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { query, queryOne } from '@/lib/database'
import { AzureDevOpsClient } from '@/lib/azure-devops-client'
import { mapIssueToAzureDevOps } from '@/lib/azure-devops-mapping-service'
import { getAzureDevOpsIntegration, getIssueContext } from '@/lib/integration-selection-service'

/**
 * POST /api/azure-devops/work-items
 * Create Azure DevOps work item from issue (with duplication prevention)
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

    // Prefer the current user's assigned team (Members tab) for which ADO backlog to use, so tickets go to the right team's backlog
    const userAssignedTeam = await queryOne(
      `SELECT om.team_id, om.organization_id
       FROM organization_members om
       INNER JOIN teams t ON om.team_id = t.id
       WHERE om.user_id = $1 AND om.is_active = true AND om.team_id IS NOT NULL
       LIMIT 1`,
      [user.userId]
    )
    const userTeamId = userAssignedTeam?.team_id
    const userOrgId = userAssignedTeam?.organization_id

    // If user has an assigned team with ADO, use it for integration + project + work item type; otherwise use issue context
    let contextTeamId: string | undefined = userTeamId
    let contextOrgId: string | undefined = userOrgId
    if (!userTeamId) {
      const issueContext = await getIssueContext(issueUuid)
      contextTeamId = issueContext?.teamId
      contextOrgId = issueContext?.organizationId
    } else {
      const issueContext = await getIssueContext(issueUuid)
      if (!issueContext?.teamId) {
        await query(
          `UPDATE issues SET team_id = $1, organization_id = $2 WHERE id = $3`,
          [userTeamId, userOrgId, issueUuid]
        )
      }
    }

    // Get the appropriate Azure DevOps integration using the context we chose (user's team or issue's team)
    const integration = await getAzureDevOpsIntegration(
      user.userId,
      contextTeamId,
      contextOrgId
    )

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: "Your team hasn't connected Azure DevOps yet. Ask your admin to set it up in Organisation settings."
        },
        { status: 404 }
      )
    }

    // Determine which project and work item type: use the context team's settings (user's assigned team so tickets go to the right backlog)
    let projectToUse = integration.project
    let workItemTypeToUse = integration.work_item_type || 'Bug'
    if (contextTeamId) {
      const team = await queryOne(
        `SELECT azure_devops_project, azure_devops_work_item_type FROM teams WHERE id = $1`,
        [contextTeamId]
      )
      if (team?.azure_devops_project) {
        projectToUse = team.azure_devops_project
        console.log(`Using team-assigned project: ${projectToUse} (team ${contextTeamId})`)
      }
      if (team?.azure_devops_work_item_type) {
        workItemTypeToUse = team.azure_devops_work_item_type
        console.log(`Using team-assigned work item type: ${workItemTypeToUse} (team ${contextTeamId})`)
      }
    }

    // Check if issue already has an Azure DevOps work item (duplication prevention)
    const existingMapping = await queryOne(
      `SELECT work_item_id, work_item_url 
      FROM azure_devops_work_item_mappings 
      WHERE issue_id = $1 
      LIMIT 1`,
      [issueUuid]
    )

    if (existingMapping) {
      // Verify the work item still exists in Azure DevOps before returning it
      console.log(`Found existing mapping for issue ${issueUuid} -> work item ${existingMapping.work_item_id}, verifying it exists...`)
      try {
        const tempClient = new AzureDevOpsClient({
          organization: integration.organization,
          encryptedPat: integration.encrypted_pat
        })
        // Use team project if available, otherwise use integration project
        const projectForCheck = contextTeamId
          ? (await queryOne(`SELECT azure_devops_project FROM teams WHERE id = $1`, [contextTeamId]))?.azure_devops_project || integration.project
          : integration.project
        const existingWorkItem = await tempClient.getWorkItem(projectForCheck, existingMapping.work_item_id)
        
        // Work item exists, return it (don't create duplicate)
        console.log(`✅ Work item ${existingMapping.work_item_id} exists in Azure DevOps, returning existing mapping`)
        return NextResponse.json({
          success: true,
          workItem: {
            id: existingMapping.work_item_id,
            url: existingMapping.work_item_url
          },
          project: projectForCheck,
          workItemType: workItemTypeToUse,
          existing: true,
          message: 'Issue already has an Azure DevOps work item'
        })
      } catch (verifyError) {
        // Work item doesn't exist in Azure DevOps anymore (deleted or not found)
        // Delete the stale mapping and continue to create a new one
        const errorMsg = verifyError instanceof Error ? verifyError.message : 'Unknown error'
        console.log(`❌ Work item ${existingMapping.work_item_id} not found in Azure DevOps (${errorMsg}), deleting stale mapping and creating new work item`)
        
        try {
          await query(
            `DELETE FROM azure_devops_work_item_mappings WHERE issue_id = $1`,
            [issueUuid]
          )
          await query(
            `UPDATE issues SET azure_devops_synced = false, azure_devops_work_item_id = NULL WHERE id = $1`,
            [issueUuid]
          )
          console.log(`✅ Deleted stale mapping for issue ${issueUuid}, will create new work item`)
        } catch (deleteError) {
          console.error(`Failed to delete stale mapping:`, deleteError)
          // Continue anyway - we'll try to create a new work item
        }
        // Continue to create a new work item below
      }
    } else {
      console.log(`No existing mapping found for issue ${issueUuid}, will create new work item`)
    }

    // Get issue details with scan results for full remediation data (LEFT JOIN so we still get the issue if scan is missing/deleted)
    const issue = await queryOne(
      `SELECT 
        i.id, i.issue_key, i.rule_id, i.rule_name, i.description, i.impact, i.wcag_level, i.standard_tags,
        i.priority, i.total_occurrences, i.affected_pages, i.help_url, i.help_text, i.notes,
        sh.scan_results, sh.remediation_report, sh.scan_type, sh.file_name, sh.url as scan_url
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

    // Extract remediation data from scan_results (same logic as sync service)
    let remediationItem = null
    let offendingElements: any[] = []
    let suggestions: any[] = []
    let screenshots: any = null

    const normalizeRuleId = (v: unknown) =>
      String(v ?? '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')

    const buildContrastDetails = (node: any): string => {
      const anyData = Array.isArray(node?.any) ? node.any : []
      const allData = Array.isArray(node?.all) ? node.all : []
      const candidates = [...anyData, ...allData]
      for (const c of candidates) {
        const d = c?.data
        if (!d || typeof d !== 'object') continue
        // axe color-contrast commonly provides: fgColor, bgColor, contrastRatio, expectedContrastRatio, fontSize, fontWeight
        const contrastRatio = (d as any).contrastRatio
        const expected = (d as any).expectedContrastRatio
        const fg = (d as any).fgColor
        const bg = (d as any).bgColor
        const fontSize = (d as any).fontSize
        const fontWeight = (d as any).fontWeight
        if (contrastRatio || expected || fg || bg) {
          const parts: string[] = []
          if (contrastRatio !== undefined) parts.push(`Contrast ratio: ${contrastRatio}`)
          if (expected !== undefined) parts.push(`Required: ${expected}`)
          if (fg) parts.push(`Foreground: ${fg}`)
          if (bg) parts.push(`Background: ${bg}`)
          if (fontSize) parts.push(`Font size: ${fontSize}`)
          if (fontWeight) parts.push(`Font weight: ${fontWeight}`)
          return parts.length ? `\n\n${parts.join(' | ')}` : ''
        }
      }
      return ''
    }

    const buildNodeFailureSummary = (node: any, scanIssue: any): string => {
      const base = node?.failureSummary || scanIssue?.description || issue.description || ''
      const ruleId = normalizeRuleId(scanIssue?.id || scanIssue?.ruleId || issue.rule_name || issue.rule_id)
      if (ruleId.includes('color-contrast')) {
        return `${base}${buildContrastDetails(node)}`
      }
      return base
    }

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
      // For web scans, extract from remediationReport (in scan_results or separate remediation_report column)
      let scanResults = issue.scan_results
      if (typeof scanResults === 'string') {
        try { scanResults = JSON.parse(scanResults) } catch { scanResults = null }
      }
      let remediationReportRaw = scanResults?.remediationReport ?? issue.remediation_report ?? null
      if (typeof remediationReportRaw === 'string') {
        try { remediationReportRaw = JSON.parse(remediationReportRaw) } catch { remediationReportRaw = null }
      }
      const remediationReport = Array.isArray(remediationReportRaw) ? remediationReportRaw : null
      if (remediationReport && remediationReport.length > 0) {
        remediationItem = remediationReport.find((r: any) =>
          r.ruleName === issue.rule_name ||
          r.ruleName === issue.rule_id ||
          r.issueId === issue.rule_name ||
          r.issueId === issue.rule_id
        )

        if (!remediationItem && issue.description) {
          remediationItem = remediationReport.find((r: any) =>
            r.description && r.description.toLowerCase().trim() === issue.description.toLowerCase().trim()
          )
        }

        if (!remediationItem && issue.description) {
          const descWords = issue.description.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
          remediationItem = remediationReport.find((r: any) =>
            r.description && descWords.some((word: string) => r.description.toLowerCase().includes(word))
          )
        }

        if (remediationItem) {
          offendingElements = remediationItem.offendingElements || []
          suggestions = remediationItem.suggestions || []
        }
      }

      // Always fallback to raw scan results when we don't have offending elements yet.
      // Many issues (e.g. landmark-unique) won't be present in remediationReport because remediationReport
      // is typically built only for issues with AI suggestions.
      if (offendingElements.length === 0) {
        if (scanResults?.results) {
          for (const result of scanResults.results) {
            if (result.issues) {
              for (const scanIssue of result.issues) {
                const scanRule = normalizeRuleId(scanIssue.id || scanIssue.ruleId)
                const issueRuleName = normalizeRuleId(issue.rule_name)
                const issueRuleId = normalizeRuleId(issue.rule_id)
                // Match so we get nodes for all axe rules: exact id, or stored rule contains axe id (e.g. "wcag2aa-region" vs "region"), or vice versa
                const ruleMatches =
                  !scanRule ? false
                  : (scanRule === issueRuleName || scanRule === issueRuleId)
                  || (issueRuleName && issueRuleName.includes(scanRule))
                  || (issueRuleId && issueRuleId.includes(scanRule))
                  || (issueRuleName && scanRule.includes(issueRuleName))
                  || (issueRuleId && scanRule.includes(issueRuleId))
                  || (scanRule.includes('contrast') && (issueRuleName?.includes('contrast') || issueRuleId?.includes('contrast')))
                const descMatches = scanIssue.description && issue.description &&
                                   (scanIssue.description.toLowerCase().trim() === issue.description.toLowerCase().trim() ||
                                    scanIssue.description.toLowerCase().includes(issue.description.toLowerCase().substring(0, 20)) ||
                                    issue.description.toLowerCase().includes(scanIssue.description.toLowerCase().substring(0, 20)))

                if (ruleMatches || descMatches) {
                  if (scanIssue.nodes && scanIssue.nodes.length > 0) {
                    offendingElements = scanIssue.nodes.map((node: any) => ({
                      html: node.html || `<${node.target?.[0] || 'element'}>`,
                      target: node.target || [],
                      failureSummary: buildNodeFailureSummary(node, scanIssue),
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

                  if (offendingElements.length > 0 || suggestions.length > 0) {
                    break
                  }
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

      // Get screenshots from scan results (web scans only)
      if (scanResults?.results?.[0]?.screenshots) {
        screenshots = scanResults.results[0].screenshots
      }
    }

    // Create Azure DevOps client
    let client: AzureDevOpsClient
    try {
      client = new AzureDevOpsClient({
        organization: integration.organization,
        encryptedPat: integration.encrypted_pat
      })
    } catch (clientError) {
      const msg = clientError instanceof Error ? clientError.message : 'Failed to create Azure DevOps client'
      if (/Failed to decrypt token/i.test(msg)) {
        return NextResponse.json({ success: false, error: msg }, { status: 400 })
      }
      throw clientError
    }

    // Map issue to Azure DevOps format
    const issueData = {
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
      screenshots
    }
    
    console.log('📋 Issue data for mapping:', {
      hasDescription: !!issueData.description,
      hasOffendingElements: issueData.offendingElements?.length > 0,
      hasSuggestions: issueData.suggestions?.length > 0,
      hasScreenshots: !!issueData.screenshots,
      ruleName: issueData.rule_name,
      description: issueData.description?.substring(0, 100)
    })
    
    const patches = mapIssueToAzureDevOps(
      issueData,
      workItemTypeToUse,
      integration.area_path,
      integration.iteration_path
    )
    
    console.log(`🔵 Generated ${patches.length} patches for Azure DevOps work item:`, patches.map(p => ({
      path: p.path,
      valueLength: typeof p.value === 'string' ? p.value.length : 'non-string',
      valuePreview: typeof p.value === 'string' ? p.value.substring(0, 100) : p.value
    })))

    // Double-check for existing mapping right before creating (prevent race condition)
    const finalCheck = await queryOne(
      `SELECT work_item_id FROM azure_devops_work_item_mappings WHERE issue_id = $1 LIMIT 1`,
      [issueUuid]
    )
    
    if (finalCheck) {
      // Another request created a work item between our check and now
      console.log(`⚠️ Race condition detected: mapping found for issue ${issueUuid} -> ${finalCheck.work_item_id}, verifying...`)
      try {
        const tempClient = new AzureDevOpsClient({
          organization: integration.organization,
          encryptedPat: integration.encrypted_pat
        })
        const existingWorkItem = await tempClient.getWorkItem(projectToUse, finalCheck.work_item_id)
        const workItemUrl = client.getWorkItemUrl(projectToUse, finalCheck.work_item_id)
        console.log(`✅ Found existing work item ${finalCheck.work_item_id}, returning it instead of creating duplicate`)
        return NextResponse.json({
          success: true,
          workItem: {
            id: finalCheck.work_item_id,
            url: workItemUrl
          },
          project: projectToUse,
          workItemType: workItemTypeToUse,
          existing: true,
          message: 'Issue already has an Azure DevOps work item (created by another request)'
        })
      } catch (verifyError) {
        // Work item doesn't exist, delete stale mapping and continue
        console.log(`❌ Stale mapping found, deleting and continuing...`)
        await query(`DELETE FROM azure_devops_work_item_mappings WHERE issue_id = $1`, [issueUuid])
      }
    }

      // Create work item in Azure DevOps (with fallback if project doesn't have configured type, e.g. Basic process uses "Issue" not "Bug")
      let createdWorkItem
      const isWorkItemTypeNotFound = (e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e)
        return /Work item type .* does not exist|WorkItemTypeNotFoundException/i.test(msg)
      }
      try {
        console.log(`Creating Azure DevOps work item for issue ${issueId} (type: ${workItemTypeToUse})`)
        createdWorkItem = await client.createWorkItem(
          projectToUse,
          workItemTypeToUse,
          patches
        )
        console.log(`✅ Successfully created Azure DevOps work item: ${createdWorkItem.id}`)
      } catch (firstError) {
        if (!isWorkItemTypeNotFound(firstError)) {
          const errorMessage = firstError instanceof Error ? firstError.message : 'Failed to create Azure DevOps work item'
          await query(
            `UPDATE issues SET azure_devops_sync_error = $1 WHERE id = $2`,
            [errorMessage, issueId]
          )
          return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 400 }
          )
        }
        // Configured type (e.g. Bug) doesn't exist in this project (e.g. Basic process has Issue/Task)
        console.log(`Work item type "${workItemTypeToUse}" not found in project, fetching available types and retrying with fallback...`)
        const availableTypes = await client.getWorkItemTypesForProject(projectToUse)
        const preferredOrder = ['Issue', 'Task', 'Bug', 'User Story', 'Story']
        const fallbackType = preferredOrder.find(name =>
          availableTypes.some(w => w.name.toLowerCase() === name.toLowerCase())
        ) || availableTypes[0]?.name
        if (!fallbackType) {
          const errorMessage = `Work item type "${workItemTypeToUse}" doesn't exist in this project. Ask your admin to set the correct type (e.g. "Issue" for Basic process) in Organisation → Integrations → Azure DevOps.`
          await query(
            `UPDATE issues SET azure_devops_sync_error = $1 WHERE id = $2`,
            [errorMessage, issueId]
          )
          return NextResponse.json(
            { success: false, error: errorMessage },
            { status: 400 }
          )
        }
        const fallbackPatches = mapIssueToAzureDevOps(
          issueData,
          fallbackType,
          integration.area_path,
          integration.iteration_path
        )
        try {
          createdWorkItem = await client.createWorkItem(
            projectToUse,
            fallbackType,
            fallbackPatches
          )
          console.log(`✅ Created Azure DevOps work item with fallback type "${fallbackType}": ${createdWorkItem.id}`)
        } catch (retryError) {
          const errorMessage = retryError instanceof Error ? retryError.message : 'Failed to create Azure DevOps work item'
          await query(
            `UPDATE issues SET azure_devops_sync_error = $1 WHERE id = $2`,
            [errorMessage, issueUuid]
          )
          return NextResponse.json(
            {
              success: false,
              error: `Work item type "${workItemTypeToUse}" isn't available in this project. Try setting the type in Organisation → Integrations → Azure DevOps (e.g. "Issue" for Basic process). ${errorMessage}`
            },
            { status: 400 }
          )
        }
      }

    // Build work item URL
    const workItemUrl = client.getWorkItemUrl(projectToUse, createdWorkItem.id)

    // Store mapping in database FIRST (before screenshots) so we have a record even if screenshots fail
    try {
      console.log(`Storing Azure DevOps mapping for issue ${issueUuid} -> work item ${createdWorkItem.id}`)
      
      // Check one more time if a mapping was created by another request
      const lastCheck = await queryOne(
        `SELECT work_item_id FROM azure_devops_work_item_mappings WHERE issue_id = $1 LIMIT 1`,
        [issueUuid]
      )
      
      if (lastCheck && lastCheck.work_item_id !== createdWorkItem.id) {
        // Another request created a different work item - this is a race condition
        console.log(`⚠️ Race condition: Another work item ${lastCheck.work_item_id} was created, returning existing one`)
        const existingMapping = await queryOne(
          `SELECT * FROM azure_devops_work_item_mappings WHERE issue_id = $1 LIMIT 1`,
          [issueUuid]
        )
        if (existingMapping) {
          return NextResponse.json({
            success: true,
            workItem: {
              id: existingMapping.work_item_id,
              url: existingMapping.work_item_url
            },
            existing: true,
            message: 'Issue already has an Azure DevOps work item (created by another request)'
          })
        }
      }
      
      // Delete any existing mappings for this issue_id first (prevent duplicates)
      await query(
        `DELETE FROM azure_devops_work_item_mappings WHERE issue_id = $1`,
        [issueUuid]
      )
      
      // Insert new mapping
      await query(
        `INSERT INTO azure_devops_work_item_mappings 
        (issue_id, work_item_id, work_item_url)
        VALUES ($1, $2, $3)`,
        [issueUuid, createdWorkItem.id, workItemUrl]
      )

      // Update issue flags
      await query(
        `UPDATE issues 
        SET azure_devops_synced = true, azure_devops_work_item_id = $1, azure_devops_sync_error = NULL 
        WHERE id = $2`,
        [createdWorkItem.id, issueUuid]
      )
      console.log(`✅ Successfully stored mapping for issue ${issueUuid}`)
    } catch (dbError) {
      // Log but don't fail - work item is already created in Azure DevOps
      console.error(`❌ Failed to store Azure DevOps mapping in database for issue ${issueUuid}:`, dbError)
    }

    // Screenshots are linked directly in the description via Cloudinary URLs
    // Optional: Can also upload as attachments if needed
    console.log(`Screenshots are linked directly in description via Cloudinary URLs`)

    // Always return success if work item was created, even if screenshots failed
    console.log(`✅ Returning success for Azure DevOps work item creation: ${createdWorkItem.id}`)
    return NextResponse.json({
      success: true,
      workItem: {
        id: createdWorkItem.id,
        url: workItemUrl
      },
      project: projectToUse,
      workItemType: workItemTypeToUse,
      existing: false
    })
  } catch (error) {
    console.error('Error creating Azure DevOps work item:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create Azure DevOps work item'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/azure-devops/work-items/check?issueId=XXX
 * Check if issue already has an Azure DevOps work item
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

    // Check if issue has an Azure DevOps work item
    const mapping = await queryOne(
      `SELECT awm.work_item_id, awm.work_item_url, i.azure_devops_synced
      FROM azure_devops_work_item_mappings awm
      JOIN issues i ON awm.issue_id = i.id
      WHERE awm.issue_id = $1
      LIMIT 1`,
      [issueUuid]
    )

    if (mapping) {
      return NextResponse.json({
        success: true,
        hasWorkItem: true,
        workItemId: mapping.work_item_id,
        workItemUrl: mapping.work_item_url
      })
    }

    return NextResponse.json({
      success: true,
      hasWorkItem: false
    })
  } catch (error) {
    console.error('Error checking Azure DevOps work item:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check Azure DevOps work item'
      },
      { status: 500 }
    )
  }
}

