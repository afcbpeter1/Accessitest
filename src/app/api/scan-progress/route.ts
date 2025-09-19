import { NextRequest } from 'next/server'
import { ScanService, ScanOptions } from '@/lib/scan-service'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import { NotificationService } from '@/lib/notification-service'
import { ScanStateService } from '@/lib/scan-state-service'

/**
 * Deduplicate issues across multiple pages to avoid counting the same issue multiple times
 */
function deduplicateIssuesAcrossPages(results: any[]): any[] {
  const issueMap = new Map<string, any>()
  
  for (const result of results) {
    if (!result.issues) continue
    
    for (const issue of result.issues) {
      // Create a unique key based on issue ID and selector
      const key = `${issue.id}_${issue.nodes?.[0]?.target?.join('_') || 'unknown'}`
      
      if (issueMap.has(key)) {
        // Merge with existing issue - combine node counts and pages
        const existingIssue = issueMap.get(key)
        existingIssue.nodes = [...(existingIssue.nodes || []), ...(issue.nodes || [])]
        existingIssue.occurrences = (existingIssue.occurrences || 1) + 1
        existingIssue.affectedPages = (existingIssue.affectedPages || 1) + 1
        
        // Update the description to reflect multiple occurrences
        if (existingIssue.occurrences > 1) {
          existingIssue.description = `${existingIssue.description} (Found on ${existingIssue.occurrences} pages)`
        }
      } else {
        // New issue - add to map
        issueMap.set(key, {
          ...issue,
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
    
    // Get user's current credit information
    let creditData = await queryOne(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [user.userId]
    )

    // If user doesn't have credit data, create it with 3 free credits
    if (!creditData) {
      console.log('Creating credit record for user:', user.userId) // Debug log
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
          console.log('Amount column missing, trying with credits_amount...')
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
        
        // Log the scan transaction (with fallback for missing columns)
        try {
          await query(
            `INSERT INTO credit_transactions (user_id, transaction_type, amount, description)
             VALUES ($1, $2, $3, $4)`,
            [user.userId, 'usage', -1, `Web scan: ${url}`]
          )
        } catch (error) {
          // If amount column doesn't exist, try with credits_amount column
          if (error.message.includes('amount')) {
            console.log('Amount column missing, trying with credits_amount...')
            await query(
              `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
               VALUES ($1, $2, $3, $4)`,
              [user.userId, 'usage', -1, `Web scan: ${url}`]
            )
          } else {
            throw error
          }
        }
        
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
                selectedTags: selectedTags || ['wcag22a', 'wcag22aa'] // WCAG 2.2 AA default
              }
              
              try {
                const pageResults = await scanService.startScan(pageScanOptions, (progress) => {
                  // Send real-time progress updates
                  sendProgress({
                    type: 'progress',
                    message: progress.message,
                    currentPage: i + 1,
                    totalPages: pagesToScan.length,
                    currentUrl: pageUrl,
                    status: progress.status
                  })
                })
                
                results.push(...pageResults)
                
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

             // Mark scan as completed in database (with error handling)
             try {
               await ScanStateService.markCompleted(scanId, finalResults)
             } catch (error) {
               console.error('Failed to mark scan as completed:', error)
             }

             // Store scan results in history (with error handling)
             try {
               const { ScanHistoryService } = await import('@/lib/scan-history-service')
               await ScanHistoryService.storeScanResult(user.userId, 'web', {
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
               console.log('✅ Scan results stored in history')
             } catch (error) {
               console.error('Failed to store scan results in history:', error)
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
