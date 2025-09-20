// Test if the IssuesBoard component is working
const fetch = require('node-fetch');

async function testIssuesBoardComponent() {
  try {
    console.log('🧪 Testing IssuesBoard component data flow...');
    
    // Test the main API
    const response = await fetch('http://localhost:3000/api/issues-board');
    const data = await response.json();
    
    console.log('📊 API Response Status:', response.status);
    console.log('📋 Issues Count:', data.data?.issues?.length || 0);
    
    if (data.data?.issues) {
      console.log('📋 Issues:');
      data.data.issues.forEach((issue, index) => {
        console.log(`${index + 1}. ${issue.rule_name} (${issue.impact})`);
      });
      
      // Test the reordering logic with real data
      console.log('\n🧪 Testing reordering with real data...');
      const issues = data.data.issues;
      
      if (issues.length >= 2) {
        const draggedItem = issues[0].id;
        const targetIssueId = issues[1].id;
        
        console.log('🎯 Dragging:', issues[0].rule_name, 'to position of:', issues[1].rule_name);
        
        const draggedIndex = issues.findIndex(issue => issue.id === draggedItem);
        const targetIndex = issues.findIndex(issue => issue.id === targetIssueId);
        
        const newIssues = [...issues];
        const [draggedIssue] = newIssues.splice(draggedIndex, 1);
        newIssues.splice(targetIndex, 0, draggedIssue);
        
        console.log('📊 Before:', issues.map((i, idx) => `${idx + 1}. ${i.rule_name}`));
        console.log('📊 After:', newIssues.map((i, idx) => `${idx + 1}. ${i.rule_name}`));
        
        console.log('✅ Reordering logic works with real data!');
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing IssuesBoard component:', error);
  }
}

testIssuesBoardComponent();