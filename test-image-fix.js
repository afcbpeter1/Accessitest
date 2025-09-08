const fs = require('fs');
const path = require('path');

async function testImageFix() {
  try {
    const pdfPath = path.join(__dirname, 'EPRS_STU(2022)729512_EN.pdf');
    const buffer = fs.readFileSync(pdfPath);
    
    console.log('🔍 Testing improved image detection...');
    
    // Test pdf-parse directly
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    
    console.log(`📄 PDF parsed: ${data.numpages} pages, ${data.text.length} characters`);
    
    // Test the new image detection logic
    let imageCount = 0;
    
    // Count image file extensions (these are actual images)
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|svg|tiff|webp)/gi;
    const extensionMatches = data.text.match(imageExtensions);
    if (extensionMatches) {
      imageCount += extensionMatches.length;
      console.log(`📁 Found ${extensionMatches.length} image file extensions`);
    }
    
    // Count actual figure references (like "Figure 1", "Figure 2", etc.)
    const figureReferences = data.text.match(/figure\s+\d+/gi);
    if (figureReferences) {
      imageCount += figureReferences.length;
      console.log(`📊 Found ${figureReferences.length} figure references: ${figureReferences.slice(0, 5).join(', ')}`);
    }
    
    // Count actual image references (like "Image 1", "Photo 1", etc.)
    const imageReferences = data.text.match(/(image|photo|picture|graphic)\s+\d+/gi);
    if (imageReferences) {
      imageCount += imageReferences.length;
      console.log(`🖼️ Found ${imageReferences.length} image references: ${imageReferences.slice(0, 5).join(', ')}`);
    }
    
    console.log(`\n🎯 Total actual images detected: ${imageCount}`);
    
    // Test complex image detection
    const complexImageIndicators = [
      /figure\s+\d+/i,
      /chart\s+showing/i,
      /graph\s+of/i,
      /diagram\s+illustrating/i,
      /data\s+visualization/i,
      /bar\s+chart/i,
      /line\s+graph/i,
      /pie\s+chart/i,
      /scatter\s+plot/i,
      /flowchart/i,
      /timeline/i,
      /infographic/i,
      /heatmap/i
    ];
    
    let hasComplexImages = false;
    for (const indicator of complexImageIndicators) {
      if (indicator.test(data.text)) {
        console.log(`🔍 Found complex image indicator: ${indicator.source}`);
        hasComplexImages = true;
        break;
      }
    }
    
    // Check for multiple instances of "figure"
    const figureMatches = data.text.match(/figure/gi);
    if (figureMatches && figureMatches.length > 2) {
      console.log(`🔍 Found ${figureMatches.length} instances of "figure" - likely actual figures`);
      hasComplexImages = true;
    }
    
    console.log(`\n🎯 Has complex images: ${hasComplexImages}`);
    console.log(`🎯 Should flag complex images: ${hasComplexImages && imageCount > 0}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testImageFix();









