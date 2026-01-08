/**
 * Full end-to-end test of the document scan workflow
 * Tests: alt text, table summaries, bookmarks, headings, reading order
 */

const fs = require('fs');
const path = require('path');

async function testFullWorkflow() {
  console.log('='.repeat(60));
  console.log('FULL END-TO-END PDF FIX TEST');
  console.log('='.repeat(60));
  console.log();
  
  const pdfPath = path.join(__dirname, 'syllabus_NOTaccessible (1).pdf');
  
  if (!fs.existsSync(pdfPath)) {
    console.error(`❌ PDF not found: ${pdfPath}`);
    process.exit(1);
  }
  
  const pdfBuffer = fs.readFileSync(pdfPath);
  const base64Content = pdfBuffer.toString('base64');
  
  console.log(`📄 Reading PDF: ${pdfPath}`);
  console.log(`   Size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
  console.log();
  
  // Call the document-scan API
  console.log('🚀 Calling document-scan API...');
  console.log();
  
  const formData = new FormData();
  const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
  formData.append('file', blob, 'syllabus_NOTaccessible (1).pdf');
  formData.append('fileName', 'syllabus_NOTaccessible (1).pdf');
  formData.append('fileType', 'application/pdf');
  formData.append('fileSize', pdfBuffer.length.toString());
  formData.append('fileContent', base64Content);
  
  try {
    const response = await fetch('http://localhost:3000/api/document-scan', {
      method: 'POST',
      body: formData,
      headers: {
        'Authorization': `Bearer ${process.env.AUTH_TOKEN || 'test-token'}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API Error (${response.status}): ${errorText}`);
      process.exit(1);
    }
    
    const result = await response.json();
    
    console.log('✅ API Response received');
    console.log();
    console.log('📊 Scan Results:');
    console.log(`   Total Issues: ${result.scanResults?.issues?.length || 0}`);
    console.log(`   Auto-Fixed: ${result.scanResults?.autoFixed ? 'Yes' : 'No'}`);
    
    if (result.scanResults?.autoFixStats) {
      const stats = result.scanResults.autoFixStats;
      console.log();
      console.log('🔧 Auto-Fix Statistics:');
      console.log(`   Alt Texts: ${stats.altText || 0}`);
      console.log(`   Table Summaries: ${stats.tableSummaries || 0}`);
      console.log(`   Bookmarks: ${stats.bookmarks || 0}`);
      console.log(`   Headings: ${stats.headings || 0}`);
      console.log(`   Reading Order: ${stats.readingOrder || 0}`);
      console.log(`   Color Contrast: ${stats.colorContrast || 0}`);
    }
    
    if (result.scanResults?.taggedPdfBase64) {
      const outputPath = path.join(__dirname, 'syllabus_FULL_TEST_OUTPUT.pdf');
      const outputBuffer = Buffer.from(result.scanResults.taggedPdfBase64, 'base64');
      fs.writeFileSync(outputPath, outputBuffer);
      console.log();
      console.log(`💾 Fixed PDF saved to: ${outputPath}`);
      console.log(`   Size: ${(outputBuffer.length / 1024).toFixed(2)} KB`);
    }
    
    console.log();
    console.log('='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  testFullWorkflow().catch(console.error);
}

module.exports = { testFullWorkflow };










