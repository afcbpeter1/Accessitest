import { PDFDocument, PDFPage, PDFForm } from 'pdf-lib'

/**
 * Polyfill browser APIs needed by pdfjs-dist v5.x in Node.js environment
 */
function setupPdfjsPolyfills() {
  if (typeof globalThis.DOMMatrix === 'undefined') {
    // @ts-ignore
    globalThis.DOMMatrix = class DOMMatrix {
      constructor(init?: any) {
        if (init) {
          this.a = init.a ?? 1
          this.b = init.b ?? 0
          this.c = init.c ?? 0
          this.d = init.d ?? 1
          this.e = init.e ?? 0
          this.f = init.f ?? 0
        } else {
          this.a = 1
          this.b = 0
          this.c = 0
          this.d = 1
          this.e = 0
          this.f = 0
        }
      }
      a: number = 1
      b: number = 0
      c: number = 0
      d: number = 1
      e: number = 0
      f: number = 0
    }
  }
  
  if (typeof globalThis.DOMPoint === 'undefined') {
    // @ts-ignore
    globalThis.DOMPoint = class DOMPoint {
      constructor(x = 0, y = 0, z = 0, w = 1) {
        this.x = x
        this.y = y
        this.z = z
        this.w = w
      }
      x: number
      y: number
      z: number
      w: number
    }
  }
}

export interface ParsedPDFStructure {
  text: string
  pages: number
  metadata: {
    title: string | null
    author: string | null
    subject: string | null
    creator: string | null
    producer: string | null
    language: string | null
    creationDate: Date | null
    modificationDate: Date | null
  }
  structure: {
    headings: Array<{
      level: number
      text: string
      page: number
    }>
    lists: Array<{
      type: 'ordered' | 'unordered'
      items: string[]
      page: number
    }>
    tables: Array<{
      rows: number
      columns: number
      hasHeaders: boolean
      page: number
    }>
  }
  images: Array<{
    id: string
    page: number
    altText: string | null
    width: number
    height: number
    type: string
    isAnimated: boolean
  }>
  links: Array<{
    text: string
    url: string
    page: number
  }>
  formFields: Array<{
    name: string
    type: string
    label: string | null
    required: boolean
    page: number
  }>
  textColors: Array<{
    color: string
    hex: string
    page: number
  }>
  structureTree?: Array<{
    type: string
    text?: string
    language?: string
    attributes?: {
      Lang?: string
      lang?: string
      Language?: string
      Alt?: string
      alt?: string
      ActualText?: string
      Headers?: string
      Scope?: string
      RowSpan?: string
      ColSpan?: string
      MCID?: number
      StructParent?: number
      [key: string]: any
    }
    mcid?: number
    structParent?: number
    children?: any[]
    page?: number
  }>
}

/**
 * Real PDF parser that extracts actual document structure, metadata, and elements
 * Combines pdf-parse for text extraction and pdf-lib for metadata/structure
 */
export class PDFParser {
  async parsePDF(buffer: Buffer): Promise<ParsedPDFStructure> {
    try {
      // Use pdf-parse for text extraction (more reliable than pdf-lib for text)
      const pdfParse = require('pdf-parse')
      const pdfParseResult = await pdfParse(buffer, { max: 0 })
      
      // Use pdf-lib for metadata and structure
      const pdfDoc = await PDFDocument.load(buffer)
      const pages = pdfDoc.getPages()
      const form = pdfDoc.getForm()
      
      // Extract metadata from pdf-lib (more reliable for metadata)
      // Language extraction uses Python script (pdf-lib doesn't expose /Lang key)
      const language = await this.extractLanguage(pdfDoc, buffer)
      
      const metadata = {
        title: pdfDoc.getTitle() || null,
        author: pdfDoc.getAuthor() || null,
        subject: pdfDoc.getSubject() || null,
        creator: pdfDoc.getCreator() || null,
        producer: pdfDoc.getProducer() || null,
        language: language || null,
        creationDate: pdfDoc.getCreationDate() || null,
        modificationDate: pdfDoc.getModificationDate() || null,
      }

      // Extract structure from text using pdf-parse result (with font info from PyMuPDF)
      const structure = await this.extractDocumentStructure(pdfParseResult.text, pdfParseResult.numpages || pages.length, buffer)

      // Extract images - skip pdfjs-dist (causes ES module errors), use fallback
      // Images will be detected from text analysis instead
      const images: Array<{ id: string; page: number; altText: string | null; width: number; height: number; type: string; isAnimated: boolean }> = []

      // Extract links from text
      const links = this.extractLinks(pdfParseResult.text, pdfParseResult.numpages || pages.length)

      // Extract form fields
      const formFields = this.extractFormFields(form, pages.length)

      // Extract structure tree using pdfjs-dist (for language attributes, tags, etc.)
      const structureTree = await this.extractStructureTree(buffer)

      return {
        text: pdfParseResult.text,
        pages: pdfParseResult.numpages || pages.length,
        metadata,
        structure,
        images,
        links,
        formFields,
        textColors: [], // Will be populated when we add contrast analysis
        structureTree, // PDF tag structure tree with language attributes
      }
    } catch (error) {
      console.error('❌ PDF parsing error:', error)
      throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Extract images from PDF using pdfjs-dist
   * This extracts actual image objects from the PDF content stream
   */
  private async extractImages(
    doc: PDFDocument,
    pages: PDFPage[],
    totalPages: number,
    buffer?: Buffer
  ): Promise<Array<{ id: string; page: number; altText: string | null; width: number; height: number; type: string; isAnimated: boolean }>> {
    const images: Array<{ id: string; page: number; altText: string | null; width: number; height: number; type: string; isAnimated: boolean }> = []
    
    try {
      // Setup polyfills for browser APIs needed by pdfjs-dist v5.x
      setupPdfjsPolyfills()
      
      // Use pdfjs-dist to extract images from PDF content streams
      // For pdfjs-dist v5.x, use dynamic import (ES module)
      // Import the default export which contains all the functions
      const pdfjsModule = await import('pdfjs-dist')
      const pdfjsLib = pdfjsModule.default || pdfjsModule
      
      if (!buffer) {
        console.warn('⚠️ Buffer not provided for image extraction')
        return images
      }
      
      // Load PDF document with pdfjs-dist
      const loadingTask = pdfjsLib.getDocument({ data: buffer })
      const pdfDocument = await loadingTask.promise
      
      // Extract images from each page
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        try {
          const page = await pdfDocument.getPage(pageNum)
          const operatorList = await page.getOperatorList()
          
          // Extract image operators from the content stream
          let imageIndex = 0
          for (let i = 0; i < operatorList.fnArray.length; i++) {
            const op = operatorList.fnArray[i]
            const args = operatorList.argsArray[i]
            
            // Check for image drawing operators (Do, BI, etc.)
            if (op === pdfjsLib.OPS.paintImageXObject || op === pdfjsLib.OPS.paintInlineImageXObject) {
              try {
                // Get image object from the operator
                const imageObj = await page.objs.get(args[0])
                
                if (imageObj && imageObj.width && imageObj.height) {
                  // Extract alt text from PDF structure tags
                  let altText: string | null = null
                  
                  // Check for alt text in the image object's dictionary
                  if (imageObj.dict) {
                    // Try /Alt tag (alternative text)
                    const altEntry = imageObj.dict.get('Alt')
                    if (altEntry) {
                      altText = altEntry.toString() || null
                    }
                    
                    // Try /ActualText tag
                    if (!altText) {
                      const actualTextEntry = imageObj.dict.get('ActualText')
                      if (actualTextEntry) {
                        altText = actualTextEntry.toString() || null
                      }
                    }
                    
                    // Try /E tag (E for "Expansion" or alternate text)
                    if (!altText) {
                      const eEntry = imageObj.dict.get('E')
                      if (eEntry) {
                        altText = eEntry.toString() || null
                      }
                    }
                  }
                  
                  // Also check page's structure tree for image annotations
                  try {
                    const structParent = imageObj.dict?.get('StructParent')
                    if (structParent !== undefined && page.getStructTree) {
                      const structTree = await page.getStructTree()
                      if (structTree) {
                        // Search structure tree for this image's alt text
                        altText = this.extractAltTextFromStructTree(structTree, structParent) || altText
                      }
                    }
                  } catch (structError) {
                    // Structure tree extraction failed, continue with dict-based alt text
                  }
                  
                  // Determine image type from data FIRST (needed for animation detection)
                  let imageType = 'image'
                  let isAnimated = false
                  
                  if (imageObj.data) {
                    try {
                      // Check first bytes for image type
                      const headerBytes = imageObj.data.subarray(0, Math.min(20, imageObj.data.length))
                      const headerStr = headerBytes.toString('binary')
                      const headerHex = headerBytes.toString('hex')
                      
                      // Check for GIF headers (GIF89a or GIF87a)
                      if (headerStr.startsWith('GIF89a') || headerStr.startsWith('GIF87a') ||
                          headerHex.toLowerCase().startsWith('474946383961') || // GIF89a in hex
                          headerHex.toLowerCase().startsWith('474946383761')) { // GIF87a in hex
                            imageType = 'gif'
                            isAnimated = true // GIFs are assumed animated unless proven otherwise
                        } else if (headerHex.startsWith('ffd8')) {
                        imageType = 'jpeg'
                      } else if (headerHex.startsWith('89504e47')) {
                        imageType = 'png'
                      } else {
                        // Additional check: look for GIF markers anywhere in the data
                        if (imageObj.data.length > 100) {
                          const dataStr = imageObj.data.toString('binary')
                          if (dataStr.includes('GIF89a') || dataStr.includes('GIF87a')) {
                            imageType = 'gif'
                            isAnimated = true
                            }
                          }
                      }
                      
                      // For GIFs, check for animation markers (NETSCAPE extension)
                      if (imageType === 'gif' && imageObj.data.length > 100) {
                        const dataStr = imageObj.data.toString('binary')
                        // NETSCAPE extension indicates animation
                        if (dataStr.includes('NETSCAPE') || dataStr.includes('GIF89a')) {
                          isAnimated = true
                        } else {
                          // Single-frame GIFs might not have NETSCAPE, but still could be animated
                          // Default to animated for GIFs unless we can prove it's static
                          isAnimated = true // Conservative approach - flag all GIFs as potentially animated
                        }
                      }
                    } catch (error) {
                      console.warn('Error determining image type/animation for image on page ' + pageNum + ':', error)
                      // If we can't determine, assume not animated
                      isAnimated = false
                    }
                  }
                  
                  // Extract actual dimensions (no defaults)
                  const width = imageObj.width || 0
                  const height = imageObj.height || 0
                  
                  images.push({
                    id: `pdf_image_${pageNum}_${imageIndex}`,
                    page: pageNum,
                    altText: altText?.trim() || null, // Extracted from PDF structure
                    width: width, // Actual width, 0 if unknown
                    height: height, // Actual height, 0 if unknown
                    type: imageType,
                    isAnimated,
                  })
                  
                  imageIndex++
                }
              } catch (imgError) {
                // Skip this image if extraction fails
                console.warn(`⚠️ Failed to extract image ${imageIndex} from page ${pageNum}:`, imgError)
              }
            }
          }
        } catch (pageError) {
          console.warn(`⚠️ Failed to extract images from page ${pageNum}:`, pageError)
        }
      }

    } catch (error) {
      console.warn('⚠️ Failed to extract images using pdfjs-dist, using fallback:', error)
      
      // Fallback: Try to detect images from XObject references in pdf-lib
      try {
        // This is a basic fallback - pdf-lib doesn't easily expose images
        // But we can at least return empty array rather than failing
      } catch (fallbackError) {
        console.warn('⚠️ Fallback image extraction also failed:', fallbackError)
      }
    }
    
    return images
  }

  /**
   * Extract PDF structure tree with language attributes using PyMuPDF
   * This is much more reliable than pdfjs-dist for server-side use
   */
  private async extractStructureTree(buffer: Buffer): Promise<Array<{
    type: string
    text?: string
    language?: string
    attributes?: {
      Lang?: string
      lang?: string
      Language?: string
      [key: string]: any
    }
    children?: any[]
    page?: number
  }>> {
    try {
      // Use PyMuPDF via Python script - much more reliable than pdfjs-dist
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      const fs = require('fs/promises')
      const path = require('path')
      const { tmpdir } = require('os')
      
      // Write PDF to temp file
      const tempDir = tmpdir()
      const tempPdfPath = path.join(tempDir, `pdf-structure-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.pdf`)
      await fs.writeFile(tempPdfPath, buffer)
      
      try {
        // Call Python script to extract structure tree
        const scriptPath = path.join(process.cwd(), 'scripts', 'extract-pdf-structure.py')
        const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
        const cmd = `${pythonCmd} "${scriptPath}" "${tempPdfPath}"`

        const { stdout, stderr } = await execAsync(cmd, {
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        })
        
        if (stderr && !stderr.includes('INFO') && !stderr.includes('WARNING')) {
          console.warn(`⚠️ PyMuPDF stderr: ${stderr}`)
        }
        
        // Parse JSON result
        const result = JSON.parse(stdout)
        
        if (!result.success) {
          console.warn(`⚠️ PyMuPDF extraction failed: ${result.error || result.message}`)
          return []
        }
        
        const structureTree = result.structureTree || []

        // Debug: Log structure tree extraction results
        const countElements = (nodes: any[]): { total: number; content: number; withMCID: number } => {
          let total = 0
          let content = 0
          let withMCID = 0
          const traverse = (ns: any[]) => {
            if (!ns || !Array.isArray(ns)) return
            for (const node of ns) {
              total++
              const nodeType = (node.type || '').toUpperCase()
              const isContent = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'LI', 'TD', 'TH', 'FIGURE', 'SPAN'].includes(nodeType)
              if (isContent) {
                content++
                if (node.mcid !== undefined || node.attributes?.MCID !== undefined || node.attributes?.mcid !== undefined) {
                  withMCID++
                }
              }
              if (node.children && Array.isArray(node.children)) {
                traverse(node.children)
              }
            }
          }
          traverse(nodes)
          return { total, content, withMCID }
        }
        const counts = countElements(structureTree)
        console.log(`📊 Structure tree extraction: ${counts.total} total elements, ${counts.content} content elements, ${counts.withMCID} with MCID`)

        // Log language attributes found
        const findLanguages = (nodes: any[]): void => {
          for (const node of nodes) {
            if (node.language) {

            }
            if (node.children && Array.isArray(node.children)) {
              findLanguages(node.children)
            }
          }
        }
        findLanguages(structureTree)
        
        return structureTree
      } finally {
        // Cleanup temp file
        await fs.unlink(tempPdfPath).catch(() => {})
      }
    } catch (error) {
      console.warn('⚠️ Failed to extract structure tree using PyMuPDF:', error)
      // Fallback: return empty array (scanner will use text-only detection)
      return []
    }
  }

  /**
   * Extract links from document text
   */
  private extractLinks(text: string, totalPages: number): Array<{ text: string; url: string; page: number }> {
    const links: Array<{ text: string; url: string; page: number }> = []
    
    try {
      const lines = text.split('\n')
      const linesPerPage = Math.ceil(lines.length / totalPages)
      
      // Extract URLs from text
      const urlRegex = /(https?:\/\/[^\s\)]+)/gi
      
      lines.forEach((line, index) => {
        const matches = line.match(urlRegex)
        if (matches) {
          const pageNumber = Math.floor(index / linesPerPage) + 1
          matches.forEach(url => {
            links.push({
              text: url,
              url: url,
              page: pageNumber,
            })
          })
        }
      })
      
    } catch (error) {
      console.warn('⚠️ Failed to extract links:', error)
    }
    
    return links
  }

  /**
   * Extract document structure from full text
   * Uses PyMuPDF to get font information for better heading detection
   */
  private async extractDocumentStructure(text: string, totalPages: number, buffer: Buffer): Promise<{
    headings: Array<{ level: number; text: string; page: number }>
    lists: Array<{ type: 'ordered' | 'unordered'; items: string[]; page: number }>
    tables: Array<{ rows: number; columns: number; hasHeaders: boolean; page: number }>
  }> {
    const headings: Array<{ level: number; text: string; page: number }> = []
    const lists: Array<{ type: 'ordered' | 'unordered'; items: string[]; page: number }> = []
    const tables: Array<{ rows: number; columns: number; hasHeaders: boolean; page: number }> = []

    // Try to extract text blocks with font information using PyMuPDF
    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      const fs = require('fs/promises')
      const path = require('path')
      const { tmpdir } = require('os')
      
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const extractScriptPath = path.join(process.cwd(), 'scripts', 'extract-pdf-text-blocks.py')
      
      // Write PDF to temp file
      const tempDir = tmpdir()
      const tempPdfPath = path.join(tempDir, `text-blocks-${Date.now()}.pdf`)
      await fs.writeFile(tempPdfPath, buffer)
      
      try {
        const { stdout } = await execAsync(`${pythonCmd} "${extractScriptPath}" "${tempPdfPath}"`, {
          maxBuffer: 10 * 1024 * 1024
        })
        
        const result = JSON.parse(stdout.trim())
        if (result.success && result.textBlocks) {
          // Analyze font sizes to determine heading levels
          const fontSizes = result.textBlocks.map((b: any) => b.fontSize).filter((s: number) => s > 0)
          const avgFontSize = fontSizes.length > 0 ? fontSizes.reduce((a: number, b: number) => a + b, 0) / fontSizes.length : 12
          const maxFontSize = Math.max(...fontSizes, 12)
          
          // Group text blocks by page and Y position (top to bottom)
          const blocksByPage: { [page: number]: any[] } = {}
          result.textBlocks.forEach((block: any) => {
            if (!blocksByPage[block.page]) {
              blocksByPage[block.page] = []
            }
            blocksByPage[block.page].push(block)
          })
          
          // Sort blocks by Y position (top to bottom) within each page
          Object.keys(blocksByPage).forEach(pageNum => {
            blocksByPage[parseInt(pageNum)].sort((a: any, b: any) => a.y - b.y)
          })
          
          // Detect headings based on font size, bold, and position
          Object.keys(blocksByPage).forEach(pageNum => {
            const pageBlocks = blocksByPage[parseInt(pageNum)]
            let previousHeadingLevel = 0
            
            pageBlocks.forEach((block: any) => {
              const blockText = block.text.trim()
              if (!blockText || blockText.length < 2 || blockText.length > 200) {
                return
              }
              
              // Skip if it looks like regular paragraph text
              if (blockText.length > 100 && block.fontSize <= avgFontSize) {
                return
              }
              
              // Determine heading level based on font size
              let level = 1
              if (block.fontSize >= maxFontSize * 0.9) {
                level = 1 // Largest text = H1
              } else if (block.fontSize >= maxFontSize * 0.75) {
                level = 2
              } else if (block.fontSize >= maxFontSize * 0.6) {
                level = 3
              } else if (block.fontSize >= avgFontSize * 1.2) {
                level = 4
              } else if (block.fontSize >= avgFontSize * 1.1) {
                level = 5
              } else if (block.fontSize > avgFontSize) {
                level = 6
              } else {
                // Not a heading if font size is average or smaller
                return
              }
              
              // Additional checks: bold text or short lines are more likely headings
              const isLikelyHeading = block.isBold || blockText.length < 80
              
              if (isLikelyHeading) {
                // Ensure heading hierarchy (don't skip levels)
                if (previousHeadingLevel > 0 && level > previousHeadingLevel + 1) {
                  level = previousHeadingLevel + 1
                }
                previousHeadingLevel = level
                
                headings.push({
                  level: Math.min(level, 6), // Cap at H6
                  text: blockText,
                  page: parseInt(pageNum)
                })
              }
            })
          })
        }
      } catch (error) {
        // Fall back to text-based detection if Python script fails
        console.warn('⚠️ PyMuPDF text block extraction failed, using text-based detection:', error)
      } finally {
        await fs.unlink(tempPdfPath).catch(() => {})
      }
    } catch (error) {
      // Fall back to text-based detection
      console.warn('⚠️ Text block extraction failed, using text-based detection:', error)
    }

    // Fallback: text-based detection if PyMuPDF extraction failed or found no headings
    // Define lines at function level for list/table detection
    const lines = text.split('\n').filter(line => line.trim().length > 0)
    const linesPerPage = Math.ceil(lines.length / totalPages)

    if (headings.length === 0) {
      lines.forEach((line, index) => {
        const trimmed = line.trim()
        const pageNumber = Math.floor(index / linesPerPage) + 1
        
        // Check for heading patterns
        if (trimmed.length < 100 && trimmed.length > 3) {
          // All caps likely heading
          if (trimmed === trimmed.toUpperCase() && trimmed.match(/^[A-Z\s]+$/)) {
            headings.push({
              level: 1,
              text: trimmed,
              page: pageNumber,
            })
          }
          // Numbered headings (1. Title, 2. Title, etc.)
          else if (trimmed.match(/^\d+\.\s+[A-Z]/)) {
            headings.push({
              level: 2,
              text: trimmed,
              page: pageNumber,
            })
          }
        }
      })
    }

    // Detect lists
    const listItems: string[] = []
    let currentListType: 'ordered' | 'unordered' | null = null
    let currentListPage = 1

    lines.forEach((line, index) => {
      const trimmed = line.trim()
      const pageNumber = Math.floor(index / linesPerPage) + 1
      
      // Ordered list (1., 2., etc.)
      if (trimmed.match(/^\d+[\.\)]\s+/)) {
        if (currentListType !== 'ordered') {
          if (currentListType === 'unordered' && listItems.length > 0) {
            lists.push({
              type: 'unordered',
              items: [...listItems],
              page: currentListPage,
            })
            listItems.length = 0
          }
          currentListType = 'ordered'
          currentListPage = pageNumber
        }
        listItems.push(trimmed.replace(/^\d+[\.\)]\s+/, ''))
      }
      // Unordered list (•, -, *, etc.)
      else if (trimmed.match(/^[•\-\*]\s+/)) {
        if (currentListType !== 'unordered') {
          if (currentListType === 'ordered' && listItems.length > 0) {
            lists.push({
              type: 'ordered',
              items: [...listItems],
              page: currentListPage,
            })
            listItems.length = 0
          }
          currentListType = 'unordered'
          currentListPage = pageNumber
        }
        listItems.push(trimmed.replace(/^[•\-\*]\s+/, ''))
      }
      // End of list
      else if (trimmed.length > 0 && currentListType) {
        lists.push({
          type: currentListType,
          items: [...listItems],
          page: currentListPage,
        })
        listItems.length = 0
        currentListType = null
      }
    })

    // Save any remaining list
    if (listItems.length > 0 && currentListType) {
      lists.push({
        type: currentListType,
        items: [...listItems],
        page: currentListPage,
      })
    }

    // Detect tables (lines with multiple separators)
    lines.forEach((line, index) => {
      const pageNumber = Math.floor(index / linesPerPage) + 1
      
      // Look for table patterns (pipe separators, multiple spaces, tabs)
      const separatorCount = (line.match(/\|/g) || []).length
      const tabCount = (line.match(/\t/g) || []).length
      const multiSpaceMatch = line.match(/\s{3,}/g)

      if (separatorCount >= 2 || tabCount >= 2 || (multiSpaceMatch && multiSpaceMatch.length >= 2)) {
        const columns = Math.max(separatorCount + 1, tabCount + 1, (multiSpaceMatch?.length || 0) + 1)
        
        // Check if this table already exists
        const existingTable = tables.find(t => t.page === pageNumber && t.columns === columns)
        
        if (!existingTable) {
          tables.push({
            rows: 1, // Will be updated as we see more rows
            columns: columns,
            hasHeaders: false, // Default
            page: pageNumber,
          })
        } else {
          existingTable.rows++
        }
      }
    })

    return { headings, lists, tables }
  }

  /**
   * Extract form fields from PDF form
   */
  private extractFormFields(form: PDFForm, totalPages: number): Array<{
    name: string
    type: string
    label: string | null
    required: boolean
    page: number
  }> {
    const fields: Array<{ name: string; type: string; label: string | null; required: boolean; page: number }> = []

    try {
      const fieldNames = form.getFields().map(field => field.getName())
      
      fieldNames.forEach(name => {
        try {
          const field = form.getTextField(name) || 
                       form.getCheckBox(name) || 
                       form.getRadioGroup(name) ||
                       form.getDropdown(name) ||
                       form.getButton(name)

          if (field) {
            const fieldType = this.getFieldType(field)
            const label = this.getFieldLabel(field, name)
            const required = this.isFieldRequired(field)

            fields.push({
              name,
              type: fieldType,
              label,
              required,
              page: 1, // pdf-lib doesn't directly provide page number for fields
            })
          }
        } catch (error) {
          console.warn(`⚠️ Failed to extract field ${name}:`, error)
        }
      })
    } catch (error) {
      console.warn('⚠️ Failed to extract form fields:', error)
    }

    return fields
  }

  /**
   * Get field type as string
   */
  private getFieldType(field: any): string {
    if (field.constructor.name.includes('PDFTextField')) return 'text'
    if (field.constructor.name.includes('PDFCheckBox')) return 'checkbox'
    if (field.constructor.name.includes('PDFRadioGroup')) return 'radio'
    if (field.constructor.name.includes('PDFDropdown')) return 'dropdown'
    if (field.constructor.name.includes('PDFButton')) return 'button'
    return 'unknown'
  }

  /**
   * Get field label (alt text or name)
   */
  private getFieldLabel(field: any, name: string): string | null {
    try {
      // Try to get alternate text or tooltip
      // pdf-lib doesn't directly expose this, so we use name as fallback
      return name
    } catch {
      return null
    }
  }

  /**
   * Check if field is required
   */
  private isFieldRequired(field: any): boolean {
    try {
      // pdf-lib doesn't directly expose required flag
      // This would require deeper PDF structure analysis
      return false
    } catch {
      return false
    }
  }

  /**
   * Extract language from PDF metadata
   * Uses Python script to properly read /Lang from PDF catalog (pdf-lib doesn't expose this)
   */
  private async extractLanguage(doc: PDFDocument, buffer: Buffer): Promise<string | null> {
    try {
      // Try Python script first (more reliable for /Lang key)
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      const fs = require('fs/promises')
      const path = require('path')
      const { tmpdir } = require('os')
      
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const extractScriptPath = path.join(process.cwd(), 'scripts', 'extract-pdf-language.py')
      
      // Write PDF to temp file
      const tempDir = tmpdir()
      const tempPdfPath = path.join(tempDir, `lang-extract-${Date.now()}.pdf`)
      await fs.writeFile(tempPdfPath, buffer)
      
      try {
        const { stdout } = await execAsync(`${pythonCmd} "${extractScriptPath}" "${tempPdfPath}"`, {
          maxBuffer: 1024 * 1024
        })
        
        const result = JSON.parse(stdout.trim())
        if (result.success && result.language) {
          return result.language
        }
      } catch (error) {
        // Python script failed, fall back to pdf-lib attempt
        console.warn('⚠️ Python language extraction failed, trying pdf-lib fallback:', error)
      } finally {
        // Cleanup temp file
        await fs.unlink(tempPdfPath).catch(() => {})
      }
      
      // Fallback: Try pdf-lib (may not work for /Lang key)
      const context = (doc as any).context
      if (!context || !context.trailerInfo || !context.trailerInfo.Root) {
        return null
      }
      
      const rootRef = context.trailerInfo.Root
      const catalog = context.lookup(rootRef)
      
      if (catalog) {
        // Try to get Lang key - it might be a PDFName or PDFString
        const langRef = catalog.get('Lang')
        if (langRef) {
          // If it's a reference, look it up
          let langValue: string = ''
          if (typeof langRef === 'object' && 'encodedName' in langRef) {
            // PDFName - get the encoded name
            langValue = langRef.encodedName || ''
          } else if (typeof langRef === 'string') {
            langValue = langRef
          } else {
            // Try to get string representation
            langValue = langRef.toString() || ''
          }
          
          // Remove leading slash if present (PDF names start with /)
          const lang = langValue.replace(/^\//, '').trim()
          if (lang && /^[a-z]{2}(-[A-Z]{2})?$/i.test(lang)) {
            // Extract just the 2-letter code (remove region code)
            const langCode = lang.toLowerCase().split('-')[0].split('_')[0]
            if (langCode && langCode.length === 2) {
              return langCode
            }
          }
        }
      }
      return null
    } catch (error) {
      // Silently fail - language extraction is optional
      return null
    }
  }
  
  /**
   * Extract alt text from PDF structure tree
   */
  private extractAltTextFromStructTree(structTree: any, structParent: number): string | null {
    try {
      if (!structTree || !structTree.children) {
        return null
      }
      
      // Recursively search structure tree for alt text
      const searchNode = (node: any): string | null => {
        if (!node) return null
        
        // Check if this node has the structParent reference
        if (node.id === structParent || node.structParent === structParent) {
          // Look for alt text in this node
          if (node.alt) return node.alt
          if (node.actualText) return node.actualText
          if (node.text) return node.text
        }
        
        // Search children
        if (node.children) {
          for (const child of node.children) {
            const result = searchNode(child)
            if (result) return result
          }
        }
        
        return null
      }
      
      return searchNode(structTree)
    } catch {
      return null
    }
  }
}

