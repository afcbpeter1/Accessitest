const fs = require('fs');
const path = require('path');

async function testDetailedIssues() {
  try {
    const pdfPath = path.join(__dirname, 'EPRS_STU(2022)729512_EN.pdf');
    const buffer = fs.readFileSync(pdfPath);
    const base64Content = buffer.toString('base64');
    
    console.log('🔍 Testing detailed issue locations...');
    
    const response = await fetch('http://localhost:3000/api/document-scan', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileName: 'EPRS_STU(2022)729512_EN.pdf',
        fileType: 'application/pdf',
        fileSize: buffer.length,
        fileContent: base64Content
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ API test successful!');
      console.log(`📄 Total pages: ${result.result.metadata.pagesAnalyzed}`);
      console.log(`❌ Total issues: ${result.result.issues.length}`);
      console.log('\n📋 Detailed Issue Analysis:');
      console.log('='.repeat(80));
      
      result.result.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.description}`);
        console.log(`   📍 Location: Page ${issue.pageNumber} • Line ${issue.lineNumber}`);
        console.log(`   📂 Section: ${issue.section}`);
        console.log(`   ⚠️  Severity: ${issue.severity}/10 (${issue.type})`);
        console.log(`   🎯 Impact: ${issue.impact}`);
        console.log(`   🤖 AI Enhanced: ${issue.aiEnhanced ? 'Yes' : 'No'}`);
        if (issue.elementLocation) {
          console.log(`   📍 Element: ${issue.elementLocation}`);
        }
        if (issue.context) {
          console.log(`   📝 Context: ${issue.context}`);
        }
        console.log(`   💡 Remediation: ${issue.remediation}`);
      });
      
      console.log('\n' + '='.repeat(80));
      console.log('🎯 Summary:');
      console.log(`   • Issues distributed across ${new Set(result.result.issues.map(i => i.pageNumber)).size} different pages`);
      console.log(`   • Average page number: ${(result.result.issues.reduce((sum, i) => sum + i.pageNumber, 0) / result.result.issues.length).toFixed(1)}`);
      console.log(`   • Page range: ${Math.min(...result.result.issues.map(i => i.pageNumber))} - ${Math.max(...result.result.issues.map(i => i.pageNumber))}`);
      
    } else {
      console.error('❌ API test failed:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testDetailedIssues();














