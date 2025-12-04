import { NextRequest, NextResponse } from 'next/server'
import { ClaudeAPI } from '@/lib/claude-api'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import { NotificationService } from '@/lib/notification-service'
import { autoAddDocumentIssuesToBacklog } from '@/lib/backlog-service'
import { getAdobePDFServices } from '@/lib/adobe-pdf-services'

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
    
    // Check if this is a PDF file
    if (!body.fileType.toLowerCase().includes('pdf') && !body.fileName.toLowerCase().endsWith('.pdf')) {
      activeScans.delete(scanId)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Only PDF files are supported for Adobe PDF Services workflow'
        },
        { status: 400 }
      )
    }
    
    // Get Adobe PDF Services instance
    const adobePDFServices = getAdobePDFServices()
    if (!adobePDFServices || !adobePDFServices.isConfigured()) {
      activeScans.delete(scanId)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Adobe PDF Services not configured. Please check your environment variables.'
        },
        { status: 500 }
      )
    }
    
    // Initialize scan result structure
    let finalScanResult: any = {
      is508Compliant: false,
      overallScore: 0,
      issues: [],
      summary: { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 },
      metadata: { 
        scanEngine: 'Adobe PDF Services API', 
        standard: 'PDF/UA, WCAG 2.1 AA',
        pagesAnalyzed: 0,
        fileSize: fileBuffer.length
      }
    }
    
    // Step 1: Auto-tag the PDF using Adobe's API FIRST
    // This fixes missing tags and prepares the document for accessibility checking
    console.log('🏷️ Step 1: Auto-tagging PDF with Adobe PDF Services...')
    const autoTagResult = await adobePDFServices.autoTagPDF(fileBuffer)
    
    let taggedPdfBuffer = fileBuffer
    let taggingSuccess = false
    
    if (autoTagResult.success && autoTagResult.taggedPdfBuffer) {
      console.log('✅ PDF successfully auto-tagged by Adobe')
      taggedPdfBuffer = autoTagResult.taggedPdfBuffer
      taggingSuccess = true
    } else {
      console.warn(`⚠️ Adobe auto-tag failed: ${autoTagResult.error || autoTagResult.message} - using original PDF`)
    }
    
    // Check for cancellation
    if (activeScans.get(scanId)?.cancelled) {
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
    
    // Step 2: Check accessibility of the TAGGED PDF
    // This runs a COMPREHENSIVE check covering ALL categories and ALL pages:
    // - Document: tags, reading order, language, title, bookmarks, color contrast
    // - Page Content: alt text, fonts, text language, structure
    // - Form Fields: labels, tab order, field properties
    // - All WCAG 2.1 AA and PDF/UA compliance checks
    console.log('🔍 Step 2: Running comprehensive accessibility check on TAGGED PDF (all pages, all checks)...')
    const accessibilityResult = await adobePDFServices.checkAccessibility(taggedPdfBuffer)
    
    if (accessibilityResult.success && accessibilityResult.report) {
      console.log(`✅ Adobe Accessibility Check complete: ${accessibilityResult.report.summary.totalIssues} issues found.`)
      console.log(`📊 Report summary:`, JSON.stringify(accessibilityResult.report.summary, null, 2))
      console.log(`📋 Issues found:`, accessibilityResult.report.issues?.length || 0)
      
      // Get ALL checks from the report (Passed, Failed, Needs manual check, Skipped)
      // The report contains all checks organized by category (like Acrobat's report)
      let adobeIssues = accessibilityResult.report.issues || []
      
      // Log full report structure for debugging
      console.log('📄 Full accessibility report structure:', JSON.stringify(accessibilityResult.report, null, 2))
      console.log('📊 Report categories:', Object.keys(accessibilityResult.report.categories || {}))
      console.log('📊 Has categories:', !!accessibilityResult.report.categories)
      console.log('📊 Categories count:', accessibilityResult.report.categories ? Object.keys(accessibilityResult.report.categories).length : 0)
      
      // Build categories from issues if not available in report
      let reportCategories = accessibilityResult.report.categories
      if (!reportCategories && adobeIssues.length > 0) {
        console.log('⚠️ No categories in report, building from issues...')
        reportCategories = {}
        adobeIssues.forEach((issue: any) => {
          const category = issue.category || 'Other'
          if (!reportCategories[category]) {
            reportCategories[category] = []
          }
          reportCategories[category].push({
            ruleName: issue.rule || issue.ruleName || 'Unknown',
            status: issue.status || 'Failed',
            description: issue.description || 'No description',
            page: issue.page,
            location: issue.location,
            elementId: issue.elementId,
            elementType: issue.elementType,
            elementContent: issue.elementContent,
            elementTag: issue.elementTag
          })
        })
        console.log('📊 Built categories from issues:', Object.keys(reportCategories))
      }
      
      // Filter to get ONLY Failed issues (exclude "Needs manual check" - those are informational only)
      const issuesNeedingRemediation = adobeIssues.filter((issue: any) => {
        const status = issue.status || (issue.type === 'error' ? 'Failed' : 'Passed')
        return status === 'Failed' || status === 'Failed manually'
      })
      
      const failedCount = issuesNeedingRemediation.length
      
      console.log(`🔍 Found ${adobeIssues.length} total checks, ${issuesNeedingRemediation.length} Failed issues need AI remediation`)
      
      // Enhance ONLY Failed issues with AI suggestions (exclude "Needs manual check")
      const claudeAPI = new ClaudeAPI()
      const enhancedIssues = await Promise.all(
        issuesNeedingRemediation.map(async (adobeIssue: any, index: number) => {
          // Check for cancellation during AI enhancement
          if (activeScans.get(scanId)?.cancelled) {
            throw new Error('Scan was cancelled by user')
          }
          
          const issueStatus = adobeIssue.status || (adobeIssue.type === 'error' ? 'Failed' : 'Passed')
          const isFailed = issueStatus === 'Failed' || issueStatus === 'Failed manually'
          
          // Build detailed context with element information from the report
          // This includes page, location, element ID, type, content, and tag for precise remediation
          const elementInfo = []
          if (adobeIssue.page) elementInfo.push(`Page ${adobeIssue.page}`)
          if (adobeIssue.location && adobeIssue.location !== 'Unknown location' && adobeIssue.location !== 'Document') {
            elementInfo.push(`Location: ${adobeIssue.location}`)
          }
          if (adobeIssue.elementId) elementInfo.push(`Element ID: ${adobeIssue.elementId}`)
          if (adobeIssue.elementType) elementInfo.push(`Element Type: ${adobeIssue.elementType}`)
          if (adobeIssue.elementContent) {
            elementInfo.push(`Content: "${adobeIssue.elementContent.substring(0, 50)}${adobeIssue.elementContent.length > 50 ? '...' : ''}"`)
          }
          if (adobeIssue.elementTag) elementInfo.push(`PDF Tag: ${adobeIssue.elementTag}`)
          
          // Use description to help identify the problem text if elementContent is missing
          // Adobe descriptions often contain clues about what text/element needs fixing
          let elementContext = adobeIssue.description || adobeIssue.rule || 'Accessibility issue'
          if (elementInfo.length > 0) {
            elementContext = `${elementContext}. ${elementInfo.join(', ')}`
          } else if (adobeIssue.description) {
            // If no element details, use the description which often contains helpful info
            elementContext = adobeIssue.description
          }
          
          console.log(`🤖 Generating AI remediation for failed issue ${index + 1}/${issuesNeedingRemediation.length}: ${adobeIssue.rule || 'Unknown rule'}`)
          console.log(`   Full Adobe issue data:`, JSON.stringify({
            page: adobeIssue.page,
            location: adobeIssue.location,
            elementId: adobeIssue.elementId,
            elementType: adobeIssue.elementType,
            elementContent: adobeIssue.elementContent,
            elementTag: adobeIssue.elementTag,
            description: adobeIssue.description,
            rule: adobeIssue.rule
          }, null, 2))
          if (elementInfo.length > 0) {
            console.log(`   Element details: ${elementInfo.join(', ')}`)
          } else {
            console.log(`   ⚠️ No element details available - using issue description and location only`)
          }
          
          const aiSuggestion = await claudeAPI.generateDocumentAccessibilitySuggestion(
            elementContext,
            adobeIssue.rule || adobeIssue.ruleName || 'Accessibility',
            body.fileName,
            body.fileType,
            adobeIssue.location || adobeIssue.elementLocation || 'Unknown location',
            adobeIssue.page || adobeIssue.pageNumber,
            adobeIssue.elementContent, // Pass element content for better context
            adobeIssue.elementId, // Pass element ID for precise targeting
            adobeIssue.elementType // Pass element type for better guidance
          )
          
          return {
            id: `adobe_issue_${Date.now()}_${index}`,
            type: 'critical', // All issues here are Failed = critical
            category: adobeIssue.category || 'structure',
            description: adobeIssue.description || adobeIssue.rule || adobeIssue.ruleName || 'Accessibility issue',
            section: adobeIssue.rule || adobeIssue.ruleName || 'Accessibility',
            pageNumber: adobeIssue.page || adobeIssue.pageNumber,
            elementLocation: adobeIssue.location || adobeIssue.elementLocation || adobeIssue.context || 'Unknown location',
            elementId: adobeIssue.elementId,
            elementType: adobeIssue.elementType,
            elementContent: adobeIssue.elementContent,
            elementTag: adobeIssue.elementTag,
            context: `Adobe Accessibility Checker found: ${adobeIssue.rule || adobeIssue.ruleName || 'Unknown rule'}${elementInfo.length > 0 ? ` (${elementInfo.join(', ')})` : ''}`,
            wcagCriterion: 'WCAG 2.1 AA - PDF/UA Compliance',
            section508Requirement: '36 CFR § 1194.22 - Document Accessibility',
            impact: 'high', // Failed issues are high impact
            recommendation: aiSuggestion,
            remediation: aiSuggestion,
            status: 'Failed' // All issues here are Failed
          }
        })
      )
      
      // Calculate compliance and score based on the TAGGED PDF report
      // This shows what issues remain AFTER auto-tagging
      // Only count Failed issues (exclude "Needs manual check" - those are informational)
      const totalIssuesFound = enhancedIssues.length // Only Failed issues
      const criticalIssuesFound = enhancedIssues.length // All are critical (Failed)
      
      // PDF is compliant if no failed issues (manual checks don't affect compliance)
      const wasCompliant = totalIssuesFound === 0
      
      // Calculate score based on failed issues only (manual checks don't affect score)
      const calculatedScore = totalIssuesFound === 0 ? 100 :
                             Math.max(0, 100 - (criticalIssuesFound * 10))
      
      // Build final scan result with detailed Acrobat-style report
      // Include the detailed report with categories for remediation
      finalScanResult = {
        is508Compliant: wasCompliant, // Only compliant if we didn't need to fix anything
        overallScore: calculatedScore, // Score based on issues we found
        issues: enhancedIssues,
        summary: {
          total: totalIssuesFound, // Only Failed issues
          critical: criticalIssuesFound, // All Failed issues are critical
          serious: 0, // Adobe report doesn't distinguish 'serious'
          moderate: 0, // No moderate issues (excluded "Needs manual check")
          minor: 0 // No minor issues
        },
        // Include detailed Acrobat-style report for display in UI
        // This shows the full report with all categories and all checks (Passed, Failed, Needs manual check, Skipped)
        detailedReport: reportCategories ? {
          filename: body.fileName,
          reportCreatedBy: 'Adobe PDF Services API',
          organization: 'Accessitest',
          summary: {
            needsManualCheck: accessibilityResult.report.summary.needsManualCheck || manualCheckCount,
            passedManually: 0,
            failedManually: 0,
            skipped: accessibilityResult.report.summary.skipped || 0,
            passed: accessibilityResult.report.summary.passed || 0,
            failed: accessibilityResult.report.summary.failed || failedCount
          },
          categories: reportCategories,
          // Include metadata about auto-tagging
          autoTagged: taggingSuccess
        } : undefined,
        metadata: {
          scanEngine: 'Adobe PDF Services API',
          standard: 'PDF/UA, WCAG 2.1 AA',
          pagesAnalyzed: 0, // Adobe report doesn't provide this directly
          fileSize: fileBuffer.length,
          scanDuration: Date.now() - startTime,
          // Include tagged PDF if auto-tagging was successful
          taggedPdfAvailable: taggingSuccess && !!autoTagResult.taggedPdfBuffer,
          autoTagged: taggingSuccess
        },
        adobeReport: {
          compliant: accessibilityResult.compliant,
          summary: accessibilityResult.report.summary
        }
      }
      
      // Store the tagged PDF buffer for download (convert to base64 for JSON response)
      // Store it at the root level of the result, not inside scanResults
      if (autoTagResult.success && autoTagResult.taggedPdfBuffer) {
        try {
          const base64String = autoTagResult.taggedPdfBuffer.toString('base64')
          finalScanResult.taggedPdfBase64 = base64String
          finalScanResult.taggedPdfFileName = body.fileName.replace(/\.pdf$/i, '_tagged.pdf')
          console.log(`✅ Tagged PDF stored for download: ${finalScanResult.taggedPdfFileName}`)
          console.log(`   Base64 size: ${Math.round(base64String.length / 1024)} KB`)
          console.log(`   Buffer size: ${Math.round(autoTagResult.taggedPdfBuffer.length / 1024)} KB`)
        } catch (error) {
          console.error('❌ Failed to convert tagged PDF to base64:', error)
          console.warn('⚠️ Tagged PDF will not be available for download')
        }
      } else {
        console.warn('⚠️ No tagged PDF available for download')
        if (!autoTagResult.success) {
          console.warn(`   Auto-tag result: ${autoTagResult.error || autoTagResult.message}`)
        }
        if (!autoTagResult.taggedPdfBuffer) {
          console.warn('   No tagged PDF buffer returned from Adobe')
        }
      }
    } else {
      console.warn(`⚠️ Adobe Accessibility Check failed: ${accessibilityResult.error || 'Unknown error'}`)
      finalScanResult.error = accessibilityResult.error || 'Adobe accessibility check failed'
    }
    
    // Final cancellation check
    if (activeScans.get(scanId)?.cancelled) {
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
    
    console.log(`✅ Adobe scan completed: ${finalScanResult.issues.length} issues found`)
    
    // Use the final scan result (already enhanced with AI)
    const scanResult = finalScanResult
    
    // Update scan duration
    const totalDuration = Date.now() - startTime
    scanResult.metadata.scanDuration = totalDuration
    
    // Process results (already enhanced with AI)
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
        remediationReport: null, // AI remediation is already in each issue
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
          selectedTags: body.selectedTags || []
        }
      })
      console.log('✅ Document scan results stored in history')

      // Auto-add issues to product backlog
      // scanHistoryResult is the ID string, not an object
      console.log('🔍 Backlog addition check:', {
        hasIssues: !!scanResult.issues,
        issuesCount: scanResult.issues?.length || 0,
        hasScanHistoryResult: !!scanHistoryResult,
        scanHistoryResultType: typeof scanHistoryResult,
        scanHistoryResultValue: scanHistoryResult
      })
      
      if (scanResult.issues && scanResult.issues.length > 0 && scanHistoryResult) {
        console.log(`🔄 Attempting to add ${scanResult.issues.length} document issues to backlog...`)
        try {
          backlogResult = await autoAddDocumentIssuesToBacklog(user.userId, scanResult.issues, scanHistoryResult, body.fileName)
          console.log('✅ Document issues automatically added to product backlog:', JSON.stringify(backlogResult, null, 2))
        } catch (backlogError) {
          console.error('❌ Failed to auto-add document issues to backlog:', backlogError)
          if (backlogError instanceof Error) {
            console.error('❌ Error stack:', backlogError.stack)
          }
          backlogResult = { success: false, error: backlogError instanceof Error ? backlogError.message : 'Unknown error' }
        }
      } else {
        console.warn('⚠️ Skipping backlog addition - no issues or missing scanHistoryResult:', {
          hasIssues: scanResult.issues && scanResult.issues.length > 0,
          issuesCount: scanResult.issues?.length || 0,
          hasScanHistoryResult: !!scanHistoryResult,
          scanHistoryResult: scanHistoryResult
        })
      }
    } catch (error) {
      console.error('Failed to store document scan results in history:', error)
    }
    
    // Include tagged PDF in response if available
    const responseData: any = {
      success: true,
      result: scanResult,
      scanId,
      backlogAdded: backlogResult
    }
    
    // Add tagged PDF to response if available (check both locations)
    if (scanResult.taggedPdfBase64) {
      responseData.taggedPdfBase64 = scanResult.taggedPdfBase64
      responseData.taggedPdfFileName = scanResult.taggedPdfFileName
      console.log('✅ Including tagged PDF in response')
    } else {
      console.warn('⚠️ No tagged PDF to include in response')
    }
    
    return NextResponse.json(responseData)
    
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
