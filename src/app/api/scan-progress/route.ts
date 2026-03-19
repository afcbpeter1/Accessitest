import { NextRequest } from 'next/server'
import { ScanService, ScanOptions } from '@/lib/scan-service'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import { NotificationService } from '@/lib/notification-service'
import { ScanStateService } from '@/lib/scan-state-service'
import { getUserCredits, deductCredits } from '@/lib/credit-service'
import { generateIssueId, autoCreateBacklogItemsWithHistoryId } from '@/lib/backlog-from-scan'
import {
  getLearnedSuggestion,
  logPipelineSuggestion,
  computePatternHash,
  computeSuggestionSignature
} from '@/lib/learned-suggestions-service'
import { AccessibilityScanner } from '@/lib/accessibility-scanner'
import { getStandardTagsFromAxeTags } from '@/lib/standard-tags'
import { ClaudeAPI } from '@/lib/claude-api'
import { ensureRuleLevelLearnedSuggestionAtScanTime, isNoOpOrInvalidCodeExample } from '@/lib/runtime-learned-suggestion'

// Auto-create backlog items for unique issues (legacy function)
async function autoCreateBacklogItems(userId: string, scanResults: any[], scanId: string, scanType: string) {
  const addedItems = []
  const reopenedItems = []
  const skippedItems = []

  for (const result of scanResults) {
    if (!result.issues) continue
    
    for (const issue of result.issues) {
      try {
        // Generate unique issue ID based on rule, element, and URL
        const issueId = generateIssueId(issue.id, issue.nodes?.[0]?.target?.[0], result.url)
        const domain = new URL(result.url).hostname

        // Check if this exact issue already exists for this domain
        const existingItem = await queryOne(`
          SELECT i.id, i.status, i.created_at, i.updated_at 
          FROM issues i
          JOIN scan_history sh ON i.first_seen_scan_id = sh.id
          WHERE sh.user_id = $1 AND i.rule_name = $2 AND sh.url LIKE $3
        `, [userId, issue.id, `%${domain}%`])

        if (existingItem) {
          // Update last_scan_at and check if we should reopen
          const now = new Date()
          const lastSeen = new Date(existingItem.last_scan_at)
          const daysSinceLastSeen = Math.floor((now.getTime() - lastSeen.getTime()) / (1000 * 60 * 60 * 24))

          // If issue was closed/done and it's been more than 7 days, reopen it
          if ((existingItem.status === 'done' || existingItem.status === 'cancelled') && daysSinceLastSeen > 7) {
            await query(`
              UPDATE issues 
              SET status = 'backlog', 
                  updated_at = NOW(),
                  rank = (
                    SELECT COALESCE(MAX(rank), 0) + 1 
                    FROM issues 
                    WHERE first_seen_scan_id IN (
                      SELECT id FROM scan_history WHERE user_id = $1
                    )
                  )
              WHERE id = $2
            `, [userId, existingItem.id])

            reopenedItems.push({
              id: existingItem.id,
              issueId: issueId,
              ruleName: issue.id,
              impact: issue.impact,
              reason: `Reopened after ${daysSinceLastSeen} days (was ${existingItem.status})`
            })
          } else {
            // Just update last seen time
            await query(`
              UPDATE issues 
              SET updated_at = NOW()
              WHERE id = $1
            `, [existingItem.id])

            skippedItems.push({
              issueId: issueId,
              ruleName: issue.id,
              reason: `Already exists (status: ${existingItem.status})`
            })
          }
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

        // Get the scan history ID for this scan
        const scanHistory = await queryOne(`
          SELECT id FROM scan_history 
          WHERE user_id = $1 AND scan_type = $2 AND url = $3
          ORDER BY created_at DESC 
          LIMIT 1
        `, [userId, scanType, result.url])

        if (!scanHistory) {
          console.error(`No scan history found for user ${userId}, scan ${scanId}`)
          continue
        }

        const standardTags = getStandardTagsFromAxeTags(issue.tags)
        // Insert new issue
        const newItem = await queryOne(`
          INSERT INTO issues (
            rule_name, description, impact, wcag_level, standard_tags,
            total_occurrences, affected_pages, notes,
            status, priority, rank, story_points, remaining_points,
            first_seen_scan_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          RETURNING *
        `, [
          issue.id,
          issue.description,
          issue.impact,
          issue.tags?.find((tag: string) => tag.startsWith('wcag')) || 'AA',
          standardTags.length > 0 ? standardTags : null,
          issue.nodes?.length || 1,
          [result.url],
          issue.nodes?.[0]?.failureSummary || '',
          'backlog',
          'medium',
          nextRank,
          1,
          1,
          scanHistory.id,
          new Date().toISOString(),
          new Date().toISOString()
        ])

        addedItems.push({
          id: newItem.id,
          issueId: issueId,
          ruleName: issue.id,
          impact: issue.impact
        })
      } catch (error) {
        console.error(`Error processing issue ${issue.id}:`, error)
        skippedItems.push({
          issueId: issue.id,
          ruleName: issue.id,
          reason: 'Error processing issue'
        })
      }
    }
  }

  console.log('✅ Backlog auto-creation result:', {
    total: scanResults.reduce((sum, result) => sum + (result.issues?.length || 0), 0),
    added: addedItems.length,
    reopened: reopenedItems.length,
    skipped: skippedItems.length
  })
}

// Extended rule IDs: group by (id + normalized description) so duplicates merge into one issue with multiple nodes
const EXTENDED_RULE_IDS = new Set([
  'alt-text-quality', 'content-readability', 'error-message-clarity', 'keyboard-focus-visible',
  'modal-focus-escape', 'modal-keyboard-trap', 'keyboard-tabindex-order', 'aria-hidden-content',
  'aria-role-strips-semantics', 'landmark-wrong-role', 'landmark-multiple-no-name',
  'form-structure', 'ad-container-accessibility'
])

function normalizedDescriptionForExtendedRule(id: string, description: string): string {
  if (!description) return id
  // Same description text → same key (e.g. all "Alt text is very short (5 chars): \"Image\"" merge)
  if (id === 'content-readability') {
    // Normalize so "Paragraph may be hard to read (estimated grade level 12.9)" and "12.7" become one group
    return description.replace(/\s*\(estimated grade level [0-9.]+\)/gi, ' (estimated grade level)').trim()
  }
  return description.trim()
}

/**
 * Deduplicate issues across multiple pages to avoid counting the same issue multiple times.
 * Axe issues: key by rule id + selector (same element across pages = one issue).
 * Extended checks: key by rule id + normalized description (same rule + same finding type = one issue with many nodes).
 */
function deduplicateIssuesAcrossPages(results: any[]): any[] {
  const issueMap = new Map<string, any>()
  
  for (const result of results) {
    if (!result.issues) continue
    
    for (const issue of result.issues) {
      const isExtended = EXTENDED_RULE_IDS.has(issue.id)
      const key = isExtended
        ? `${issue.id}__${normalizedDescriptionForExtendedRule(issue.id, issue.description || '')}`
        : `${issue.id}_${issue.nodes?.[0]?.target?.join('_') || 'unknown'}`
      
      if (issueMap.has(key)) {
        // Merge with existing issue - combine nodes
        const existingIssue = issueMap.get(key)
        existingIssue.nodes = [...(existingIssue.nodes || []), ...(issue.nodes || [])]
        existingIssue.occurrences = existingIssue.nodes.length
        existingIssue.affectedPages = (existingIssue.affectedPages || 1) + (result.url ? 1 : 0)
        
        if (existingIssue.description) {
          existingIssue.description = existingIssue.description.replace(/\s*\(Found on \d+ pages?\)/g, '').trim()
        }
      } else {
        const cleanDescription = issue.description 
          ? issue.description.replace(/\s*\(Found on \d+ pages?\)/g, '').trim()
          : issue.description
        
        issueMap.set(key, {
          ...issue,
          description: cleanDescription,
          occurrences: issue.nodes?.length || 1,
          affectedPages: 1
        })
      }
    }
  }
  
  // Convert back to array and update summaries
  const deduplicatedResults = results.map(result => {
    const deduplicatedIssues = Array.from(issueMap.values()).filter(issue => 
      issue.nodes?.some((node: any) => 
        result.issues?.some((originalIssue: any) => 
          originalIssue.id === issue.id && 
          originalIssue.nodes?.some((originalNode: any) => 
            JSON.stringify(originalNode.target) === JSON.stringify(node.target)
          )
        )
      )
    )
    
    // Recalculate summary for this page
    const summary = {
      total: deduplicatedIssues.length,
      critical: deduplicatedIssues.filter((issue: any) => issue.impact === 'critical').length,
      serious: deduplicatedIssues.filter((issue: any) => issue.impact === 'serious').length,
      moderate: deduplicatedIssues.filter((issue: any) => issue.impact === 'moderate').length,
      minor: deduplicatedIssues.filter((issue: any) => issue.impact === 'minor').length,
      passes: result.summary?.passes || 0,
      incomplete: result.summary?.incomplete || 0,
      inapplicable: result.summary?.inapplicable || 0
    }
    
    return {
      ...result,
      issues: deduplicatedIssues,
      summary
    }
  })
  
  console.log(`🔄 Issue deduplication: ${results.reduce((sum, r) => sum + (r.issues?.length || 0), 0)} total issues → ${Array.from(issueMap.values()).length} unique issues`)
  
  return deduplicatedResults
}

export async function POST(request: NextRequest) {
  try {
    // Require authentication
    let user
    try {
      user = await getAuthenticatedUser(request)
    } catch (authError) {
      console.error('Authentication error:', authError)
      const errorMessage = authError instanceof Error ? authError.message : 'Authentication required'
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    const { url, pagesToScan, includeSubdomains, scanType, wcagLevel, selectedTags } = await request.json()

    if (!url || !pagesToScan || pagesToScan.length === 0) {
      return new Response(JSON.stringify({ error: 'URL and pages to scan are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Check and deduct credits before starting scan
    const scanId = `web_scan_${Date.now()}`
    
    console.log('Processing scan for user:', user.userId) // Debug log
    
    // Register the scan in the database (with error handling)
    try {
      await ScanStateService.registerScan(
        scanId,
        user.userId,
        'web',
        url,
        undefined,
        pagesToScan.length
      )
    } catch (error) {
      console.error('Failed to register scan in database:', error)
      // Continue with scan even if registration fails
    }
    
    // Get user's current credit information using credit service (handles organization-primary model)
    const creditData = await getUserCredits(user.userId)
    
    // Check if user has unlimited credits
    if (creditData.unlimited_credits) {
      // Unlimited user - no page limit; deductCredits will log but not deduct
      await deductCredits(user.userId, 0, `Web scan: ${url}`)
    } else {
      // Check if user has enough credits
      if (creditData.credits_remaining < 1) {
        // Create notification for insufficient credits
        await NotificationService.notifyInsufficientCredits(user.userId)
        
        return new Response(JSON.stringify({ error: 'Insufficient credits', canScan: false }), {
          status: 402,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // Deduct credits using credit service (handles organization-primary model and transactions)
      const result = await deductCredits(user.userId, 1, `Web scan: ${url}`)
      
      if (!result.success) {
        return new Response(JSON.stringify({ error: result.error || 'Failed to deduct credits', canScan: false }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        })
      }
      
      // Create notification for low credits if remaining credits are low
      if (result.credits_remaining <= 1 && result.credits_remaining > 0) {
        await NotificationService.notifyLowCredits(user.userId, result.credits_remaining)
      }
    }

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        
         // Helper function to send progress updates
         const sendProgress = async (progress: any) => {
           try {
             // Check if controller is still open before sending
             if (controller.desiredSize === null) {
               // Controller is closed, skip sending
               return
             }
           const data = `data: ${JSON.stringify(progress)}\n\n`
           controller.enqueue(encoder.encode(data))
           } catch (error: any) {
             // Silently ignore errors if controller is closed
             if (error?.code !== 'ERR_INVALID_STATE') {
               console.error('Error sending progress:', error)
             }
           }
           
           // Update scan state in database (with error handling)
           try {
             await ScanStateService.updateProgress(scanId, progress)
           } catch (error) {
             console.error('Failed to update scan progress:', error)
             // Continue with scan even if progress update fails
           }
         }

        // Initialize the scan service
        const scanService = new ScanService()
        
        // Start scanning process
        const startScanning = async () => {
          try {
            // Send initial progress
            sendProgress({
              type: 'start',
              message: 'Starting accessibility scan...',
              currentPage: 0,
              totalPages: pagesToScan.length,
              status: 'scanning'
            })

            const results: any[] = []
            let remediationReport: any[] = []
            let totalIssues = 0

            // Scan each selected page individually
            for (let i = 0; i < pagesToScan.length; i++) {
              const pageUrl = pagesToScan[i]
              
              // Send progress for current page
              sendProgress({
                type: 'page_start',
                message: `Scanning ${pageUrl}...`,
                currentPage: i + 1,
                totalPages: pagesToScan.length,
                currentUrl: pageUrl,
                status: 'scanning'
              })
              
              // Create scan options for this specific page
              const pageScanOptions: ScanOptions = {
                url: pageUrl,
                includeSubdomains: includeSubdomains ?? true,
                deepCrawl: false,
                maxPages: 1,
                scanType: 'full',
                selectedTags: selectedTags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice', 'section508', 'EN-301-549']
              }
              
              try {
                console.log(`🔍 Starting scan for ${pageUrl}`)
                
                // Initialize browser if not already done
                console.log('🌐 Initializing browser...')
                await scanService.initializeBrowser()
                
                // Scan the specific page directly
                console.log(`🧪 Scanning page with tags: ${selectedTags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice', 'section508', 'EN-301-549']}`)
                const pageResult = await scanService.scanPage(pageUrl, selectedTags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice', 'section508', 'EN-301-549'], { skipAiSuggestions: true })
                
                console.log(`✅ Scan completed for ${pageUrl}:`, {
                  issues: pageResult.issues?.length || 0,
                  summary: pageResult.summary
                })
                
                results.push(pageResult)
                
                // Send page completion
                sendProgress({
                  type: 'page_complete',
                  message: `Completed scanning ${pageUrl}`,
                  currentPage: i + 1,
                  totalPages: pagesToScan.length,
                  currentUrl: pageUrl,
                  status: 'analyzing'
                })
                
              } catch (error) {
                console.error(`Failed to scan ${pageUrl}:`, error)
                sendProgress({
                  type: 'page_error',
                  message: `Failed to scan ${pageUrl}: ${error}`,
                  currentPage: i + 1,
                  totalPages: pagesToScan.length,
                  currentUrl: pageUrl,
                  status: 'error'
                })
              }
            }

            // Enrich with learned suggestions (same as pipeline) and log for cron to update daily
            const scanner = new AccessibilityScanner()
            const claude = new ClaudeAPI()
            const inflightRuleLearns = new Map<string, Promise<any>>()
            for (const result of results) {
              if (result.issues && result.issues.length > 0) {
                for (const issue of result.issues) {
                  const html = issue.nodes?.[0]?.html ?? ''
                  const patternHash = computePatternHash(issue.id, html)
                  const learned = await getLearnedSuggestion(issue.id, patternHash)
                  const priority = (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : issue.impact === 'moderate' ? 'medium' : 'low') as 'high' | 'medium' | 'low'

                  const ruleBased = scanner.getRuleBasedSuggestion(issue)
                  const firstRule = ruleBased.length > 0 ? ruleBased[0] : null

                  // If learned is missing/invalid, learn immediately (one-time per rule) and persist.
                  const learnedInvalid = learned ? isNoOpOrInvalidCodeExample(issue.id, learned.codeExample) : false
                  if (!learned || learnedInvalid) {
                    const key = issue.id
                    let p = inflightRuleLearns.get(key)
                    if (!p) {
                      p = (async () => {
                        if (!firstRule) return null
                        return ensureRuleLevelLearnedSuggestionAtScanTime({
                          claude,
                          ruleId: key,
                          currentDescription: firstRule.description,
                          currentCodeExample: firstRule.codeExample
                        })
                      })()
                      inflightRuleLearns.set(key, p)
                    }

                    const ensured = await p
                    if (ensured?.codeExample) {
                      ;(issue as any).suggestions = [{
                        type: 'fix',
                        description: ensured.description,
                        codeExample: ensured.codeExample ?? undefined,
                        priority
                      }]
                    } else if (ruleBased.length > 0) {
                      ;(issue as any).suggestions = ruleBased
                    }
                  } else {
                    const codeExample = learned.codeExample ?? (firstRule && firstRule.codeExample) ?? undefined
                    ;(issue as any).suggestions = [{
                      type: 'fix',
                      description: learned.description,
                      codeExample,
                      priority
                    }]
                  }

                  const sugg = (issue as any).suggestions?.[0]
                  await logPipelineSuggestion(issue.id, patternHash, computeSuggestionSignature(sugg?.description, sugg?.codeExample)).catch(() => {})
                }
              }
            }

            // Process results for remediation report
            for (const result of results) {
              if (result.issues && result.issues.length > 0) {
                for (const issue of result.issues) {
                  if (issue.suggestions && issue.suggestions.length > 0) {
                    const report = {
                      issueId: issue.id,
                      ruleName: issue.id,
                      description: issue.description || 'Accessibility issue detected',
                      impact: issue.impact || 'moderate',
                      wcag22Level: 'A',
                      help: issue.help || 'Please review and fix this accessibility issue',
                      helpUrl: issue.helpUrl || 'https://www.w3.org/WAI/WCAG21/quickref/',
                      totalOccurrences: issue.nodes?.length || 1,
                      affectedUrls: [result.url],
                      offendingElements: issue.nodes?.map((node: any) => ({
                        html: node.html || `<${node.target?.[0] || 'element'}>`,
                        target: node.target || [],
                        failureSummary: node.failureSummary || issue.description,
                        impact: issue.impact || 'moderate',
                        url: result.url,
                        screenshot: node.screenshot,
                        boundingBox: node.boundingBox
                      })) || [],
                      suggestions: issue.suggestions.map((suggestion: any) => ({
                        type: 'fix',
                        description: suggestion.description || suggestion.text || 'AI-generated accessibility fix',
                        codeExample: suggestion.codeExample || suggestion.code || '',
                        priority: suggestion.priority || 'medium'
                      })),
                      priority: issue.priority || 'medium',
                      screenshots: result.screenshots || null
                    }
                    remediationReport.push(report)
                  }
                }
              }
            }

            // Deduplicate issues across all pages
            const deduplicatedResults = deduplicateIssuesAcrossPages(results)
            
            // Calculate compliance summary from deduplicated results
            const complianceSummary = {
              totalIssues: deduplicatedResults.reduce((sum, r) => sum + (r.summary?.total || 0), 0),
              criticalIssues: deduplicatedResults.reduce((sum, r) => sum + (r.summary?.critical || 0), 0),
              seriousIssues: deduplicatedResults.reduce((sum, r) => sum + (r.summary?.serious || 0), 0),
              moderateIssues: deduplicatedResults.reduce((sum, r) => sum + (r.summary?.moderate || 0), 0),
              minorIssues: deduplicatedResults.reduce((sum, r) => sum + (r.summary?.minor || 0), 0)
            }

            // Send final results
            const finalResults = {
              url,
              pagesScanned: results.length,
              results: deduplicatedResults,
              complianceSummary,
              remediationReport
            }

            let scanHistoryId: string | null = null
            try {
              await ScanStateService.markCompleted(scanId, finalResults)
            } catch (error) {
              console.error('Failed to mark scan as completed:', error)
            }
            try {
              const { ScanHistoryService } = await import('@/lib/scan-history-service')
              scanHistoryId = await ScanHistoryService.storeScanResult(user.userId, 'web', {
                scanTitle: `Web Scan: ${url}`,
                url: url,
                scanResults: finalResults,
                complianceSummary: complianceSummary,
                remediationReport: remediationReport,
                totalIssues: complianceSummary.totalIssues,
                criticalIssues: complianceSummary.criticalIssues,
                seriousIssues: complianceSummary.seriousIssues,
                moderateIssues: complianceSummary.moderateIssues,
                minorIssues: complianceSummary.minorIssues,
                pagesScanned: results.length,
                scanSettings: {
                  pagesToScan: pagesToScan,
                  includeSubdomains: includeSubdomains,
                  wcagLevel: wcagLevel,
                  selectedTags: selectedTags
                }
              })
              console.log('✅ Scan results stored in history with ID:', scanHistoryId)
            } catch (error) {
              console.error('Failed to store scan results in history:', error)
            }
            if (scanHistoryId) {
              try {
                console.log('🎫 Auto-creating backlog items for unique issues...')
                await autoCreateBacklogItemsWithHistoryId(user.userId, finalResults.results, scanHistoryId)
                try {
                  const { addScanResultsToProductBacklog } = await import('@/lib/product-backlog-from-scan')
                  await addScanResultsToProductBacklog(user.userId, finalResults.results)
                } catch (productBacklogErr) {
                  console.error('❌ Error adding web scan to product backlog:', productBacklogErr)
                }
                try {
                  const { autoSyncIssuesToJira, getIssueIdsFromScan } = await import('@/lib/jira-sync-service')
                  const issueIds = await getIssueIdsFromScan(scanHistoryId)
                  if (issueIds.length > 0) {
                    console.log(`🔗 Auto-syncing ${issueIds.length} issues to Jira...`)
                    const syncResult = await autoSyncIssuesToJira(user.userId, issueIds)
                    console.log(`✅ Jira sync complete: ${syncResult.created} created, ${syncResult.skipped} skipped, ${syncResult.errors} errors`)
                  }
                } catch (jiraError) {
                  console.error('❌ Error auto-syncing to Jira:', jiraError)
                }
              } catch (error) {
                console.error('❌ Error auto-creating backlog items:', error)
              }
            }

            const origin = process.env.NEXTAUTH_URL?.replace(/\/$/, '') || ''
            const reportUrl = scanHistoryId ? `${origin}/scan-history/${scanHistoryId}` : null

            await sendProgress({
              type: 'complete',
              message: `Scan completed successfully! Scanned ${results.length} pages.`,
              currentPage: results.length,
              totalPages: pagesToScan.length,
              status: 'complete',
              results: finalResults,
              scanId,
              scanHistoryId: scanHistoryId ?? undefined,
              reportUrl: reportUrl ?? undefined
            })
            controller.close()

           } catch (error) {
             console.error('Scan error:', error)
             await sendProgress({
               type: 'error',
               message: `Scan failed: ${error}`,
               status: 'error'
             })
             
             // Mark scan as failed in database (with error handling)
             try {
               const errorMessage = error instanceof Error ? error.message : String(error)
               await ScanStateService.markFailed(scanId, errorMessage)
             } catch (dbError) {
               console.error('Failed to mark scan as failed:', dbError)
             }
             
             controller.close()
           }
        }

        // Start the scanning process
        startScanning()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Cache-Control'
      }
    })

  } catch (error) {
    console.error('Scan progress API error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}