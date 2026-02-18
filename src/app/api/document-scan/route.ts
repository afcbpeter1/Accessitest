import { NextRequest, NextResponse } from 'next/server'
import { ClaudeAPI } from '@/lib/claude-api'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import { getUserCredits, deductCredits, addCredits } from '@/lib/credit-service'
import { NotificationService } from '@/lib/notification-service'
import { autoAddDocumentIssuesToBacklog } from '@/lib/backlog-service'
import { getAdobePDFServices } from '@/lib/adobe-pdf-services'
import { PDFAutoTagService } from '@/lib/pdf-auto-tag-service'
import { ComprehensiveDocumentScanner } from '@/lib/comprehensive-document-scanner'
import { WordAutoFixService } from '@/lib/word-auto-fix-service'
import { AIAutoFixService } from '@/lib/ai-auto-fix-service'
import { validatePDFFile, validateWordFile } from '@/lib/file-security-validator'
import * as path from 'path'
import { tmpdir } from 'os'
import { promises as fs } from 'fs'

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

// Track active scans (creditDeducted = we used credit-service so refund via addCredits)
interface ActiveScan {
  cancelled: boolean
  creditTransactionId?: number | null
  userId?: string
  creditDeducted?: boolean
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
    // Validate input
    if (!pdfBuffer || !Buffer.isBuffer(pdfBuffer)) {
      return {
        success: false,
        error: 'Invalid PDF buffer provided'
      }
    }
    
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
      // Write Python verification script to temp file (avoids indentation issues with inline -c)
      const verifyScriptPath = path.join(tempDir, `verify-${Date.now()}.py`)
      const verifyScript = `import fitz
import pikepdf
import sys
import json
import os

try:
    pdf_path = r'${tempPdfPath.replace(/\\/g, '/')}'
    
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
    # Initialize counts before try block so they're always defined
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
                
                class Counter:
                    def __init__(self):
                        self.figure_count = 0
                        self.table_count = 0
                        self.heading_count = 0
                
                counter = Counter()
                
                def count_elements(elem):
                    if isinstance(elem, pikepdf.IndirectObject):
                        elem_obj = pdf.get_object(elem.objgen)
                    else:
                        elem_obj = elem
                    
                    if isinstance(elem_obj, pikepdf.Dictionary):
                        s_type = elem_obj.get('/S')
                        if s_type == pikepdf.Name('/Figure'):
                            counter.figure_count += 1
                        elif s_type == pikepdf.Name('/Table'):
                            counter.table_count += 1
                        elif str(s_type).startswith('/H'):
                            counter.heading_count += 1
                        
                        k_children = elem_obj.get('/K', pikepdf.Array([]))
                        for child in k_children:
                            if isinstance(child, (pikepdf.IndirectObject, pikepdf.Dictionary)):
                                count_elements(child)
                
                for elem in k_array:
                    count_elements(elem)
                
                figure_count = counter.figure_count
                table_count = counter.table_count
                heading_count = counter.heading_count
    except Exception as e:
        # Counts already initialized to 0 above
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
      
      await fs.writeFile(verifyScriptPath, verifyScript)
      
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const { stdout } = await execAsync(`${pythonCmd} "${verifyScriptPath}"`, {
        maxBuffer: 10 * 1024 * 1024
      })
      
      // Cleanup script file
      await fs.unlink(verifyScriptPath).catch(() => {})
      
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
  let scanId: string | undefined = undefined // Declare scanId in outer scope for error handler
  
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)
    
    const body: DocumentScanRequest = await request.json()

    scanId = body.scanId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Register this scan as active (before any processing)
    activeScans.set(scanId, { cancelled: false })
    
    // Convert base64 to buffer
    const fileBuffer = Buffer.from(body.fileContent, 'base64')
    
    // File size limit (defined once for the entire function)
    const FILE_SIZE_LIMIT = 50 * 1024 * 1024 // 50MB
    
    // CRITICAL: Security validation - prevent file spoofing attacks
    // Check if this is a PDF or Word file by extension
    const isPDF = body.fileType.toLowerCase().includes('pdf') || body.fileName.toLowerCase().endsWith('.pdf')
    const isWord = body.fileType.toLowerCase().includes('word') || 
                   body.fileType.toLowerCase().includes('document') ||
                   body.fileName.toLowerCase().endsWith('.docx') ||
                   body.fileName.toLowerCase().endsWith('.doc')
    
    if (!isPDF && !isWord) {
      activeScans.delete(scanId)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Only PDF and Word documents are supported for auto-fix workflow'
        },
        { status: 400 }
      )
    }
    
    // CRITICAL: Validate actual file content (magic numbers) to prevent spoofing
    // A malicious file could have a .pdf extension but actually be an executable
    if (isPDF) {
      const pdfValidation = validatePDFFile(fileBuffer, body.fileName, body.fileType, FILE_SIZE_LIMIT)
      if (!pdfValidation.valid) {
        activeScans.delete(scanId)
        return NextResponse.json(
          { 
            success: false, 
            error: pdfValidation.error || 'Invalid PDF file',
            details: pdfValidation.details || 'File does not appear to be a valid PDF. This may be a file spoofing attempt.'
          },
          { status: 400 }
        )
      }
    } else if (isWord) {
      const wordValidation = validateWordFile(fileBuffer, body.fileName, body.fileType, FILE_SIZE_LIMIT)
      if (!wordValidation.valid) {
        activeScans.delete(scanId)
        return NextResponse.json(
          { 
            success: false, 
            error: wordValidation.error || 'Invalid Word document',
            details: wordValidation.details || 'File does not appear to be a valid Word document. This may be a file spoofing attempt.'
          },
          { status: 400 }
        )
      }
    }
    
    // ============================================
    // WORD DOCUMENT PROCESSING
    // ============================================
    if (isWord) {
      // Initialize ISO compliance report variable (only used for PDFs, but declared here for scope)
      let fixedISOCompliance: any = undefined
      
      // Check and deduct credits (organization credits - same as top bar / web scans)
      const creditInfo = await getUserCredits(user.userId)
      if (!creditInfo.unlimited_credits && creditInfo.credits_remaining < 1) {
        activeScans.delete(scanId)
        return NextResponse.json(
          {
            success: false,
            error: 'Insufficient credits. Please upgrade your plan or purchase more credits.',
            creditsRemaining: creditInfo.credits_remaining
          },
          { status: 402 }
        )
      }

      const deductResult = await deductCredits(user.userId, 1, `Document scan: ${body.fileName}`, scanId)
      if (!deductResult.success) {
        activeScans.delete(scanId)
        return NextResponse.json(
          {
            success: false,
            error: deductResult.error ?? 'Insufficient credits. Please upgrade your plan or purchase more credits.',
            creditsRemaining: deductResult.credits_remaining
          },
          { status: 402 }
        )
      }

      if (deductResult.credits_remaining <= 3 && deductResult.credits_remaining > 0) {
        await NotificationService.notifyLowCredits(user.userId, deductResult.credits_remaining)
      }

      activeScans.set(scanId, {
        cancelled: false,
        creditTransactionId: null,
        userId: user.userId,
        creditDeducted: true
      })

      // Step 1: Scan Word document

      const scanner = new ComprehensiveDocumentScanner()
      const scanResult = await scanner.scanDocument(
        fileBuffer,
        body.fileName,
        body.fileType,
        undefined,
        () => activeScans.get(scanId as string)?.cancelled || false
      )

      if (!scanResult) {
        throw new Error('Scan result is null or undefined')
      }

      const originalIssues = scanResult.issues || []


      // Step 2: Apply auto-fixes

      const wordAutoFixService = new WordAutoFixService()
      
      // Extract document text from scan result
      let documentText: string | undefined = undefined
      try {
        const mammoth = require('mammoth')
        const textResult = await mammoth.extractRawText({ buffer: fileBuffer })
        documentText = textResult.value
      } catch (e) {
        console.warn(' Could not extract Word document text:', e)
      }
      
      const autoFixResult = await wordAutoFixService.applyAutoFixes(
        fileBuffer,
        originalIssues,
        body.fileName,
        documentText,
        undefined // parsedStructure - will be extracted from issues if needed
      )

      if (autoFixResult.errors && autoFixResult.errors.length > 0) {
        console.error('Auto-fix errors:', autoFixResult.errors)
      }

      let fixedWordBuffer: Buffer | undefined = undefined
      let remainingIssues: any[] = originalIssues
      let comparisonReport: any = undefined

      if (autoFixResult.success && autoFixResult.fixedWordBuffer) {
        fixedWordBuffer = autoFixResult.fixedWordBuffer

        // Step 3: Re-scan fixed document

        const fixedScanResult = await scanner.scanDocument(
          fixedWordBuffer,
          body.fileName,
          body.fileType,
          undefined,
          () => activeScans.get(scanId as string)?.cancelled || false
        )

        remainingIssues = fixedScanResult.issues || []

        // Generate comparison report
        // Track which issues were actually fixed by comparing issue descriptions
        // Create a map of original issue descriptions for comparison
        const originalIssueMap = new Map<string, any>()
        originalIssues.forEach((issue: any) => {
          const key = issue.description || issue.section || issue.id || JSON.stringify(issue)
          originalIssueMap.set(key, issue)
        })

        // Count how many original issues are no longer present
        const fixedIssues: any[] = []
        originalIssues.forEach((originalIssue: any) => {
          const key = originalIssue.description || originalIssue.section || originalIssue.id || JSON.stringify(originalIssue)
          const stillExists = remainingIssues.some((remaining: any) => {
            const remainingKey = remaining.description || remaining.section || remaining.id || JSON.stringify(remaining)
            return key === remainingKey
          })
          if (!stillExists) {
            fixedIssues.push(originalIssue)
          }
        })

        const originalCount = originalIssues.length
        const remainingCount = remainingIssues.length
        const fixedCount = fixedIssues.length

        comparisonReport = {
          original: {
            totalIssues: originalCount,
            failedIssues: originalCount // All issues are "failed" (need fixing)
          },
          fixed: {
            totalIssues: remainingCount,
            failedIssues: remainingCount // All remaining issues are "failed"
          },
          improvement: {
            issuesFixed: fixedCount,
            improvementPercentage: originalCount > 0 
              ? Math.round((fixedCount / originalCount) * 100) 
              : 0
          }
        }


      }

      // Step 4: Generate AI suggestions for remaining issues

      const claudeAPI = new ClaudeAPI()
      const documentType = isWord ? 'Word document' : 'PDF document'
      const enhancedIssues = await Promise.all(
        remainingIssues.slice(0, 50).map(async (issue: any, index: number) => {
          if (activeScans.get(scanId as string)?.cancelled) {
            throw new Error('Scan was cancelled by user')
          }

          const aiSuggestion = await claudeAPI.generateDocumentAccessibilitySuggestion(
            issue.description || issue.context || 'Accessibility issue',
            issue.section || issue.rule || 'Accessibility',
            body.fileName,
            body.fileType,
            issue.elementContent,
            issue.pageNumber || 1
          )

          return {
            ...issue,
            recommendation: aiSuggestion,
            remediation: aiSuggestion,
            autoFixed: false
          }
        })
      )

      // Build final result
      const finalScanResult = {
        is508Compliant: remainingIssues.length === 0,
        overallScore: remainingIssues.length === 0 ? 100 : Math.max(0, 100 - (remainingIssues.length * 5)),
        issues: enhancedIssues,
        summary: {
          total: remainingIssues.length,
          critical: remainingIssues.filter((i: any) => i.type === 'critical' || i.impact === 'high').length,
          serious: remainingIssues.filter((i: any) => i.type === 'serious' || i.impact === 'medium').length,
          moderate: remainingIssues.filter((i: any) => i.type === 'moderate' || i.impact === 'low').length,
          minor: remainingIssues.filter((i: any) => i.type === 'minor').length
        },
        metadata: {
          scanEngine: 'Comprehensive Document Scanner',
          standard: 'WCAG 2.1 AA, Section 508',
          pagesAnalyzed: scanResult.metadata?.pagesAnalyzed || 1,
          fileSize: fileBuffer.length
        },
        detailedReport: {
          categories: (scanResult as any).reportCategories || {},
          summary: (scanResult as any).reportSummary || scanResult.summary,
          issues: enhancedIssues
        },
        fixReport: {
          success: autoFixResult.success,
          fixesApplied: autoFixResult.fixesApplied,
          errors: autoFixResult.errors
        },
        autoFixStats: autoFixResult.success ? autoFixResult.fixesApplied : undefined, // For FixReport component
        comparisonReport: comparisonReport ? {
          original: {
            failed: comparisonReport.original.failedIssues,
            totalChecks: comparisonReport.original.totalIssues
          },
          fixed: {
            count: comparisonReport.fixed.failedIssues,
            issues: [] // Will be populated if needed
          },
          remaining: {
            failed: comparisonReport.fixed.failedIssues,
            totalChecks: comparisonReport.fixed.totalIssues,
            issues: remainingIssues.slice(0, 20) // Show first 20 remaining issues
          },
          improvement: {
            improvementPercentage: comparisonReport.improvement.improvementPercentage
          }
        } : undefined,
        isoComplianceReport: fixedISOCompliance ? {
          before: {
            compliant: fixedISOCompliance.before.compliant,
            passed: fixedISOCompliance.before.summary.passed,
            failed: fixedISOCompliance.before.summary.failed,
            totalChecks: fixedISOCompliance.before.summary.total_checks,
            complianceRate: fixedISOCompliance.before.summary.compliance_rate,
            failures: fixedISOCompliance.before.failures,
            checks: Object.entries(fixedISOCompliance.before.checks || {}).map(([name, check]: [string, any]) => ({
              name,
              passed: check.passed,
              failures: check.failures || []
            }))
          },
          after: {
            compliant: fixedISOCompliance.after.compliant,
            passed: fixedISOCompliance.after.summary.passed,
            failed: fixedISOCompliance.after.summary.failed,
            totalChecks: fixedISOCompliance.after.summary.total_checks,
            complianceRate: fixedISOCompliance.after.summary.compliance_rate,
            failures: fixedISOCompliance.after.failures,
            checks: Object.entries(fixedISOCompliance.after.checks || {}).map(([name, check]: [string, any]) => ({
              name,
              passed: check.passed,
              failures: check.failures || []
            }))
          },
          improvement: {
            checksFixed: fixedISOCompliance.improvement.checks_fixed,
            checksRegressed: fixedISOCompliance.improvement.checks_regressed,
            complianceRateBefore: fixedISOCompliance.improvement.compliance_rate_before,
            complianceRateAfter: fixedISOCompliance.improvement.compliance_rate_after,
            compliant: fixedISOCompliance.improvement.compliant
          },
          checks: fixedISOCompliance.checks.map((check: any) => ({
            checkName: check.check_name,
            isoRequirement: check.iso_requirement,
            isoDescription: check.iso_description,
            before: {
              status: check.before.status,
              passed: check.before.passed,
              failures: check.before.failures
            },
            after: {
              status: check.after.status,
              passed: check.after.passed,
              failures: check.after.failures
            },
            improvement: {
              fixed: check.improvement.fixed,
              statusChange: check.improvement.status_change
            }
          }))
        } : undefined,
        fixedDocument: fixedWordBuffer ? {
          buffer: fixedWordBuffer.toString('base64'),
          fileName: body.fileName.replace(/\.(docx?|doc)$/i, '_fixed.docx'),
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        } : undefined
      }

      activeScans.delete(scanId)

      // Add issues to backlog
      // For Word documents, we don't have a scan_history record yet, so we'll skip the backlog for now
      // TODO: Create scan_history record for Word documents or make scanHistoryId optional
      if (enhancedIssues.length > 0) {
        try {
          // Create a temporary scan_history record for Word documents
          const scanHistoryResult = await queryOne(`
            INSERT INTO scan_history (
              user_id, scan_type, scan_title, file_name, file_type,
              total_issues, critical_issues, serious_issues, moderate_issues, minor_issues,
              overall_score, is_508_compliant, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
            RETURNING id
          `, [
            user.userId,
            'document',
            body.fileName,
            body.fileName,
            body.fileType,
            enhancedIssues.length,
            enhancedIssues.filter((i: any) => i.type === 'critical').length,
            enhancedIssues.filter((i: any) => i.type === 'serious').length,
            enhancedIssues.filter((i: any) => i.type === 'moderate').length,
            enhancedIssues.filter((i: any) => i.type === 'minor').length,
            finalScanResult.overallScore,
            finalScanResult.is508Compliant
          ])
          
          if (scanHistoryResult?.id) {
            await autoAddDocumentIssuesToBacklog(user.userId, enhancedIssues, scanHistoryResult.id, body.fileName)

          }
        } catch (backlogError) {
          console.error('❌ Failed to add Word document issues to backlog:', backlogError)
          // Don't fail the entire scan if backlog addition fails
        }
      }

      return NextResponse.json({
        success: true,
        scanId: scanId,
        scanResults: finalScanResult,
        scanDuration: Date.now() - startTime
      })
    }
    
    // ============================================
    // PDF DOCUMENT PROCESSING (existing code)
    // ============================================
    
    // Check file size BEFORE processing and BEFORE deducting credits
    // FILE_SIZE_LIMIT already defined above
    
    // Check file size first
    if (fileBuffer.length > FILE_SIZE_LIMIT) {
      activeScans.delete(scanId)
      return NextResponse.json(
        { 
          success: false, 
          error: `PDF exceeds file size limit`,
          details: `This PDF is ${Math.round(fileBuffer.length / (1024 * 1024))}MB, but the maximum file size for document scanning is ${Math.round(FILE_SIZE_LIMIT / (1024 * 1024))}MB.`,
          fileSize: fileBuffer.length,
          maxFileSize: FILE_SIZE_LIMIT,
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
      
      // No page limit - we can process any size PDF now
      console.log(`📄 PDF detected: ${pageCount} pages (${isScannedPDF ? 'scanned' : 'standard'})`)
    } catch (pageCountError: any) {
      console.warn('Could not check page count:', pageCountError.message)
      // Continue processing - we'll handle errors during processing if needed
      // This prevents blocking valid PDFs if page count check fails
      isScannedPDF = false
    }
    
    // Check and deduct credits AFTER page count validation passes (organization credits - same as top bar)
    const creditInfo = await getUserCredits(user.userId)
    if (!creditInfo.unlimited_credits && creditInfo.credits_remaining < 1) {
      await NotificationService.notifyInsufficientCredits(user.userId)
      activeScans.delete(scanId)
      return NextResponse.json(
        { error: 'Insufficient credits', canScan: false },
        { status: 402 }
      )
    }

    const deductResult = await deductCredits(user.userId, 1, `Document scan: ${body.fileName}`, scanId)
    if (!deductResult.success) {
      await NotificationService.notifyInsufficientCredits(user.userId)
      activeScans.delete(scanId)
      return NextResponse.json(
        { error: deductResult.error ?? 'Insufficient credits', canScan: false },
        { status: 402 }
      )
    }

    if (deductResult.credits_remaining <= 1 && deductResult.credits_remaining > 0) {
      await NotificationService.notifyLowCredits(user.userId, deductResult.credits_remaining)
    }

    const currentScan = activeScans.get(scanId)
    activeScans.set(scanId, {
      cancelled: currentScan?.cancelled || false,
      creditTransactionId: null,
      userId: user.userId,
      creditDeducted: true
    })
    
    // Initialize scan result structure
    let finalScanResult: any = {
      is508Compliant: false,
      overallScore: 0,
      issues: [],
      summary: { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 },
      metadata: { 
        scanEngine: 'PDF Auto-Tagging Service', 
        standard: 'PDF/UA, WCAG 2.1 AA',
        pagesAnalyzed: 0,
        fileSize: fileBuffer.length
      }
    }
    
    // Step 1: Auto-tag the PDF using our ISO 14289-1 compliant service
    // This fixes missing tags and prepares the document for accessibility checking
    console.log('🏷️ Auto-tagging PDF with our service...')
    const pdfAutoTagService = new PDFAutoTagService()
    
    // Check dependencies
    const deps = await pdfAutoTagService.checkDependencies()
    if (!deps.python || !deps.pymupdf) {
      console.warn('⚠️ PyMuPDF not available, continuing without auto-tagging')
      // Continue with original PDF - we'll still scan and fix issues
    }
    
    const autoTagResult = await pdfAutoTagService.autoTagPDF(fileBuffer, body.fileName)
    
    let taggedPdfBuffer = fileBuffer
    let taggingSuccess = false
    
    if (autoTagResult.success && autoTagResult.taggedPdfBuffer) {
      taggedPdfBuffer = Buffer.from(autoTagResult.taggedPdfBuffer)
      taggingSuccess = true
      console.log(`✅ PDF auto-tagged successfully: ${autoTagResult.structureDetected?.headings || 0} headings, ${autoTagResult.structureDetected?.tables || 0} tables, ${autoTagResult.structureDetected?.lists || 0} lists, ${autoTagResult.structureDetected?.images || 0} images`)
    } else {
      const errorMessage = autoTagResult.error || autoTagResult.message || ''
      console.warn(`⚠️ Auto-tag failed: ${errorMessage}`)
      // Continue with original PDF - we'll still scan and fix issues
      console.log(`ℹ️ Continuing with original PDF (will still scan and apply fixes)`)
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
    
    // Step 2: Scan the TAGGED PDF for accessibility issues
    // Use our comprehensive scanner to find all issues
    console.log('🔍 Scanning tagged PDF for accessibility issues...')
    const scanner = new ComprehensiveDocumentScanner()
    const initialScanResult = await scanner.scanDocument(taggedPdfBuffer, body.fileName, body.fileType)
    
    // Convert scan results to ISO 14289-1 compliance report format
    const complianceIssues = initialScanResult.issues.map((issue: any) => ({
      rule: issue.section || issue.category || 'Accessibility',
      ruleName: issue.section || issue.category || 'Accessibility',
      description: issue.description || issue.remediation || 'No description',
      page: issue.pageNumber || 1,
      location: issue.elementLocation || 'Document',
      status: issue.type === 'critical' || issue.type === 'serious' ? 'Failed' : 'Needs manual check',
      category: issue.category || 'Other',
      elementId: issue.id,
      elementType: issue.elementType,
      elementContent: issue.elementContent
    }))
    
    // Build report structure
    let reportCategories: any = {}
    complianceIssues.forEach((issue: any) => {
      const category = issue.category || 'Other'
      if (!reportCategories[category]) {
        reportCategories[category] = []
      }
      reportCategories[category].push({
        ruleName: issue.ruleName,
        status: issue.status,
        description: issue.description,
        page: issue.page,
        location: issue.location
      })
    })
    
    let reportSummary = {
      totalIssues: complianceIssues.length,
      criticalIssues: complianceIssues.filter((i: any) => i.status === 'Failed').length,
      warnings: complianceIssues.filter((i: any) => i.status === 'Needs manual check').length,
      passed: 0,
      needsManualCheck: complianceIssues.filter((i: any) => i.status === 'Needs manual check').length,
      failed: complianceIssues.filter((i: any) => i.status === 'Failed').length,
      skipped: 0
    }
    
    // Create ISO 14289-1 compliance result
    const accessibilityResult: {
      success: boolean
      compliant: boolean
      report: any
      error?: string
    } = {
      success: true,
      compliant: reportSummary.criticalIssues === 0 && reportSummary.warnings === 0,
      report: {
        summary: reportSummary,
        categories: reportCategories,
        issues: complianceIssues
      }
    }
    
    let comparisonReport: any = undefined
    
    // Process accessibility results
    if (accessibilityResult.success && accessibilityResult.report) {
      // Get ALL issues from the report
      let complianceIssues = accessibilityResult.report.issues || []
      
      // Filter to get ONLY Failed issues (exclude "Needs manual check" - those are informational only)
      const issuesNeedingRemediation = complianceIssues.filter((issue: any) => {
        const status = issue.status || (issue.type === 'error' ? 'Failed' : 'Passed')
        return status === 'Failed' || status === 'Failed manually'
      })
      
      // Store original scan results for comparison report
      const originalScanResults = {
        totalChecks: complianceIssues.length,
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


      // Don't generate AI suggestions yet - wait until after auto-fix and re-scan
      // This avoids wasting API calls on issues that will be auto-fixed
      let enhancedIssues: any[] = []
      
      // Step 3: Apply automatic fixes using AI + PyMuPDF
      // This is our USP - automatically fix issues like alt text and table summaries

      let autoFixedPdfBuffer: Buffer | undefined = undefined
      let autoFixResult: any = undefined
      let verificationResult: any = null
      
      try {
        const { AIAutoFixService } = await import('@/lib/ai-auto-fix-service')
        const autoFixService = new AIAutoFixService()
        
        // Extract document text for better bookmark/reading order analysis (optional)
        let documentText: string | undefined = undefined
        try {
          const pdfParse = require('pdf-parse')
          const pdfParseResult = await pdfParse(taggedPdfBuffer, { max: 0 })
          documentText = pdfParseResult.text

        } catch (textError) {
          console.warn(' Could not extract document text for AI analysis:', textError)
          // Continue without text - AI can still work with issue descriptions
        }
        
        // Apply auto-fixes to the tagged PDF
        const failedIssues = complianceIssues.filter((issue: any) => {
          const status = issue.status || 'Failed'
          return status === 'Failed' || status === 'Failed manually'
        }).map((issue: any) => ({
          ...issue,
          type: issue.type || 'critical' // Ensure type property exists
        }))
        
        autoFixResult = await autoFixService.applyAutoFixes(
          taggedPdfBuffer,
          failedIssues,
          body.fileName,
          documentText ?? undefined // Pass document text for better bookmark/reading order analysis (optional)
        )
        
        if (autoFixResult.success && autoFixResult.fixedPdfBuffer) {
          autoFixedPdfBuffer = autoFixResult.fixedPdfBuffer

          // Verify fixes were actually applied (same as test scripts)

          try {
            verificationResult = autoFixedPdfBuffer ? await verifyPDFFixes(autoFixedPdfBuffer) : { success: false, message: 'No buffer available' }
            if (verificationResult.success) {



            } else {
              console.warn('Verification failed:', verificationResult.error || 'Unknown error')
            }
          } catch (verifyError) {
            console.warn('Could not verify fixes (non-critical):', verifyError instanceof Error ? verifyError.message : 'Unknown error')
          }
          
          // Store verification result for response
          ;(autoFixResult as any).verification = verificationResult
          
          // Generate ISO 14289-1 compliance report (after fixes)
          let fixedISOCompliance: any = undefined
          try {
            const { generateISOComplianceReport } = await import('@/lib/iso-compliance-validator')
            const tempOriginalPath = path.join(tmpdir(), `original_iso_${Date.now()}.pdf`)
            const tempFixedPath = path.join(tmpdir(), `fixed_iso_${Date.now()}.pdf`)
            await fs.writeFile(tempOriginalPath, taggedPdfBuffer)
            if (autoFixedPdfBuffer) {
              await fs.writeFile(tempFixedPath, autoFixedPdfBuffer)
              fixedISOCompliance = await generateISOComplianceReport(tempOriginalPath, tempFixedPath)
            }
            
            // Cleanup temp files
            await fs.unlink(tempOriginalPath).catch(() => {})
            await fs.unlink(tempFixedPath).catch(() => {})
          } catch (isoError) {
            console.warn('Could not generate ISO compliance report:', isoError)
          }
          
          // Re-scan the FIXED PDF to get only remaining issues (avoid duplicate work)
          console.log('🔍 Re-scanning fixed PDF for remaining issues...')
          const fixedPdfScanResult = autoFixedPdfBuffer ? await scanner.scanDocument(autoFixedPdfBuffer, body.fileName, body.fileType) : null
          
          if (fixedPdfScanResult) {
            // Convert scan results to report format
            const fixedPdfIssues = fixedPdfScanResult.issues.map((issue: any) => ({
              rule: issue.section || issue.category || 'Accessibility',
              ruleName: issue.section || issue.category || 'Accessibility',
              description: issue.description || issue.remediation || 'No description',
              page: issue.pageNumber || 1,
              location: issue.elementLocation || 'Document',
              status: issue.type === 'critical' || issue.type === 'serious' ? 'Failed' : 'Needs manual check',
              category: issue.category || 'Other',
              elementId: issue.id,
              elementType: issue.elementType,
              elementContent: issue.elementContent
            }))
            
            // Filter out issues that the fix script reliably and completely addressed
            // Note: figure/alt issues are NOT filtered here - the re-scan result is authoritative
            // because alt text fixes may be partial (some figures have structural issues that can't be patched)
            const fixedByScript = new Set<string>()
            if (autoFixResult?.success) {
              // Table headers and heading nesting are always fully patched when script succeeds
              fixedByScript.add('table')
              fixedByScript.add('header')
              fixedByScript.add('heading')
              fixedByScript.add('bookmark')
              fixedByScript.add('nesting')
            }
            
            const remainingFailedIssues = fixedPdfIssues.filter((issue: any) => {
              const status = issue.status || 'Passed'
              if (status !== 'Failed' && status !== 'Failed manually') {
                return false
              }
              
              // Filter out issues that were fixed by the script
              // Check both rule/category name AND description for better matching
              const ruleText = (issue.rule || issue.ruleName || '').toLowerCase()
              const descText = (issue.description || '').toLowerCase()
              const combined = ruleText + ' ' + descText
              
              // Only filter heading/bookmark/table issues - these are reliably fixed
              // Figure/alt issues are NOT filtered - trust the re-scan result
              if (fixedByScript.has('heading') && (combined.includes('heading') || combined.includes('nesting') || combined.includes('bookmark'))) {
                return false
              }
              if (fixedByScript.has('table') && (combined.includes('table') || combined.includes('header'))) {
                return false
              }
              
              return true
            })
            
            // Build categories from re-scan
            const fixedReportCategories: any = {}
            fixedPdfIssues.forEach((issue: any) => {
              const category = issue.category || 'Other'
              if (!fixedReportCategories[category]) {
                fixedReportCategories[category] = []
              }
              fixedReportCategories[category].push({
                ruleName: issue.ruleName,
                status: issue.status,
                description: issue.description,
                page: issue.page,
                location: issue.location
              })
            })
            
            // USE RE-SCAN RESULTS for detailed report (not original scan)
            reportCategories = fixedReportCategories
            reportSummary = {
              totalIssues: fixedPdfIssues.length,
              criticalIssues: remainingFailedIssues.length,
              warnings: fixedPdfIssues.filter((i: any) => i.status === 'Needs manual check').length,
              passed: 0,
              needsManualCheck: fixedPdfIssues.filter((i: any) => i.status === 'Needs manual check').length,
              failed: remainingFailedIssues.length,
              skipped: 0
            }
            
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
              summary: reportSummary
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
            
            comparisonReport = {
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
            
            // Replace enhancedIssues with only remaining issues from fixed PDF
            if (remainingFailedIssues.length > 0) {
              // Enhance remaining issues with AI suggestions (only generate for issues that couldn't be auto-fixed)

              const remainingClaudeAPI = new ClaudeAPI()
              const remainingEnhancedIssues = await Promise.all(
                remainingFailedIssues.map(async (issue: any, index: number) => {
                  // Check for cancellation during AI enhancement
                  if (activeScans.get(scanId as string)?.cancelled) {
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

                  const aiSuggestion = await remainingClaudeAPI.generateDocumentAccessibilitySuggestion(
                    elementContext,
                    issue.rule || issue.ruleName || 'Accessibility',
                    body.fileName,
                    body.fileType,
                    issue.elementContent,
                    issue.page || issue.pageNumber
                  )
                  
                  return {
                    id: `iso_compliance_issue_${Date.now()}_${index}`,
                    type: 'critical',
                    category: issue.category || 'structure',
                    description: issue.description || issue.rule || issue.ruleName || 'ISO 14289-1 compliance issue',
                    section: issue.rule || issue.ruleName || 'ISO 14289-1',
                    pageNumber: issue.page || issue.pageNumber,
                    elementLocation: issue.location || issue.elementLocation || 'Unknown location',
                    elementId: issue.elementId,
                    elementType: issue.elementType,
                    elementContent: issue.elementContent,
                    elementTag: issue.elementTag,
                    context: `ISO 14289-1 compliance check found: ${issue.rule || issue.ruleName || 'Unknown rule'}${elementInfo.length > 0 ? ` (${elementInfo.join(', ')})` : ''}`,
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

            }
          }
        } else {
          console.warn(' Auto-fix failed or no fixes applied:', autoFixResult.errors)
          // If auto-fix failed, generate AI suggestions for original issues
          if (issuesNeedingRemediation.length > 0) {

            const claudeAPI = new ClaudeAPI()
            enhancedIssues = await Promise.all(
              issuesNeedingRemediation.map(async (complianceIssue: any, index: number) => {
                if (activeScans.get(scanId as string)?.cancelled) {
                  throw new Error('Scan was cancelled by user')
                }
                
                const elementInfo = []
                if (complianceIssue.page) elementInfo.push(`Page ${complianceIssue.page}`)
                if (complianceIssue.location && complianceIssue.location !== 'Unknown location' && complianceIssue.location !== 'Document') {
                  elementInfo.push(`Location: ${complianceIssue.location}`)
                }
                if (complianceIssue.elementId) elementInfo.push(`Element ID: ${complianceIssue.elementId}`)
                if (complianceIssue.elementType) elementInfo.push(`Element Type: ${complianceIssue.elementType}`)
                if (complianceIssue.elementContent) {
                  elementInfo.push(`Content: "${complianceIssue.elementContent.substring(0, 50)}${complianceIssue.elementContent.length > 50 ? '...' : ''}"`)
                }
                if (complianceIssue.elementTag) elementInfo.push(`PDF Tag: ${complianceIssue.elementTag}`)
                
                let elementContext = complianceIssue.description || complianceIssue.rule || 'ISO 14289-1 compliance issue'
                if (elementInfo.length > 0) {
                  elementContext = `${elementContext}. ${elementInfo.join(', ')}`
                } else if (complianceIssue.description) {
                  elementContext = complianceIssue.description
                }
                
                let locationForAI = complianceIssue.location || complianceIssue.elementLocation
                if (!locationForAI || locationForAI === 'Unknown location' || locationForAI === 'Document') {
                  const ruleName = complianceIssue.rule || complianceIssue.ruleName || ''
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
                  complianceIssue.rule || complianceIssue.ruleName || 'ISO 14289-1',
                  body.fileName,
                  body.fileType,
                  complianceIssue.elementContent,
                  complianceIssue.page || complianceIssue.pageNumber
                )
                
                return {
                  id: `iso_compliance_issue_${Date.now()}_${index}`,
                  type: 'critical',
                  category: complianceIssue.category || 'structure',
                  description: complianceIssue.description || complianceIssue.rule || complianceIssue.ruleName || 'ISO 14289-1 compliance issue',
                  section: complianceIssue.rule || complianceIssue.ruleName || 'ISO 14289-1',
                  pageNumber: complianceIssue.page || complianceIssue.pageNumber,
                  elementLocation: complianceIssue.location || complianceIssue.elementLocation || complianceIssue.context || 'Unknown location',
                  elementId: complianceIssue.elementId,
                  elementType: complianceIssue.elementType,
                  elementContent: complianceIssue.elementContent,
                  elementTag: complianceIssue.elementTag,
                  context: `ISO 14289-1 compliance check found: ${complianceIssue.rule || complianceIssue.ruleName || 'Unknown rule'}${elementInfo.length > 0 ? ` (${elementInfo.join(', ')})` : ''}`,
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

          const claudeAPI = new ClaudeAPI()
          enhancedIssues = await Promise.all(
            issuesNeedingRemediation.map(async (complianceIssue: any, index: number) => {
              if (activeScans.get(scanId as string)?.cancelled) {
                throw new Error('Scan was cancelled by user')
              }
              
              const elementInfo = []
              if (complianceIssue.page) elementInfo.push(`Page ${complianceIssue.page}`)
              if (complianceIssue.location && complianceIssue.location !== 'Unknown location' && complianceIssue.location !== 'Document') {
                elementInfo.push(`Location: ${complianceIssue.location}`)
              }
              if (complianceIssue.elementId) elementInfo.push(`Element ID: ${complianceIssue.elementId}`)
              if (complianceIssue.elementType) elementInfo.push(`Element Type: ${complianceIssue.elementType}`)
              if (complianceIssue.elementContent) {
                elementInfo.push(`Content: "${complianceIssue.elementContent.substring(0, 50)}${complianceIssue.elementContent.length > 50 ? '...' : ''}"`)
              }
              if (complianceIssue.elementTag) elementInfo.push(`PDF Tag: ${complianceIssue.elementTag}`)
              
              let elementContext = complianceIssue.description || complianceIssue.rule || 'ISO 14289-1 compliance issue'
              if (elementInfo.length > 0) {
                elementContext = `${elementContext}. ${elementInfo.join(', ')}`
              } else if (complianceIssue.description) {
                elementContext = complianceIssue.description
              }
              
              let locationForAI = complianceIssue.location || complianceIssue.elementLocation
              if (!locationForAI || locationForAI === 'Unknown location' || locationForAI === 'Document') {
                const ruleName = complianceIssue.rule || complianceIssue.ruleName || ''
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
                complianceIssue.rule || complianceIssue.ruleName || 'ISO 14289-1',
                body.fileName,
                body.fileType,
                complianceIssue.elementContent,
                complianceIssue.page || complianceIssue.pageNumber
              )
              
              return {
                id: `iso_compliance_issue_${Date.now()}_${index}`,
                type: 'critical',
                category: complianceIssue.category || 'structure',
                description: complianceIssue.description || complianceIssue.rule || complianceIssue.ruleName || 'ISO 14289-1 compliance issue',
                section: complianceIssue.rule || complianceIssue.ruleName || 'ISO 14289-1',
                pageNumber: complianceIssue.page || complianceIssue.pageNumber,
                elementLocation: complianceIssue.location || complianceIssue.elementLocation || complianceIssue.context || 'Unknown location',
                elementId: complianceIssue.elementId,
                elementType: complianceIssue.elementType,
                elementContent: complianceIssue.elementContent,
                elementTag: complianceIssue.elementTag,
                context: `ISO 14289-1 compliance check found: ${complianceIssue.rule || complianceIssue.ruleName || 'Unknown rule'}${elementInfo.length > 0 ? ` (${elementInfo.join(', ')})` : ''}`,
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
            needsManualCheck: accessibilityResult.report.summary.needsManualCheck || 0,
            passedManually: 0,
            failedManually: 0,
            skipped: accessibilityResult.report.summary.skipped || 0,
            passed: accessibilityResult.report.summary.passed || 0,
            failed: accessibilityResult.report.summary.failed || 0
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
        } catch (error) {
          console.error('❌ Failed to convert tagged PDF to base64:', error)
          console.warn(' Tagged PDF will not be available for download')
        }
      } else if (!autoFixedPdfBuffer) {
        console.warn(' No PDF available for download')
        if (!autoTagResult.success) {
          console.warn(`   Auto-tag result: ${autoTagResult.error || autoTagResult.message}`)
        }
        if (!autoTagResult.taggedPdfBuffer) {
          console.warn('   No tagged PDF buffer returned from Adobe')
        }
      }
      // Surface PyMuPDF unavailable so UI can show a friendly message (scan still succeeds)
      if (autoFixResult?.errors?.length && autoFixResult.errors.some((e: string) => String(e).includes('PyMuPDF'))) {
        ;(finalScanResult as any).autoFixUnavailableReason = 'PDF auto-fix was skipped (PyMuPDF is not installed on this server). You still receive full scan results and AI suggestions. To enable automatic PDF fixes, install PyMuPDF on the server (e.g. pip install pymupdf).'
      }
    } else {
      console.warn(` Adobe Accessibility Check failed: ${accessibilityResult.error || 'Unknown error'}`)
      
      // Initialize finalScanResult even when Adobe fails
      const errorMessage = accessibilityResult.error || 'Adobe accessibility check failed'
      
      // Check if it's a quota error
      const isQuotaError = errorMessage.toLowerCase().includes('quota') || 
                          errorMessage.toLowerCase().includes('exhausted')
      
      finalScanResult = {
        is508Compliant: false,
        overallScore: 0,
        issues: [],
        summary: {
          total: 0,
          critical: 0,
          serious: 0,
          moderate: 0,
          minor: 0
        },
        detailedReport: isQuotaError ? {
          filename: body.fileName,
          reportCreatedBy: 'Adobe PDF Services API',
          organization: 'Accessitest',
          summary: {
            needsManualCheck: 0,
            passedManually: 0,
            failedManually: 0,
            skipped: 0,
            passed: 0,
            failed: 0
          },
          categories: {
            'Error': [{
              ruleName: 'Adobe Services Unavailable',
              status: 'Failed',
              description: isQuotaError 
                ? 'Adobe PDF Services quota has been exceeded. Please try again later or contact support.'
                : errorMessage,
              page: undefined,
              location: 'Document'
            }]
          },
          autoTagged: false
        } : undefined,
        metadata: {
          scanEngine: 'Adobe PDF Services API',
          standard: 'PDF/UA, WCAG 2.1 AA',
          pagesAnalyzed: 0,
          fileSize: fileBuffer.length,
          scanDuration: Date.now() - startTime,
          taggedPdfAvailable: false,
          autoTagged: false
        },
        error: errorMessage,
        comparisonReport: undefined
      }
    }
    
    // Final cancellation check - refund credit if cancelled
    if (activeScans.get(scanId)?.cancelled) {
      const scanStatus = activeScans.get(scanId)
      if (scanStatus?.creditDeducted && scanStatus?.userId) {
        try {
          await addCredits(scanStatus.userId, 1, `Refund for cancelled scan: ${scanId}`)
        } catch (refundError) {
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
          wcagLevel: (body as any).wcagLevel || 'AA',
          selectedTags: (body as any).selectedTags || []
        }
      })

      // Auto-add issues to product backlog
      // scanHistoryResult is the ID string, not an object

      if (scanResult.issues && scanResult.issues.length > 0 && scanHistoryResult) {

        try {
          backlogResult = await autoAddDocumentIssuesToBacklog(user.userId, scanResult.issues, scanHistoryResult, body.fileName)
          
          // Auto-sync to Jira if enabled (AFTER backlog items are created)
          try {
            const { autoSyncIssuesToJira, getIssueIdsFromScan } = await import('@/lib/jira-sync-service')
            const issueIds = await getIssueIdsFromScan(scanHistoryResult)
            
            if (issueIds.length > 0) {

              const syncResult = await autoSyncIssuesToJira(user.userId, issueIds)

            }
          } catch (jiraError) {
            // Don't fail scan if Jira sync fails
            console.error('❌ Error auto-syncing to Jira:', jiraError)
          }

          // Auto-sync to Azure DevOps if enabled (AFTER backlog items are created)
          try {
            const { autoSyncIssuesToAzureDevOps, getIssueIdsFromScan: getIssueIdsFromScanAzure } = await import('@/lib/azure-devops-sync-service')
            const issueIds = await getIssueIdsFromScanAzure(scanHistoryResult)
            
            if (issueIds.length > 0) {

              const syncResult = await autoSyncIssuesToAzureDevOps(user.userId, issueIds)

            }
          } catch (azureDevOpsError) {
            // Don't fail scan if Azure DevOps sync fails
            console.error('❌ Error auto-syncing to Azure DevOps:', azureDevOpsError)
          }
        } catch (backlogError) {
          console.error('❌ Failed to auto-add document issues to backlog:', backlogError)
          if (backlogError instanceof Error) {
            console.error('❌ Error stack:', backlogError.stack)
          }
          backlogResult = { success: false, error: backlogError instanceof Error ? backlogError.message : 'Unknown error' }
        }
      } else {
        console.warn(' Skipping backlog addition - no issues or missing scanHistoryResult:', {
          hasIssues: scanResult.issues && scanResult.issues.length > 0,
          issuesCount: scanResult.issues?.length || 0,
          hasScanHistoryResult: !!scanHistoryResult,
          scanHistoryResult: scanHistoryResult
        })
        backlogResult = { success: true, added: 0, skipped: 0, addedItems: [], skippedItems: [], total: scanResult.issues?.length ?? 0 }
      }
    } catch (error) {
      console.error('Failed to store document scan results in history:', error)
      backlogResult = {
        success: false,
        added: 0,
        skipped: 0,
        addedItems: [],
        skippedItems: [],
        error: error instanceof Error ? error.message : 'Scan history could not be stored'
      }
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

    } else {
      console.warn(' No tagged PDF to include in response')
    }
    
    // Surface PyMuPDF/unavailable auto-fix so the UI can show a friendly message (scan still succeeds)
    if (typeof (scanResult as any).autoFixUnavailableReason === 'string' && (scanResult as any).autoFixUnavailableReason) {
      responseData.autoFixUnavailable = true
      responseData.autoFixUnavailableReason = (scanResult as any).autoFixUnavailableReason
    }
    
    return NextResponse.json(responseData)
    
  } catch (error) {
    console.error('❌ Document scan error:', error)
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    
    // Get scan info before deleting (only if scanId was set)
    const currentScan = scanId ? activeScans.get(scanId) : undefined
    
    // Clean up active scan on error (only if scanId exists)
    if (scanId) {
      activeScans.delete(scanId)
    }
    
    // Refund credit if it was deducted
    if (currentScan?.creditDeducted && currentScan?.userId) {
      try {
        await addCredits(currentScan.userId, 1, `Document scan refund: processing error`)
      } catch (refundError) {
        console.error('❌ Failed to refund credit:', refundError)
      }
    }

    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to scan document',
        details: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : undefined) : undefined
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

    // Refund credit if scan was cancelled (only if credits were deducted)
    if (scanStatus.creditDeducted && scanStatus.userId && scanStatus.userId === user.userId) {
      try {
        await addCredits(scanStatus.userId, 1, `Refund for cancelled scan: ${scanId}`)
      } catch (refundError) {
        console.error('❌ Failed to refund credit:', refundError)
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
    
    // Process issues sequentially instead of concurrently to avoid rate limiting
    const enhancedIssues = []
    
    for (let i = 0; i < issuesToEnhance.length; i++) {
      const issue = scanResult.issues[i]
      try {

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

        enhancedIssues.push({
          ...issue,
          recommendation: aiRecommendation
        })
        
        // Reduced delay to 1 second for faster processing
        if (i < issuesToEnhance.length - 1) {

          await new Promise(resolve => setTimeout(resolve, 1000))
        }
        
      } catch (error) {
        console.error('❌ AI enhancement failed for issue:', issue.id, error)
        enhancedIssues.push({
          ...issue
        })
        
        // Even on error, wait before continuing to next issue
        if (i < issuesToEnhance.length - 1) {

          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    }

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
