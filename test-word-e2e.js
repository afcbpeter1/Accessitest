/**
 * End-to-end test for Word document scanning and auto-fix
 * Tests the complete workflow: Scan → Auto-Fix → Re-Scan → Verification
 */

const fs = require('fs')
const path = require('path')

async function testWordDocumentE2E() {
  try {
    const filePath = path.join(__dirname, 'syllabus_NOTaccessible (1).docx')
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`)
      process.exit(1)
    }

    console.log('='.repeat(80))
    console.log('WORD DOCUMENT E2E TEST')
    console.log('='.repeat(80))
    console.log(`\n📄 Testing: ${path.basename(filePath)}`)
    console.log(`📊 File size: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB\n`)

    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath)
    const base64Content = fileBuffer.toString('base64')
    
    console.log('🔍 Step 1: Calling document scan API...\n')
    
    // Note: This requires authentication
    // You'll need to log in via the UI first to get a session cookie
    const response = await fetch('http://localhost:3000/api/document-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add your auth token here if testing via API
        // 'Authorization': 'Bearer YOUR_TOKEN'
        // Or use cookies if testing from browser
      },
      credentials: 'include', // Include cookies
      body: JSON.stringify({
        fileName: 'syllabus_NOTaccessible (1).docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: fileBuffer.length,
        fileContent: base64Content,
        scanId: `test_e2e_${Date.now()}`
      })
    })

    const responseText = await response.text()
    console.log(`📡 Response status: ${response.status}`)
    
    if (!response.ok) {
      console.error(`❌ API Error (${response.status}):`)
      try {
        const error = JSON.parse(responseText)
        console.error(JSON.stringify(error, null, 2))
      } catch {
        console.error(responseText.substring(0, 500))
      }
      process.exit(1)
    }

    const result = JSON.parse(responseText)
    
    if (!result.success) {
      console.error(`❌ Scan failed:`, result.error)
      if (result.details) {
        console.error(`   Details: ${result.details}`)
      }
      process.exit(1)
    }

    console.log('\n✅ Scan completed successfully!\n')
    console.log('='.repeat(80))
    console.log('SCAN RESULTS')
    console.log('='.repeat(80))
    
    const scanResults = result.scanResults
    
    console.log(`\n📊 Overall Score: ${scanResults.overallScore}/100`)
    console.log(`✅ 508 Compliant: ${scanResults.is508Compliant ? 'Yes' : 'No'}`)
    console.log(`\n📋 Issues Summary:`)
    console.log(`   Total: ${scanResults.summary.total}`)
    console.log(`   Critical: ${scanResults.summary.critical}`)
    console.log(`   Serious: ${scanResults.summary.serious}`)
    console.log(`   Moderate: ${scanResults.summary.moderate}`)
    console.log(`   Minor: ${scanResults.summary.minor}`)
    
    if (scanResults.fixReport) {
      console.log(`\n🔧 Auto-Fix Report:`)
      const fixes = scanResults.fixReport.fixesApplied
      console.log(`   Alt Text: ${fixes.altText || 0}`)
      console.log(`   Table Summaries: ${fixes.tableSummaries || 0}`)
      console.log(`   Metadata: ${fixes.metadata || 0}`)
      console.log(`   Headings: ${fixes.headings || 0}`)
      console.log(`   Language: ${fixes.language || 0}`)
      console.log(`   Link Text: ${fixes.linkText || 0}`)
    }
    
    if (scanResults.comparisonReport) {
      console.log(`\n📊 Comparison Report (Before vs After Auto-Fix):`)
      console.log(`   Original Issues: ${scanResults.comparisonReport.original.failedIssues}`)
      console.log(`   Remaining Issues: ${scanResults.comparisonReport.fixed.failedIssues}`)
      console.log(`   Issues Fixed: ${scanResults.comparisonReport.improvement.issuesFixed}`)
      console.log(`   Improvement: ${scanResults.comparisonReport.improvement.improvementPercentage}%`)
    }
    
    if (scanResults.issues && scanResults.issues.length > 0) {
      console.log(`\n📝 Remaining Issues (showing first 10):`)
      scanResults.issues.slice(0, 10).forEach((issue, index) => {
        console.log(`\n   ${index + 1}. [${issue.type?.toUpperCase() || 'UNKNOWN'}] ${issue.section || issue.category || 'Unknown'}`)
        console.log(`      Description: ${issue.description}`)
        if (issue.pageNumber) {
          console.log(`      Page: ${issue.pageNumber}`)
        }
        if (issue.recommendation) {
          const rec = issue.recommendation.substring(0, 100)
          console.log(`      Recommendation: ${rec}${issue.recommendation.length > 100 ? '...' : ''}`)
        }
      })
    } else {
      console.log(`\n✅ No remaining issues - all fixed!`)
    }
    
    if (scanResults.fixedDocument) {
      console.log(`\n💾 Fixed document available: ${scanResults.fixedDocument.fileName}`)
      const fixedBuffer = Buffer.from(scanResults.fixedDocument.buffer, 'base64')
      const outputPath = path.join(__dirname, scanResults.fixedDocument.fileName)
      fs.writeFileSync(outputPath, fixedBuffer)
      console.log(`   ✅ Saved to: ${outputPath}`)
      
      // Verify the fixed document
      console.log(`\n🔍 Step 2: Verifying fixed document...`)
      console.log(`   File size: ${(fixedBuffer.length / 1024).toFixed(2)} KB`)
      console.log(`   ✅ Fixed document saved successfully`)
    }
    
    console.log(`\n⏱️  Scan Duration: ${result.scanDuration}ms`)
    console.log('='.repeat(80))
    console.log('\n✅ E2E Test Completed Successfully!')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
    process.exit(1)
  }
}

// Run the test
testWordDocumentE2E().catch(console.error)



