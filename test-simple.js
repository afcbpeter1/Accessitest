const fs = require('fs');
const path = require('path');

async function testSimplePDF() {
  try {
    const pdfPath = path.join(__dirname, 'EPRS_STU(2022)729512_EN.pdf');
    const buffer = fs.readFileSync(pdfPath);
    
    console.log('📁 Testing simple PDF parsing...');
    console.log(`📊 Buffer size: ${buffer.length} bytes`);
    
    // Test pdf-parse directly
    const pdfParse = require('pdf-parse');
    
    console.log('🔍 Calling pdf-parse...');
    const data = await pdfParse(buffer);
    
    console.log('✅ pdf-parse successful!');
    console.log(`📄 Pages: ${data.numpages}`);
    console.log(`📝 Text length: ${data.text.length}`);
    console.log(`📊 Word count: ${data.text.split(/\s+/).length}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
  }
}

testSimplePDF();











