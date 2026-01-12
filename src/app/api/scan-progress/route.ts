import { NextRequest } from 'next/server'
import { ScanService, ScanOptions } from '@/lib/scan-service'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query, queryMany } from '@/lib/database'
import { NotificationService } from '@/lib/notification-service'
import { ScanStateService } from '@/lib/scan-state-service'

// Generate a unique issue ID based on rule, element, and URL
function generateIssueId(ruleName: string, elementSelector: string, url: string): string {
  const crypto = require('crypto')
  const content = `${ruleName}|${elementSelector || ''}|${url}`
  return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16)
}

// Auto-create backlog items for unique issues (with scan history ID)
async function autoCreateBacklogItemsWithHistoryId(userId: string, scanResults: any[], scanHistoryId: string) {
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
          const lastSeen = new Date(existingItem.updated_at || existingItem.created_at)
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
              status: 'reopened'
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

        // Insert new issue using the provided scan history ID
        const newItem = await queryOne(`
          INSERT INTO issues (
            issue_key, rule_id, rule_name, description, impact, wcag_level,
            total_occurrences, affected_pages, notes,
            status, priority, rank, story_points, remaining_points,
            first_seen_scan_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
          RETURNING *
        `, [
          issueId,
          issue.id, // rule_id
          issue.id, 
          issue.description, 
          issue.impact, 
          issue.tags?.find((tag: string) => tag.startsWith('wcag')) || 'AA',
          issue.nodes?.length || 1, 
          [result.url], 
          issue.nodes?.[0]?.failureSummary || '', 
          'open', 
          'medium', 
          nextRank, 
          1, 
          1, 
          scanHistoryId, 
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

  => sum + (result.issues?.length || 0), 0),
    added: addedItems.length,
    reopened: reopenedItems.length,
    skipped: skippedItems.length
  })
}

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

        // Insert new issue
        const newItem = await queryOne(`
          INSERT INTO issues (
            rule_name, description, impact, wcag_level,
            total_occurrences, affected_pages, notes,
            status, priority, rank, story_points, remaining_points,
            first_seen_scan_id, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
          RETURNING *
        `, [
          issue.id, 
          issue.description, 
          issue.impact, 
          issue.tags?.find((tag: string) => tag.startsWith('wcag')) || 'AA',
          issue.nodes?.length || 1, 
          [resultUrl], 
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

  => sum + (result.issues?.length || 0), 0),
    added: addedItems.length,
    reopened: reopenedItems.length,
    skipped: skippedItems.length
  })
}

/**
 * Deduplicate issues across multiple pages to avoid counting the same issue multiple times
 */
function deduplicateIssuesAcrossPages(results: any[]): any[] {
  const issueMap = new Map<string, any>()
  
  for (const result of results) {
    if (!result.issues) continue
    
    for (const issue of result.issues) {
      // Create a unique key based on issue ID and FULL element selector path
      // This ensures same rule on different elements = different issues
      // But same rule on same element across pages = same issue (grouped)
      const elementSelector = issue.nodes?.[0]?.target?.join(' > ') || issue.nodes?.[0]?.target?.[0] || 'unknown'
      const key = `${issue.id}_${elementSelector}`
      
      if (issueMap.has(key)) {
        // Merge with existing issue - combine node counts and pages
        const existingIssue = issueMap.get(key)
        existingIssue.nodes = [...(existingIssue.nodes || []), ...(issue.nodes || [])]
        existingIssue.occurrences = (existingIssue.occurrences || 1) + 1
        existingIssue.affectedPages = (existingIssue.affectedPages || 1) + 1
        
        // Clean up description - remove any existing "(Found on X pages)" text to avoid duplicates
        if (existingIssue.description) {
          existingIssue.description = existingIssue.description.replace(/\s*\(Found on \d+ pages?\)/g, '').trim()
        }
      } else {
        // New issue - add to map
        // Clean up description - remove any existing "(Found on X pages)" text
        const cleanDescription = issue.description 
          ? issue.description.replace(/\s*\(Found on \d+ pages?\)/g, '').trim()
          : issue.description
        
        issueMap.set(key, {
          ...issue,
          description: cleanDescription,
          occurrences: 1,
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
  
  => sum + (r.issues?.length || 0), 0)} total issues → ${Array.from(issueMap.values()).length} unique issues`)
  
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
      return new Response(JSON.stringify({ error: authError.message }), {
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
    
    // Debug log
    
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
    
    // Get user's current credit information
    let creditData = await queryOne(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [user.userId]
    )

    // If user doesn't have credit data, create it with 3 free credits
    if (!creditData) {
      // Debug log
      await query(
        `INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, 3, 0, false]
      )
      
      // Get the newly created credit data
      creditData = await queryOne(
        'SELECT * FROM user_credits WHERE user_id = $1',
        [user.userId]
      )
    }
    
    // Check if user has unlimited credits
    if (creditData.unlimited_credits) {
      // Unlimited user, log the scan but don't deduct credits
      try {
        await query(
          `INSERT INTO credit_transactions (user_id, transaction_type, amount, description)
           VALUES ($1, $2, $3, $4)`,
          [user.userId, 'usage', 0, `Web scan: ${url}`]
        )
      } catch (error) {
        // If amount column doesn't exist, try with credits_amount column
        if (error.message.includes('amount')) {

          await query(
            `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
             VALUES ($1, $2, $3, $4)`,
            [user.userId, 'usage', 0, `Web scan: ${url}`]
          )
        } else {
          throw error
        }
      }
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
      
      // Start transaction to deduct credit and log usage
      await query('BEGIN')
      
      try {
        // Deduct 1 credit for the scan
        await query(
          `UPDATE user_credits 
           SET credits_remaining = credits_remaining - 1, 
               credits_used = credits_used + 1,
               updated_at = NOW()
           WHERE user_id = $1`,
          [user.userId]
        )
        
        // Log the scan transaction
        await query(
          `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
           VALUES ($1, $2, $3, $4)`,
          [user.userId, 'usage', -1, `Web scan: ${url}`]
        )
        
        await query('COMMIT')
        
        const newCredits = creditData.credits_remaining - 1
        
        // Create notification for low credits if remaining credits are low
        if (newCredits <= 1 && newCredits > 0) {
          await NotificationService.notifyLowCredits(user.userId, newCredits)
        }
      } catch (error) {
        await query('ROLLBACK')
        throw error
      }
    }

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        
         // Helper function to send progress updates
         const sendProgress = async (progress: any) => {
           const data = `data: ${JSON.stringify(progress)}\n\n`
           controller.enqueue(encoder.encode(data))
           
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
                selectedTags: selectedTags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice', 'section508'] // Comprehensive WCAG compliance
              }
              
              try {

                // Initialize browser if not already done
                if (!scanService.browser) {

                  await scanService.initializeBrowser()
                }
                
                // Scan the specific page directly

                const pageResult = await scanService.scanPage(pageUrl, selectedTags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice', 'section508'])

                // Ensure the result has a url property for backlog creation
                const resultWithUrl = {
                  ...pageResult,
                  url: pageResult.url || pageUrl
                }
                
                results.push(resultWithUrl)
                
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

            // Process results for remediation report
            for (const result of results) {
              if (result.issues && result.issues.length > 0) {
                for (const issue of result.issues) {
                  if (issue.suggestions && issue.suggestions.length > 0) {
                    const report = {
                      issueId: issue.id,
                      ruleName: issue.description || issue.id,
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
            
            await sendProgress({
              type: 'complete',
              message: `Scan completed successfully! Scanned ${results.length} pages.`,
              currentPage: results.length,
              totalPages: pagesToScan.length,
              status: 'complete',
              results: finalResults
            })

            // Clean up browser
            if (scanService.browser) {
              await scanService.browser.close()
              scanService.browser = null
            }

             // Mark scan as completed in database (with error handling)
             try {
               await ScanStateService.markCompleted(scanId, finalResults)
             } catch (error) {
               console.error('Failed to mark scan as completed:', error)
             }

             // Store scan results in history (with error handling)
             let scanHistoryId: string | null = null
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

             } catch (error) {
               console.error('Failed to store scan results in history:', error)
             }

            // Auto-create backlog items for unique issues (AFTER scan history is stored)
            if (scanHistoryId) {
              try {

                await autoCreateBacklogItemsWithHistoryId(user.userId, finalResults.results, scanHistoryId)
                
                // TEMPORARILY DISABLED: Auto-sync to Jira - let user manually sync from backlog
                // if (issueIds.length > 0) {
                //   //   const syncResult = await autoSyncIssuesToJira(user.userId, issueIds)
                //   // }
              } catch (error) {
                console.error('❌ Error auto-creating backlog items:', error)
                if (error instanceof Error) {
                  console.error('Error message:', error.message)
                  console.error('Error stack:', error.stack)
                }
              }
            } else {
              console.error('❌ Cannot create backlog items - no scan history ID')
            }

             // Close the stream
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
               await ScanStateService.markFailed(scanId, error.message || error.toString())
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