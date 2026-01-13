import { NextRequest, NextResponse } from 'next/server'
import { DocumentRepairService } from '@/lib/document-repair-service'
import { ComprehensiveDocumentScanner } from '@/lib/comprehensive-document-scanner'
import { getAuthenticatedUser } from '@/lib/auth-middleware'

/**
 * PDF Repair API
 * Uses Adobe PDF Services to auto-tag PDFs, then rescans to verify fixes
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const user = await getAuthenticatedUser(request)

    const formData = await request.formData()
    const file = formData.get('file') as File
    const fileName = formData.get('fileName') as string || 'document.pdf'

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Only process PDFs
    if (!file.type.includes('pdf') && !fileName.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { error: 'This endpoint only processes PDF files' },
        { status: 400 }
      )
    }
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)

    // Step 1: Scan the PDF first to get issues
    const scanner = new ComprehensiveDocumentScanner()
    const scanResult = await scanner.scanDocument(
      fileBuffer,
      fileName,
      'pdf',
      undefined, // No selected tags - run full scan
      () => false // No cancellation
    )
    // Step 2: Repair the PDF using Adobe PDF Services
    const repairService = new DocumentRepairService()
    const repairResult = await repairService.repairDocument(
      fileBuffer,
      fileName,
      'pdf',
      scanResult.issues,
      false // Don't rebuild, use Adobe auto-tag
    )

    if (!repairResult.repairedDocument) {
      return NextResponse.json({
        success: false,
        error: 'PDF repair failed - no repaired document returned',
        originalScan: scanResult,
        repairPlan: repairResult.repairPlan
      }, { status: 500 })
    }
    // Step 3: Rescan the repaired PDF to verify fixes
    const rescanResult = await scanner.scanDocument(
      repairResult.repairedDocument,
      fileName.replace('.pdf', '_fixed.pdf'),
      'pdf',
      undefined,
      () => false
    )

    `)

    // Convert repaired PDF to base64 for download
    const repairedPdfBase64 = repairResult.repairedDocument.toString('base64')

    return NextResponse.json({
      success: true,
      message: 'PDF repaired and rescanned successfully',
      originalScan: {
        issues: scanResult.issues,
        score: scanResult.overallScore,
        summary: scanResult.summary
      },
      repairedScan: {
        issues: rescanResult.issues,
        score: rescanResult.overallScore,
        summary: rescanResult.summary
      },
      improvement: {
        issuesFixed: scanResult.issues.length - rescanResult.issues.length,
        scoreImprovement: rescanResult.overallScore - scanResult.overallScore,
        issuesRemaining: rescanResult.issues.length
      },
      repairedPdf: repairedPdfBase64,
      repairPlan: repairResult.repairPlan
    })

  } catch (error: any) {
    console.error('❌ PDF repair error:', error)
    return NextResponse.json(
      {
        error: error.message || 'Failed to repair PDF',
        details: error.stack
      },
      { status: 500 }
    )
  }
}

