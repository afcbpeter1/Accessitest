import { NextRequest, NextResponse } from 'next/server'
import { ClaudeAPI } from '@/lib/claude-api'
import { ComprehensiveDocumentScanner } from '@/lib/comprehensive-document-scanner'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import { NotificationService } from '@/lib/notification-service'
import { autoAddDocumentIssuesToBacklog } from '@/lib/backlog-service'

interface DocumentScanRequest {
  fileName: string
  fileType: string
  fileSize: number
  fileContent: string // Base64 encoded file content
  selectedTags?: string[] // Optional: specific Section 508 tags to test
  scanId?: string // Optional: unique scan ID for cancellation
}

// Simple in-memory database for scan history
// In production, this would be replaced with a real database like PostgreSQL, MongoDB, etc.
// 
// DATABASE SCHEMA:
// - id: Unique scan record ID
// - scanId: Original scan identifier
// - fileName: Name of scanned document
// - fileType: Document type (PDF, Word, etc.)
// - fileSize: File size in bytes
// - scanDate: ISO timestamp of scan
// - status: 'completed', 'cancelled', 'error'
// - scanDuration: Total scan time in milliseconds
// - pagesAnalyzed: Number of pages processed
// - overallScore: Accessibility score (0-100)
// - is508Compliant: Boolean compliance status
// - scanResults: Object containing summary, issues, and metadata
//
// PRIVACY & LEGAL COMPLIANCE:
// ✅ STORED: Scan metadata, results, and accessibility issues
// ❌ NOT STORED: Actual document content, file data, or personal information
// ✅ PURPOSE: Accessibility compliance tracking and audit trails
// ✅ RETENTION: In-memory only (resets on server restart)
//
// For production use, consider:
// - Database encryption at rest
// - User authentication and authorization
// - Data retention policies
// - GDPR/CCPA compliance measures
const scanDatabase = new Map<string, any>()

// Track active scans
const activeScans = new Map<string, { cancelled: boolean }>()

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)
    
    const body: DocumentScanRequest = await request.json()
    
    console.log('🔍 Starting document scan for:', body.fileName)

    // Check and deduct credits before starting scan
    const scanId = body.scanId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Get user's current credit information
    let creditData = await queryOne(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [user.userId]
    )

    // If user doesn't have credit data, create it with 3 free credits
    if (!creditData) {
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
      await query(
        `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, 'usage', 0, `Document scan: ${body.fileName}`]
      )
    } else {
      // Check if user has enough credits
      if (creditData.credits_remaining < 1) {
        // Create notification for insufficient credits
        await NotificationService.notifyInsufficientCredits(user.userId)
        
        return NextResponse.json(
          { error: 'Insufficient credits', canScan: false },
          { status: 402 }
        )
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
        await query(
          `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
           VALUES ($1, $2, $3, $4)`,
          [user.userId, 'usage', -1, `Document scan: ${body.fileName}`]
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
    
    // Register this scan as active
    activeScans.set(scanId, { cancelled: false })
    
    // Convert base64 to buffer
    const fileBuffer = Buffer.from(body.fileContent, 'base64')
    
    // Initialize the COMPREHENSIVE document scanner with selected tags
    const scanner = new ComprehensiveDocumentScanner()
    
    // Log selected tags for debugging
    console.log(`🏷️ Selected tags received: ${JSON.stringify(body.selectedTags)}`)
    console.log(`🏷️ Selected tags type: ${Array.isArray(body.selectedTags) ? 'array' : typeof body.selectedTags}`)
    if (body.selectedTags && body.selectedTags.length > 0) {
      console.log(`🏷️ Tag details: ${body.selectedTags.map(t => `"${t}"`).join(', ')}`)
    }
    
    // Perform COMPREHENSIVE document accessibility scan with cancellation support
    const scanResult = await Promise.race([
      scanner.scanDocument(
        fileBuffer, 
        body.fileName, 
        body.fileType, 
        body.selectedTags,
        () => activeScans.get(scanId)?.cancelled || false // Cancellation check function
      ) as Promise<any>,
      // Add a cancellation check every 100ms
      new Promise<never>((_, reject) => {
        const checkInterval = setInterval(() => {
          if (activeScans.get(scanId)?.cancelled) {
            clearInterval(checkInterval)
            reject(new Error('Scan was cancelled by user'))
          }
        }, 100)
        
        // Clean up interval after 5 minutes (safety timeout)
        setTimeout(() => clearInterval(checkInterval), 300000)
      })
    ])
    
    // Check if scan was cancelled
    const scanStatus = activeScans.get(scanId)
    if (scanStatus?.cancelled) {
      activeScans.delete(scanId)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Scan was cancelled by user',
          cancelled: true
        },
        { status: 200 }
      )
    }
    
    // Check if scan was cancelled during execution
    if (scanResult instanceof Error && scanResult.message === 'Scan was cancelled by user') {
      activeScans.delete(scanId)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Scan was cancelled by user',
          cancelled: true
        },
        { status: 200 }
      )
    }
    
    console.log(`✅ Real scan completed: ${scanResult.issues.length} issues found`)
    
    // Enhance results with AI analysis if issues are found
    if (scanResult.issues.length > 0) {
      const enhancedResult = await enhanceWithAI(scanResult, body, scanId)
      
      // Check if scan was cancelled during AI enhancement
      const finalScanStatus = activeScans.get(scanId)
      if (finalScanStatus?.cancelled) {
        activeScans.delete(scanId)
        return NextResponse.json(
          { 
            success: false, 
            error: 'Scan was cancelled by user',
            cancelled: true
          },
          { status: 200 }
        )
      }
      
      // Update scan duration to include AI enhancement time
      const totalDuration = Date.now() - startTime
      enhancedResult.metadata.scanDuration = totalDuration
      
      // Save scan results to database (without document content)
      const scanRecord = {
        id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        scanId: scanId,
        fileName: body.fileName,
        fileType: body.fileType,
        fileSize: body.fileSize,
        scanDate: new Date().toISOString(),
        status: 'completed',
        scanDuration: totalDuration,
        pagesAnalyzed: enhancedResult.metadata.pagesAnalyzed,
        overallScore: enhancedResult.overallScore,
        is508Compliant: enhancedResult.is508Compliant,
        scanResults: {
          summary: enhancedResult.summary,
          issues: enhancedResult.issues, // Store ALL issues with full details
          metadata: enhancedResult.metadata
        }
      }
      
      scanDatabase.set(scanRecord.id, scanRecord)
      console.log(`💾 Scan results saved to database: ${scanRecord.id}`)
      
      // Clean up scan record
      activeScans.delete(scanId)
      
      // Initialize backlogResult outside try block so it's available in return statement
      let backlogResult = null
      
      // Store scan results in history (with error handling)
      try {
        const { ScanHistoryService } = await import('@/lib/scan-history-service')
        const scanHistoryResult = await ScanHistoryService.storeScanResult(user.userId, 'document', {
          scanTitle: `Document Scan: ${body.fileName}`,
          fileName: body.fileName,
          fileType: body.fileType,
          scanResults: enhancedResult,
          complianceSummary: {
            totalIssues: enhancedResult.summary.total,
            criticalIssues: enhancedResult.summary.critical,
            seriousIssues: enhancedResult.summary.serious,
            moderateIssues: enhancedResult.summary.moderate,
            minorIssues: enhancedResult.summary.minor
          },
          remediationReport: enhancedResult.remediationReport,
          totalIssues: enhancedResult.summary.total,
          criticalIssues: enhancedResult.summary.critical,
          seriousIssues: enhancedResult.summary.serious,
          moderateIssues: enhancedResult.summary.moderate,
          minorIssues: enhancedResult.summary.minor,
          pagesAnalyzed: enhancedResult.metadata.pagesAnalyzed,
          overallScore: enhancedResult.overallScore,
          is508Compliant: enhancedResult.is508Compliant,
          scanDurationSeconds: Math.round(totalDuration / 1000),
          scanSettings: {
            wcagLevel: body.wcagLevel || 'AA',
            selectedTags: body.selectedTags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
          }
        })
        console.log('✅ Document scan results stored in history')

        // Auto-add issues to product backlog
        // scanHistoryResult is the ID string, not an object
        if (enhancedResult.issues && enhancedResult.issues.length > 0 && scanHistoryResult) {
          console.log(`🔄 Attempting to add ${enhancedResult.issues.length} enhanced document issues to backlog...`)
          try {
            backlogResult = await autoAddDocumentIssuesToBacklog(user.userId, enhancedResult.issues, scanHistoryResult, body.fileName)
            console.log('✅ Document issues automatically added to product backlog:', backlogResult)
          } catch (backlogError) {
            console.error('❌ Failed to auto-add document issues to backlog:', backlogError)
            backlogResult = { success: false, error: backlogError instanceof Error ? backlogError.message : 'Unknown error' }
          }
        } else {
          console.log('⚠️ Skipping backlog addition - no enhanced issues or missing scanHistoryResult:', {
            hasIssues: enhancedResult.issues && enhancedResult.issues.length > 0,
            issuesCount: enhancedResult.issues?.length || 0,
            hasScanHistoryResult: !!scanHistoryResult
          })
        }
      } catch (error) {
        console.error('Failed to store document scan results in history:', error)
      }
      
      return NextResponse.json({
        success: true,
        result: enhancedResult,
        scanId,
        backlogAdded: backlogResult
      })
    }
    
    // Update scan duration for non-enhanced results
    const totalDuration = Date.now() - startTime
    scanResult.metadata.scanDuration = totalDuration
    
    // Save scan results to database (without document content)
    const scanRecord = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scanId: scanId,
      fileName: body.fileName,
      fileType: body.fileType,
      fileSize: body.fileSize,
      scanDate: new Date().toISOString(),
      status: 'completed',
      scanDuration: totalDuration,
      pagesAnalyzed: scanResult.metadata.pagesAnalyzed,
      overallScore: scanResult.overallScore,
      is508Compliant: scanResult.is508Compliant,
      scanResults: {
        summary: scanResult.summary,
        issues: scanResult.issues, // Store ALL issues with full details
        metadata: scanResult.metadata
      }
    }
    
    scanDatabase.set(scanRecord.id, scanRecord)
    console.log(`💾 Scan results saved to database: ${scanRecord.id}`)
    
    // Clean up scan record
    activeScans.delete(scanId)
    
    // Initialize backlogResult outside try block so it's available in return statement
    let backlogResult = null
    
    // Store scan results in history (with error handling)
    try {
      const { ScanHistoryService } = await import('@/lib/scan-history-service')
      const scanHistoryResult = await ScanHistoryService.storeScanResult(user.userId, 'document', {
        scanTitle: `Document Scan: ${body.fileName}`,
        fileName: body.fileName,
        fileType: body.fileType,
        scanResults: scanResult,
        complianceSummary: {
          totalIssues: scanResult.summary.total,
          criticalIssues: scanResult.summary.critical,
          seriousIssues: scanResult.summary.serious,
          moderateIssues: scanResult.summary.moderate,
          minorIssues: scanResult.summary.minor
        },
        remediationReport: null, // No AI enhancement for this path
        totalIssues: scanResult.summary.total,
        criticalIssues: scanResult.summary.critical,
        seriousIssues: scanResult.summary.serious,
        moderateIssues: scanResult.summary.moderate,
        minorIssues: scanResult.summary.minor,
        pagesAnalyzed: scanResult.metadata.pagesAnalyzed,
        overallScore: scanResult.overallScore,
        is508Compliant: scanResult.is508Compliant,
        scanDurationSeconds: Math.round(totalDuration / 1000),
        scanSettings: {
          wcagLevel: body.wcagLevel || 'AA',
          selectedTags: body.selectedTags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
        }
      })
      console.log('✅ Document scan results stored in history')

      // Auto-add issues to product backlog
      // scanHistoryResult is the ID string, not an object
      if (scanResult.issues && scanResult.issues.length > 0 && scanHistoryResult) {
        console.log(`🔄 Attempting to add ${scanResult.issues.length} document issues to backlog...`)
        try {
          backlogResult = await autoAddDocumentIssuesToBacklog(user.userId, scanResult.issues, scanHistoryResult, body.fileName)
          console.log('✅ Document issues automatically added to product backlog:', backlogResult)
        } catch (backlogError) {
          console.error('❌ Failed to auto-add document issues to backlog:', backlogError)
          backlogResult = { success: false, error: backlogError instanceof Error ? backlogError.message : 'Unknown error' }
        }
      } else {
        console.log('⚠️ Skipping backlog addition - no issues or missing scanHistoryResult:', {
          hasIssues: scanResult.issues && scanResult.issues.length > 0,
          issuesCount: scanResult.issues?.length || 0,
          hasScanHistoryResult: !!scanHistoryResult
        })
      }
    } catch (error) {
      console.error('Failed to store document scan results in history:', error)
    }
    
    return NextResponse.json({
      success: true,
      result: scanResult,
      scanId,
      backlogAdded: backlogResult
    })
    
  } catch (error) {
    console.error('❌ Document scan error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to scan document' 
      },
      { status: 500 }
    )
  }
}

// New endpoint to cancel scans
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const scanId = searchParams.get('scanId')
    
    if (!scanId) {
      return NextResponse.json(
        { success: false, error: 'Scan ID required' },
        { status: 400 }
      )
    }
    
    const scanStatus = activeScans.get(scanId)
    if (!scanStatus) {
      return NextResponse.json(
        { success: false, error: 'Scan not found or already completed' },
        { status: 404 }
      )
    }
    
    // Mark scan as cancelled
    scanStatus.cancelled = true
    console.log(`🚫 Scan ${scanId} marked for cancellation`)
    
    // Save cancelled scan to database
    const cancelledScanRecord = {
      id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      scanId: scanId,
      fileName: 'Cancelled Scan',
      fileType: 'unknown',
      fileSize: 0,
      scanDate: new Date().toISOString(),
      status: 'cancelled',
      scanDuration: 0,
      pagesAnalyzed: 0,
      overallScore: 0,
      is508Compliant: false,
      scanResults: {
        summary: { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 },
        issues: [],
        metadata: {}
      }
    }
    
    scanDatabase.set(cancelledScanRecord.id, cancelledScanRecord)
    console.log(`💾 Cancelled scan saved to database: ${cancelledScanRecord.id}`)
    
    return NextResponse.json({
      success: true,
      message: 'Scan cancellation requested'
    })
    
  } catch (error) {
    console.error('❌ Cancel scan error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to cancel scan' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)
    
    const { searchParams } = new URL(request.url)
    const scanId = searchParams.get('scanId')
    
    if (scanId) {
      // Get specific scan status
      const scan = activeScans.get(scanId)
      if (!scan) {
        return NextResponse.json(
          { success: false, error: 'Scan not found' },
          { status: 404 }
        )
      }
      
      return NextResponse.json({
        success: true,
        scanId,
        status: scan.cancelled ? 'cancelled' : 'active',
        cancelled: scan.cancelled
      })
    } else {
      // Get scan history
      const scans = Array.from(scanDatabase.values())
        .sort((a, b) => new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime())
      
      return NextResponse.json({
        success: true,
        scans
      })
    }
  } catch (error) {
    console.error('Document scan GET error:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401 }
    )
  }
}


/**
 * Enhance scan results with AI-powered analysis
 */
async function enhanceWithAI(scanResult: any, request: DocumentScanRequest, scanId: string): Promise<any> {
  try {
    const claudeAPI = new ClaudeAPI()
    
    // Enhance ALL issues with AI for comprehensive recommendations
    const issuesToEnhance = scanResult.issues
    
    console.log(`🤖 Starting AI enhancement for ${issuesToEnhance.length}/${scanResult.issues.length} issues (all issues)`)
    
    // Process issues sequentially instead of concurrently to avoid rate limiting
    const enhancedIssues = []
    
    for (let i = 0; i < issuesToEnhance.length; i++) {
      const issue = scanResult.issues[i]
      try {
        console.log(`🤖 Enhancing issue ${i + 1}/${issuesToEnhance.length}:`, issue.description)
        
        // Create detailed context for AI with all available information
        const issueContext = `
Issue: ${issue.description}
Section: ${issue.section}
Page: ${issue.pageNumber || 'Unknown'}
Line: ${issue.lineNumber || 'Unknown'}
Location: ${issue.elementLocation || 'Unknown'}
Context: ${issue.context || 'No additional context'}
WCAG Criterion: ${issue.wcagCriterion || 'Unknown'}
Section 508 Requirement: ${issue.section508Requirement || 'Unknown'}
Impact: ${issue.impact || 'Unknown'}
Document: ${request.fileName}
File Type: ${request.fileType}
        `.trim()
        
        const aiRecommendation = await claudeAPI.generateDocumentAccessibilitySuggestion(
          issue.description,
          issue.section,
          request.fileName,
          request.fileType,
          issue.elementContent || issue.context || issue.elementLocation,
          issue.pageNumber
        )
        
        console.log(`✅ AI enhancement completed for issue ${i + 1}`)
        
        enhancedIssues.push({
          ...issue,
          recommendation: aiRecommendation
        })
        
        // Reduced delay to 1 second for faster processing
        if (i < issuesToEnhance.length - 1) {
          console.log('⏳ Waiting 1 second before processing next issue...')
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
      } catch (error) {
        console.error('❌ AI enhancement failed for issue:', issue.id, error)
        enhancedIssues.push({
          ...issue
        })
        
        // Even on error, wait before continuing to next issue
        if (i < issuesToEnhance.length - 1) {
          console.log('⏳ Waiting 1 second after error before processing next issue...')
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }
    
    console.log('🎉 AI enhancement completed for critical/serious issues')
    
    // Add non-enhanced issues back
    const nonEnhancedIssues = scanResult.issues.filter((issue: any) => 
      issue.type !== 'critical' && issue.type !== 'serious'
    )
    
    return {
      ...scanResult,
      issues: [...enhancedIssues, ...nonEnhancedIssues],
      metadata: {
        ...scanResult.metadata
      }
    }
  } catch (error) {
    console.error('❌ AI enhancement failed:', error)
    return {
      ...scanResult,
      metadata: {
        ...scanResult.metadata
      }
    }
  }
}

// Note: autoAddDocumentIssuesToBacklog is now imported from @/lib/backlog-service
