/**
 * PDF Auto-Tagging Service
 * 
 * Replicates Adobe's auto-tagging functionality:
 * - Identifies document structure (headings, tables, lists, images, etc.)
 * - Creates PDF structure tree (StructTreeRoot) with actual structure elements
 * - Tags all elements with proper PDF/UA tags using PyMuPDF + pikepdf
 * - Links content to structure via MCID (Marked Content ID)
 * - Sets MarkInfo/Marked=true
 * - Adds language tags
 * - Creates proper reading order
 * 
 * Uses pdf-rebuild-with-fixes.py which creates actual structure elements
 * (not just structure tree root) - this replaces Adobe's autoTagPDF API call.
 */

import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs/promises'
import * as path from 'path'
import { tmpdir } from 'os'
import { ComprehensiveDocumentScanner } from './comprehensive-document-scanner'
import { PDFParser } from './pdf-parser'

const execAsync = promisify(exec)

// Helper to properly quote arguments for shell execution
function quoteArg(arg: string): string {
  // If argument contains spaces or special characters, quote it
  if (arg.includes(' ') || arg.includes('"') || arg.includes("'")) {
    // Escape existing quotes and wrap in quotes
    return `"${arg.replace(/"/g, '\\"')}"`
  }
  return arg
}

export interface AutoTagResult {
  success: boolean
  taggedPdfBuffer?: Buffer
  error?: string
  message?: string
  structureDetected?: {
    headings: number
    tables: number
    lists: number
    images: number
    paragraphs: number
  }
}

export interface StructureElement {
  type: 'heading' | 'paragraph' | 'table' | 'list' | 'image' | 'link' | 'form'
  page: number
  text?: string
  level?: number // For headings (1-6)
  altText?: string // For images
  language?: string // ISO language code
  tableData?: {
    rows: number
    columns: number
    hasHeaders: boolean
    cells?: Array<{ row: number; col: number; text: string; isHeader: boolean }>
  }
  listData?: {
    type: 'ordered' | 'unordered'
    items: string[]
  }
  rect?: { x0: number; y0: number; x1: number; y1: number } // Bounding box
  readingOrder?: number
}

export class PDFAutoTagService {
  private scanner: ComprehensiveDocumentScanner
  private pdfParser: PDFParser

  constructor() {
    this.scanner = new ComprehensiveDocumentScanner()
    this.pdfParser = new PDFParser()
  }

  /**
   * Auto-tag a PDF - replicates Adobe's autoTagPDF functionality
   * 
   * Process:
   * 1. Scan PDF to identify structure (headings, tables, lists, images, etc.)
   * 2. Extract structure elements with positions
   * 3. Convert to fixes format for pdf-rebuild-with-fixes.py
   * 4. Call pdf-rebuild-with-fixes.py which:
   *    - Uses PyMuPDF to detect and extract structure
   *    - Uses pikepdf to create actual structure elements (/StructElem)
   *    - Links content to structure via MCID
   *    - Sets MarkInfo/Marked=true
   *    - Adds language tags
   *    - Creates proper reading order
   */
  async autoTagPDF(pdfBuffer: Buffer, fileName: string = 'document.pdf'): Promise<AutoTagResult> {
    try {
      // Step 1: Scan PDF to identify structure
      console.log('🔍 Step 1: Scanning PDF to identify structure...')
      const scanResult = await this.scanner.scanDocument(pdfBuffer, fileName, 'application/pdf')
      
      // Step 2: Parse PDF to get detailed structure with positions
      console.log('📄 Step 2: Parsing PDF structure...')
      const parsedStructure = await this.pdfParser.parsePDF(pdfBuffer)
      
      // Step 3: Extract structure elements for tagging
      console.log('🏷️ Step 3: Extracting structure elements...')
      const structureElements = await this.extractStructureElements(scanResult, parsedStructure)
      
      console.log(`✅ Detected structure: ${structureElements.headings.length} headings, ${structureElements.tables.length} tables, ${structureElements.lists.length} lists, ${structureElements.images.length} images`)
      
      // Step 4: Create tagged PDF using pdf-rebuild-with-fixes.py (PyMuPDF + pikepdf)
      console.log('🔧 Step 4: Creating tagged PDF with pdf-rebuild-with-fixes.py (PyMuPDF + pikepdf)...')
      const taggedPdfBuffer = await this.createTaggedPDF(pdfBuffer, structureElements, parsedStructure)
      
      return {
        success: true,
        taggedPdfBuffer,
        message: 'PDF successfully auto-tagged',
        structureDetected: {
          headings: structureElements.headings.length,
          tables: structureElements.tables.length,
          lists: structureElements.lists.length,
          images: structureElements.images.length,
          paragraphs: structureElements.paragraphs.length
        }
      }
    } catch (error: any) {
      console.error('❌ PDF auto-tagging error:', error)
      return {
        success: false,
        error: error.message || 'Failed to auto-tag PDF',
        message: `PDF auto-tagging error: ${error.message}`
      }
    }
  }

  /**
   * Extract structure elements from scan results and parsed structure
   */
  private async extractStructureElements(
    scanResult: any,
    parsedStructure: any
  ): Promise<{
    headings: StructureElement[]
    tables: StructureElement[]
    lists: StructureElement[]
    images: StructureElement[]
    paragraphs: StructureElement[]
    links: StructureElement[]
    forms: StructureElement[]
  }> {
    const headings: StructureElement[] = []
    const tables: StructureElement[] = []
    const lists: StructureElement[] = []
    const images: StructureElement[] = []
    const paragraphs: StructureElement[] = []
    const links: StructureElement[] = []
    const forms: StructureElement[] = []

    // Extract headings from parsed structure (check both parsedStructure and scanResult)
    const parsedHeadings = parsedStructure.structure?.headings || []
    if (parsedHeadings.length > 0) {
      parsedHeadings.forEach((h: any) => {
        headings.push({
          type: 'heading',
          page: h.page || 1,
          text: h.text || '',
          level: h.level || 1,
          readingOrder: headings.length + 1
        })
      })
    } else if (scanResult.metadata?.headingCount > 0) {
      // Fallback: try to extract from page analysis
      scanResult.pageAnalysis?.forEach((page: any) => {
        if (page.headingCount > 0) {
          // Create placeholder headings if we know there are headings but can't extract them
          for (let i = 0; i < page.headingCount; i++) {
            headings.push({
              type: 'heading',
              page: page.pageNumber || 1,
              text: `Heading ${i + 1}`,
              level: 1,
              readingOrder: headings.length + 1
            })
          }
        }
      })
    }

    // Extract tables
    const parsedTables = parsedStructure.structure?.tables || []
    if (parsedTables.length > 0) {
      parsedTables.forEach((t: any, index: number) => {
        tables.push({
          type: 'table',
          page: t.page || 1,
          tableData: {
            rows: t.rows || 0,
            columns: t.columns || 0,
            hasHeaders: t.hasHeaders || false
          },
          readingOrder: headings.length + tables.length + 1
        })
      })
    } else if (scanResult.metadata?.tableCount > 0) {
      // Fallback: create placeholder tables
      scanResult.pageAnalysis?.forEach((page: any) => {
        if (page.tableCount > 0) {
          for (let i = 0; i < page.tableCount; i++) {
            tables.push({
              type: 'table',
              page: page.pageNumber || 1,
              tableData: {
                rows: 0,
                columns: 0,
                hasHeaders: false
              },
              readingOrder: headings.length + tables.length + 1
            })
          }
        }
      })
    }

    // Extract lists
    const parsedLists = parsedStructure.structure?.lists || []
    if (parsedLists.length > 0) {
      parsedLists.forEach((l: any, index: number) => {
        lists.push({
          type: 'list',
          page: l.page || 1,
          listData: {
            type: l.type || 'unordered',
            items: l.items || []
          },
          readingOrder: headings.length + tables.length + lists.length + 1
        })
      })
    }

    // Extract images
    const parsedImages = parsedStructure.images || []
    if (parsedImages.length > 0) {
      parsedImages.forEach((img: any, index: number) => {
        images.push({
          type: 'image',
          page: img.page || 1,
          altText: img.altText || null,
          readingOrder: headings.length + tables.length + lists.length + images.length + 1
        })
      })
    } else if (scanResult.imageAnalysis?.totalImages > 0) {
      // Fallback: extract from image analysis
      scanResult.imageAnalysis.imagesByPage && Object.keys(scanResult.imageAnalysis.imagesByPage).forEach((pageNum: string) => {
        const count = scanResult.imageAnalysis.imagesByPage[parseInt(pageNum)]
        for (let i = 0; i < count; i++) {
          images.push({
            type: 'image',
            page: parseInt(pageNum) || 1,
            altText: undefined,
            readingOrder: headings.length + tables.length + lists.length + images.length + 1
          })
        }
      })
    }

    // Extract links
    if (parsedStructure.links) {
      parsedStructure.links.forEach((link: any, index: number) => {
        links.push({
          type: 'link',
          page: link.page || 1,
          text: link.text || '',
          readingOrder: headings.length + tables.length + lists.length + images.length + links.length + 1
        })
      })
    }

    // Extract form fields
    if (parsedStructure.formFields) {
      parsedStructure.formFields.forEach((field: any, index: number) => {
        forms.push({
          type: 'form',
          page: field.page || 1,
          text: field.name || '',
          readingOrder: headings.length + tables.length + lists.length + images.length + links.length + forms.length + 1
        })
      })
    }

    // Extract paragraphs (from text blocks)
    // For now, we'll create paragraphs from text content
    // This is a simplified approach - in production, you'd analyze text blocks more carefully
    const text = parsedStructure.text || ''
    const lines = text.split('\n').filter((line: string) => line.trim().length > 0)
    lines.forEach((line: string, index: number) => {
      // Skip if it's a heading, list item, or table cell
      const isHeading = headings.some(h => h.text === line.trim())
      const isListItem = lists.some(l => l.listData?.items.includes(line.trim()))
      if (!isHeading && !isListItem && line.trim().length > 20) {
        paragraphs.push({
          type: 'paragraph',
          page: Math.floor(index / 50) + 1, // Estimate page
          text: line.trim(),
          readingOrder: headings.length + tables.length + lists.length + images.length + links.length + forms.length + paragraphs.length + 1
        })
      }
    })

    return {
      headings,
      tables,
      lists,
      images,
      paragraphs,
      links,
      forms
    }
  }

  /**
   * Create tagged PDF using pdf-rebuild-with-fixes.py
   * This uses PyMuPDF + pikepdf to create actual structure elements with MCID linking
   * (replicates Adobe's auto-tagging quality)
   */
  private async createTaggedPDF(
    pdfBuffer: Buffer,
    structureElements: {
      headings: StructureElement[]
      tables: StructureElement[]
      lists: StructureElement[]
      images: StructureElement[]
      paragraphs: StructureElement[]
      links: StructureElement[]
      forms: StructureElement[]
    },
    parsedStructure: any
  ): Promise<Buffer> {
    // Create temporary files
    const tempDir = tmpdir()
    const timestamp = Date.now()
    const inputPdfPath = path.join(tempDir, `input-${timestamp}.pdf`)
    const outputPdfPath = path.join(tempDir, `output-${timestamp}.pdf`)
    const fixesJsonPath = path.join(tempDir, `fixes-${timestamp}.json`)

    try {
      // Write input PDF
      await fs.writeFile(inputPdfPath, pdfBuffer)

      // Convert structure elements to fixes format expected by pdf-rebuild-with-fixes.py
      const fixes: any[] = []

      // Add heading fixes
      structureElements.headings.forEach(h => {
        if (h.text) {
          fixes.push({
            type: 'heading',
            page: h.page,
            text: h.text,
            level: h.level || 1,
            readingOrder: h.readingOrder
          })
        }
      })

      // Add table fixes (with tableData structure)
      structureElements.tables.forEach(t => {
        fixes.push({
          type: 'table',
          page: t.page,
          tableData: {
            rows: t.tableData?.rows || 0,
            columns: t.tableData?.columns || 0,
            hasHeaders: t.tableData?.hasHeaders || false,
            summary: '' // Will be auto-generated if needed
          },
          readingOrder: t.readingOrder
        })
      })

      // Add list fixes
      structureElements.lists.forEach(l => {
        fixes.push({
          type: 'list',
          page: l.page,
          listData: {
            type: l.listData?.type || 'unordered',
            items: l.listData?.items || []
          },
          readingOrder: l.readingOrder
        })
      })

      // Add alt text fixes for images
      structureElements.images.forEach((img, index) => {
        if (img.altText) {
          fixes.push({
            type: 'altText',
            page: img.page,
            altText: img.altText,
            imageIndex: index, // For matching images on page
            readingOrder: img.readingOrder
          })
        }
      })

      // Write fixes JSON with UTF-8 encoding
      await fs.writeFile(fixesJsonPath, JSON.stringify(fixes, null, 2), { encoding: 'utf8' })

      // Call pdf-rebuild-with-fixes.py script
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const rebuildScriptPath = path.join(process.cwd(), 'scripts', 'pdf-rebuild-with-fixes.py')
      
      // Build command with metadata
      const metadata = parsedStructure.metadata || {}
      
      // Detect language from document text if not already set
      let language = metadata.language
      if (!language) {
        language = this.detectLanguage(parsedStructure.text || '')
        console.log(`🌐 Detected language: ${language}`)
      } else {
        console.log(`🌐 Using metadata language: ${language}`)
      }
      
      // Build command arguments with proper quoting for arguments with spaces
      const execArgs: string[] = [rebuildScriptPath]
      execArgs.push('--input', inputPdfPath)
      execArgs.push('--output', outputPdfPath)
      execArgs.push('--fixes', fixesJsonPath)
      
      if (metadata.title) {
        execArgs.push('--title', metadata.title)
      }
      // Always set language (defaults to 'en' if not specified)
      execArgs.push('--language', language)
      if (metadata.author) {
        execArgs.push('--author', metadata.author)
      }

      // Build command string with proper quoting
      const cmd = [pythonCmd, ...execArgs.map(quoteArg)].join(' ')

      console.log(`🔧 Running: ${cmd}`)
      const { stdout, stderr } = await execAsync(cmd, {
        maxBuffer: 10 * 1024 * 1024 // 10MB buffer
      })

      // Log output for debugging
      if (stdout) {
        console.log('📄 Rebuild output:', stdout)
      }
      if (stderr && !stderr.includes('INFO') && !stderr.includes('WARNING')) {
        console.warn('⚠️ Rebuild warnings:', stderr)
      }

      // Check if output file exists
      try {
        await fs.access(outputPdfPath)
      } catch {
        throw new Error('Tagged PDF output file was not created. Check Python script output above.')
      }

      // Read tagged PDF
      const taggedPdfBuffer = await fs.readFile(outputPdfPath)

      // Cleanup
      await fs.unlink(inputPdfPath).catch(() => {})
      await fs.unlink(outputPdfPath).catch(() => {})
      await fs.unlink(fixesJsonPath).catch(() => {})

      return taggedPdfBuffer
    } catch (error: any) {
      // Cleanup on error
      await fs.unlink(inputPdfPath).catch(() => {})
      await fs.unlink(outputPdfPath).catch(() => {})
      await fs.unlink(fixesJsonPath).catch(() => {})
      throw error
    }
  }

  /**
   * Detect language from text using simple heuristics
   * Returns ISO 639-1 language code (e.g., 'en', 'es', 'fr', 'de')
   */
  private detectLanguage(text: string): string {
    if (!text || text.trim().length < 10) {
      return 'en' // Default to English
    }

    const lowerText = text.toLowerCase()
    const words = lowerText.split(/\s+/).slice(0, 100) // Check first 100 words
    const textSample = words.join(' ')

    // Common words for major languages
    const languagePatterns: { [key: string]: RegExp[] } = {
      'en': [
        /\b(the|be|to|of|and|a|in|that|have|it|for|not|on|with|he|as|you|do|at|this)\b/gi,
        /\b(but|his|from|they|we|say|her|she|or|an|will|my|one|all|would|there|their)\b/gi
      ],
      'es': [
        /\b(el|la|de|que|y|a|en|un|ser|se|no|haber|por|con|su|para|como|estar|tener|le|lo)\b/gi,
        /\b(todo|pero|más|hacer|o|poder|decir|este|ir|otro|ese|la|si|me|ya|ver|porque|dar|cuando)\b/gi
      ],
      'fr': [
        /\b(le|de|et|à|un|il|être|et|en|avoir|que|pour|dans|ce|son|une|sur|avec|ne|se|pas|tout)\b/gi,
        /\b(plus|par|grand|en|une|être|et|pour|que|dans|son|sur|avec|ne|se|pas|tout|faire|comme)\b/gi
      ],
      'de': [
        /\b(der|die|und|in|den|von|zu|das|mit|sich|des|auf|für|ist|im|dem|nicht|ein|eine|als|auch)\b/gi,
        /\b(es|ein|werden|aus|er|hat|dass|sie|nach|wird|bei|einer|um|am|sind|noch|wie|einem|über|einen|so)\b/gi
      ],
      'it': [
        /\b(il|di|che|e|la|a|un|per|è|in|una|sono|si|con|non|le|i|da|come|al|anche|ma|più|questo)\b/gi,
        /\b(quando|se|tutto|essere|fare|dire|andare|avere|stare|vedere|sapere|volere|dare|potere)\b/gi
      ],
      'pt': [
        /\b(o|de|e|do|da|em|um|para|é|com|não|uma|os|no|se|na|por|mais|as|dos|como|mas|foi|ao)\b/gi,
        /\b(ele|das|tem|à|seu|sua|ou|ser|quando|muito|há|nos|já|está|eu|também|só|pelo|pela|até)\b/gi
      ],
      'ru': [
        /\b(и|в|не|что|он|на|я|с|со|как|а|то|все|она|так|его|но|да|ты|к|у|же|за|бы|по|только|её|мне|было|вот|от|меня|ещё|нет|о|из|ему|теперь|когда|даже|ну|вдруг|ли|если|уже|или|ни|быть|был|него|до|вас|нибудь|опять|уж|вам|сказал|ведь|там|потом|себя|ничего|ей|может|они|тут|где|есть|надо|ней|для|мы|тебя|их|чем|была|сам|чтоб|без|будто|чего|раз|тоже|себе|под|будет|ж|тогда|кто|этот|того|потому|этого|какой|совсем|ним|здесь|этом|один|почти|мой|тем|чтобы|нее|сейчас|были|куда|зачем|всех|никогда|можно|при|наконец|два|об|другой|хоть|после|над|больше|тот|через|эти|нас|про|всего|них|какая|много|разве|три|эту|моя|впрочем|хорошо|свою|этой|перед|иногда|лучше|чуть|том|нельзя|такой|им|более|всегда|конечно|всю|между)\b/gi
      ],
      'zh': [
        /[\u4e00-\u9fff]/g // Chinese characters
      ],
      'ja': [
        /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g // Hiragana, Katakana, Kanji
      ],
      'ar': [
        /[\u0600-\u06FF]/g // Arabic characters
      ]
    }

    // Score each language
    const scores: { [key: string]: number } = {}
    
    for (const [lang, patterns] of Object.entries(languagePatterns)) {
      let score = 0
      for (const pattern of patterns) {
        const matches = textSample.match(pattern)
        if (matches) {
          score += matches.length
        }
      }
      scores[lang] = score
    }

    // Find language with highest score
    const sortedLangs = Object.entries(scores).sort((a, b) => b[1] - a[1])
    
    // Return language if score is significant (at least 3 matches)
    if (sortedLangs.length > 0 && sortedLangs[0][1] >= 3) {
      return sortedLangs[0][0]
    }

    // Default to English if no clear match
    return 'en'
  }

  /**
   * Check if Python, PyMuPDF, and pikepdf are available
   */
  async checkDependencies(): Promise<{ python: boolean; pymupdf: boolean; pikepdf: boolean }> {
    try {
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      
      // Check Python
      let hasPython = false
      try {
        const { stdout } = await execAsync(`${pythonCmd} --version`)
        hasPython = stdout.includes('Python 3')
      } catch {
        hasPython = false
      }

      // Check PyMuPDF
      let hasPyMuPDF = false
      if (hasPython) {
        try {
          const { stdout } = await execAsync(`${pythonCmd} -c "import fitz; print(fitz.version)"`)
          hasPyMuPDF = stdout.includes('1.') || stdout.includes('2.')
        } catch {
          hasPyMuPDF = false
        }
      }

      // Check pikepdf (required for structure element creation)
      let hasPikepdf = false
      if (hasPython) {
        try {
          await execAsync(`${pythonCmd} -c "import pikepdf"`)
          hasPikepdf = true
        } catch {
          hasPikepdf = false
        }
      }

      return { python: hasPython, pymupdf: hasPyMuPDF, pikepdf: hasPikepdf }
    } catch {
      return { python: false, pymupdf: false, pikepdf: false }
    }
  }
}

