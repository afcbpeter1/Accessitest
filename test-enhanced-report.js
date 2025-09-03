const fs = require('fs');
const path = require('path');

async function testEnhancedReport() {
  try {
    const pdfPath = path.join(__dirname, 'EPRS_STU(2022)729512_EN.pdf');
    const buffer = fs.readFileSync(pdfPath);
    const base64Content = buffer.toString('base64');
    
    console.log('🔍 Testing enhanced web-report style format...');
    
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
      console.log('✅ Enhanced report generated!');
      console.log(`📄 Document: ${result.result.metadata.documentType}`);
      console.log(`📊 Pages: ${result.result.metadata.pagesAnalyzed}`);
      console.log(`📝 Words: ${result.result.metadata.wordCount.toLocaleString()}`);
      console.log(`📄 Characters: ${result.result.metadata.characterCount.toLocaleString()}`);
      console.log(`🖼️ Images: ${result.result.metadata.imageCount} total`);
      console.log(`📋 Tables: ${result.result.metadata.tableCount}`);
      console.log(`🔗 Links: ${result.result.metadata.linkCount}`);
      console.log(`❌ Issues: ${result.result.issues.length}`);
      console.log(`🎯 Score: ${result.result.overallScore}/100`);
      console.log(`🔧 Engine: ${result.result.metadata.scanEngine}`);
      console.log(`📋 Standard: ${result.result.metadata.standard}`);
      
      console.log('\n📋 ENHANCED ISSUE REPORT (Web-Style Format):');
      console.log('='.repeat(100));
      
      result.result.issues.forEach((issue, index) => {
        console.log(`\n${index + 1}. ${issue.description.toUpperCase()}`);
        console.log('   ' + '─'.repeat(80));
        
        // Severity and Priority (like web reports)
        const severityColor = issue.severity >= 8 ? '🔴' : issue.severity >= 6 ? '🟠' : issue.severity >= 4 ? '🟡' : '🔵';
        const priorityText = issue.priority === 'high' ? 'HIGH PRIORITY' : issue.priority === 'medium' ? 'MEDIUM PRIORITY' : 'LOW PRIORITY';
        const severityText = issue.type.toUpperCase();
        
        console.log(`   ${severityColor} ${severityText} | ${priorityText} | ${issue.wcagCriterion}`);
        
                 // Offending Element Details (like web reports)
         console.log(`\n   📍 OFFENDING ELEMENT:`);
         console.log(`      Type: ${issue.elementType || 'Unknown'}`);
         console.log(`      Location: Page ${issue.pageNumber} • Line ${issue.lineNumber}`);
         console.log(`      Selector: ${issue.elementSelector || 'N/A'}`);
         console.log(`      Occurrences: ${issue.occurrences || 1}`);
         console.log(`      Affected Pages: ${issue.affectedPages || 1}`);
         
         // Show detailed locations for multiple instances
         if (issue.elementContent && issue.occurrences > 1) {
           console.log(`\n   📍 ALL INSTANCES FOUND:`);
           const instances = issue.elementContent.split('; ');
           instances.forEach((instance, idx) => {
             console.log(`      ${idx + 1}. ${instance}`);
           });
         } else if (issue.elementContent) {
           console.log(`\n   📍 ELEMENT CONTENT:`);
           console.log(`      ${issue.elementContent}`);
         }
        
        // Section 508 Information
        console.log(`\n   📋 SECTION 508 COMPLIANCE:`);
        console.log(`      Requirement: ${issue.section508Requirement || 'N/A'}`);
        console.log(`      Impact: ${issue.impact.toUpperCase()}`);
        console.log(`      Category: ${issue.category.toUpperCase()}`);
        
        // AI-Enhanced Fix
        if (issue.recommendation) {
          console.log(`\n   🤖 HOW TO FIX (AI-Enhanced):`);
          console.log(`      ${issue.recommendation.replace(/\n/g, '\n      ')}`);
        } else {
          console.log(`\n   💡 HOW TO FIX:`);
          console.log(`      ${issue.remediation}`);
        }
        
        console.log('   ' + '─'.repeat(80));
      });
      
      console.log('\n' + '='.repeat(100));
      console.log('🎯 SUMMARY:');
      console.log(`   • Document Analysis:`);
      console.log(`     - Pages: ${result.result.metadata.pagesAnalyzed}`);
      console.log(`     - Words: ${result.result.metadata.wordCount.toLocaleString()}`);
      console.log(`     - Characters: ${result.result.metadata.characterCount.toLocaleString()}`);
      console.log(`     - Images: ${result.result.metadata.imageCount} total`);
      console.log(`     - Tables: ${result.result.metadata.tableCount}`);
      console.log(`     - Links: ${result.result.metadata.linkCount}`);
      console.log(`   • Accessibility Issues:`);
      console.log(`     - Total: ${result.result.issues.length}`);
      console.log(`     - Critical: ${result.result.summary.critical}`);
      console.log(`     - Serious: ${result.result.summary.serious}`);
      console.log(`     - Moderate: ${result.result.summary.moderate}`);
      console.log(`     - Minor: ${result.result.summary.minor}`);
      console.log(`   • AI Enhancement: ${result.result.issues.filter(i => i.aiEnhanced).length}/${result.result.issues.length} issues enhanced`);
      console.log(`   • Section 508 Compliance: ${result.result.is508Compliant ? 'NO' : 'YES'} (Score: ${result.result.overallScore}/100)`);
      
    } else {
      console.error('❌ API test failed:', response.status, response.statusText);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testEnhancedReport();
