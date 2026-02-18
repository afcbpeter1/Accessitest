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
  constructor() {
    // This wrapper now uses pdf-rebuild-with-fixes.py directly
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
        ...(options.metadata?.language ? ['--lang', options.metadata.language] : [])
        // Note: --author is not currently supported by pdf-rebuild-with-fixes.py
      ].join(' ')

      // Execute Python script
      let stdout: string
      let stderr: string
      try {
        const result = await execAsync(cmd, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })
        stdout = result.stdout
        stderr = result.stderr
      } catch (error: any) {
        stdout = error.stdout || ''
        stderr = error.stderr || ''
        
        // Check for pikepdf installation error
        if (stderr.includes('pikepdf not installed') || stdout.includes('pikepdf not installed')) {
          const installCmd = process.platform === 'win32' 
            ? 'pip install -r scripts/requirements.txt'
            : 'pip3 install -r scripts/requirements.txt'
          throw new Error(
            `❌ PDF auto-tagging requires pikepdf to be installed.\n\n` +
            `Please install it by running:\n` +
            `  ${installCmd}\n\n` +
            `Or on Windows, you can run:\n` +
            `  scripts\\install-pymupdf.bat\n\n` +
            `This will install both PyMuPDF and pikepdf required for PDF accessibility fixes.`
          )
        }
        
        // Re-throw other errors
        throw error
      }

      if (stderr && !stderr.includes('WARNING') && !stderr.includes('INFO') && !stderr.includes('SUCCESS')) {
        // Check for pikepdf installation error in stderr
        if (stderr.includes('pikepdf not installed')) {
          const installCmd = process.platform === 'win32' 
            ? 'pip install -r scripts/requirements.txt'
            : 'pip3 install -r scripts/requirements.txt'
          throw new Error(
            `❌ PDF auto-tagging requires pikepdf to be installed.\n\n` +
            `Please install it by running:\n` +
            `  ${installCmd}\n\n` +
            `Or on Windows, you can run:\n` +
            `  scripts\\install-pymupdf.bat\n\n` +
            `This will install both PyMuPDF and pikepdf required for PDF accessibility fixes.`
          )
        }
        console.error(`❌ PyMuPDF error: ${stderr}`)
        throw new Error(`PyMuPDF rebuild failed: ${stderr}`)
      }

      // Check if output file exists and has content
      try {
        const stats = await fs.stat(options.outputPath)

        if (stats.size === 0) {
          throw new Error('PyMuPDF output file is empty')
        }
      } catch (statError) {
        console.error(`❌ Cannot read output file: ${statError}`)
        throw new Error(`PyMuPDF output file not found or empty: ${options.outputPath}`)
      }

      // Read rebuilt PDF
      const repairedBuffer = await fs.readFile(options.outputPath)

      // Cleanup
      await fs.unlink(fixesJsonPath).catch(() => {})

      return repairedBuffer
    } catch (error) {
      console.error('❌ PyMuPDF wrapper error:', error)
      throw error
    }
  }

  /**
   * Check if Python, PyMuPDF, and pikepdf are available
   */
  async checkDependencies(): Promise<{ python: boolean; pymupdf: boolean; pikepdf: boolean }> {
    try {
      // Try 'python' first (Windows), then 'python3' (Unix)
      let pythonCmd = 'python'
      let hasPython = false
      try {
        const { stdout: pythonVersion } = await execAsync('python --version')
        hasPython = pythonVersion.includes('Python 3')
      } catch (error) {
        try {
          const { stdout: pythonVersion } = await execAsync('python3 --version')
          hasPython = pythonVersion.includes('Python 3')
          pythonCmd = 'python3'
        } catch (error2) {
          hasPython = false
        }
      }

      // Check PyMuPDF
      let hasPyMuPDF = false
      let hasPikepdf = false
      if (hasPython) {
        try {
          const { stdout } = await execAsync(`${pythonCmd} -c "import fitz; print(fitz.version)"`)
          hasPyMuPDF = stdout.includes('1.') || stdout.includes('2.')
        } catch (error) {
          hasPyMuPDF = false
        }

        // Check pikepdf
        try {
          await execAsync(`${pythonCmd} -c "import pikepdf; print(pikepdf.__version__)"`)
          hasPikepdf = true
        } catch (error) {
          hasPikepdf = false
        }
      }

      return { python: hasPython, pymupdf: hasPyMuPDF, pikepdf: hasPikepdf }
    } catch (error) {
      return { python: false, pymupdf: false, pikepdf: false }
    }
  }
}

