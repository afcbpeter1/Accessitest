/**
 * Full test script for PDF accessibility scanning and auto-fix
 * Tests: syllabus_NOTaccessible (1).pdf
 */

const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch');

// Configuration
const PDF_PATH = path.join(__dirname, 'syllabus_NOTaccessible (1).pdf');
const API_URL = 'http://localhost:3000/api/document-scan';
const TEST_TOKEN = process.env.TEST_AUTH_TOKEN || 'test-token'; // You'll need to get a real token

async function runFullTest() {
  console.log('🧪 Starting full PDF accessibility test...\n');
  
  try {
    // Step 1: Read PDF file
    console.log('📄 Step 1: Reading PDF file...');
    const pdfBuffer = fs.readFileSync(PDF_PATH);
    const pdfBase64 = pdfBuffer.toString('base64');
    console.log(`✅ PDF loaded: ${pdfBuffer.length} bytes\n`);
    
    // Step 2: Call document-scan API
    console.log('🔍 Step 2: Calling document-scan API...');
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${TEST_TOKEN}`
      },
      body: JSON.stringify({
        fileName: 'syllabus_NOTaccessible (1).pdf',
        fileType: 'application/pdf',
        fileSize: pdfBuffer.length,
        fileContent: pdfBase64
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    const scanResult = await response.json();
    console.log('✅ Scan completed\n');
    
    // Step 3: Analyze results
    console.log('📊 Step 3: Analyzing scan results...');
    console.log(`   Overall Score: ${scanResult.overallScore || 0}/100`);
    console.log(`   Is 508 Compliant: ${scanResult.is508Compliant ? 'Yes' : 'No'}`);
    console.log(`   Total Issues: ${scanResult.issues?.length || 0}`);
    console.log(`   Auto-Fixed: ${scanResult.autoFixed ? 'Yes' : 'No'}`);
    
    if (scanResult.autoFixStats) {
      console.log(`   Auto-Fix Stats:`);
      console.log(`     - Alt Texts: ${scanResult.autoFixStats.altText || 0}`);
      console.log(`     - Table Summaries: ${scanResult.autoFixStats.tableSummaries || 0}`);
      console.log(`     - Bookmarks: ${scanResult.autoFixStats.bookmarks || 0}`);
    }
    console.log('');
    
    // Step 4: Save fixed PDF if available
    if (scanResult.taggedPdfBase64) {
      console.log('💾 Step 4: Saving fixed PDF...');
      const fixedPdfBuffer = Buffer.from(scanResult.taggedPdfBase64, 'base64');
      const outputPath = path.join(__dirname, 'syllabus_NOTaccessible_TEST_OUTPUT.pdf');
      fs.writeFileSync(outputPath, fixedPdfBuffer);
      console.log(`✅ Fixed PDF saved to: ${outputPath}\n`);
      
      // Step 5: Verify fixes using PyMuPDF
      console.log('🔍 Step 5: Verifying fixes in output PDF...');
      await verifyFixes(outputPath, scanResult);
    } else {
      console.log('⚠️ No fixed PDF returned from API\n');
    }
    
    // Step 6: Check issues
    console.log('📋 Step 6: Checking remaining issues...');
    const failedIssues = scanResult.issues?.filter(issue => 
      issue.status === 'Failed' || issue.type === 'error'
    ) || [];
    
    if (failedIssues.length === 0) {
      console.log('✅ No failed issues remaining!\n');
    } else {
      console.log(`⚠️ ${failedIssues.length} failed issues remaining:`);
      failedIssues.forEach(issue => {
        console.log(`   - ${issue.ruleName || issue.rule}: ${issue.description}`);
      });
      console.log('');
    }
    
    // Step 7: Summary
    console.log('📊 TEST SUMMARY:');
    console.log('================');
    console.log(`✅ Scan completed successfully`);
    console.log(`✅ Fixed PDF generated: ${scanResult.taggedPdfBase64 ? 'Yes' : 'No'}`);
    console.log(`✅ Auto-fixes applied: ${scanResult.autoFixed ? 'Yes' : 'No'}`);
    console.log(`✅ Remaining issues: ${failedIssues.length}`);
    console.log(`✅ Overall score: ${scanResult.overallScore || 0}/100`);
    console.log(`✅ 508 Compliant: ${scanResult.is508Compliant ? 'Yes' : 'No'}`);
    
    return {
      success: true,
      scanResult,
      outputPath: scanResult.taggedPdfBase64 ? path.join(__dirname, 'syllabus_NOTaccessible_TEST_OUTPUT.pdf') : null
    };
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

async function verifyFixes(pdfPath, scanResult) {
  try {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    // Use Python to verify structure elements
    const verifyScript = `
import fitz
import sys
import json

try:
    doc = fitz.open('${pdfPath.replace(/\\/g, '/')}')
    
    # Check if document is tagged
    catalog = doc.pdf_catalog()
    struct_tree_result = doc.xref_get_key(catalog, "StructTreeRoot")
    has_struct_tree = struct_tree_result[0] != 0
    
    # Check MarkInfo
    markinfo_result = doc.xref_get_key(catalog, "MarkInfo")
    is_marked = False
    if markinfo_result[0] != 0:
        markinfo_xref = int(markinfo_result[1]) if markinfo_result[1].isdigit() else None
        if markinfo_xref:
            marked_result = doc.xref_get_key(markinfo_xref, "Marked")
            is_marked = marked_result[0] != 0 and marked_result[1].lower() == 'true'
    
    # Count images
    page = doc[0]
    images = page.get_images()
    
    result = {
        'isTagged': has_struct_tree,
        'isMarked': is_marked,
        'imageCount': len(images),
        'pages': len(doc)
    }
    
    print(json.dumps(result))
    doc.close()
except Exception as e:
    print(json.dumps({'error': str(e)}))
`
    
    const { stdout } = await execAsync(`python -c "${verifyScript.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`);
    const verification = JSON.parse(stdout.trim());
    
    if (verification.error) {
      console.log(`   ⚠️ Verification error: ${verification.error}`);
      return;
    }
    
    console.log(`   ✅ Document is tagged: ${verification.isTagged ? 'Yes' : 'No'}`);
    console.log(`   ✅ MarkInfo/Marked set: ${verification.isMarked ? 'Yes' : 'No'}`);
    console.log(`   ✅ Images found: ${verification.imageCount}`);
    console.log(`   ✅ Pages: ${verification.pages}\n`);
    
  } catch (error) {
    console.log(`   ⚠️ Could not verify fixes: ${error.message}\n`);
  }
}

// Run the test
if (require.main === module) {
  runFullTest().then(result => {
    if (result.success) {
      console.log('\n✅ Full test completed successfully!');
      process.exit(0);
    } else {
      console.log('\n❌ Full test failed!');
      process.exit(1);
    }
  }).catch(error => {
    console.error('\n❌ Test error:', error);
    process.exit(1);
  });
}

module.exports = { runFullTest };









