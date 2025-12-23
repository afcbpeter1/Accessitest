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

    // Get issue context (team/organization)
    const issueContext = await getIssueContext(issueId)
    
    // Get the appropriate Azure DevOps integration (team > org > personal)
    const integration = await getAzureDevOpsIntegration(
      user.userId,
      issueContext?.teamId,
      issueContext?.organizationId
    )

    if (!integration) {
      return NextResponse.json(
        {
          success: false,
          error: 'Azure DevOps integration not configured. Please set up Azure DevOps in settings first.'
        },
        { status: 404 }
      )
    }

    // Check if issue already has an Azure DevOps work item (duplication prevention)
    const existingMapping = await queryOne(
      `SELECT work_item_id, work_item_url 
      FROM azure_devops_work_item_mappings 
      WHERE issue_id = $1 
      LIMIT 1`,
      [issueId]
    )

    if (existingMapping) {
      // Verify the work item still exists in Azure DevOps before returning it
      console.log(`Found existing mapping for issue ${issueId} -> work item ${existingMapping.work_item_id}, verifying it exists...`)
      try {
        const tempClient = new AzureDevOpsClient({
          organization: integration.organization,
          encryptedPat: integration.encrypted_pat
        })
        const existingWorkItem = await tempClient.getWorkItem(integration.project, existingMapping.work_item_id)
        
        // Work item exists, return it (don't create duplicate)
        console.log(`✅ Work item ${existingMapping.work_item_id} exists in Azure DevOps, returning existing mapping`)
        return NextResponse.json({
          success: true,
          workItem: {
            id: existingMapping.work_item_id,
            url: existingMapping.work_item_url
          },
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
            [issueId]
          )
          await query(
            `UPDATE issues SET azure_devops_synced = false, azure_devops_work_item_id = NULL WHERE id = $1`,
            [issueId]
          )
          console.log(`✅ Deleted stale mapping for issue ${issueId}, will create new work item`)
        } catch (deleteError) {
          console.error(`Failed to delete stale mapping:`, deleteError)
          // Continue anyway - we'll try to create a new work item
        }
        // Continue to create a new work item below
      }
    } else {
      console.log(`No existing mapping found for issue ${issueId}, will create new work item`)
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

    // Extract remediation data from scan_results (same logic as sync service)
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

    // Create Azure DevOps client
    const client = new AzureDevOpsClient({
      organization: integration.organization,
      encryptedPat: integration.encrypted_pat
    })

    // Map issue to Azure DevOps format
    const issueData = {
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
      integration.work_item_type || 'Bug',
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
      [issueId]
    )
    
    if (finalCheck) {
      // Another request created a work item between our check and now
      console.log(`⚠️ Race condition detected: mapping found for issue ${issueId} -> ${finalCheck.work_item_id}, verifying...`)
      try {
        const tempClient = new AzureDevOpsClient({
          organization: integration.organization,
          encryptedPat: integration.encrypted_pat
        })
        const existingWorkItem = await tempClient.getWorkItem(integration.project, finalCheck.work_item_id)
        const workItemUrl = client.getWorkItemUrl(integration.project, finalCheck.work_item_id)
        console.log(`✅ Found existing work item ${finalCheck.work_item_id}, returning it instead of creating duplicate`)
        return NextResponse.json({
          success: true,
          workItem: {
            id: finalCheck.work_item_id,
            url: workItemUrl
          },
          existing: true,
          message: 'Issue already has an Azure DevOps work item (created by another request)'
        })
      } catch (verifyError) {
        // Work item doesn't exist, delete stale mapping and continue
        console.log(`❌ Stale mapping found, deleting and continuing...`)
        await query(`DELETE FROM azure_devops_work_item_mappings WHERE issue_id = $1`, [issueId])
      }
    }

    // Create work item in Azure DevOps
    let createdWorkItem
    try {
      console.log(`Creating Azure DevOps work item for issue ${issueId}`)
      createdWorkItem = await client.createWorkItem(
        integration.project,
        integration.work_item_type || 'Bug',
        patches
      )
      console.log(`✅ Successfully created Azure DevOps work item: ${createdWorkItem.id}`)
    } catch (error) {
      // Update issue with error
      const errorMessage = error instanceof Error ? error.message : 'Failed to create Azure DevOps work item'
      await query(
        `UPDATE issues SET azure_devops_sync_error = $1 WHERE id = $2`,
        [errorMessage, issueId]
      )

      return NextResponse.json(
        {
          success: false,
          error: errorMessage
        },
        { status: 400 }
      )
    }

    // Build work item URL
    const workItemUrl = client.getWorkItemUrl(integration.project, createdWorkItem.id)

    // Store mapping in database FIRST (before screenshots) so we have a record even if screenshots fail
    try {
      console.log(`Storing Azure DevOps mapping for issue ${issueId} -> work item ${createdWorkItem.id}`)
      
      // Check one more time if a mapping was created by another request
      const lastCheck = await queryOne(
        `SELECT work_item_id FROM azure_devops_work_item_mappings WHERE issue_id = $1 LIMIT 1`,
        [issueId]
      )
      
      if (lastCheck && lastCheck.work_item_id !== createdWorkItem.id) {
        // Another request created a different work item - this is a race condition
        console.log(`⚠️ Race condition: Another work item ${lastCheck.work_item_id} was created, returning existing one`)
        const existingMapping = await queryOne(
          `SELECT * FROM azure_devops_work_item_mappings WHERE issue_id = $1 LIMIT 1`,
          [issueId]
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
        [issueId]
      )
      
      // Insert new mapping
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
      console.log(`✅ Successfully stored mapping for issue ${issueId}`)
    } catch (dbError) {
      // Log but don't fail - work item is already created in Azure DevOps
      console.error(`❌ Failed to store Azure DevOps mapping in database for issue ${issueId}:`, dbError)
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

    // Check if issue has an Azure DevOps work item
    const mapping = await queryOne(
      `SELECT awm.work_item_id, awm.work_item_url, i.azure_devops_synced
      FROM azure_devops_work_item_mappings awm
      JOIN issues i ON awm.issue_id = i.id
      WHERE awm.issue_id = $1
      LIMIT 1`,
      [issueId]
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

