import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { queryOne, query } from '@/lib/database'
import { DocumentRepairService, RepairPlan } from '@/lib/document-repair-service'
import { ComprehensiveDocumentScanner } from '@/lib/comprehensive-document-scanner'
import { NotificationService } from '@/lib/notification-service'

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)
    
    const body = await request.json()
    const { fileContent, fileName, fileType } = body
    
    if (!fileContent || !fileName || !fileType) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: fileContent, fileName, fileType' },
        { status: 400 }
      )
    }

    console.log(`🔧 Starting document repair for: ${fileName}`)

    // Check credits first (but don't deduct yet)
    let creditData = await queryOne(
      'SELECT * FROM user_credits WHERE user_id = $1',
      [user.userId]
    )

    if (!creditData) {
      await query(
        `INSERT INTO user_credits (user_id, credits_remaining, credits_used, unlimited_credits)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, 3, 0, false]
      )
      creditData = await queryOne(
        'SELECT * FROM user_credits WHERE user_id = $1',
        [user.userId]
      )
    }

    // Check if user has unlimited credits
    if (!creditData.unlimited_credits) {
      if (creditData.credits_remaining < 1) {
        await NotificationService.notifyInsufficientCredits(user.userId)
        return NextResponse.json(
          { success: false, error: 'Insufficient credits. Please purchase more credits to repair documents.' },
          { status: 402 }
        )
      }
    }

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(fileContent, 'base64')

    // Step 1: Scan document to find issues (BEFORE deducting credits)
    console.log(`🔍 Step 1: Scanning document for accessibility issues...`)
    let scanResult
    try {
      const scanner = new ComprehensiveDocumentScanner()
      scanResult = await scanner.scanDocument(
        fileBuffer,
        fileName,
        fileType,
        undefined, // All tests
        () => false // No cancellation for now
      )
      console.log(`✅ Scan complete: Found ${scanResult.issues?.length || 0} issues`)
    } catch (scanError) {
      console.error('❌ Scan failed, NOT deducting credits:', scanError)
      return NextResponse.json(
        { 
          success: false, 
          error: `Failed to scan document: ${scanError instanceof Error ? scanError.message : 'Unknown error'}` 
        },
        { status: 500 }
      )
    }

    // Only deduct credits AFTER scan succeeds
    if (!creditData.unlimited_credits) {
      await query('BEGIN')
      try {
        await query(
          `UPDATE user_credits 
           SET credits_remaining = credits_remaining - 1, 
               credits_used = credits_used + 1,
               updated_at = NOW()
           WHERE user_id = $1`,
          [user.userId]
        )

        await query(
          `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
           VALUES ($1, $2, $3, $4)`,
          [user.userId, 'usage', -1, `Document repair: ${fileName}`]
        )

        await query('COMMIT')
        console.log(`✅ Deducted 1 credit for document repair (after successful scan)`)
      } catch (error) {
        await query('ROLLBACK')
        throw error
      }
    } else {
      // Log unlimited usage
      await query(
        `INSERT INTO credit_transactions (user_id, transaction_type, credits_amount, description)
         VALUES ($1, $2, $3, $4)`,
        [user.userId, 'usage', 0, `Document repair (unlimited): ${fileName}`]
      )
    }

    if (!scanResult.issues || scanResult.issues.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Document has no accessibility issues!',
        repairPlan: [],
        repairedDocument: null,
        fixesApplied: 0,
        suggestionsProvided: 0
      })
    }

    // Step 2: Generate repair plan using AI
    console.log(`🤖 Step 2: Generating repair plan with AI...`)
    const repairService = new DocumentRepairService()
    const { repairPlan, repairedDocument } = await repairService.repairDocument(
      fileBuffer,
      fileName,
      fileType,
      scanResult.issues
    )

    const automaticFixes = repairPlan.filter(p => p.fixType === 'automatic')
    const suggestions = repairPlan.filter(p => p.fixType === 'suggestion')

    console.log(`✅ Repair plan generated: ${automaticFixes.length} automatic fixes, ${suggestions.length} suggestions`)

    // Step 3: Save scan results to database (for history and backlog)
    const repairDuration = ((Date.now() - startTime) / 1000)
    let scanHistoryId: string | null = null
    let backlogResult = null

    try {
      const { ScanHistoryService } = await import('@/lib/scan-history-service')
      
      // Count issues by severity
      const criticalCount = scanResult.issues.filter((i: any) => i.type === 'critical').length
      const seriousCount = scanResult.issues.filter((i: any) => i.type === 'serious').length
      const moderateCount = scanResult.issues.filter((i: any) => i.type === 'moderate').length
      const minorCount = scanResult.issues.filter((i: any) => i.type === 'minor').length

      scanHistoryId = await ScanHistoryService.storeScanResult(user.userId, 'document', {
        scanTitle: `Document Repair: ${fileName}`,
        fileName: fileName,
        fileType: fileType,
        scanResults: scanResult,
        complianceSummary: {
          totalIssues: scanResult.issues.length,
          criticalIssues: criticalCount,
          seriousIssues: seriousCount,
          moderateIssues: moderateCount,
          minorIssues: minorCount
        },
        remediationReport: {
          repairPlan: repairPlan,
          fixesApplied: automaticFixes.length,
          suggestionsProvided: suggestions.length,
          repairedDocumentAvailable: !!repairedDocument
        },
        totalIssues: scanResult.issues.length,
        criticalIssues: criticalCount,
        seriousIssues: seriousCount,
        moderateIssues: moderateCount,
        minorIssues: minorCount,
        pagesAnalyzed: scanResult.metadata?.pagesAnalyzed || 1,
        overallScore: scanResult.overallScore,
        is508Compliant: scanResult.is508Compliant,
        scanDurationSeconds: Math.round(repairDuration),
        scanSettings: {
          scanType: 'repair',
          wcagLevel: 'AA',
          selectedTags: ['all']
        }
      })
      console.log('✅ Document repair results stored in history:', scanHistoryId)

      // Auto-add issues to product backlog
      if (scanResult.issues && scanResult.issues.length > 0 && scanHistoryId) {
        console.log(`🔄 Attempting to add ${scanResult.issues.length} issues to backlog...`)
        try {
          const { autoAddDocumentIssuesToBacklog } = await import('@/lib/backlog-service')
          backlogResult = await autoAddDocumentIssuesToBacklog(user.userId, scanResult.issues, scanHistoryId, fileName)
          console.log('✅ Issues automatically added to product backlog:', backlogResult)
        } catch (backlogError) {
          console.error('❌ Failed to auto-add issues to backlog:', backlogError)
          backlogResult = { success: false, error: backlogError instanceof Error ? backlogError.message : 'Unknown error' }
        }
      }
    } catch (error) {
      console.error('❌ Failed to store document repair results in history:', error)
      // Don't fail the repair if database save fails
    }

    // Step 4: Return repair plan and repaired document
    return NextResponse.json({
      success: true,
      repairPlan,
      repairedDocument: repairedDocument ? repairedDocument.toString('base64') : null,
      fixesApplied: automaticFixes.length,
      suggestionsProvided: suggestions.length,
      originalIssues: scanResult.issues.length,
      repairDuration: `${repairDuration.toFixed(2)}s`,
      fileName,
      scanHistoryId,
      backlogAdded: backlogResult
    })

  } catch (error) {
    console.error('❌ Document repair error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to repair document' 
      },
      { status: 500 }
    )
  }
}


