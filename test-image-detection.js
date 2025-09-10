const fs = require('fs');
const path = require('path');

async function testImageDetection() {
  try {
    const pdfPath = path.join(__dirname, 'EPRS_STU(2022)729512_EN.pdf');
    const buffer = fs.readFileSync(pdfPath);
    
    console.log('🔍 Testing image detection logic...');
    
    // Test pdf-parse directly
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    
    console.log(`📄 PDF parsed: ${data.numpages} pages, ${data.text.length} characters`);
    
    // Test complex image detection
    const complexImageIndicators = [
      /chart/i,
      /graph/i,
      /diagram/i,
      /figure/i,
      /plot/i,
      /visualization/i,
      /data visualization/i,
      /infographic/i,
      /flowchart/i,
      /mind map/i,
      /timeline/i,
      /bar chart/i,
      /line graph/i,
      /pie chart/i,
      /scatter plot/i,
      /histogram/i,
      /heatmap/i
    ];
    
    console.log('\n🔍 Checking for complex image indicators:');
    let foundIndicators = [];
    
    for (const indicator of complexImageIndicators) {
      const matches = data.text.match(indicator);
      if (matches) {
        foundIndicators.push({
          pattern: indicator.source,
          matches: matches.length,
          examples: matches.slice(0, 3) // Show first 3 examples
        });
      }
    }
    
    if (foundIndicators.length > 0) {
      console.log('✅ Found complex image indicators:');
      foundIndicators.forEach(indicator => {
        console.log(`   • ${indicator.pattern}: ${indicator.matches} matches`);
        console.log(`     Examples: ${indicator.examples.join(', ')}`);
      });
    } else {
      console.log('❌ No complex image indicators found');
    }
    
    // Check for image-related content
    console.log('\n🔍 Checking for image-related content:');
    const imagePatterns = [
      /image/i,
      /picture/i,
      /photo/i,
      /illustration/i,
      /graphic/i,
      /visual/i
    ];
    
    let imageContent = [];
    for (const pattern of imagePatterns) {
      const matches = data.text.match(pattern);
      if (matches) {
        imageContent.push({
          pattern: pattern.source,
          matches: matches.length,
          examples: matches.slice(0, 3)
        });
      }
    }
    
    if (imageContent.length > 0) {
      console.log('✅ Found image-related content:');
      imageContent.forEach(content => {
        console.log(`   • ${content.pattern}: ${content.matches} matches`);
        console.log(`     Examples: ${content.examples.join(', ')}`);
      });
    } else {
      console.log('❌ No image-related content found');
    }
    
    // Show a sample of the text around where images might be mentioned
    console.log('\n📄 Sample text content (first 1000 characters):');
    console.log(data.text.substring(0, 1000));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testImageDetection();











