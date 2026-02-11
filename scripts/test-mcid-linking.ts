#!/usr/bin/env tsx
/**
 * Test MCID linking implementation
 * Tests the full auto-tagging process with MCID linking
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { PDFAutoTagService } from '../src/lib/pdf-auto-tag-service'

async function testMCIDLinking() {
  console.log('🧪 Testing MCID Linking Implementation\n')
  
  const testPdfPath = path.join(process.cwd(), 'Introduction-to-Research.pdf')
  const outputPath = path.join(process.cwd(), 'Introduction-to-Research_tagged.pdf')
  
  try {
    // Check if test PDF exists
    await fs.access(testPdfPath)
    console.log(`✅ Found test PDF: ${testPdfPath}\n`)
    
    // Read PDF
    const pdfBuffer = await fs.readFile(testPdfPath)
    console.log(`📄 PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB\n`)
    
    // Initialize auto-tag service
    console.log('🔧 Initializing PDF Auto-Tag Service...')
    const autoTagService = new PDFAutoTagService()
    
    // Check dependencies
    console.log('\n🔍 Checking dependencies...')
    const deps = await autoTagService.checkDependencies()
    console.log(`  Python: ${deps.python ? '✅' : '❌'}`)
    console.log(`  PyMuPDF: ${deps.pymupdf ? '✅' : '❌'}`)
    console.log(`  pikepdf: ${deps.pikepdf ? '✅' : '❌'}\n`)
    
    if (!deps.python || !deps.pymupdf || !deps.pikepdf) {
      console.error('❌ Missing dependencies. Please install Python, PyMuPDF, and pikepdf.')
      process.exit(1)
    }
    
    // Run auto-tagging
    console.log('🏷️  Starting auto-tagging with MCID linking...\n')
    const startTime = Date.now()
    
    const result = await autoTagService.autoTagPDF(pdfBuffer, 'Introduction-to-Research.pdf')
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    if (!result.success) {
      console.error(`\n❌ Auto-tagging failed: ${result.error}`)
      process.exit(1)
    }
    
    console.log(`\n✅ Auto-tagging completed in ${duration}s`)
    console.log(`\n📊 Structure detected:`)
    console.log(`  Headings: ${result.structureDetected?.headings || 0}`)
    console.log(`  Tables: ${result.structureDetected?.tables || 0}`)
    console.log(`  Lists: ${result.structureDetected?.lists || 0}`)
    console.log(`  Images: ${result.structureDetected?.images || 0}`)
    console.log(`  Paragraphs: ${result.structureDetected?.paragraphs || 0}`)
    
    // Save tagged PDF
    if (result.taggedPdfBuffer) {
      await fs.writeFile(outputPath, result.taggedPdfBuffer)
      const outputSize = (result.taggedPdfBuffer.length / 1024 / 1024).toFixed(2)
      console.log(`\n💾 Tagged PDF saved: ${outputPath}`)
      console.log(`   Size: ${outputSize} MB`)
      
      // Verify the PDF
      console.log('\n🔍 Verifying tagged PDF...')
      try {
        const { exec } = require('child_process')
        const { promisify } = require('util')
        const execAsync = promisify(exec)
        
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
        const verifyScript = path.join(process.cwd(), 'scripts', 'check-tagged-elements.py')
        
        const { stdout } = await execAsync(`${pythonCmd} "${verifyScript}" "${outputPath}"`)
        console.log(stdout)
        
        console.log('\n✅ Test completed successfully!')
        console.log(`\n📝 Next steps:`)
        console.log(`   1. Open ${outputPath} in Adobe Acrobat Pro`)
        console.log(`   2. Run Accessibility Checker (Tools > Accessibility > Full Check)`)
        console.log(`   3. Verify that "Tagged content" passes`)
        console.log(`   4. Check that MCID linking is working (Tags panel should show structure)`)
        
      } catch (error: any) {
        console.warn(`\n⚠️  Could not verify PDF: ${error.message}`)
        console.log(`\n✅ Tagged PDF created: ${outputPath}`)
      }
    } else {
      console.error('\n❌ No tagged PDF buffer returned')
      process.exit(1)
    }
    
  } catch (error: any) {
    console.error(`\n❌ Test failed: ${error.message}`)
    if (error.stack) {
      console.error(error.stack)
    }
    process.exit(1)
  }
}

testMCIDLinking()



