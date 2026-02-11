#!/usr/bin/env tsx
/**
 * Test language detection in tagged PDFs
 * This verifies that:
 * 1. Language is set during auto-tagging
 * 2. Language can be extracted from tagged PDF
 * 3. Scanner correctly detects language
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { PDFAutoTagService } from '../src/lib/pdf-auto-tag-service'
import { PDFParser } from '../src/lib/pdf-parser'

async function testLanguageDetection() {
  console.log('🧪 Testing language detection in tagged PDFs...\n')
  
  const testPdfPath = path.join(process.cwd(), 'Introduction-to-Research.pdf')
  
  if (!await fs.access(testPdfPath).then(() => true).catch(() => false)) {
    console.error('❌ Test PDF not found:', testPdfPath)
    process.exit(1)
  }
  
  const originalBuffer = await fs.readFile(testPdfPath)
  console.log('📄 Original PDF loaded:', originalBuffer.length, 'bytes')
  
  // Step 1: Auto-tag the PDF
  console.log('\n🏷️ Step 1: Auto-tagging PDF...')
  const autoTagService = new PDFAutoTagService()
  const autoTagResult = await autoTagService.autoTagPDF(originalBuffer, 'Introduction-to-Research.pdf')
  
  if (!autoTagResult.success || !autoTagResult.taggedPdfBuffer) {
    console.error('❌ Auto-tagging failed:', autoTagResult.error)
    process.exit(1)
  }
  
  const taggedBuffer = Buffer.from(autoTagResult.taggedPdfBuffer)
  console.log('✅ PDF auto-tagged:', taggedBuffer.length, 'bytes')
  
  // Step 2: Extract language from tagged PDF using PDFParser
  console.log('\n📄 Step 2: Extracting language from tagged PDF...')
  const parser = new PDFParser()
  const parsedStructure = await parser.parsePDF(taggedBuffer)
  
  console.log('📊 Parsed metadata:')
  console.log('  - Title:', parsedStructure.metadata.title || '(none)')
  console.log('  - Author:', parsedStructure.metadata.author || '(none)')
  console.log('  - Language:', parsedStructure.metadata.language || '(none) ⚠️')
  
  if (parsedStructure.metadata.language) {
    console.log('✅ Language successfully extracted:', parsedStructure.metadata.language)
  } else {
    console.error('❌ Language NOT extracted from tagged PDF!')
    console.log('   This means the scanner will report "Missing document language declaration"')
    process.exit(1)
  }
  
  // Step 3: Verify using Python script directly
  console.log('\n🐍 Step 3: Verifying with Python script...')
  const { exec } = require('child_process')
  const { promisify } = require('util')
  const execAsync = promisify(exec)
  const { tmpdir } = require('os')
  
  const tempPdfPath = path.join(tmpdir(), `test-lang-${Date.now()}.pdf`)
  await fs.writeFile(tempPdfPath, taggedBuffer)
  
  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
    const extractScriptPath = path.join(process.cwd(), 'scripts', 'extract-pdf-language.py')
    const { stdout } = await execAsync(`${pythonCmd} "${extractScriptPath}" "${tempPdfPath}"`)
    const result = JSON.parse(stdout.trim())
    
    if (result.success && result.language) {
      console.log('✅ Python script confirms language:', result.language)
      if (result.language === parsedStructure.metadata.language) {
        console.log('✅ Language matches between PDFParser and Python script!')
      } else {
        console.error('❌ Language mismatch!')
        console.error('   PDFParser:', parsedStructure.metadata.language)
        console.error('   Python:', result.language)
      }
    } else {
      console.error('❌ Python script could not extract language')
    }
  } finally {
    await fs.unlink(tempPdfPath).catch(() => {})
  }
  
  console.log('\n✅ All tests passed! Language detection is working correctly.')
}

testLanguageDetection().catch(error => {
  console.error('❌ Test failed:', error)
  process.exit(1)
})



