// Test the drag and drop reordering logic
function testDragDropLogic() {
  console.log('🧪 Testing drag and drop reordering logic...');
  
  // Simulate the issues array
  const issues = [
    { id: 'issue-1', rule_name: 'Issue 1' },
    { id: 'issue-2', rule_name: 'Issue 2' },
    { id: 'issue-3', rule_name: 'Issue 3' },
    { id: 'issue-4', rule_name: 'Issue 4' }
  ];
  
  console.log('📊 Original order:', issues.map((i, idx) => `${idx + 1}. ${i.rule_name}`));
  
  // Simulate dragging issue-1 to position of issue-3
  const draggedItem = 'issue-1';
  const targetIssueId = 'issue-3';
  
  const draggedIndex = issues.findIndex(issue => issue.id === draggedItem);
  const targetIndex = issues.findIndex(issue => issue.id === targetIssueId);
  
  console.log('🎯 Dragged item:', draggedItem, 'at index:', draggedIndex);
  console.log('🎯 Target item:', targetIssueId, 'at index:', targetIndex);
  
  // Apply the reordering logic
  const newIssues = [...issues];
  const [draggedIssue] = newIssues.splice(draggedIndex, 1);
  newIssues.splice(targetIndex, 0, draggedIssue);
  
  console.log('📊 After reordering:', newIssues.map((i, idx) => `${idx + 1}. ${i.rule_name}`));
  
  // Expected: Issue 2, Issue 3, Issue 1, Issue 4
  const expected = ['Issue 2', 'Issue 3', 'Issue 1', 'Issue 4'];
  const actual = newIssues.map(i => i.rule_name);
  
  console.log('✅ Expected:', expected);
  console.log('✅ Actual:', actual);
  console.log('✅ Match:', JSON.stringify(expected) === JSON.stringify(actual) ? 'YES' : 'NO');
}

testDragDropLogic();