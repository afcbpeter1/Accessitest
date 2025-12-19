/**
 * Simple test using the API endpoint
 * Make sure the Next.js dev server is running: npm run dev
 */

const fs = require('fs')
const path = require('path')

async function testWordDocument() {
  try {
    const filePath = path.join(__dirname, 'syllabus_NOTaccessible (1).docx')
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`)
      console.log(`\n💡 Make sure the file is in the project root directory`)
      process.exit(1)
    }

    console.log(`📄 Testing Word document: ${path.basename(filePath)}`)
    console.log(`📊 File size: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB\n`)

    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath)
    const base64Content = fileBuffer.toString('base64')
    
    console.log('🔍 Calling document scan API...\n')
    console.log('⚠️  Note: This requires authentication. If it fails, you may need to:')
    console.log('   1. Make sure the Next.js dev server is running (npm run dev)')
    console.log('   2. Log in to the app first to get an auth token')
    console.log('   3. Or modify this script to include your auth token\n')
    
    // Call the document scan API
    const response = await fetch('http://localhost:3000/api/document-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // You'll need to add a cookie or auth token here
        // For testing, you might need to log in via browser first
      },
      body: JSON.stringify({
        fileName: 'syllabus_NOTaccessible (1).docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: fileBuffer.length,
        fileContent: base64Content,
        scanId: `test_${Date.now()}`
      })
    })

    const responseText = await response.text()
    
    if (!response.ok) {
      console.error(`❌ API Error (${response.status}):`)
      try {
        const error = JSON.parse(responseText)
        console.error(JSON.stringify(error, null, 2))
      } catch {
        console.error(responseText)
      }
      
      if (response.status === 401) {
        console.log('\n💡 Authentication required. Please:')
        console.log('   1. Open http://localhost:3000 in your browser')
        console.log('   2. Log in to your account')
        console.log('   3. Copy the session cookie and add it to this script')
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
    
    if (scanResults.metadata) {
      console.log(`\n📄 Document Metadata:`)
      console.log(`   Pages: ${scanResults.metadata.pagesAnalyzed || 'N/A'}`)
      console.log(`   File Size: ${(scanResults.metadata.fileSize / 1024).toFixed(2)} KB`)
      console.log(`   Scan Engine: ${scanResults.metadata.scanEngine || 'N/A'}`)
      console.log(`   Standard: ${scanResults.metadata.standard || 'N/A'}`)
    }
    
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
      console.log(`\n📝 Issues Found (showing first 15):`)
      scanResults.issues.slice(0, 15).forEach((issue, index) => {
        console.log(`\n   ${index + 1}. [${issue.type?.toUpperCase() || 'UNKNOWN'}] ${issue.section || issue.category || 'Unknown'}`)
        console.log(`      Description: ${issue.description}`)
        if (issue.pageNumber) {
          console.log(`      Page: ${issue.pageNumber}`)
        }
        if (issue.elementLocation && issue.elementLocation !== 'Unknown location') {
          console.log(`      Location: ${issue.elementLocation}`)
        }
        if (issue.recommendation) {
          const rec = issue.recommendation.substring(0, 120)
          console.log(`      Recommendation: ${rec}${issue.recommendation.length > 120 ? '...' : ''}`)
        }
      })
      
      if (scanResults.issues.length > 15) {
        console.log(`\n   ... and ${scanResults.issues.length - 15} more issues`)
      }
      
      // Group by category
      const byCategory = {}
      scanResults.issues.forEach(issue => {
        const cat = issue.category || 'other'
        byCategory[cat] = (byCategory[cat] || 0) + 1
      })
      
      console.log(`\n📊 Issues by Category:`)
      Object.entries(byCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`)
      })
    } else {
      console.log(`\n✅ No accessibility issues found!`)
    }
    
    if (scanResults.fixedDocument) {
      console.log(`\n💾 Fixed document available: ${scanResults.fixedDocument.fileName}`)
      const fixedBuffer = Buffer.from(scanResults.fixedDocument.buffer, 'base64')
      const outputPath = path.join(__dirname, scanResults.fixedDocument.fileName)
      fs.writeFileSync(outputPath, fixedBuffer)
      console.log(`   ✅ Saved to: ${outputPath}`)
    }
    
    console.log(`\n⏱️  Scan Duration: ${result.scanDuration}ms`)
    console.log('='.repeat(80))
    
    // Save full results
    const resultsPath = path.join(__dirname, 'word-scan-results.json')
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2))
    console.log(`\n💾 Full results saved to: ${resultsPath}`)
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
    process.exit(1)
  }
}

// Run the test
testWordDocument().catch(console.error)



