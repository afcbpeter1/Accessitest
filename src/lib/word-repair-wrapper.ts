/**
 * Word Repair Wrapper
 * Wraps the Python word-repair-with-fixes.py script
 * Similar to PyMuPDFWrapper but for Word documents
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface WordRepairOptions {
  inputPath: string
  outputPath: string
  fixes: WordStructureFix[]
  metadata?: {
    title?: string
    language?: string
    author?: string
  }
}

export interface WordStructureFix {
  type: 'heading' | 'altText' | 'table' | 'language' | 'colorContrast' | 'linkText'
  page?: number
  text?: string
  level?: number
  altText?: string
  imageId?: string
  summary?: string
  hasHeaders?: boolean
  tableIndex?: number
  language?: string
  elementLocation?: string
  oldText?: string
  newText?: string
  currentColor?: string
  newColor?: string
}

export class WordRepairWrapper {
  private pythonScriptPath: string

  constructor() {
    this.pythonScriptPath = path.join(process.cwd(), 'scripts', 'word-repair-with-fixes.py')
  }

  /**
   * Repair Word document using Python script
   * This applies accessibility fixes to .docx files
   */
  async repairWord(options: WordRepairOptions): Promise<Buffer> {
    try {
      // Create temporary JSON file with fixes
      const tempDir = tmpdir()
      const fixesJsonPath = path.join(tempDir, `word-fixes-${Date.now()}.json`)
      
      // Convert fixes to format expected by Python script
      const fixesData: any = {
        imageFixes: [],
        tableFixes: [],
        headingFixes: [],
        languageFixes: [],
        colorContrastFixes: [],
        linkTextFixes: [],
        metadata: options.metadata || {}
      }

      // Organize fixes by type
      for (const fix of options.fixes) {
        switch (fix.type) {
          case 'altText':
            if (fix.imageId && fix.altText) {
              fixesData.imageFixes.push({
                imageId: fix.imageId,
                altText: fix.altText
              })
            }
            break
          
          case 'table':
            if (fix.tableIndex !== undefined) {
              fixesData.tableFixes.push({
                summary: fix.summary || '',
                hasHeaders: fix.hasHeaders || false,
                tableIndex: fix.tableIndex
              })
            }
            break
          
          case 'heading':
            if (fix.text && fix.level) {
              // Note: paragraphIndex needs to be determined from document structure
              // For now, we'll pass the text and level, and Python script will find it
              fixesData.headingFixes.push({
                text: fix.text,
                level: fix.level
              })
            }
            break
          
          case 'language':
            if (fix.text && fix.language) {
              fixesData.languageFixes.push({
                text: fix.text,
                language: fix.language,
                elementLocation: fix.elementLocation
              })
            }
            break
          
          case 'colorContrast':
            if (fix.text && fix.newColor) {
              fixesData.colorContrastFixes.push({
                text: fix.text,
                currentColor: fix.currentColor || 'unknown',
                newColor: fix.newColor,
                elementLocation: fix.elementLocation
              })
            }
            break
          
          case 'linkText':
            if (fix.oldText && fix.newText) {
              fixesData.linkTextFixes.push({
                oldText: fix.oldText,
                newText: fix.newText,
                elementLocation: fix.elementLocation
              })
            }
            break
        }
      }

      await fs.writeFile(fixesJsonPath, JSON.stringify(fixesData, null, 2), { encoding: 'utf8' })

      // Build Python command
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const cmd = [
        pythonCmd,
        this.pythonScriptPath,
        '--input', options.inputPath,
        '--output', options.outputPath,
        '--fixes', fixesJsonPath,
        ...(options.metadata?.title ? ['--title', options.metadata.title] : []),
        ...(options.metadata?.language ? ['--language', options.metadata.language] : []),
        ...(options.metadata?.author ? ['--author', options.metadata.author] : [])
      ].join(' ')

      // Execute Python script
      const { stdout, stderr } = await execAsync(cmd, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })

      if (stderr && !stderr.includes('WARNING') && !stderr.includes('INFO') && !stderr.includes('SUCCESS')) {
        console.error(`❌ Word repair error: ${stderr}`)
        throw new Error(`Word repair failed: ${stderr}`)
      }

      // Check if output file exists and has content
      try {
        const stats = await fs.stat(options.outputPath)

        if (stats.size === 0) {
          throw new Error('Word repair output file is empty')
        }
      } catch (statError) {
        console.error(`❌ Cannot read output file: ${statError}`)
        throw new Error(`Word repair output file not found or empty: ${options.outputPath}`)
      }

      // Read repaired Word document
      const repairedBuffer = await fs.readFile(options.outputPath)

      // Cleanup
      await fs.unlink(fixesJsonPath).catch(() => {})

      return repairedBuffer
    } catch (error) {
      console.error('❌ Word repair wrapper error:', error)
      throw error
    }
  }

  /**
   * Check if Python and python-docx are available
   */
  async checkDependencies(): Promise<{ python: boolean; pythonDocx: boolean }> {
    try {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      
      // Check Python
      try {
        await execAsync(`${pythonCmd} --version`)
      } catch {
        return { python: false, pythonDocx: false }
      }

      // Check python-docx
      try {
        await execAsync(`${pythonCmd} -c "import docx; print('ok')"`)
        return { python: true, pythonDocx: true }
      } catch {
        return { python: true, pythonDocx: false }
      }
    } catch {
      return { python: false, pythonDocx: false }
    }
  }
}

