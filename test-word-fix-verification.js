/**
 * E2E Test for Word Document Auto-Fix Verification
 * Tests the complete flow: scan -> auto-fix -> re-scan -> verify fixes detected
 */

const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'peter.kirby85@gmail.com';
const TEST_PASSWORD = 'BeynacCastle2!';
const TEST_FILE = 'syllabus_NOTaccessible (1).docx';

let authToken = null;

async function login() {
  console.log('🔐 Logging in...');
  const response = await fetch(`${BASE_URL}/api/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'login',
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Login failed (${response.status}): ${error}`);
  }

  const data = await response.json();
  authToken = data.token;
  console.log('✅ Logged in successfully');
}

async function uploadAndScan() {
  console.log(`\n📄 Uploading and scanning ${TEST_FILE}...`);
  
  if (!fs.existsSync(TEST_FILE)) {
    throw new Error(`Test file not found: ${TEST_FILE}`);
  }

  const fileBuffer = fs.readFileSync(TEST_FILE);
  const base64Content = fileBuffer.toString('base64');

  const response = await fetch(`${BASE_URL}/api/document-scan`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fileName: TEST_FILE,
      fileType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      fileSize: fileBuffer.length,
      fileContent: base64Content
    })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Scan failed (${response.status}): ${error}`);
  }

  const result = await response.json();
  console.log('✅ Scan completed');
  console.log('\n📋 API Response Structure:');
  console.log(`  success: ${result.success}`);
  console.log(`  has scanResults: ${!!result.scanResults}`);
  console.log(`  has autoFixStats: ${!!result.autoFixStats}`);
  console.log(`  has fixedDocument: ${!!result.fixedDocument}`);
  console.log(`  has comparisonReport: ${!!result.comparisonReport}`);
  
  if (result.error) {
    console.log(`  error: ${result.error}`);
  }
  
  return result;
}

function verifyResults(result) {
  console.log('\n🔍 Verifying results...');
  
  // Check different possible response structures
  const scanResults = result.scanResults || result;
  const issues = scanResults?.issues || [];
  const comparisonReport = scanResults?.comparisonReport || result.comparisonReport;
  const fixedDocument = scanResults?.fixedDocument || result.fixedDocument;
  const autoFixStats = scanResults?.autoFixStats || scanResults?.fixReport?.fixesApplied;
  const fixReport = scanResults?.fixReport;
  
  console.log('\n📊 Response Details:');
  console.log(`  scanResults.issues: ${scanResults?.issues?.length || 0}`);
  console.log(`  scanResults.fixReport: ${!!fixReport}`);
  console.log(`  scanResults.autoFixStats: ${!!autoFixStats}`);
  console.log(`  scanResults.comparisonReport: ${!!comparisonReport}`);
  console.log(`  scanResults.fixedDocument: ${!!fixedDocument}`);
  
  if (fixReport) {
    console.log(`\n🔧 Fix Report:`);
    console.log(`  success: ${fixReport.success}`);
    console.log(`  fixesApplied:`, JSON.stringify(fixReport.fixesApplied, null, 2));
    if (fixReport.errors && fixReport.errors.length > 0) {
      console.log(`  errors:`, fixReport.errors);
    }
  }
  
  console.log(`\n📊 Original Issues: ${issues.length}`);
  issues.forEach((issue, i) => {
    console.log(`  ${i + 1}. ${issue.description} (${issue.type})`);
  });
  
  if (comparisonReport) {
    console.log(`\n📈 Comparison Report:`);
    console.log(`  Original: ${comparisonReport.original?.failed || comparisonReport.original?.totalIssues || comparisonReport.original?.failedIssues || 'N/A'} issues`);
    console.log(`  Fixed: ${comparisonReport.fixed?.count || comparisonReport.fixed?.failedIssues || comparisonReport.fixed?.totalIssues || 'N/A'} issues`);
    console.log(`  Remaining: ${comparisonReport.remaining?.failed || comparisonReport.remaining?.failedIssues || comparisonReport.remaining?.totalIssues || 'N/A'} issues`);
    console.log(`  Improvement: ${comparisonReport.improvement?.improvementPercentage || comparisonReport.improvement?.issuesFixed || 0}%`);
    console.log(`  Full comparison:`, JSON.stringify(comparisonReport, null, 2));
  }
  
  if (fixedDocument) {
    console.log(`\n✅ Fixed document available: ${fixedDocument.fileName || 'fixed.docx'}`);
    if (fixedDocument.buffer) {
      const buffer = Buffer.from(fixedDocument.buffer, 'base64');
      console.log(`   Size: ${(buffer.length / 1024).toFixed(2)} KB`);
      console.log(`   MIME Type: ${fixedDocument.mimeType || 'unknown'}`);
      
      // Save the fixed document
      const outputPath = `fixed-${TEST_FILE}`;
      fs.writeFileSync(outputPath, buffer);
      console.log(`   💾 Saved to: ${outputPath}`);
    } else {
      console.log(`   ⚠️ No buffer data available`);
    }
  }
  
  // Check for specific fixes
  const remainingIssues = result.scanResults?.issues || [];
  const titleIssue = remainingIssues.find(i => i.description?.includes('title') || i.description?.includes('Title'));
  const altTextIssue = remainingIssues.find(i => i.description?.includes('alt text') || i.description?.includes('alternative text'));
  const headingIssue = remainingIssues.find(i => i.description?.includes('heading'));
  const languageIssue = remainingIssues.find(i => i.description?.includes('language'));
  
  console.log(`\n🔧 Fix Verification:`);
  console.log(`  Title issue: ${titleIssue ? '❌ Still present' : '✅ Fixed'}`);
  console.log(`  Alt text issue: ${altTextIssue ? '❌ Still present' : '✅ Fixed'}`);
  console.log(`  Heading issue: ${headingIssue ? '⚠️ Still present (expected - requires manual fix)' : '✅ Fixed'}`);
  console.log(`  Language issue: ${languageIssue ? '⚠️ Still present (expected - requires manual fix)' : '✅ Fixed'}`);
  
  // Save fixed document for manual inspection
  if (fixedDocument && fixedDocument.data) {
    const outputPath = `fixed-${TEST_FILE}`;
    const buffer = Buffer.from(fixedDocument.data, 'base64');
    fs.writeFileSync(outputPath, buffer);
    console.log(`\n💾 Saved fixed document to: ${outputPath}`);
  }
  
  // Success criteria
  const success = {
    scanCompleted: !!result.scanResults,
    fixesApplied: !!result.autoFixStats && (result.autoFixStats.altText > 0 || result.autoFixStats.metadata > 0),
    comparisonReportGenerated: !!comparisonReport,
    fixedDocumentAvailable: !!fixedDocument,
    titleFixed: !titleIssue, // Title should be fixed
    altTextFixed: !altTextIssue, // Alt text should be fixed
  };
  
  console.log(`\n✅ Test Results:`);
  console.log(`  Scan completed: ${success.scanCompleted ? '✅' : '❌'}`);
  console.log(`  Fixes applied: ${success.fixesApplied ? '✅' : '❌'}`);
  console.log(`  Comparison report: ${success.comparisonReportGenerated ? '✅' : '❌'}`);
  console.log(`  Fixed document available: ${success.fixedDocumentAvailable ? '✅' : '❌'}`);
  console.log(`  Title fixed: ${success.titleFixed ? '✅' : '❌'}`);
  console.log(`  Alt text fixed: ${success.altTextFixed ? '✅' : '❌'}`);
  
  const allPassed = Object.values(success).every(v => v);
  console.log(`\n${allPassed ? '🎉 ALL TESTS PASSED' : '⚠️ SOME TESTS FAILED'}`);
  
  return { success, allPassed, result };
}

async function runTest() {
  try {
    console.log('🧪 Starting Word Document Auto-Fix Verification Test\n');
    console.log(`📁 Test file: ${TEST_FILE}`);
    console.log(`🌐 Base URL: ${BASE_URL}\n`);
    
    await login();
    const result = await uploadAndScan();
    const verification = verifyResults(result);
    
    if (!verification.allPassed) {
      console.log('\n❌ Test failed - some fixes were not detected');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the test
runTest();

