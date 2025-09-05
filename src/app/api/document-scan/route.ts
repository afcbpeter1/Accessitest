import { NextRequest, NextResponse } from 'next/server'
import { ClaudeAPI } from '@/lib/claude-api'
import { ComprehensiveDocumentScanner } from '@/lib/comprehensive-document-scanner'

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
    const body: DocumentScanRequest = await request.json()
    
    console.log('🔍 Starting document scan for:', body.fileName)
    
    // Generate scan ID if not provided
    const scanId = body.scanId || `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Register this scan as active
    activeScans.set(scanId, { cancelled: false })
    
    // Convert base64 to buffer
    const fileBuffer = Buffer.from(body.fileContent, 'base64')
    
    // Initialize the COMPREHENSIVE document scanner with selected tags
    const scanner = new ComprehensiveDocumentScanner()
    
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
          issues: enhancedResult.issues.slice(0, 10), // Store first 10 issues to avoid huge records
          metadata: enhancedResult.metadata
        }
      }
      
      scanDatabase.set(scanRecord.id, scanRecord)
      console.log(`💾 Scan results saved to database: ${scanRecord.id}`)
      
      // Clean up scan record
      activeScans.delete(scanId)
      
      return NextResponse.json({
        success: true,
        result: enhancedResult,
        scanId
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
        issues: scanResult.issues.slice(0, 10), // Store first 10 issues to avoid huge records
        metadata: scanResult.metadata
      }
    }
    
    scanDatabase.set(scanRecord.id, scanRecord)
    console.log(`💾 Scan results saved to database: ${scanRecord.id}`)
    
    // Clean up scan record
    activeScans.delete(scanId)
    
    return NextResponse.json({
      success: true,
      result: scanResult,
      scanId
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
        
        // Create detailed context for AI
        const issueContext = `
Issue: ${issue.description}
Section: ${issue.section}
Page: ${issue.pageNumber || 'Unknown'}
Line: ${issue.lineNumber || 'Unknown'}
Location: ${issue.elementLocation || 'Unknown'}
WCAG Criterion: ${issue.wcagCriterion || 'Unknown'}
Section 508 Requirement: ${issue.section508Requirement || 'Unknown'}
Document: ${request.fileName}
File Type: ${request.fileType}
        `.trim()
        
        const aiRecommendation = await claudeAPI.generateDocumentAccessibilitySuggestion(
          issue.description,
          issue.section,
          request.fileName,
          request.fileType,
          issue.elementContent,
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
