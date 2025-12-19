/**
 * Direct test of Word document scanning (no API, no auth needed)
 * Tests the ComprehensiveDocumentScanner directly
 */

const fs = require('fs')
const path = require('path')

// Note: This needs to be run in a Node.js environment that can import ES modules
// Or we can use a simpler approach with require

async function testWordDocumentDirect() {
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
    
    console.log('🔍 Loading scanner...')
    
    // Import the scanner (using dynamic import for ES modules)
    const { ComprehensiveDocumentScanner } = await import('./src/lib/comprehensive-document-scanner.ts')
    
    const scanner = new ComprehensiveDocumentScanner()
    
    console.log('🔍 Scanning document...\n')
    
    // Scan the document
    const scanResult = await scanner.scanDocument(
      fileBuffer,
      'syllabus_NOTaccessible (1).docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      undefined, // selectedTags
      () => false // isCancelled
    )
    
    console.log('='.repeat(80))
    console.log('SCAN RESULTS')
    console.log('='.repeat(80))
    
    console.log(`\n📊 Overall Score: ${scanResult.overallScore}/100`)
    console.log(`✅ 508 Compliant: ${scanResult.is508Compliant ? 'Yes' : 'No'}`)
    console.log(`\n📋 Issues Summary:`)
    console.log(`   Total: ${scanResult.summary.total}`)
    console.log(`   Critical: ${scanResult.summary.critical}`)
    console.log(`   Serious: ${scanResult.summary.serious}`)
    console.log(`   Moderate: ${scanResult.summary.moderate}`)
    console.log(`   Minor: ${scanResult.summary.minor}`)
    
    console.log(`\n📄 Document Metadata:`)
    console.log(`   Pages Analyzed: ${scanResult.metadata.pagesAnalyzed}`)
    console.log(`   Word Count: ${scanResult.metadata.wordCount}`)
    console.log(`   Character Count: ${scanResult.metadata.characterCount}`)
    console.log(`   Image Count: ${scanResult.metadata.imageCount}`)
    console.log(`   Table Count: ${scanResult.metadata.tableCount}`)
    console.log(`   Link Count: ${scanResult.metadata.linkCount}`)
    console.log(`   Heading Count: ${scanResult.metadata.headingCount}`)
    
    if (scanResult.imageAnalysis) {
      console.log(`\n🖼️  Image Analysis:`)
      console.log(`   Total Images: ${scanResult.imageAnalysis.totalImages}`)
      console.log(`   With Alt Text: ${scanResult.imageAnalysis.imagesWithAltText}`)
      console.log(`   Without Alt Text: ${scanResult.imageAnalysis.imagesWithoutAltText}`)
      console.log(`   Decorative: ${scanResult.imageAnalysis.decorativeImages}`)
      console.log(`   Informative: ${scanResult.imageAnalysis.informativeImages}`)
    }
    
    if (scanResult.issues && scanResult.issues.length > 0) {
      console.log(`\n📝 Issues Found (showing first 20):`)
      scanResult.issues.slice(0, 20).forEach((issue, index) => {
        console.log(`\n   ${index + 1}. [${issue.type?.toUpperCase()}] ${issue.section || 'Unknown'}`)
        console.log(`      Category: ${issue.category}`)
        console.log(`      Description: ${issue.description}`)
        if (issue.pageNumber) {
          console.log(`      Page: ${issue.pageNumber}`)
        }
        if (issue.elementLocation) {
          console.log(`      Location: ${issue.elementLocation}`)
        }
        if (issue.elementContent) {
          console.log(`      Content: ${issue.elementContent.substring(0, 100)}${issue.elementContent.length > 100 ? '...' : ''}`)
        }
        if (issue.remediation) {
          console.log(`      Remediation: ${issue.remediation.substring(0, 150)}${issue.remediation.length > 150 ? '...' : ''}`)
        }
      })
      
      if (scanResult.issues.length > 20) {
        console.log(`\n   ... and ${scanResult.issues.length - 20} more issues`)
      }
      
      // Group by category
      const byCategory = {}
      scanResult.issues.forEach(issue => {
        const cat = issue.category || 'other'
        byCategory[cat] = (byCategory[cat] || 0) + 1
      })
      
      console.log(`\n📊 Issues by Category:`)
      Object.entries(byCategory).forEach(([cat, count]) => {
        console.log(`   ${cat}: ${count}`)
      })
    } else {
      console.log(`\n✅ No accessibility issues found!`)
    }
    
    console.log(`\n⏱️  Scan Duration: ${scanResult.metadata.scanDuration}ms`)
    console.log('='.repeat(80))
    
    // Save results to JSON
    const resultsPath = path.join(__dirname, 'word-scan-results.json')
    fs.writeFileSync(resultsPath, JSON.stringify(scanResult, null, 2))
    console.log(`\n💾 Full results saved to: ${resultsPath}`)
    
  } catch (error) {
    console.error('❌ Test failed:', error)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
    process.exit(1)
  }
}

// Run the test
testWordDocumentDirect().catch(console.error)



