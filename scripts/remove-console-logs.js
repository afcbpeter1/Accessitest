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
    
    // Remove console.log, console.debug, console.info
    // But keep console.error and console.warn
    content = content.replace(/^\s*console\.(log|debug|info)\([^)]*\);?\s*$/gm, '');
    content = content.replace(/^\s*console\.(log|debug|info)\([^)]*\)\s*$/gm, '');
    
    // Remove multi-line console.log statements (basic)
    content = content.replace(/console\.(log|debug|info)\([^;]*?\);?\s*/g, '');
    
    if (content !== originalContent) {
      const removed = (originalContent.match(/console\.(log|debug|info)\(/g) || []).length - 
                      (content.match(/console\.(log|debug|info)\(/g) || []).length;
      totalRemoved += removed;
      fs.writeFileSync(file, content, 'utf-8');
      console.log(`Cleaned ${file}: removed ${removed} console.log/debug/info statements`);
    }
  } catch (error) {
    console.error(`Error processing ${file}:`, error.message);
  }
});

console.log(`\nTotal removed: ${totalRemoved} console.log/debug/info statements`);

