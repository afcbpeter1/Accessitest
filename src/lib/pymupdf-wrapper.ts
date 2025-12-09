/**
 * PyMuPDF (fitz) Wrapper for PDF Structure Tree Modifications
 * 
 * This wrapper calls a Python script that uses PyMuPDF to modify PDF structure trees.
 * PyMuPDF can:
 * - Add heading tags (H1-H6) to PDF structure tree
 * - Add alt text to images
 * - Add language tags to text spans
 * - Modify table/list structure
 * - Preserve document layout exactly
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import { tmpdir } from 'os'

const execAsync = promisify(exec)

export interface PDFStructureFix {
  type: 'heading' | 'altText' | 'language' | 'table' | 'list' | 'imageOfText' | 'colorContrast' | 'readingOrder' | 'colorIndicator' | 'formLabel' | 'linkText' | 'textResize' | 'bookmark' | 'fontEmbedding' | 'tabOrder' | 'formFieldProperties' | 'linkValidation' | 'securitySettings'
  page: number
  text?: string
  level?: number // For headings (1-6)
  altText?: string // For images
  language?: string // ISO language code (e.g., 'fr', 'es')
  elementLocation?: string
  extractedText?: string // For images of text (OCR result)
  tableData?: any // Table structure data
  listData?: any // List structure data
  colorInfo?: { foreground: string; background: string; newForeground?: string; newBackground?: string } // Color contrast
  readingOrder?: number // Reading order sequence
  labelText?: string // For form labels
  linkText?: string // Improved link text
  fontSize?: number // For text resizing
}

export interface PyMuPDFRepairOptions {
  inputPath: string
  outputPath: string
  fixes: PDFStructureFix[]
  metadata?: {
    title?: string
    language?: string
    author?: string
  }
}

export class PyMuPDFWrapper {
  private pythonScriptPath: string

  constructor() {
    // Path to Python script that uses PyMuPDF
    this.pythonScriptPath = path.join(process.cwd(), 'scripts', 'pdf-repair.py')
  }

  /**
   * Repair PDF using PyMuPDF
   * This REBUILDS the PDF with fixes applied - extracts all content and rebuilds with proper structure tags
   */
  async repairPDF(options: PyMuPDFRepairOptions): Promise<Buffer> {
    try {
      // Use the rebuild script instead of the repair script
      const rebuildScriptPath = path.join(process.cwd(), 'scripts', 'pdf-rebuild-with-fixes.py')
      
      // Create temporary JSON file with fixes
      const tempDir = tmpdir()
      const fixesJsonPath = path.join(tempDir, `fixes-${Date.now()}.json`)
      await fs.writeFile(fixesJsonPath, JSON.stringify(options.fixes, null, 2))

      // Build Python command - use rebuild script
      // Use 'python' on Windows, 'python3' on Unix
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const cmd = [
        pythonCmd,
        rebuildScriptPath,
        '--input', options.inputPath,
        '--output', options.outputPath,
        '--fixes', fixesJsonPath,
        ...(options.metadata?.title ? ['--title', options.metadata.title] : []),
        ...(options.metadata?.language ? ['--language', options.metadata.language] : []),
        ...(options.metadata?.author ? ['--author', options.metadata.author] : [])
      ].join(' ')

      console.log(`🐍 Running PyMuPDF rebuild with fixes: ${cmd}`)
      console.log(`📋 Fixes being passed to Python: ${JSON.stringify(options.fixes, null, 2).substring(0, 500)}...`)
      console.log(`📋 Total fixes: ${options.fixes.length}`)

      // Execute Python script
      const { stdout, stderr } = await execAsync(cmd, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })

      console.log(`📄 Python script stdout: ${stdout}`)
      if (stderr) {
        console.log(`📄 Python script stderr: ${stderr}`)
      }

      if (stderr && !stderr.includes('WARNING') && !stderr.includes('INFO') && !stderr.includes('SUCCESS')) {
        console.error(`❌ PyMuPDF error: ${stderr}`)
        throw new Error(`PyMuPDF rebuild failed: ${stderr}`)
      }

      // Check if output file exists and has content
      try {
        const stats = await fs.stat(options.outputPath)
        console.log(`📊 Rebuilt PDF size: ${stats.size} bytes`)
        if (stats.size === 0) {
          throw new Error('PyMuPDF output file is empty')
        }
      } catch (statError) {
        console.error(`❌ Cannot read output file: ${statError}`)
        throw new Error(`PyMuPDF output file not found or empty: ${options.outputPath}`)
      }

      console.log(`✅ PyMuPDF rebuild complete: ${stdout}`)

      // Read rebuilt PDF
      const repairedBuffer = await fs.readFile(options.outputPath)
      console.log(`✅ Read rebuilt PDF: ${repairedBuffer.length} bytes`)

      // Cleanup
      await fs.unlink(fixesJsonPath).catch(() => {})

      return repairedBuffer
    } catch (error) {
      console.error('❌ PyMuPDF wrapper error:', error)
      throw error
    }
  }

  /**
   * Check if Python and PyMuPDF are available
   */
  async checkDependencies(): Promise<{ python: boolean; pymupdf: boolean }> {
    try {
      // Try 'python' first (Windows), then 'python3' (Unix)
      let pythonCmd = 'python'
      let hasPython = false
      try {
        const { stdout: pythonVersion } = await execAsync('python --version')
        hasPython = pythonVersion.includes('Python 3')
        console.log(`   ✅ Found Python: ${pythonVersion.trim()}`)
      } catch (error) {
        console.log(`   ⚠️ 'python' command failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
        try {
          const { stdout: pythonVersion } = await execAsync('python3 --version')
          hasPython = pythonVersion.includes('Python 3')
          pythonCmd = 'python3'
          console.log(`   ✅ Found Python3: ${pythonVersion.trim()}`)
        } catch (error2) {
          console.log(`   ❌ 'python3' command also failed: ${error2 instanceof Error ? error2.message : 'Unknown error'}`)
          hasPython = false
        }
      }

      // Check PyMuPDF
      let hasPyMuPDF = false
      if (hasPython) {
        try {
          const { stdout } = await execAsync(`${pythonCmd} -c "import fitz; print(fitz.version)"`)
          hasPyMuPDF = stdout.includes('1.') || stdout.includes('2.')
          if (hasPyMuPDF) {
            console.log(`   ✅ PyMuPDF found: ${stdout.trim()}`)
          } else {
            console.log(`   ⚠️ PyMuPDF import succeeded but version check failed: ${stdout.trim()}`)
          }
        } catch (error) {
          console.log(`   ❌ PyMuPDF import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
          hasPyMuPDF = false
        }
      } else {
        console.log(`   ⚠️ Skipping PyMuPDF check - Python not available`)
      }

      return { python: hasPython, pymupdf: hasPyMuPDF }
    } catch (error) {
      console.log(`   ❌ Dependency check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      return { python: false, pymupdf: false }
    }
  }
}

