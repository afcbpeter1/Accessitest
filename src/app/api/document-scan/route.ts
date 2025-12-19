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
interface ActiveScan {
  cancelled: boolean
  creditTransactionId?: number | null
  userId?: string
}

const activeScans = new Map<string, ActiveScan>()

/**
 * Verify that PDF fixes were actually applied
 * Uses Python/PyMuPDF to check structure tree, metadata, etc. (same as test scripts)
 */
async function verifyPDFFixes(pdfBuffer: Buffer): Promise<{
  success: boolean
  isTagged?: boolean
  isMarked?: boolean
  language?: string
  title?: string
  bookmarkCount?: number
  structureElements?: number
  figureCount?: number
  tableCount?: number
  headingCount?: number
  error?: string
}> {
  try {
    const { exec } = require('child_process')
    const { promisify } = require('util')
    const execAsync = promisify(exec)
    const fs = require('fs/promises')
    const path = require('path')
    const { tmpdir } = require('os')
    
    // Create temporary PDF file
    const tempDir = tmpdir()
    const tempPdfPath = path.join(tempDir, `verify-${Date.now()}.pdf`)
    await fs.writeFile(tempPdfPath, pdfBuffer)
    
    try {
      // Use Python to verify structure elements (same as test scripts)
      const verifyScript = `
import fitz
import pikepdf
import sys
import json
import os

try:
    pdf_path = '${tempPdfPath.replace(/\\/g, '/')}'
    
    # Check with PyMuPDF
    doc = fitz.open(pdf_path)
    catalog = doc.pdf_catalog()
    
    # Check structure tree
    struct_result = doc.xref_get_key(catalog, "StructTreeRoot")
    has_struct = struct_result[0] != 0
    
    # Check MarkInfo
    markinfo_result = doc.xref_get_key(catalog, "MarkInfo")
    is_marked = False
    if markinfo_result[0] != 0:
        markinfo_xref = int(markinfo_result[1]) if markinfo_result[1].isdigit() else None
        if markinfo_xref:
            marked_result = doc.xref_get_key(markinfo_xref, "Marked")
            is_marked = marked_result[0] != 0 and marked_result[1].lower() == 'true'
    
    # Check language
    lang_result = doc.xref_get_key(catalog, "Lang")
    lang_value = None
    if lang_result[0] != 0:
        lang_value = str(lang_result[1])
    
    # Check metadata
    metadata = doc.metadata
    title = metadata.get('title', '')
    
    # Check bookmarks
    toc = doc.get_toc()
    bookmark_count = len(toc) if toc else 0
    
    doc.close()
    
    # Check with pikepdf for structure elements
    figure_count = 0
    table_count = 0
    heading_count = 0
    structure_elements = 0
    
    try:
        with pikepdf.Pdf.open(pdf_path) as pdf:
            if '/StructTreeRoot' in pdf.Root:
                struct_root = pdf.Root['/StructTreeRoot']
                k_array = struct_root.get('/K', pikepdf.Array([]))
                structure_elements = len(k_array)
                
                def count_elements(elem):
                    nonlocal figure_count, table_count, heading_count
                    if isinstance(elem, pikepdf.IndirectObject):
                        elem_obj = pdf.get_object(elem.objgen)
                    else:
                        elem_obj = elem
                    
                    if isinstance(elem_obj, pikepdf.Dictionary):
                        s_type = elem_obj.get('/S')
                        if s_type == pikepdf.Name('/Figure'):
                            figure_count += 1
                        elif s_type == pikepdf.Name('/Table'):
                            table_count += 1
                        elif str(s_type).startswith('/H'):
                            heading_count += 1
                        
                        k_children = elem_obj.get('/K', pikepdf.Array([]))
                        for child in k_children:
                            if isinstance(child, (pikepdf.IndirectObject, pikepdf.Dictionary)):
                                count_elements(child)
                
                for elem in k_array:
                    count_elements(elem)
    except Exception as e:
        pass  # pikepdf check is optional
    
    result = {
        'success': True,
        'isTagged': has_struct,
        'isMarked': is_marked,
        'language': lang_value,
        'title': title,
        'bookmarkCount': bookmark_count,
        'structureElements': structure_elements,
        'figureCount': figure_count,
        'tableCount': table_count,
        'headingCount': heading_count
    }
    
    print(json.dumps(result))
except Exception as e:
    print(json.dumps({'success': False, 'error': str(e)}))
`
      
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const { stdout } = await execAsync(`${pythonCmd} -c "${verifyScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
        maxBuffer: 10 * 1024 * 1024
      })
      
      const result = JSON.parse(stdout.trim())
      
      return {
        success: result.success || false,
        isTagged: result.isTagged,
        isMarked: result.isMarked,
        language: result.language,
        title: result.title,
        bookmarkCount: result.bookmarkCount,
        structureElements: result.structureElements,
        figureCount: result.figureCount,
        tableCount: result.tableCount,
        headingCount: result.headingCount,
        error: result.error
      }
    } finally {
      // Cleanup temp file
      await fs.unlink(tempPdfPath).catch(() => {})
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)
    
    const body: DocumentScanRequest = await request.json()
    
    console.log('🔍 Starting document scan for:', body.fileName)

    const scanId = body.scanId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Register this scan as active (before any processing)
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
    
    // Check file size and page count BEFORE processing and BEFORE deducting credits
    // Adobe PDF Services API limits:
    // - Standard PDFs: 400 pages max
    // - Scanned PDFs: 150 pages max
    // - File size: 100MB max
    const ADOBE_STANDARD_PAGE_LIMIT = 400
    const ADOBE_SCANNED_PAGE_LIMIT = 150
    const ADOBE_FILE_SIZE_LIMIT = 100 * 1024 * 1024 // 100MB in bytes
    
    // Check file size first
    if (fileBuffer.length > ADOBE_FILE_SIZE_LIMIT) {
      activeScans.delete(scanId)
      return NextResponse.json(
        { 
          success: false, 
          error: `PDF exceeds Adobe PDF Services file size limit`,
          details: `This PDF is ${Math.round(fileBuffer.length / (1024 * 1024))}MB, but Adobe PDF Services supports a maximum of ${Math.round(ADOBE_FILE_SIZE_LIMIT / (1024 * 1024))}MB for auto-tagging and accessibility checking.`,
          fileSize: fileBuffer.length,
          maxFileSize: ADOBE_FILE_SIZE_LIMIT,
          suggestion: 'Please compress the PDF or split it into smaller documents to reduce file size.'
        },
        { status: 400 }
      )
    }
    
    let pageCount = 0
    let isScannedPDF = false
    
    try {
      const pdfParse = require('pdf-parse')
      // Parse first few pages to get page count and check if scanned
      const pdfParseResult = await pdfParse(fileBuffer, { max: 3 }) // Parse first 3 pages to detect scanned
      pageCount = pdfParseResult.numpages || 0
      
      // Detect if PDF is scanned (image-based) vs standard (text-based)
      // Scanned PDFs have very little extractable text relative to file size
      const textLength = pdfParseResult.text?.length || 0
      const avgTextPerPage = pageCount > 0 ? textLength / pageCount : 0
      
      // Heuristic: If average text per page is less than 100 characters, likely scanned
      // Also check if file size is large but text is small (indicates image-heavy/scanned)
      const textToSizeRatio = textLength / fileBuffer.length
      isScannedPDF = avgTextPerPage < 100 || (fileBuffer.length > 1024 * 1024 && textToSizeRatio < 0.01)
      
      const pageLimit = isScannedPDF ? ADOBE_SCANNED_PAGE_LIMIT : ADOBE_STANDARD_PAGE_LIMIT
      const pdfType = isScannedPDF ? 'scanned' : 'standard'
      
      if (pageCount > pageLimit) {
        activeScans.delete(scanId)
        return NextResponse.json(
          { 
            success: false, 
            error: `PDF exceeds Adobe PDF Services page limit`,
            details: `This ${pdfType} PDF has ${pageCount} pages, but Adobe PDF Services supports a maximum of ${pageLimit} pages for ${pdfType} PDFs during auto-tagging and accessibility checking.`,
            pageCount: pageCount,
            maxPages: pageLimit,
            pdfType: pdfType,
            suggestion: `Please split the PDF into smaller documents (under ${pageLimit} pages each) or use our manual accessibility checker for larger documents.`
          },
          { status: 400 }
        )
      }
      
      console.log(`📄 PDF validation: ${pageCount} pages, ${Math.round(fileBuffer.length / (1024 * 1024))}MB, type: ${pdfType} (limit: ${pageLimit} pages)`)
    } catch (pageCountError: any) {
      console.warn(`⚠️ Could not check page count: ${pageCountError.message}`)
      // Continue processing - we'll let Adobe API handle the error if it's too large
      // This prevents blocking valid PDFs if page count check fails
      // Default to standard PDF limits if we can't detect
      isScannedPDF = false
    }
    
    // Check and deduct credits AFTER page count validation passes
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
    
    // Store credit transaction ID for potential refund if cancelled
    let creditTransactionId: number | null = null
    
    // Check if user has unlimited credits
    if (creditData.unlimited_credits) {
      // Unlimited user, log the scan but don't deduct credits
      const transactionResult = await query(
        `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [user.userId, 'usage', 0, `Document scan: ${body.fileName}`]
      )
      creditTransactionId = transactionResult.rows?.[0]?.id || null
    } else {
      // Check if user has enough credits
      if (creditData.credits_remaining < 1) {
        // Create notification for insufficient credits
        await NotificationService.notifyInsufficientCredits(user.userId)
        activeScans.delete(scanId)
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
        const transactionResult = await query(
          `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
           VALUES ($1, $2, $3, $4)
           RETURNING id`,
          [user.userId, 'usage', -1, `Document scan: ${body.fileName}`]
        )
        creditTransactionId = transactionResult.rows?.[0]?.id || null
        
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
    
    // Update active scan with credit transaction ID and userId for potential refund if cancelled
    const currentScan = activeScans.get(scanId)
    activeScans.set(scanId, { 
      cancelled: currentScan?.cancelled || false,
      creditTransactionId: creditTransactionId,
      userId: user.userId
    })
    
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
      const errorMessage = autoTagResult.error || autoTagResult.message || ''
      console.warn(`⚠️ Adobe auto-tag failed: ${errorMessage}`)
      
      // Check if the error is due to page limit
      if (errorMessage.toLowerCase().includes('page limit') || 
          errorMessage.toLowerCase().includes('exceeds') ||
          errorMessage.toLowerCase().includes('too many pages') ||
          errorMessage.toLowerCase().includes('not suitable for conversion')) {
        // Refund the credit since we can't process this PDF
        if (creditTransactionId && user.userId) {
          try {
            await query('BEGIN')
            await query(
              `UPDATE user_credits 
               SET credits_remaining = credits_remaining + 1, 
                   credits_used = GREATEST(credits_used - 1, 0),
                   updated_at = NOW()
               WHERE user_id = $1`,
              [user.userId]
            )
            await query('COMMIT')
            console.log('✅ Refunded credit due to page limit error')
          } catch (refundError) {
            await query('ROLLBACK')
            console.error('❌ Failed to refund credit:', refundError)
          }
        }
        
        // Determine PDF type and appropriate limit
        const pdfType = isScannedPDF ? 'scanned' : 'standard'
        const pageLimit = isScannedPDF ? ADOBE_SCANNED_PAGE_LIMIT : ADOBE_STANDARD_PAGE_LIMIT
        
        activeScans.delete(scanId)
        return NextResponse.json(
          { 
            success: false, 
            error: `PDF exceeds Adobe PDF Services page limit`,
            details: `Adobe PDF Services cannot process this ${pdfType} PDF: ${errorMessage}. The maximum page limit is ${pageLimit} pages for ${pdfType} PDFs during auto-tagging and accessibility checking.`,
            pageCount: pageCount || 'unknown',
            maxPages: pageLimit,
            pdfType: pdfType,
            suggestion: `Please split the PDF into smaller documents (under ${pageLimit} pages each) or use our manual accessibility checker for larger documents.`
          },
          { status: 400 }
        )
      }
      
      // For other auto-tag failures, continue with original PDF
      console.warn(`⚠️ Continuing with original PDF (auto-tag failed but not due to page limit)`)
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
      
      // If we successfully auto-tagged the PDF, add an informational note that the original PDF was missing tags
      // This helps users understand that we fixed the "Tags are missing" issue automatically
      if (taggingSuccess) {
        const taggedPdfCheck = accessibilityResult.report.categories?.['Document']?.find(
          (check: any) => (check.Rule || check.rule || check.ruleName || '').toLowerCase().includes('tagged pdf')
        )
        
        // If Adobe reports "Tagged PDF" as Passed, it means the PDF now has tags (we added them)
        // Add an informational issue to let the user know the original PDF was missing tags
        if (taggedPdfCheck && (taggedPdfCheck.Status || taggedPdfCheck.status) === 'Passed') {
          console.log('ℹ️ Original PDF was missing tags - auto-tagged during scan')
          // Note: We don't add this as a "Failed" issue since we've already fixed it
          // But we'll include it in metadata so users know what was fixed
        }
      }
      
      // Log full report structure for debugging
      console.log('📄 Full accessibility report structure:', JSON.stringify(accessibilityResult.report, null, 2))
      console.log('📊 Report categories:', Object.keys(accessibilityResult.report.categories || {}))
      console.log('📊 Has categories:', !!accessibilityResult.report.categories)
      console.log('📊 Categories count:', accessibilityResult.report.categories ? Object.keys(accessibilityResult.report.categories).length : 0)
      
      // Build categories from issues if not available in report
      // NOTE: This will be replaced with re-scan results if auto-fix succeeds
      let reportCategories = accessibilityResult.report.categories
      let reportSummary = accessibilityResult.report.summary
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
      
      // Store original scan results for comparison report
      const originalScanResults = {
        totalChecks: adobeIssues.length,
        failedIssues: issuesNeedingRemediation.length,
        issues: issuesNeedingRemediation.map((issue: any) => ({
          rule: issue.rule || issue.ruleName || 'Unknown',
          description: issue.description || 'No description',
          status: issue.status || 'Failed',
          category: issue.category || 'Other',
          page: issue.page,
          location: issue.location
        })),
        summary: accessibilityResult.report.summary
      }
      
      console.log(`🔍 Found ${adobeIssues.length} total checks, ${issuesNeedingRemediation.length} Failed issues`)
      console.log(`⏭️ Skipping AI suggestions for original scan - will generate only for remaining issues after auto-fix`)
      
      // Don't generate AI suggestions yet - wait until after auto-fix and re-scan
      // This avoids wasting API calls on issues that will be auto-fixed
      let enhancedIssues: any[] = []
      
      // Step 3: Apply automatic fixes using AI + PyMuPDF
      // This is our USP - automatically fix issues like alt text and table summaries
      console.log('🤖 Step 3: Applying automatic fixes using AI...')
      let autoFixedPdfBuffer: Buffer | undefined = undefined
      let autoFixResult: any = undefined
      let verificationResult: any = null
      let comparisonReport: any = undefined
      
      try {
        const { AIAutoFixService } = await import('@/lib/ai-auto-fix-service')
        const autoFixService = new AIAutoFixService()
        
        // Extract document text for better bookmark/reading order analysis (optional)
        let documentText: string | undefined = undefined
        try {
          const pdfParse = require('pdf-parse')
          const pdfParseResult = await pdfParse(taggedPdfBuffer, { max: 0 })
          documentText = pdfParseResult.text
          console.log(`📄 Extracted ${documentText.length} characters for AI analysis`)
        } catch (textError) {
          console.warn('⚠️ Could not extract document text for AI analysis:', textError)
          // Continue without text - AI can still work with issue descriptions
        }
        
        // Apply auto-fixes to the tagged PDF
        const failedIssues = adobeIssues.filter((issue: any) => {
          const status = issue.status || 'Failed'
          return status === 'Failed' || status === 'Failed manually'
        })
        
        autoFixResult = await autoFixService.applyAutoFixes(
          taggedPdfBuffer,
          failedIssues,
          body.fileName,
          documentText ?? undefined // Pass document text for better bookmark/reading order analysis (optional)
        )
        
        if (autoFixResult.success && autoFixResult.fixedPdfBuffer) {
          autoFixedPdfBuffer = autoFixResult.fixedPdfBuffer
          console.log(`✅ Auto-fix complete: ${autoFixResult.fixesApplied.altText} alt texts, ${autoFixResult.fixesApplied.tableSummaries} table summaries`)
          
          // Verify fixes were actually applied (same as test scripts)
          console.log('🔍 Step 4: Verifying fixes were applied to PDF...')
          try {
            verificationResult = await verifyPDFFixes(autoFixedPdfBuffer)
            if (verificationResult.success) {
              console.log(`✅ Verification passed:`)
              console.log(`   - Document is tagged: ${verificationResult.isTagged ? 'Yes' : 'No'}`)
              console.log(`   - MarkInfo/Marked: ${verificationResult.isMarked ? 'Yes' : 'No'}`)
              console.log(`   - Document language: ${verificationResult.language || 'Not set'}`)
              console.log(`   - Document title: ${verificationResult.title ? 'Yes' : 'No'}`)
              console.log(`   - Bookmarks: ${verificationResult.bookmarkCount || 0}`)
              console.log(`   - Structure elements: ${verificationResult.structureElements || 0} (Figures: ${verificationResult.figureCount || 0}, Tables: ${verificationResult.tableCount || 0}, Headings: ${verificationResult.headingCount || 0})`)
            } else {
              console.warn(`⚠️ Verification failed: ${verificationResult.error || 'Unknown error'}`)
            }
          } catch (verifyError) {
            console.warn(`⚠️ Could not verify fixes (non-critical): ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`)
          }
          
          // Store verification result for response
          ;(autoFixResult as any).verification = verificationResult
          
          // Re-scan the FIXED PDF to get only remaining issues (avoid duplicate work)
          console.log('🔍 Step 5: Re-scanning FIXED PDF to identify remaining issues...')
          const fixedPdfAccessibilityResult = await adobePDFServices.checkAccessibility(autoFixedPdfBuffer)
          
          if (fixedPdfAccessibilityResult.success && fixedPdfAccessibilityResult.report) {
            // USE RE-SCAN RESULTS for detailed report (not original scan)
            reportCategories = fixedPdfAccessibilityResult.report.categories || reportCategories
            reportSummary = fixedPdfAccessibilityResult.report.summary || reportSummary
            console.log(`✅ Re-scan complete: Using re-scan results for detailed report`)
            
            const fixedPdfIssues = fixedPdfAccessibilityResult.report.issues || []
            const remainingFailedIssues = fixedPdfIssues.filter((issue: any) => {
              const status = issue.status || 'Passed'
              return status === 'Failed' || status === 'Failed manually'
            })
            
            // Store re-scan results for comparison
            const reScanResults = {
              totalChecks: fixedPdfIssues.length,
              failedIssues: remainingFailedIssues.length,
              issues: remainingFailedIssues.map((issue: any) => ({
                rule: issue.rule || issue.ruleName || 'Unknown',
                description: issue.description || 'No description',
                status: issue.status || 'Failed',
                category: issue.category || 'Other',
                page: issue.page,
                location: issue.location
              })),
              summary: fixedPdfAccessibilityResult.report.summary
            }
            
            // Create comparison report
            const fixedIssues = originalScanResults.issues.filter((original: any) => {
              // An issue was fixed if it's in original but not in remaining
              return !remainingFailedIssues.some((remaining: any) => {
                const originalRule = (original.rule || '').toLowerCase()
                const remainingRule = (remaining.rule || remaining.ruleName || '').toLowerCase()
                return originalRule === remainingRule || 
                       (originalRule.includes('figure') && remainingRule.includes('figure')) ||
                       (originalRule.includes('table') && remainingRule.includes('table'))
              })
            })
            
            const comparisonReport = {
              original: {
                totalChecks: originalScanResults.totalChecks,
                failed: originalScanResults.failedIssues,
                passed: originalScanResults.summary?.passed || 0,
                needsManualCheck: originalScanResults.summary?.needsManualCheck || 0,
                issues: originalScanResults.issues
              },
              fixed: {
                count: fixedIssues.length,
                issues: fixedIssues,
                fixesApplied: autoFixResult.fixesApplied || {}
              },
              remaining: {
                totalChecks: reScanResults.totalChecks,
                failed: reScanResults.failedIssues,
                passed: reScanResults.summary?.passed || 0,
                needsManualCheck: reScanResults.summary?.needsManualCheck || 0,
                issues: reScanResults.issues
              },
              improvement: {
                issuesFixed: fixedIssues.length,
                issuesRemaining: remainingFailedIssues.length,
                improvementPercentage: originalScanResults.failedIssues > 0 
                  ? Math.round((fixedIssues.length / originalScanResults.failedIssues) * 100)
                  : 0
              }
            }
            
            console.log(`✅ Re-scan complete: ${fixedPdfIssues.length} total checks, ${remainingFailedIssues.length} remaining failed issues`)
            console.log(`📊 Issues fixed: ${fixedIssues.length} out of ${originalScanResults.failedIssues} (${comparisonReport.improvement.improvementPercentage}% improvement)`)
            console.log(`📋 Comparison Report:`, JSON.stringify(comparisonReport, null, 2))
            
            // Replace enhancedIssues with only remaining issues from fixed PDF
            if (remainingFailedIssues.length > 0) {
              // Enhance remaining issues with AI suggestions (only generate for issues that couldn't be auto-fixed)
              console.log(`🤖 Generating AI remediation for ${remainingFailedIssues.length} remaining issues...`)
              const remainingClaudeAPI = new ClaudeAPI()
              const remainingEnhancedIssues = await Promise.all(
                remainingFailedIssues.map(async (issue: any, index: number) => {
                  // Check for cancellation during AI enhancement
                  if (activeScans.get(scanId)?.cancelled) {
                    throw new Error('Scan was cancelled by user')
                  }
                  
                  // Build detailed context with element information from the report
                  const elementInfo = []
                  if (issue.page) elementInfo.push(`Page ${issue.page}`)
                  if (issue.location && issue.location !== 'Unknown location' && issue.location !== 'Document') {
                    elementInfo.push(`Location: ${issue.location}`)
                  }
                  if (issue.elementId) elementInfo.push(`Element ID: ${issue.elementId}`)
                  if (issue.elementType) elementInfo.push(`Element Type: ${issue.elementType}`)
                  if (issue.elementContent) {
                    elementInfo.push(`Content: "${issue.elementContent.substring(0, 50)}${issue.elementContent.length > 50 ? '...' : ''}"`)
                  }
                  if (issue.elementTag) elementInfo.push(`PDF Tag: ${issue.elementTag}`)
                  
                  let elementContext = issue.description || issue.rule || 'Accessibility issue'
                  if (elementInfo.length > 0) {
                    elementContext = `${elementContext}. ${elementInfo.join(', ')}`
                  } else if (issue.description) {
                    elementContext = issue.description
                  }
                  
                  // Determine location - if truly unknown, use rule name to provide context
                  let locationForAI = issue.location || issue.elementLocation
                  if (!locationForAI || locationForAI === 'Unknown location' || locationForAI === 'Document') {
                    const ruleName = issue.rule || issue.ruleName || ''
                    if (ruleName.toLowerCase().includes('figure') || ruleName.toLowerCase().includes('image')) {
                      locationForAI = 'All figures/images in document'
                    } else if (ruleName.toLowerCase().includes('table')) {
                      locationForAI = 'All tables in document'
                    } else if (ruleName.toLowerCase().includes('heading')) {
                      locationForAI = 'All headings in document'
                    } else if (ruleName.toLowerCase().includes('title')) {
                      locationForAI = 'Document properties'
                    } else if (ruleName.toLowerCase().includes('language')) {
                      locationForAI = 'Document properties'
                    } else {
                      locationForAI = 'Document'
                    }
                  }
                  
                  console.log(`🤖 Generating AI remediation for remaining issue ${index + 1}/${remainingFailedIssues.length}: ${issue.rule || issue.ruleName || 'Unknown rule'}`)
                  
                  const aiSuggestion = await remainingClaudeAPI.generateDocumentAccessibilitySuggestion(
                    elementContext,
                    issue.rule || issue.ruleName || 'Accessibility',
                    body.fileName,
                    body.fileType,
                    locationForAI,
                    issue.page || issue.pageNumber,
                    issue.elementContent,
                    issue.elementId,
                    issue.elementType
                  )
                  
                  return {
                    id: `adobe_issue_${Date.now()}_${index}`,
                    type: 'critical',
                    category: issue.category || 'structure',
                    description: issue.description || issue.rule || issue.ruleName || 'Accessibility issue',
                    section: issue.rule || issue.ruleName || 'Accessibility',
                    pageNumber: issue.page || issue.pageNumber,
                    elementLocation: issue.location || issue.elementLocation || 'Unknown location',
                    elementId: issue.elementId,
                    elementType: issue.elementType,
                    elementContent: issue.elementContent,
                    elementTag: issue.elementTag,
                    context: `Adobe Accessibility Checker found: ${issue.rule || issue.ruleName || 'Unknown rule'}${elementInfo.length > 0 ? ` (${elementInfo.join(', ')})` : ''}`,
                    wcagCriterion: 'WCAG 2.1 AA - PDF/UA Compliance',
                    section508Requirement: '36 CFR § 1194.22 - Document Accessibility',
                    impact: 'high',
                    recommendation: aiSuggestion,
                    remediation: aiSuggestion,
                    status: 'Failed',
                    autoFixed: false // These are remaining issues that couldn't be auto-fixed
                  }
                })
              )
              
              enhancedIssues = remainingEnhancedIssues
            } else {
              // All issues were fixed!
              enhancedIssues = []
              console.log('🎉 All issues were auto-fixed! No remaining issues.')
            }
          }
        } else {
          console.warn('⚠️ Auto-fix failed or no fixes applied:', autoFixResult.errors)
          // If auto-fix failed, generate AI suggestions for original issues
          if (issuesNeedingRemediation.length > 0) {
            console.log(`🤖 Auto-fix failed - generating AI suggestions for ${issuesNeedingRemediation.length} original issues...`)
            const claudeAPI = new ClaudeAPI()
            enhancedIssues = await Promise.all(
              issuesNeedingRemediation.map(async (adobeIssue: any, index: number) => {
                if (activeScans.get(scanId)?.cancelled) {
                  throw new Error('Scan was cancelled by user')
                }
                
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
                
                let elementContext = adobeIssue.description || adobeIssue.rule || 'Accessibility issue'
                if (elementInfo.length > 0) {
                  elementContext = `${elementContext}. ${elementInfo.join(', ')}`
                } else if (adobeIssue.description) {
                  elementContext = adobeIssue.description
                }
                
                let locationForAI = adobeIssue.location || adobeIssue.elementLocation
                if (!locationForAI || locationForAI === 'Unknown location' || locationForAI === 'Document') {
                  const ruleName = adobeIssue.rule || adobeIssue.ruleName || ''
                  if (ruleName.toLowerCase().includes('figure') || ruleName.toLowerCase().includes('image')) {
                    locationForAI = 'All figures/images in document'
                  } else if (ruleName.toLowerCase().includes('table')) {
                    locationForAI = 'All tables in document'
                  } else if (ruleName.toLowerCase().includes('heading')) {
                    locationForAI = 'All headings in document'
                  } else if (ruleName.toLowerCase().includes('title')) {
                    locationForAI = 'Document properties'
                  } else if (ruleName.toLowerCase().includes('language')) {
                    locationForAI = 'Document properties'
                  } else {
                    locationForAI = 'Document'
                  }
                }
                
                const aiSuggestion = await claudeAPI.generateDocumentAccessibilitySuggestion(
                  elementContext,
                  adobeIssue.rule || adobeIssue.ruleName || 'Accessibility',
                  body.fileName,
                  body.fileType,
                  locationForAI,
                  adobeIssue.page || adobeIssue.pageNumber,
                  adobeIssue.elementContent,
                  adobeIssue.elementId,
                  adobeIssue.elementType
                )
                
                return {
                  id: `adobe_issue_${Date.now()}_${index}`,
                  type: 'critical',
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
                  impact: 'high',
                  recommendation: aiSuggestion,
                  remediation: aiSuggestion,
                  status: 'Failed'
                }
              })
            )
          }
        }
      } catch (autoFixError) {
        console.error('❌ Auto-fix service error:', autoFixError)
        // If auto-fix errors, generate AI suggestions for original issues
        if (issuesNeedingRemediation.length > 0 && enhancedIssues.length === 0) {
          console.log(`🤖 Auto-fix error - generating AI suggestions for ${issuesNeedingRemediation.length} original issues...`)
          const claudeAPI = new ClaudeAPI()
          enhancedIssues = await Promise.all(
            issuesNeedingRemediation.map(async (adobeIssue: any, index: number) => {
              if (activeScans.get(scanId)?.cancelled) {
                throw new Error('Scan was cancelled by user')
              }
              
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
              
              let elementContext = adobeIssue.description || adobeIssue.rule || 'Accessibility issue'
              if (elementInfo.length > 0) {
                elementContext = `${elementContext}. ${elementInfo.join(', ')}`
              } else if (adobeIssue.description) {
                elementContext = adobeIssue.description
              }
              
              let locationForAI = adobeIssue.location || adobeIssue.elementLocation
              if (!locationForAI || locationForAI === 'Unknown location' || locationForAI === 'Document') {
                const ruleName = adobeIssue.rule || adobeIssue.ruleName || ''
                if (ruleName.toLowerCase().includes('figure') || ruleName.toLowerCase().includes('image')) {
                  locationForAI = 'All figures/images in document'
                } else if (ruleName.toLowerCase().includes('table')) {
                  locationForAI = 'All tables in document'
                } else if (ruleName.toLowerCase().includes('heading')) {
                  locationForAI = 'All headings in document'
                } else if (ruleName.toLowerCase().includes('title')) {
                  locationForAI = 'Document properties'
                } else if (ruleName.toLowerCase().includes('language')) {
                  locationForAI = 'Document properties'
                } else {
                  locationForAI = 'Document'
                }
              }
              
              const aiSuggestion = await claudeAPI.generateDocumentAccessibilitySuggestion(
                elementContext,
                adobeIssue.rule || adobeIssue.ruleName || 'Accessibility',
                body.fileName,
                body.fileType,
                locationForAI,
                adobeIssue.page || adobeIssue.pageNumber,
                adobeIssue.elementContent,
                adobeIssue.elementId,
                adobeIssue.elementType
              )
              
              return {
                id: `adobe_issue_${Date.now()}_${index}`,
                type: 'critical',
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
                impact: 'high',
                recommendation: aiSuggestion,
                remediation: aiSuggestion,
                status: 'Failed'
              }
            })
          )
        }
      }
      
      // Calculate compliance and score based on REMAINING issues after auto-fix
      // Only count Failed issues (exclude "Needs manual check" - those are informational)
      const totalIssuesFound = enhancedIssues.length // Only remaining Failed issues
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
        },
        // Comparison report showing what was fixed vs what remains
        comparisonReport: comparisonReport
      }
      
      // Store PDFs for download (prioritize auto-fixed PDF, then tagged PDF)
      // Convert to base64 for JSON response
      if (autoFixedPdfBuffer) {
        try {
          const base64String = autoFixedPdfBuffer.toString('base64')
          finalScanResult.taggedPdfBase64 = base64String
          finalScanResult.taggedPdfFileName = body.fileName.replace(/\.pdf$/i, '_auto-fixed.pdf')
          ;(finalScanResult as any).autoFixed = true
          ;(finalScanResult as any).autoFixStats = autoFixResult?.fixesApplied
          ;(finalScanResult as any).verification = verificationResult // Include verification results (same as test scripts)
          console.log(`✅ Auto-fixed PDF stored for download: ${finalScanResult.taggedPdfFileName}`)
          console.log(`   Fixes applied: ${autoFixResult?.fixesApplied.altText || 0} alt texts, ${autoFixResult?.fixesApplied.tableSummaries || 0} table summaries`)
          console.log(`   Base64 size: ${Math.round(base64String.length / 1024)} KB`)
        } catch (error) {
          console.error('❌ Failed to convert auto-fixed PDF to base64:', error)
          // Fall through to tagged PDF
        }
      }
      
      // If no auto-fixed PDF, use tagged PDF
      if (!autoFixedPdfBuffer && autoTagResult.success && autoTagResult.taggedPdfBuffer) {
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
      } else if (!autoFixedPdfBuffer) {
        console.warn('⚠️ No PDF available for download')
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
    
    // Final cancellation check - refund credit if cancelled
    if (activeScans.get(scanId)?.cancelled) {
      const scanStatus = activeScans.get(scanId)
      if (scanStatus?.creditTransactionId && scanStatus?.userId) {
        try {
          await query('BEGIN')
          await query(
            `UPDATE user_credits 
             SET credits_remaining = credits_remaining + 1, 
                 credits_used = GREATEST(0, credits_used - 1),
                 updated_at = NOW()
             WHERE user_id = $1`,
            [scanStatus.userId]
          )
          await query(
            `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
             VALUES ($1, $2, $3, $4)`,
            [scanStatus.userId, 'refund', 1, `Refund for cancelled scan: ${scanId}`]
          )
          await query('COMMIT')
          console.log(`💰 Credit refunded for cancelled scan ${scanId}`)
        } catch (refundError) {
          await query('ROLLBACK')
          console.error('❌ Failed to refund credit on cancellation:', refundError)
        }
      }
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
          
          // Auto-sync to Jira if enabled (AFTER backlog items are created)
          try {
            const { autoSyncIssuesToJira, getIssueIdsFromScan } = await import('@/lib/jira-sync-service')
            const issueIds = await getIssueIdsFromScan(scanHistoryResult)
            
            if (issueIds.length > 0) {
              console.log(`🔗 Auto-syncing ${issueIds.length} document issues to Jira...`)
              const syncResult = await autoSyncIssuesToJira(user.userId, issueIds)
              console.log(`✅ Jira sync complete: ${syncResult.created} created, ${syncResult.skipped} skipped, ${syncResult.errors} errors`)
            }
          } catch (jiraError) {
            // Don't fail scan if Jira sync fails
            console.error('❌ Error auto-syncing to Jira:', jiraError)
          }
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
    
    // Require authentication for cancellation
    const user = await getAuthenticatedUser(request)
    
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
    
    // Refund credit if scan was cancelled (only if credits were deducted)
    if (scanStatus.creditTransactionId && scanStatus.userId && scanStatus.userId === user.userId) {
      try {
        // Get the transaction to check if credit was deducted
        const transaction = await queryOne(
          'SELECT * FROM credit_transactions WHERE id = $1 AND user_id = $2',
          [scanStatus.creditTransactionId, scanStatus.userId]
        )
        
        if (transaction && transaction.credits_amount < 0) {
          // Credit was deducted, refund it
          await query('BEGIN')
          
          try {
            // Refund the credit
            await query(
              `UPDATE user_credits 
               SET credits_remaining = credits_remaining + 1, 
                   credits_used = GREATEST(0, credits_used - 1),
                   updated_at = NOW()
               WHERE user_id = $1`,
              [scanStatus.userId]
            )
            
            // Log the refund transaction
            await query(
              `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
               VALUES ($1, $2, $3, $4)`,
              [scanStatus.userId, 'refund', 1, `Refund for cancelled scan: ${scanId}`]
            )
            
            await query('COMMIT')
            console.log(`💰 Credit refunded for cancelled scan ${scanId}`)
          } catch (refundError) {
            await query('ROLLBACK')
            console.error('❌ Failed to refund credit:', refundError)
            // Continue with cancellation even if refund fails
          }
        }
      } catch (error) {
        console.error('❌ Error checking transaction for refund:', error)
        // Continue with cancellation even if refund check fails
      }
    }
    
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
      message: 'Scan cancelled successfully. Credit has been refunded if applicable.'
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
