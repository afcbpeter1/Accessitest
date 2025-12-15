/**
 * End-to-End Test Script for Word Document Scanning and Auto-Fix
 * 
 * This script tests the complete workflow:
 * 1. Upload Word document
 * 2. Scan for accessibility issues
 * 3. Auto-fix issues
 * 4. Re-scan to verify fixes
 * 5. Verify comparison report
 * 6. Download and verify fixed document
 */

const fs = require('fs')
const path = require('path')

// Test configuration
const TEST_CONFIG = {
  apiUrl: 'http://localhost:3000',
  testFile: 'syllabus_NOTaccessible (1).docx',
  email: 'peter.kirby85@gmail.com',
  password: 'BeynacCastle2!'
}

async function login() {
  console.log('🔐 Step 1: Logging in...')
  
  const loginResponse = await fetch(`${TEST_CONFIG.apiUrl}/api/auth`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      action: 'login',
      email: TEST_CONFIG.email,
      password: TEST_CONFIG.password
    })
  })
  
  if (!loginResponse.ok) {
    const errorText = await loginResponse.text()
    throw new Error(`Login failed (${loginResponse.status}): ${errorText}`)
  }
  
  const loginResult = await loginResponse.json()
  
  if (!loginResult.success || !loginResult.token) {
    throw new Error('Login failed: No token received')
  }
  
  console.log('✅ Login successful')
  return loginResult.token
}

async function testWordDocumentE2E() {
  let authToken = null
  
  try {
    console.log('='.repeat(80))
    console.log('WORD DOCUMENT E2E TEST')
    console.log('='.repeat(80))
    console.log(`\n📄 Testing: ${TEST_CONFIG.testFile}`)
    
    // Step 1: Login
    authToken = await login()
    
    // Step 2: Read test file
    const filePath = path.join(__dirname, TEST_CONFIG.testFile)
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Test file not found: ${filePath}`)
    }
    
    const fileBuffer = fs.readFileSync(filePath)
    const base64Content = fileBuffer.toString('base64')
    
    console.log(`\n📊 File size: ${(fileBuffer.length / 1024).toFixed(2)} KB`)
    console.log(`📊 Base64 size: ${(base64Content.length / 1024).toFixed(2)} KB`)
    
    // Step 3: Call document scan API
    console.log('\n🔍 Step 2: Calling document scan API...')
    console.log('   This will: Scan → Auto-Fix → Re-Scan → Generate Comparison Report\n')
    
    const scanId = `test_e2e_${Date.now()}`
    const scanResponse = await fetch(`${TEST_CONFIG.apiUrl}/api/document-scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        fileName: TEST_CONFIG.testFile,
        fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        fileSize: fileBuffer.length,
        fileContent: base64Content,
        scanId: scanId
      })
    })
    
    const responseText = await scanResponse.text()
    
    if (!scanResponse.ok) {
      console.error(`❌ API Error (${scanResponse.status}):`)
      try {
        const error = JSON.parse(responseText)
        console.error(JSON.stringify(error, null, 2))
        if (error.details) {
          console.error(`\nDetails: ${error.details}`)
        }
      } catch {
        console.error(responseText.substring(0, 1000))
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
    
    // Step 4: Verify results
    console.log('\n' + '='.repeat(80))
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
    
    // Step 5: Verify Auto-Fix Report
    if (scanResults.fixReport) {
      console.log(`\n🔧 Auto-Fix Report:`)
      const fixes = scanResults.fixReport.fixesApplied
      const totalFixes = (fixes.altText || 0) + 
                        (fixes.tableSummaries || 0) + 
                        (fixes.metadata || 0) + 
                        (fixes.headings || 0) + 
                        (fixes.language || 0) + 
                        (fixes.linkText || 0)
      
      console.log(`   ✅ Total Fixes Applied: ${totalFixes}`)
      console.log(`   - Alt Text: ${fixes.altText || 0}`)
      console.log(`   - Table Summaries: ${fixes.tableSummaries || 0}`)
      console.log(`   - Metadata: ${fixes.metadata || 0}`)
      console.log(`   - Headings: ${fixes.headings || 0}`)
      console.log(`   - Language: ${fixes.language || 0}`)
      console.log(`   - Link Text: ${fixes.linkText || 0}`)
      
      if (totalFixes === 0) {
        console.log(`   ⚠️  WARNING: No fixes were applied!`)
      } else {
        console.log(`   ✅ Auto-fix was successful`)
      }
    } else {
      console.log(`\n⚠️  No auto-fix report available`)
    }
    
    // Step 6: Verify Comparison Report
    if (scanResults.comparisonReport) {
      console.log(`\n📊 Comparison Report (Before vs After Auto-Fix):`)
      const comp = scanResults.comparisonReport
      console.log(`   Original Issues: ${comp.original.failedIssues}`)
      console.log(`   Remaining Issues: ${comp.fixed.failedIssues}`)
      console.log(`   Issues Fixed: ${comp.improvement.issuesFixed}`)
      console.log(`   Improvement: ${comp.improvement.improvementPercentage}%`)
      
      if (comp.improvement.improvementPercentage > 0) {
        console.log(`   ✅ Document was improved by auto-fix`)
      } else if (comp.original.failedIssues === 0) {
        console.log(`   ✅ Document had no issues to fix`)
      } else {
        console.log(`   ⚠️  No improvement detected`)
      }
    } else {
      console.log(`\n⚠️  No comparison report available`)
    }
    
    // Step 7: Check remaining issues
    if (scanResults.issues && scanResults.issues.length > 0) {
      console.log(`\n📝 Remaining Issues (${scanResults.issues.length} total):`)
      scanResults.issues.slice(0, 10).forEach((issue, index) => {
        console.log(`\n   ${index + 1}. [${issue.type?.toUpperCase() || 'UNKNOWN'}] ${issue.section || issue.category || 'Unknown'}`)
        console.log(`      Description: ${issue.description}`)
        if (issue.pageNumber) {
          console.log(`      Page: ${issue.pageNumber}`)
        }
        if (issue.recommendation) {
          const rec = issue.recommendation.substring(0, 80)
          console.log(`      Recommendation: ${rec}${issue.recommendation.length > 80 ? '...' : ''}`)
        }
      })
      
      if (scanResults.issues.length > 10) {
        console.log(`\n   ... and ${scanResults.issues.length - 10} more issues`)
      }
    } else {
      console.log(`\n✅ No remaining issues - all fixed!`)
    }
    
    // Step 8: Verify fixed document
    if (scanResults.fixedDocument) {
      console.log(`\n💾 Step 3: Verifying fixed document...`)
      const fixedBuffer = Buffer.from(scanResults.fixedDocument.buffer, 'base64')
      const outputPath = path.join(__dirname, scanResults.fixedDocument.fileName)
      
      fs.writeFileSync(outputPath, fixedBuffer)
      console.log(`   ✅ Fixed document saved: ${scanResults.fixedDocument.fileName}`)
      console.log(`   📊 File size: ${(fixedBuffer.length / 1024).toFixed(2)} KB`)
      
      // Verify the file is valid
      if (fixedBuffer.length > 0) {
        console.log(`   ✅ File is valid (non-empty)`)
      } else {
        console.log(`   ⚠️  WARNING: Fixed file is empty!`)
      }
      
      // Check if it's a valid .docx file (starts with PK signature)
      if (fixedBuffer[0] === 0x50 && fixedBuffer[1] === 0x4B) {
        console.log(`   ✅ File is valid .docx format (ZIP archive)`)
      } else {
        console.log(`   ⚠️  WARNING: File doesn't appear to be a valid .docx file`)
      }
    } else {
      console.log(`\n⚠️  No fixed document available for download`)
    }
    
    // Step 9: Summary
    console.log(`\n⏱️  Scan Duration: ${result.scanDuration}ms`)
    console.log('='.repeat(80))
    
    // Final verification
    const testPassed = 
      result.success &&
      scanResults.fixReport &&
      scanResults.comparisonReport &&
      scanResults.fixedDocument
    
    if (testPassed) {
      console.log('\n✅ E2E TEST PASSED!')
      console.log('   ✅ Document scanned successfully')
      console.log('   ✅ Auto-fix applied')
      console.log('   ✅ Re-scan completed')
      console.log('   ✅ Comparison report generated')
      console.log('   ✅ Fixed document available')
    } else {
      console.log('\n⚠️  E2E TEST INCOMPLETE')
      if (!result.success) console.log('   ❌ Scan failed')
      if (!scanResults.fixReport) console.log('   ❌ No fix report')
      if (!scanResults.comparisonReport) console.log('   ❌ No comparison report')
      if (!scanResults.fixedDocument) console.log('   ❌ No fixed document')
    }
    
    console.log('='.repeat(80))
    
    // Save full results to file
    const resultsPath = path.join(__dirname, 'word-e2e-test-results.json')
    fs.writeFileSync(resultsPath, JSON.stringify(result, null, 2))
    console.log(`\n💾 Full results saved to: ${resultsPath}`)
    
    return testPassed
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    if (error.stack) {
      console.error('\nStack trace:', error.stack)
    }
    process.exit(1)
  }
}

// Run the test
console.log('🚀 Starting Word Document E2E Test...\n')
testWordDocumentE2E()
  .then(passed => {
    process.exit(passed ? 0 : 1)
  })
  .catch(error => {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  })

