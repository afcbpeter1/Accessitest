const fs = require('fs');
const path = require('path');

// Recursively find all TypeScript files
function findFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory() && !filePath.includes('node_modules') && !filePath.includes('.next')) {
      findFiles(filePath, fileList);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
}

const files = findFiles('src');
let totalRemoved = 0;

files.forEach(file => {
  try {
    let content = fs.readFileSync(file, 'utf-8');
    const originalContent = content;
    let removed = 0;
    
    // Remove console.log/debug/info statements more carefully
    // Match: console.log(...); or console.log(...) on its own line
    // But keep console.error and console.warn
    
    // Pattern 1: Single line console.log/debug/info with semicolon
    content = content.replace(/^\s*console\.(log|debug|info)\([^)]*\);\s*$/gm, '');
    
    // Pattern 2: Multi-line console.log (basic - be careful)
    // Remove console.log with template literals (single line)
    content = content.replace(/console\.(log|debug|info)\(`[^`]*`\);\s*/g, '');
    
    // Pattern 3: Remove console.log with simple strings
    content = content.replace(/console\.(log|debug|info)\(['"][^'"]*['"]\);\s*/g, '');
    
    // Count what was removed
    const originalMatches = (originalContent.match(/console\.(log|debug|info)\(/g) || []).length;
    const newMatches = (content.match(/console\.(log|debug|info)\(/g) || []).length;
    removed = originalMatches - newMatches;
    
    if (content !== originalContent && removed > 0) {
      totalRemoved += removed;
      fs.writeFileSync(file, content, 'utf-8');
      console.log(`Cleaned ${file}: removed ${removed} console.log/debug/info statements`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nTotal removed: ${totalRemoved} console.log/debug/info statements`);

