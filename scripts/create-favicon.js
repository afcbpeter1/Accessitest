const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

async function createFavicon() {
  const inputPath = path.join(__dirname, '../public/allytest.png');
  const outputDir = path.join(__dirname, '../public');
  
  // Read the original image to get dimensions
  const metadata = await sharp(inputPath).metadata();
  console.log(`Original image: ${metadata.width}x${metadata.height}px`);
  
  // Create square versions at standard favicon sizes
  const sizes = [16, 32, 48, 180]; // Standard favicon sizes
  
  for (const size of sizes) {
    // Create square version by:
    // 1. Resizing to fit within square (maintaining aspect ratio)
    // 2. Adding transparent padding to make it square
    const outputPath = path.join(outputDir, `favicon-${size}x${size}.png`);
    
    await sharp(inputPath)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 0 } // Transparent background
      })
      .toFile(outputPath);
    
    console.log(`Created: favicon-${size}x${size}.png`);
  }
  
  // Also create a generic favicon.ico equivalent (32x32)
  const faviconPath = path.join(outputDir, 'favicon.png');
  await sharp(inputPath)
    .resize(32, 32, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 }
    })
    .toFile(faviconPath);
  
  console.log('\n✅ Favicon files created!');
  console.log('Update layout.tsx to use these new square favicons.');
}

createFavicon().catch(console.error);

