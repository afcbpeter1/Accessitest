const fs = require('fs');
const path = require('path');

async function testActualImages() {
  try {
    const pdfPath = path.join(__dirname, 'EPRS_STU(2022)729512_EN.pdf');
    const buffer = fs.readFileSync(pdfPath);
    
    console.log('🔍 Testing actual image detection...');
    
    // Test pdf-parse directly
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    
    console.log(`📄 PDF parsed: ${data.numpages} pages, ${data.text.length} characters`);
    
    // Test the exact same logic as the scanner
    let imageCount = 0;
    const detectedImages = [];
    
    // Count image file extensions (these are actual images)
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|svg|tiff|webp)/gi;
    const extensionMatches = data.text.match(imageExtensions);
    if (extensionMatches) {
      imageCount += extensionMatches.length;
      detectedImages.push(`File extensions: ${extensionMatches.join(', ')}`);
      console.log(`📁 Found ${extensionMatches.length} image file extensions: ${extensionMatches.join(', ')}`);
    }
    
    // Count actual figure references (like "Figure 1", "Figure 2", etc.)
    const figureReferences = data.text.match(/figure\s+\d+/gi);
    if (figureReferences) {
      imageCount += figureReferences.length;
      detectedImages.push(`Figure references: ${figureReferences.join(', ')}`);
      console.log(`📊 Found ${figureReferences.length} figure references: ${figureReferences.join(', ')}`);
    }
    
    // Count actual image references (like "Image 1", "Photo 1", etc.)
    const imageReferences = data.text.match(/(image|photo|picture|graphic)\s+\d+/gi);
    if (imageReferences) {
      imageCount += imageReferences.length;
      detectedImages.push(`Image references: ${imageReferences.join(', ')}`);
      console.log(`🖼️ Found ${imageReferences.length} image references: ${imageReferences.join(', ')}`);
    }
    
    console.log(`\n🎯 Total images detected: ${imageCount}`);
    console.log(`📋 All detected image content:`);
    detectedImages.forEach((item, idx) => {
      console.log(`   ${idx + 1}. ${item}`);
    });
    
    // Show context around image-related words
    console.log(`\n🔍 Context around image-related words:`);
    const imageWords = ['image', 'picture', 'photo', 'figure', 'graph', 'chart', 'diagram'];
    imageWords.forEach(word => {
      const regex = new RegExp(`.{0,50}${word}.{0,50}`, 'gi');
      const matches = data.text.match(regex);
      if (matches && matches.length > 0) {
        console.log(`\n   "${word}":`);
        matches.slice(0, 3).forEach((match, idx) => {
          console.log(`     ${idx + 1}. "...${match.trim()}..."`);
        });
      }
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testActualImages();






