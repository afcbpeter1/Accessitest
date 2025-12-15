/**
 * Test script to scan a Word document for accessibility issues
 * Similar to the PDF test scripts
 */

const fs = require('fs')
const path = require('path')

async function testWordDocument() {
  try {
    const filePath = path.join(__dirname, 'syllabus_NOTaccessible (1).docx')
    
    if (!fs.existsSync(filePath)) {
      console.error(`❌ File not found: ${filePath}`)
      process.exit(1)
    }

    console.log(`📄 Testing Word document: ${filePath}`)
    console.log(`📊 File size: ${(fs.statSync(filePath).size / 1024).toFixed(2)} KB\n`)

    // Read file as buffer
    const fileBuffer = fs.readFileSync(filePath)
    
    // Convert to base64 for API
    const base64Content = fileBuffer.toString('base64')
    
    // Call the document scan API
    const response = await fetch('http://localhost:3000/api/document-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Note: You'll need to add authentication token here
        // 'Authorization': 'Bearer YOUR_TOKEN'
      },
      body: JSON.stringify({
        fileName: 'syllabus_NOTaccessible (1).docx',
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: fileBuffer.length,
        fileContent: base64Content,
        scanId: `test_${Date.now()}`
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ API Error (${response.status}):`, errorText)
      process.exit(1)
    }

    const result = await response.json()
    
    if (!result.success) {
      console.error(`❌ Scan failed:`, result.error)
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
      console.log(`   Alt Text: ${scanResults.fixReport.fixesApplied.altText}`)
      console.log(`   Table Summaries: ${scanResults.fixReport.fixesApplied.tableSummaries}`)
      console.log(`   Metadata: ${scanResults.fixReport.fixesApplied.metadata}`)
      console.log(`   Headings: ${scanResults.fixReport.fixesApplied.headings}`)
      console.log(`   Language: ${scanResults.fixReport.fixesApplied.language}`)
    }
    
    if (scanResults.comparisonReport) {
      console.log(`\n📊 Comparison Report:`)
      console.log(`   Original Issues: ${scanResults.comparisonReport.original.failedIssues}`)
      console.log(`   Remaining Issues: ${scanResults.comparisonReport.fixed.failedIssues}`)
      console.log(`   Issues Fixed: ${scanResults.comparisonReport.improvement.issuesFixed}`)
      console.log(`   Improvement: ${scanResults.comparisonReport.improvement.improvementPercentage}%`)
    }
    
    if (scanResults.issues && scanResults.issues.length > 0) {
      console.log(`\n📝 Issues Found (showing first 10):`)
      scanResults.issues.slice(0, 10).forEach((issue, index) => {
        console.log(`\n   ${index + 1}. [${issue.type?.toUpperCase()}] ${issue.section || 'Unknown'}`)
        console.log(`      Description: ${issue.description}`)
        if (issue.pageNumber) {
          console.log(`      Page: ${issue.pageNumber}`)
        }
        if (issue.elementLocation) {
          console.log(`      Location: ${issue.elementLocation}`)
        }
        if (issue.recommendation) {
          console.log(`      Recommendation: ${issue.recommendation.substring(0, 100)}...`)
        }
      })
      
      if (scanResults.issues.length > 10) {
        console.log(`\n   ... and ${scanResults.issues.length - 10} more issues`)
      }
    } else {
      console.log(`\n✅ No accessibility issues found!`)
    }
    
    if (scanResults.fixedDocument) {
      console.log(`\n💾 Fixed document available for download: ${scanResults.fixedDocument.fileName}`)
      // Optionally save the fixed document
      const fixedBuffer = Buffer.from(scanResults.fixedDocument.buffer, 'base64')
      const outputPath = path.join(__dirname, scanResults.fixedDocument.fileName)
      fs.writeFileSync(outputPath, fixedBuffer)
      console.log(`   Saved to: ${outputPath}`)
    }
    
    console.log(`\n⏱️  Scan Duration: ${result.scanDuration}ms`)
    console.log('='.repeat(80))
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    process.exit(1)
  }
}

// Run the test
testWordDocument()



