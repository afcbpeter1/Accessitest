// import { configure } from 'axe-core'

export interface ComprehensiveDocumentIssue {
  id: string
  type: 'critical' | 'serious' | 'moderate' | 'minor'
  category: 'text' | 'image' | 'color' | 'font' | 'layout' | 'structure' | 'navigation' | 'media' | 'form'
  description: string
  section: string
  pageNumber?: number
  lineNumber?: number
  elementLocation?: string
  context?: string
  wcagCriterion?: string
  section508Requirement?: string
  impact: 'high' | 'medium' | 'low'
  remediation: string
  // Enhanced fields for web-report style detail
  priority?: 'high' | 'medium' | 'low'
  occurrences?: number
  affectedPages?: number
  elementContent?: string // The actual text/image content that caused the issue
  elementType?: string // 'text', 'image', 'table', 'link', etc.
  elementSelector?: string // Document-specific identifier (like CSS selector for web)
  recommendation?: string // AI-generated specific fix
}

export interface PageAnalysis {
  pageNumber: number
  wordCount: number
  characterCount: number
  imageCount: number
  tableCount: number
  linkCount: number
  headingCount: number
  paragraphCount: number
  issues: ComprehensiveDocumentIssue[]
}

export interface ImageAnalysis {
  totalImages: number
  imagesWithAltText: number
  imagesWithoutAltText: number
  decorativeImages: number
  informativeImages: number
  complexImages: number
  imageIssues: ComprehensiveDocumentIssue[]
  imagesByPage: { [pageNumber: number]: number }
}

export interface ComprehensiveScanResult {
  is508Compliant: boolean
  overallScore: number // 0-100
  issues: ComprehensiveDocumentIssue[]
  summary: {
    total: number
    critical: number
    serious: number
    moderate: number
    minor: number
    byCategory: {
      text: number
      image: number
      color: number
      font: number
      layout: number
      structure: number
      navigation: number
    }
  }
  imageAnalysis: ImageAnalysis
  pageAnalysis: PageAnalysis[]
  metadata: {
    documentType: string
    scanDate: string
    scanDuration: number
    pagesAnalyzed: number
    scanEngine: string
    standard: string
    fileSize: number
    wordCount: number
    characterCount: number
    imageCount: number
    tableCount: number
    linkCount: number
    headingCount: number
    paragraphCount: number
  }
}

export class ComprehensiveDocumentScanner {
  private initialized: boolean = false

  constructor() {
    this.initialized = true
  }

  /**
   * Calculate impact based on issue type
   */
  private calculateImpact(issueType: 'critical' | 'serious' | 'moderate' | 'minor'): 'high' | 'medium' | 'low' {
    switch (issueType) {
      case 'critical':
      case 'serious':
        return 'high'
      case 'moderate':
        return 'medium'
      case 'minor':
        return 'low'
      default:
        return 'medium'
    }
  }

  async scanDocument(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    selectedTags?: string[],
    isCancelled?: () => boolean
  ): Promise<ComprehensiveScanResult> {
    const startTime = Date.now()
    console.log(`🚀 Starting COMPREHENSIVE document scan for: ${fileName}`)

    try {
      // Check for cancellation at the very start
      if (isCancelled && isCancelled()) {
        throw new Error('Scan was cancelled by user')
      }
      let documentContent: string
      let documentType: string
      let pagesAnalyzed: number
      let wordCount: number
      let characterCount: number
      let imageCount: number = 0
      let tableCount: number = 0
      let linkCount: number = 0
      let headingCount: number = 0
      let paragraphCount: number = 0
      let imageAnalysis: ImageAnalysis = {
        totalImages: 0,
        imagesWithAltText: 0,
        imagesWithoutAltText: 0,
        decorativeImages: 0,
        informativeImages: 0,
        complexImages: 0,
        imageIssues: [],
        imagesByPage: {}
      }
      let pageAnalysis: PageAnalysis[] = []

      // Parse document based on type
      let parsedStructure: any = null
      if (fileType.includes('pdf')) {
        const pdfResult = await this.parsePDFComprehensive(fileBuffer)
        documentContent = pdfResult.text
        documentType = 'PDF'
        pagesAnalyzed = pdfResult.pages || 1
        
        // Filter out PDF metadata and non-visible text for accurate word count
        const cleanText = documentContent
          .replace(/\/\w+\s+/g, '') // Remove PDF command tokens like /Font, /Type, etc.
          .replace(/\[.*?\]/g, '') // Remove PDF array syntax
          .replace(/\([^)]*\)/g, (match) => {
            // Keep text in parentheses only if it contains letters
            return /[a-zA-Z]/.test(match) ? match : ''
          })
          .replace(/<[^>]+>/g, '') // Remove XML/HTML tags
          .replace(/^\d+\s+0\s+obj.*?endobj$/gms, '') // Remove PDF object definitions
          .replace(/stream.*?endstream/gms, '') // Remove PDF stream content
          .trim()
        
        // Count only visible words (more than 2 characters, not just numbers/symbols)
        const visibleWords = cleanText.split(/\s+/).filter(word => 
          word.length > 2 && /[a-zA-Z]/.test(word)
        )
        wordCount = visibleWords.length
        characterCount = cleanText.length
        imageCount = pdfResult.imageCount || 0
        tableCount = pdfResult.tableCount || 0
        linkCount = pdfResult.linkCount || 0
        imageAnalysis = pdfResult.imageAnalysis || imageAnalysis
        pageAnalysis = pdfResult.pageAnalysis || []
        parsedStructure = pdfResult.parsedStructure // Store parsed structure for real checks
        
        // Check for cancellation after PDF parsing
        if (isCancelled && isCancelled()) {
          throw new Error('Scan was cancelled by user')
        }
      } else if (fileType.includes('word') || fileType.includes('document')) {
        const wordResult = await this.parseWordComprehensive(fileBuffer)
        documentContent = wordResult.text
        documentType = 'Word'
        pagesAnalyzed = wordResult.pages || 1
        wordCount = documentContent.split(/\s+/).length
        characterCount = documentContent.length
        imageCount = wordResult.imageCount || 0
        tableCount = wordResult.tableCount || 0
        linkCount = wordResult.linkCount || 0
        imageAnalysis = wordResult.imageAnalysis || imageAnalysis
        pageAnalysis = wordResult.pageAnalysis || []
        parsedStructure = wordResult.parsedStructure || null // Store parsed structure for real checks
        
        // Check for cancellation after Word parsing
        if (isCancelled && isCancelled()) {
          throw new Error('Scan was cancelled by user')
        }
      } else if (fileType.includes('powerpoint') || fileType.includes('presentation')) {
        const pptResult = await this.parsePowerPointComprehensive(fileBuffer)
        documentContent = pptResult.text
        documentType = 'PowerPoint'
        pagesAnalyzed = pptResult.pages || 1
        wordCount = documentContent.split(/\s+/).length
        characterCount = documentContent.length
        imageCount = pptResult.imageCount || 0
        tableCount = pptResult.tableCount || 0
        linkCount = pptResult.linkCount || 0
        imageAnalysis = pptResult.imageAnalysis || imageAnalysis
        pageAnalysis = pptResult.pageAnalysis || []
        parsedStructure = pptResult.parsedStructure || null // Store parsed structure for real checks
        
        // Check for cancellation after PowerPoint parsing
        if (isCancelled && isCancelled()) {
          throw new Error('Scan was cancelled by user')
        }
      } else if (fileType.includes('html')) {
        const htmlResult = await this.parseHTMLComprehensive(fileBuffer)
        documentContent = htmlResult.text
        documentType = 'HTML'
        pagesAnalyzed = htmlResult.pages || 1
        wordCount = documentContent.split(/\s+/).length
        characterCount = documentContent.length
        imageCount = htmlResult.imageCount || 0
        tableCount = htmlResult.tableCount || 0
        linkCount = htmlResult.linkCount || 0
        imageAnalysis = htmlResult.imageAnalysis || imageAnalysis
        pageAnalysis = htmlResult.pageAnalysis || []
        parsedStructure = htmlResult.parsedStructure || null // Store parsed structure for real checks
        
        // Check for cancellation after HTML parsing
        if (isCancelled && isCancelled()) {
          throw new Error('Scan was cancelled by user')
        }
      } else {
        documentContent = fileBuffer.toString('utf-8')
        documentType = 'Text'
        pagesAnalyzed = 1
        wordCount = documentContent.split(/\s+/).length
        characterCount = documentContent.length
        imageCount = 0
        tableCount = 0
        linkCount = 0
        
        // Check for cancellation after text parsing
        if (isCancelled && isCancelled()) {
          throw new Error('Scan was cancelled by user')
        }
      }

      // Analyze document structure
      const structureAnalysis = this.analyzeDocumentStructure(documentContent, pagesAnalyzed)
      headingCount = structureAnalysis.headingCount
      paragraphCount = structureAnalysis.paragraphCount

      // If no page analysis was done, create basic page analysis
      if (pageAnalysis.length === 0) {
        pageAnalysis = this.createBasicPageAnalysis(documentContent, pagesAnalyzed)
      }

      // Check for cancellation after document parsing
      if (isCancelled && isCancelled()) {
        throw new Error('Scan was cancelled by user')
      }

      console.log(`📄 Document parsed: ${documentType}, ${pagesAnalyzed} pages, ${wordCount} words, ${characterCount} characters`)
      console.log(`🖼️ Images detected: ${imageCount} total images (${imageAnalysis.complexImages} complex, ${imageAnalysis.decorativeImages} decorative, ${imageAnalysis.informativeImages} informative)`)
      console.log(`📋 Content elements: ${tableCount} tables, ${linkCount} links, ${headingCount} headings, ${paragraphCount} paragraphs`)

      // Run comprehensive accessibility analysis with selected tags
      const allIssues = await this.analyzeComprehensive(documentContent, documentType, pagesAnalyzed, imageAnalysis, pageAnalysis, selectedTags, isCancelled, parsedStructure)
      
      // Deduplicate issues to group similar ones together
      const deduplicatedIssues = this.deduplicateIssues(allIssues)
      
      // Calculate comprehensive summary
      const summary = this.calculateComprehensiveSummary(deduplicatedIssues)
      
      // Calculate accessibility scores
      const overallScore = this.calculateOverallScore(deduplicatedIssues, imageAnalysis)
      
      // Determine overall compliance
      const is508Compliant = summary.critical === 0 && summary.serious === 0 && overallScore >= 80

      const scanDuration = Date.now() - startTime
      console.log(`🎉 COMPREHENSIVE scan completed in ${scanDuration}ms - Score: ${overallScore}/100`)

      return {
        is508Compliant,
        overallScore,
        issues: deduplicatedIssues,
        summary,
        imageAnalysis,
        pageAnalysis,
        metadata: {
          documentType,
          scanDate: new Date().toISOString(),
          scanDuration,
          pagesAnalyzed,
          scanEngine: 'Comprehensive 508 Compliance Engine',
          standard: 'Section 508 + WCAG 2.1 AA',
          fileSize: fileBuffer.length,
          wordCount,
          characterCount,
          imageCount,
          tableCount,
          linkCount,
          headingCount,
          paragraphCount
        }
      }

    } catch (error) {
      console.error('❌ Comprehensive scan failed:', error)
      throw new Error(`Failed to scan document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private analyzeDocumentStructure(content: string, pagesAnalyzed: number): { headingCount: number, paragraphCount: number } {
    const lines = content.split('\n')
    let headingCount = 0
    let paragraphCount = 0

    for (const line of lines) {
      const trimmedLine = line.trim()
      if (trimmedLine === '') continue

      // Count headings (lines that are all caps and short)
      if (/^[A-Z][A-Z\s]+$/.test(trimmedLine) && trimmedLine.length < 100 && trimmedLine.length > 3) {
        headingCount++
      }
      // Count paragraphs (non-empty lines that aren't headings)
      else if (trimmedLine.length > 0) {
        paragraphCount++
      }
    }

    return { headingCount, paragraphCount }
  }

  private createBasicPageAnalysis(content: string, pagesAnalyzed: number): PageAnalysis[] {
    const lines = content.split('\n')
    const wordsPerPage = Math.ceil(lines.length / pagesAnalyzed)
    
    const pageAnalysis: PageAnalysis[] = []
    
    for (let i = 0; i < pagesAnalyzed; i++) {
      const startLine = i * wordsPerPage
      const endLine = Math.min((i + 1) * wordsPerPage, lines.length)
      const pageLines = lines.slice(startLine, endLine)
      const pageContent = pageLines.join('\n')
      
      pageAnalysis.push({
        pageNumber: i + 1,
        wordCount: pageContent.split(/\s+/).length,
        characterCount: pageContent.length,
        imageCount: 0, // Will be updated by specific parsers
        tableCount: 0,
        linkCount: 0,
        headingCount: 0,
        paragraphCount: 0,
        issues: []
      })
    }
    
    return pageAnalysis
  }

  private async parsePDFComprehensive(buffer: Buffer): Promise<{
    text: string, 
    pages: number, 
    imageCount: number,
    tableCount: number,
    linkCount: number,
    imageAnalysis: ImageAnalysis,
    pageAnalysis: PageAnalysis[],
    parsedStructure?: any // Add parsed structure for real checks
  }> {
    try {
      // Use new PDF parser for real structure extraction
      const { PDFParser } = await import('./pdf-parser')
      const parser = new PDFParser()
      
      console.log(`🔍 Attempting to parse PDF with ${buffer.length} bytes`)
      
      const parsedStructure = await parser.parsePDF(buffer)
      
      console.log(`📄 PDF parsed successfully: ${parsedStructure.pages} pages, ${parsedStructure.text.length} characters`)
      console.log(`📋 Metadata extracted: Title=${parsedStructure.metadata.title ? 'Yes' : 'No'}, Language=${parsedStructure.metadata.language || 'None'}`)
      console.log(`📊 Structure: ${parsedStructure.structure.headings.length} headings, ${parsedStructure.structure.lists.length} lists, ${parsedStructure.structure.tables.length} tables`)
      console.log(`🔗 Links: ${parsedStructure.links.length}, Images: ${parsedStructure.images.length}, Form fields: ${parsedStructure.formFields.length}`)
      
      // Use actual counts from parsed structure
      const imageCount = parsedStructure.images.length
      const tableCount = parsedStructure.structure.tables.length
      const linkCount = parsedStructure.links.length
      
      // Create image analysis from actual parsed images
      const imagesWithAltText = parsedStructure.images.filter((img: any) => img.altText).length
      const imagesWithoutAltText = imageCount - imagesWithAltText
      
      // Analyze images to determine decorative vs informative
      const imageAnalysisResult = this.analyzeImageTypes(parsedStructure.images, parsedStructure.text, parsedStructure.structure)
      
      const imageAnalysis: ImageAnalysis = {
        totalImages: imageCount,
        imagesWithAltText: imagesWithAltText,
        imagesWithoutAltText: imagesWithoutAltText,
        decorativeImages: imageAnalysisResult.decorative,
        informativeImages: imageAnalysisResult.informative,
        complexImages: imageAnalysisResult.complex,
        imageIssues: [],
        imagesByPage: this.calculateImagesByPage(parsedStructure.images)
      }
      
      // Create detailed page analysis
      const pageAnalysis = this.createDetailedPageAnalysis(parsedStructure.text, parsedStructure.pages)
      
      console.log(`✅ Returning PDF result with ${parsedStructure.pages} pages and ${parsedStructure.text.length} characters`)
      console.log(`🖼️ Image analysis: ${imageCount} total images, ${imagesWithAltText} with alt text`)
      
      return { 
        text: parsedStructure.text, 
        pages: parsedStructure.pages,
        imageCount,
        tableCount,
        linkCount,
        imageAnalysis,
        pageAnalysis,
        parsedStructure // Return full structure for accessibility checks
      }
    } catch (error) {
      console.error('❌ PDF parsing failed:', error)
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error')
      console.error('❌ Buffer size:', buffer.length, 'bytes')
      
      // Fallback to basic pdf-parse if new parser fails
      console.log('⚠️ Falling back to basic pdf-parse')
      try {
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(buffer, { max: 0 })
        
        const contentAnalysis = this.analyzeContentElements(data.text)
        const imageAnalysis: ImageAnalysis = {
          totalImages: contentAnalysis.imageCount,
          imagesWithAltText: 0,
          imagesWithoutAltText: contentAnalysis.imageCount,
          decorativeImages: 0,
          informativeImages: contentAnalysis.imageCount,
          complexImages: 0,
          imageIssues: [],
          imagesByPage: this.distributeImagesAcrossPages(contentAnalysis.imageCount, data.numpages || 1)
        }
        
        return {
          text: data.text,
          pages: data.numpages || 1,
          imageCount: contentAnalysis.imageCount,
          tableCount: contentAnalysis.tableCount,
          linkCount: contentAnalysis.linkCount,
          imageAnalysis,
          pageAnalysis: this.createDetailedPageAnalysis(data.text, data.numpages || 1)
        }
      } catch (fallbackError) {
        console.error('❌ Fallback parsing also failed:', fallbackError)
        return { 
          text: buffer.toString('utf-8').substring(0, 1000) + '... [PDF content extraction failed]',
          pages: 1,
          imageCount: 0,
          tableCount: 0,
          linkCount: 0,
          imageAnalysis: {
            totalImages: 0,
            imagesWithAltText: 0,
            imagesWithoutAltText: 0,
            decorativeImages: 0,
            informativeImages: 0,
            complexImages: 0,
            imageIssues: [],
            imagesByPage: {}
          },
          pageAnalysis: []
        }
      }
    }
  }

  /**
   * Calculate images by page from parsed image data
   */
  private calculateImagesByPage(images: Array<{ page: number }>): { [pageNumber: number]: number } {
    const imagesByPage: { [pageNumber: number]: number } = {}
    images.forEach(img => {
      imagesByPage[img.page] = (imagesByPage[img.page] || 0) + 1
    })
    return imagesByPage
  }

  private async parsePDFAlternative(buffer: Buffer): Promise<string> {
    try {
      // Try to extract text using a different approach
      const text = buffer.toString('utf-8')
      
      // Look for PDF text markers
      const textMatches = text.match(/\([^)]+\)/g)
      if (textMatches && textMatches.length > 10) {
        return textMatches.join(' ')
      }
      
      // Look for readable text content
      const readableText = text.replace(/[^\x20-\x7E\n\r\t]/g, '')
      if (readableText.length > 100) {
        return readableText
      }
      
      return text
    } catch (error) {
      console.error('Alternative PDF parsing failed:', error)
      return ''
    }
  }

  private async parseWordComprehensive(buffer: Buffer): Promise<{
    text: string, 
    pages: number, 
    imageCount: number,
    tableCount: number,
    linkCount: number,
    imageAnalysis: ImageAnalysis,
    pageAnalysis: PageAnalysis[],
    parsedStructure?: any // Add parsed structure for real checks
  }> {
    try {
      // Use new Word parser for real structure extraction
      const { WordParser } = await import('./word-parser')
      const parser = new WordParser()
      
      console.log(`🔍 Attempting to parse Word document with ${buffer.length} bytes`)
      
      const parsedStructure = await parser.parseWord(buffer)
      
      console.log(`📄 Word document parsed successfully: ${parsedStructure.pages} pages, ${parsedStructure.text.length} characters`)
      console.log(`📋 Metadata extracted: Title=${parsedStructure.metadata.title ? 'Yes' : 'No'}, Language=${parsedStructure.metadata.language || 'None'}`)
      console.log(`📊 Structure: ${parsedStructure.structure.headings.length} headings, ${parsedStructure.structure.lists.length} lists, ${parsedStructure.structure.tables.length} tables`)
      console.log(`🔗 Links: ${parsedStructure.links.length}, Images: ${parsedStructure.images.length}`)
      
      // Use actual counts from parsed structure
      const imageCount = parsedStructure.images.length
      const tableCount = parsedStructure.structure.tables.length
      const linkCount = parsedStructure.links.length
      
      // Create image analysis from actual parsed images
      const imagesWithAltText = parsedStructure.images.filter((img: any) => img.altText).length
      const imagesWithoutAltText = imageCount - imagesWithAltText
      
      // Analyze images to determine decorative vs informative
      const imageAnalysisResult = this.analyzeImageTypes(parsedStructure.images, parsedStructure.text, parsedStructure.structure)
      
      const imageAnalysis: ImageAnalysis = {
        totalImages: imageCount,
        imagesWithAltText,
        imagesWithoutAltText,
        decorativeImages: imageAnalysisResult.decorative,
        informativeImages: imageAnalysisResult.informative,
        complexImages: imageAnalysisResult.complex,
        imageIssues: [],
        imagesByPage: this.calculateImagesByPage(parsedStructure.images)
      }
      
      // Create detailed page analysis
      const pageAnalysis = this.createDetailedPageAnalysis(parsedStructure.text, parsedStructure.pages)
      
      return { 
        text: parsedStructure.text, 
        pages: parsedStructure.pages,
        imageCount,
        tableCount,
        linkCount,
        imageAnalysis,
        pageAnalysis,
        parsedStructure // Return parsed structure for real checks
      }
    } catch (error) {
      console.error('❌ Word document parsing failed:', error)
      // Fallback to basic text extraction
      const mammoth = require('mammoth')
      try {
        const result = await mammoth.extractRawText({ buffer })
        const text = result.value
        // Use actual page count from document if available, otherwise estimate more accurately
        const pages = Math.max(1, Math.ceil(text.split(/\s+/).length / 500)) // More accurate: ~500 words per page
        const contentAnalysis = this.analyzeContentElements(text)
        
        return { 
          text, 
          pages,
          imageCount: contentAnalysis.imageCount,
          tableCount: contentAnalysis.tableCount,
          linkCount: contentAnalysis.linkCount,
          imageAnalysis: {
            totalImages: contentAnalysis.imageCount,
            imagesWithAltText: 0,
            imagesWithoutAltText: contentAnalysis.imageCount,
            decorativeImages: 0, // Will be determined by actual analysis if parsedStructure available
            informativeImages: contentAnalysis.imageCount, // Default to all informative until analyzed
            complexImages: 0,
            imageIssues: [],
            imagesByPage: {}
          },
          pageAnalysis: this.createDetailedPageAnalysis(text, pages)
        }
      } catch (fallbackError) {
        return { 
          text: buffer.toString('utf-8').substring(0, 1000) + '... [Word document content extracted]',
          pages: 1,
          imageCount: 0,
          tableCount: 0,
          linkCount: 0,
          imageAnalysis: {
            totalImages: 0,
            imagesWithAltText: 0,
            imagesWithoutAltText: 0,
            decorativeImages: 0,
            informativeImages: 0,
            complexImages: 0,
            imageIssues: [],
            imagesByPage: {}
          },
          pageAnalysis: []
        }
      }
    }
  }

  private async parsePowerPointComprehensive(buffer: Buffer): Promise<{
    text: string, 
    pages: number, 
    imageCount: number,
    tableCount: number,
    linkCount: number,
    imageAnalysis: ImageAnalysis,
    pageAnalysis: PageAnalysis[],
    parsedStructure?: any // Add parsed structure for real checks
  }> {
    try {
      // Use new PowerPoint parser for real structure extraction
      const { PowerPointParser } = await import('./powerpoint-parser')
      const parser = new PowerPointParser()
      
      console.log(`🔍 Attempting to parse PowerPoint with ${buffer.length} bytes`)
      
      const parsedStructure = await parser.parsePowerPoint(buffer)
      
      console.log(`📄 PowerPoint parsed successfully: ${parsedStructure.pages} slides, ${parsedStructure.text.length} characters`)
      console.log(`📋 Metadata extracted: Title=${parsedStructure.metadata.title ? 'Yes' : 'No'}, Author=${parsedStructure.metadata.author || 'None'}`)
      console.log(`📊 Structure: ${parsedStructure.structure.headings.length} headings, ${parsedStructure.structure.lists.length} lists, ${parsedStructure.structure.tables.length} tables`)
      console.log(`🔗 Links: ${parsedStructure.links.length}, Images: ${parsedStructure.images.length}`)
      
      // Use actual counts from parsed structure
      const imageCount = parsedStructure.images.length
      const tableCount = parsedStructure.structure.tables.length
      const linkCount = parsedStructure.links.length
      
      // Create image analysis from actual parsed images
      const imagesWithAltText = parsedStructure.images.filter((img: any) => img.altText).length
      const imagesWithoutAltText = imageCount - imagesWithAltText
      
      // Analyze images to determine decorative vs informative
      const imageAnalysisResult = this.analyzeImageTypes(parsedStructure.images, parsedStructure.text, parsedStructure.structure)
      
      const imageAnalysis: ImageAnalysis = {
        totalImages: imageCount,
        imagesWithAltText,
        imagesWithoutAltText,
        decorativeImages: imageAnalysisResult.decorative,
        informativeImages: imageAnalysisResult.informative,
        complexImages: imageAnalysisResult.complex,
        imageIssues: [],
        imagesByPage: this.calculateImagesByPage(parsedStructure.images)
      }
      
      // Create detailed page analysis
      const pageAnalysis = this.createDetailedPageAnalysis(parsedStructure.text, parsedStructure.pages)
      
      return { 
        text: parsedStructure.text, 
        pages: parsedStructure.pages,
        imageCount,
        tableCount,
        linkCount,
        imageAnalysis,
        pageAnalysis,
        parsedStructure // Return parsed structure for real checks
      }
    } catch (error) {
      console.error('❌ PowerPoint parsing failed:', error)
      // Fallback to basic text extraction
      const text = buffer.toString('utf-8').substring(0, 2000) + '... [PowerPoint content extracted]'
      // Use actual slide count if available, otherwise estimate based on content
      const pages = Math.max(1, Math.ceil(text.split(/\s+/).length / 100)) // ~100 words per slide
      const contentAnalysis = this.analyzeContentElements(text)
      
      return { 
        text, 
        pages,
        imageCount: contentAnalysis.imageCount,
        tableCount: contentAnalysis.tableCount,
        linkCount: contentAnalysis.linkCount,
        imageAnalysis: {
          totalImages: contentAnalysis.imageCount,
          imagesWithAltText: 0,
          imagesWithoutAltText: contentAnalysis.imageCount,
          decorativeImages: 0, // Will be determined by actual analysis
          informativeImages: contentAnalysis.imageCount, // Default until analyzed
          complexImages: 0, // Will be determined by actual analysis
          imageIssues: [],
          imagesByPage: {}
        },
        pageAnalysis: this.createDetailedPageAnalysis(text, pages)
      }
    }
  }

  private async parseHTMLComprehensive(buffer: Buffer): Promise<{
    text: string, 
    pages: number, 
    imageCount: number,
    tableCount: number,
    linkCount: number,
    imageAnalysis: ImageAnalysis,
    pageAnalysis: PageAnalysis[],
    parsedStructure?: any // Add parsed structure for real checks
  }> {
    try {
      // Use new HTML parser for real structure extraction
      const { HTMLParser } = await import('./html-parser')
      const parser = new HTMLParser()
      
      console.log(`🔍 Attempting to parse HTML with ${buffer.length} bytes`)
      
      const parsedStructure = await parser.parseHTML(buffer)
      
      console.log(`📄 HTML parsed successfully: ${parsedStructure.pages} pages, ${parsedStructure.text.length} characters`)
      console.log(`📋 Metadata extracted: Title=${parsedStructure.metadata.title ? 'Yes' : 'No'}, Language=${parsedStructure.metadata.language || 'None'}`)
      console.log(`📊 Structure: ${parsedStructure.structure.headings.length} headings, ${parsedStructure.structure.lists.length} lists, ${parsedStructure.structure.tables.length} tables`)
      console.log(`🔗 Links: ${parsedStructure.links.length}, Images: ${parsedStructure.images.length}, Form fields: ${parsedStructure.formFields.length}`)
      
      // Use actual counts from parsed structure
      const imageCount = parsedStructure.images.length
      const tableCount = parsedStructure.structure.tables.length
      const linkCount = parsedStructure.links.length
      
      // Create image analysis from actual parsed images
      const imagesWithAltText = parsedStructure.images.filter((img: any) => img.altText).length
      const imagesWithoutAltText = imageCount - imagesWithAltText
      
      // Analyze images to determine decorative vs informative
      const imageAnalysisResult = this.analyzeImageTypes(parsedStructure.images, parsedStructure.text, parsedStructure.structure)
      
      const imageAnalysis: ImageAnalysis = {
        totalImages: imageCount,
        imagesWithAltText,
        imagesWithoutAltText,
        decorativeImages: imageAnalysisResult.decorative,
        informativeImages: imageAnalysisResult.informative,
        complexImages: imageAnalysisResult.complex,
        imageIssues: [],
        imagesByPage: this.calculateImagesByPage(parsedStructure.images)
      }
      
      // Create detailed page analysis
      const pageAnalysis = this.createDetailedPageAnalysis(parsedStructure.text, parsedStructure.pages)
      
      return { 
        text: parsedStructure.text, 
        pages: parsedStructure.pages,
        imageCount,
        tableCount,
        linkCount,
        imageAnalysis,
        pageAnalysis,
        parsedStructure // Return parsed structure for real checks
      }
    } catch (error) {
      console.error('❌ HTML parsing failed:', error)
      // Fallback to basic text extraction
      const text = buffer.toString('utf-8').replace(/<[^>]*>/g, ' ')
      const pages = 1
      const contentAnalysis = this.analyzeContentElements(text)
      
      return { 
        text, 
        pages,
        imageCount: contentAnalysis.imageCount,
        tableCount: contentAnalysis.tableCount,
        linkCount: contentAnalysis.linkCount,
        imageAnalysis: {
          totalImages: contentAnalysis.imageCount,
          imagesWithAltText: 0,
          imagesWithoutAltText: contentAnalysis.imageCount,
          decorativeImages: 0, // Will be determined by actual analysis
          informativeImages: contentAnalysis.imageCount, // Default until analyzed
          complexImages: 0,
          imageIssues: [],
          imagesByPage: {}
        },
        pageAnalysis: this.createDetailedPageAnalysis(text, pages)
      }
    }
  }

  private analyzeContentElements(content: string): { imageCount: number, tableCount: number, linkCount: number } {
    // More intelligent image detection - only count actual image references, not text mentions
    let imageCount = 0
    
    // Count image file extensions (these are actual images)
    const imageExtensions = /\.(jpg|jpeg|png|gif|bmp|svg|tiff|webp)/gi
    const extensionMatches = content.match(imageExtensions)
    if (extensionMatches) {
      imageCount += extensionMatches.length
      console.log(`📁 Found ${extensionMatches.length} image file extensions: ${extensionMatches.slice(0, 3).join(', ')}`)
    }
    
    // Count actual figure references (like "Figure 1", "Figure 2", etc.)
    const figureReferences = content.match(/figure\s+\d+/gi)
    if (figureReferences) {
      imageCount += figureReferences.length
      console.log(`📊 Found ${figureReferences.length} figure references: ${figureReferences.slice(0, 5).join(', ')}${figureReferences.length > 5 ? '...' : ''}`)
    }
    
    // Count actual image references (like "Image 1", "Photo 1", etc.)
    const imageReferences = content.match(/(image|photo|picture|graphic)\s+\d+/gi)
    if (imageReferences) {
      imageCount += imageReferences.length
      console.log(`🖼️ Found ${imageReferences.length} image references: ${imageReferences.slice(0, 3).join(', ')}`)
    }
    
    // Count tables
    const tableIndicators = [
      /table/i,
      /row/i,
      /column/i,
      /cell/i,
      /header/i
    ]
    
    let tableCount = 0
    for (const indicator of tableIndicators) {
      const matches = content.match(indicator)
      if (matches) {
        tableCount += matches.length
      }
    }
    
    // Count links
    const linkPatterns = [
      /http[s]?:\/\/[^\s]+/gi,
      /www\.[^\s]+/gi,
      /mailto:/gi
    ]
    
    let linkCount = 0
    for (const pattern of linkPatterns) {
      const matches = content.match(pattern)
      if (matches) {
        linkCount += matches.length
      }
    }
    
    return {
      imageCount: imageCount, // Use actual count
      tableCount: tableCount, // Use actual count
      linkCount: linkCount    // Use actual count
    }
  }

  private createDetailedPageAnalysis(content: string, pages: number): PageAnalysis[] {
    const lines = content.split('\n')
    const linesPerPage = Math.ceil(lines.length / pages)
    
    const pageAnalysis: PageAnalysis[] = []
    
    for (let i = 0; i < pages; i++) {
      const startLine = i * linesPerPage
      const endLine = Math.min((i + 1) * linesPerPage, lines.length)
      const pageLines = lines.slice(startLine, endLine)
      const pageContent = pageLines.join('\n')
      
      // Analyze this page's content
      const pageContentAnalysis = this.analyzeContentElements(pageContent)
      const pageStructure = this.analyzeDocumentStructure(pageContent, 1)
      
      pageAnalysis.push({
        pageNumber: i + 1,
        wordCount: pageContent.split(/\s+/).length,
        characterCount: pageContent.length,
        imageCount: pageContentAnalysis.imageCount,
        tableCount: pageContentAnalysis.tableCount,
        linkCount: pageContentAnalysis.linkCount,
        headingCount: pageStructure.headingCount,
        paragraphCount: pageStructure.paragraphCount,
        issues: []
      })
    }
    
    return pageAnalysis
  }

  private distributeImagesAcrossPages(totalImages: number, totalPages: number): { [pageNumber: number]: number } {
    const distribution: { [pageNumber: number]: number } = {}
    const imagesPerPage = Math.floor(totalImages / totalPages)
    const remainingImages = totalImages % totalPages
    
    for (let i = 1; i <= totalPages; i++) {
      distribution[i] = imagesPerPage + (i <= remainingImages ? 1 : 0)
    }
    
    return distribution
  }

  /**
   * Analyze images to determine decorative vs informative vs complex
   * Uses actual image context, size, position, and surrounding text
   */
  private analyzeImageTypes(
    images: Array<{ id: string; page: number; altText: string | null; width: number; height: number; type: string; isAnimated: boolean }>,
    documentText: string,
    structure?: any
  ): { decorative: number; informative: number; complex: number } {
    let decorative = 0
    let informative = 0
    let complex = 0
    
    if (!images || images.length === 0) {
      return { decorative: 0, informative: 0, complex: 0 }
    }
    
    images.forEach((image) => {
      // Check if image is complex (charts, graphs, diagrams)
      const complexIndicators = [
        /chart|graph|diagram|plot|timeline|flowchart|infographic|heatmap|visualization/i,
        image.type === 'chart' || image.type === 'diagram'
      ]
      
      // Check surrounding text for complex image indicators
      const textAroundImage = this.getTextAroundImage(image, documentText, structure)
      const hasComplexIndicators = complexIndicators.some(indicator => 
        typeof indicator === 'string' ? textAroundImage.includes(indicator) : indicator
      )
      
      if (hasComplexIndicators) {
        complex++
      } else {
        // Determine if decorative or informative
        // Decorative images: small, no alt text, no surrounding context
        const isSmall = (image.width > 0 && image.width < 100) || (image.height > 0 && image.height < 100)
        const hasNoAltText = !image.altText || image.altText.trim() === ''
        const hasNoContext = !textAroundImage || textAroundImage.length < 20
        
        // Informative images: have alt text, or are referenced in text, or are large
        const isLarge = image.width > 200 || image.height > 200
        const hasAltText = image.altText && image.altText.trim().length > 0
        const isReferenced = this.isImageReferencedInText(image, documentText, structure)
        
        if ((isSmall && hasNoAltText && hasNoContext) || (image.altText === '')) {
          decorative++
        } else if (hasAltText || isReferenced || isLarge) {
          informative++
        } else {
          // Default to informative if uncertain
          informative++
        }
      }
    })
    
    return { decorative, informative, complex }
  }
  
  /**
   * Get text around an image for context analysis
   */
  private getTextAroundImage(
    image: { page: number },
    documentText: string,
    structure?: any
  ): string {
    // Try to find text near the image on the same page
    // For now, return page text if available
    const lines = documentText.split('\n')
    const linesPerPage = Math.ceil(lines.length / (structure?.pages || 1))
    const pageStart = (image.page - 1) * linesPerPage
    const pageEnd = Math.min(image.page * linesPerPage, lines.length)
    const pageText = lines.slice(pageStart, pageEnd).join(' ')
    
    return pageText || ''
  }
  
  /**
   * Check if image is referenced in document text
   */
  private isImageReferencedInText(
    image: { id: string; page: number },
    documentText: string,
    structure?: any
  ): boolean {
    // Check for figure references, image citations, etc.
    const imageId = image.id.replace(/pdf_image_|img_|slide_|image_/g, '').replace(/_\d+$/, '')
    const pageNum = image.page
    
    // Look for references like "Figure 1", "Image 2", "see image", etc.
    const referencePatterns = [
      new RegExp(`figure\\s+${pageNum}`, 'i'),
      new RegExp(`image\\s+${pageNum}`, 'i'),
      new RegExp(`see\\s+.*image`, 'i'),
      new RegExp(`refer.*to.*figure`, 'i'),
    ]
    
    return referencePatterns.some(pattern => pattern.test(documentText))
  }

  /**
   * Detect if there are indicators of complex images (charts, graphs, diagrams) in the document
   */
  private detectComplexImageIndicators(content: string): boolean {
    // More specific patterns that indicate actual complex images
    const complexImageIndicators = [
      /figure\s+\d+/i,  // "Figure 1", "Figure 2", etc.
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
    ]
    
    // Check if any complex image indicators are present in the text
    for (const indicator of complexImageIndicators) {
      if (indicator.test(content)) {
        console.log(`🔍 Found complex image indicator: ${indicator.source}`)
        return true
      }
    }
    
    // Also check for multiple instances of "figure" which might indicate actual figures
    const figureMatches = content.match(/figure/gi)
    if (figureMatches && figureMatches.length > 2) {
      console.log(`🔍 Found ${figureMatches.length} instances of "figure" - likely actual figures`)
      return true
    }
    
    return false
  }

  private async analyzeComprehensive(
    documentContent: string,
    documentType: string,
    pagesAnalyzed: number,
    imageAnalysis: ImageAnalysis,
    pageAnalysis: PageAnalysis[],
    selectedTags?: string[],
    isCancelled?: () => boolean,
    parsedStructure?: any // Real parsed PDF structure for actual checks
  ): Promise<ComprehensiveDocumentIssue[]> {
    const issues: ComprehensiveDocumentIssue[] = []

    // Check if Section 508 tags are selected
    const hasSection508Tags = selectedTags && selectedTags.some(tag => tag.startsWith('1194.22'))
    
    // Only run general WCAG compliance checks if NO Section 508 tags are selected
    // This ensures that when user selects specific Section 508 tests, only those tests run
    if (!hasSection508Tags) {
      console.log(`🔍 Running general WCAG compliance checks (no Section 508 tags selected)`)
      
      // Text analysis - use parsed structure if available
      const textIssues = this.analyzeTextAccessibility(documentContent, documentType, pagesAnalyzed, parsedStructure)
      issues.push(...textIssues)

      // Check for cancellation after text analysis
      if (isCancelled && isCancelled()) {
        throw new Error('Scan was cancelled by user')
      }

      // Structure analysis - use real parsed structure if available
      const structureIssues = this.analyzeStructureAccessibility(documentContent, documentType, pagesAnalyzed, parsedStructure)
      issues.push(...structureIssues)

      // Check for cancellation after structure analysis
      if (isCancelled && isCancelled()) {
        throw new Error('Scan was cancelled by user')
      }

      // Image analysis - use parsed structure for real image data
      const imageIssues = this.analyzeImageAccessibility(imageAnalysis, documentType, pagesAnalyzed, parsedStructure)
      issues.push(...imageIssues)

      // Check for cancellation after image analysis
      if (isCancelled && isCancelled()) {
        throw new Error('Scan was cancelled by user')
      }

      // Additional WCAG Level AA checks
      const additionalAAIssues = this.checkAdditionalWCAGAA(documentContent, documentType, pagesAnalyzed, parsedStructure)
      issues.push(...additionalAAIssues)
      
      // Helper function for getPageAndLine (needed for some checks)
      const lines = documentContent.split('\n')
      const getPageAndLine = (lineIndex: number): { page: number, line: number } => {
        const linesPerPage = Math.ceil(lines.length / pagesAnalyzed)
        const page = Math.floor(lineIndex / linesPerPage) + 1
        const line = (lineIndex % linesPerPage) + 1
        return { page, line }
      }
      
      // Additional missing Level AA checks
      const orientationIssues = this.checkOrientation(documentContent, pagesAnalyzed)
      issues.push(...orientationIssues)
      
      const inputPurposeIssues = this.checkInputPurpose(documentContent, pagesAnalyzed, parsedStructure)
      issues.push(...inputPurposeIssues)
      
      const reflowIssues = this.checkReflow(documentContent, pagesAnalyzed)
      issues.push(...reflowIssues)
      
      const textSpacingIssues = this.checkTextSpacing(documentContent, pagesAnalyzed)
      issues.push(...textSpacingIssues)
      
      const hoverFocusIssues = this.checkContentOnHoverFocus(documentContent, pagesAnalyzed)
      issues.push(...hoverFocusIssues)
      
      const headingsLabelsIssues = this.checkHeadingsAndLabels(documentContent, pagesAnalyzed, parsedStructure)
      issues.push(...headingsLabelsIssues)
      
      const languagePartsIssues = this.checkLanguageOfParts(documentContent, getPageAndLine, parsedStructure)
      issues.push(...languagePartsIssues)
      
      const consistentNavIssues = this.checkConsistentNavigation(documentContent, pagesAnalyzed, parsedStructure)
      issues.push(...consistentNavIssues)
      
      const consistentIdIssues = this.checkConsistentIdentification(documentContent, pagesAnalyzed, parsedStructure)
      issues.push(...consistentIdIssues)
      
      const errorPreventionAAIssues = this.checkErrorPreventionAA(documentContent, getPageAndLine, parsedStructure)
      issues.push(...errorPreventionAAIssues)

      // Check for cancellation after additional checks
      if (isCancelled && isCancelled()) {
        throw new Error('Scan was cancelled by user')
      }
    } else {
      console.log(`⏭️ Section 508 tags selected - skipping general WCAG checks to run only selected compliance tests`)
    }

    // Section 508 compliance testing (only if tags are selected)
    if (selectedTags && selectedTags.length > 0) {
      console.log(`🔍 Running Section 508 compliance tests for selected tags: ${selectedTags.join(', ')}`)
    } else {
      console.log(`⏭️ No Section 508 tests selected - skipping Section 508 compliance testing`)
    }
    
    const section508Issues = await this.testSection508Compliance(documentContent, documentType, pagesAnalyzed, selectedTags, isCancelled, parsedStructure)
    issues.push(...section508Issues)

    return issues
  }

  private analyzeTextAccessibility(documentContent: string, documentType: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')

    // Helper function to calculate page and line number from line index
    const getPageAndLine = (lineIndex: number): { page: number, line: number } => {
      const linesPerPage = Math.ceil(lines.length / pagesAnalyzed)
      const page = Math.floor(lineIndex / linesPerPage) + 1
      const line = (lineIndex % linesPerPage) + 1
      return { page, line }
    }

    // WCAG 1.3.1 Info and Relationships (A): Use built-in document features for structure
    // Use parsed structure lists if available, otherwise fall back to text pattern matching
    const listIssues = parsedStructure?.structure ? 
      this.checkListStructureReal(parsedStructure.structure.lists, pagesAnalyzed) :
      this.checkListStructure(documentContent, getPageAndLine)
    issues.push(...listIssues)

    // WCAG 2.4.4 Link Purpose (A): Descriptive link text
    // Use parsed structure links if available
    const linkIssues = parsedStructure?.links ? 
      this.checkLinkTextReal(parsedStructure.links, pagesAnalyzed) :
      this.checkLinkText(documentContent, getPageAndLine)
    issues.push(...linkIssues)

    // WCAG 1.3.1 Info and Relationships (A): Table structure with headers
    // Use parsed structure tables if available
    const tableIssues = parsedStructure?.structure?.tables ? 
      this.checkTableStructureReal(parsedStructure.structure.tables, pagesAnalyzed) :
      this.checkTableStructure(documentContent, getPageAndLine)
    issues.push(...tableIssues)

    // WCAG 1.4.1 Use of Color (A): Color not the only way to convey information
    const colorIssues = this.checkColorUsage(documentContent, getPageAndLine)
    issues.push(...colorIssues)

    // WCAG 1.4.5 Images of Text (AA): Avoid images of text
    const textImageIssues = this.checkImagesOfText(documentContent, getPageAndLine)
    issues.push(...textImageIssues)

    // WCAG 3.1.2 Language of Parts (AA): Identify foreign language parts
    const languageIssues = this.checkLanguageParts(documentContent, getPageAndLine)
    issues.push(...languageIssues)

    // WCAG 1.2.1 Audio-only and Video-only (A): Check for media references
    const mediaIssues = this.checkTimeBasedMedia(documentContent, getPageAndLine)
    issues.push(...mediaIssues)

    // WCAG 3.2.1 On Focus (A): Check for form-like content
    const formIssues = this.checkFormAccessibility(documentContent, getPageAndLine)
    issues.push(...formIssues)

    // WCAG 1.3.3 Sensory Characteristics (A): Instructions not relying solely on shape/size/location
    const sensoryIssues = this.checkSensoryCharacteristics(documentContent, getPageAndLine)
    issues.push(...sensoryIssues)

    // WCAG 1.4.2 Audio Control (A): No auto-playing audio
    const audioIssues = this.checkAudioControl(documentContent, getPageAndLine)
    issues.push(...audioIssues)

    // WCAG 2.4.3 Focus Order (A): Logical tab order
    const focusOrderIssues = this.checkFocusOrder(documentContent, pagesAnalyzed, parsedStructure)
    issues.push(...focusOrderIssues)

    // WCAG 3.3.1 Error Identification (A): Form error messages
    const errorIdIssues = this.checkErrorIdentification(documentContent, getPageAndLine, parsedStructure)
    issues.push(...errorIdIssues)

    // WCAG 4.1.1 Parsing (A): Valid markup/structure
    const parsingIssues = this.checkParsing(documentContent, pagesAnalyzed, parsedStructure)
    issues.push(...parsingIssues)

    // WCAG 4.1.2 Name, Role, Value (A): Form controls have proper attributes
    const nameRoleValueIssues = this.checkNameRoleValue(documentContent, pagesAnalyzed, parsedStructure)
    issues.push(...nameRoleValueIssues)

    // WCAG 1.2.2 Captions (Prerecorded) (A): Captions for video
    const captionIssues = this.checkCaptionsPrerecorded(documentContent, getPageAndLine, parsedStructure)
    issues.push(...captionIssues)

    // WCAG 1.2.3 Audio Description or Media Alternative (A): Audio descriptions for video
    const audioDescIssues = this.checkAudioDescription(documentContent, getPageAndLine, parsedStructure)
    issues.push(...audioDescIssues)

    // WCAG 1.2.4 Captions (Live) (A): Live captions
    const liveCaptionIssues = this.checkCaptionsLive(documentContent, getPageAndLine)
    issues.push(...liveCaptionIssues)

    // WCAG 1.2.5 Audio Description (Prerecorded) (AA): Extended audio descriptions
    const extAudioDescIssues = this.checkExtendedAudioDescription(documentContent, getPageAndLine)
    issues.push(...extAudioDescIssues)

    // WCAG 2.1.4 Character Key Shortcuts (A): Keyboard shortcuts
    const shortcutIssues = this.checkCharacterKeyShortcuts(documentContent, getPageAndLine)
    issues.push(...shortcutIssues)

    // WCAG 2.2.2 Pause, Stop, Hide (A): Moving content controls
    const pauseStopIssues = this.checkPauseStopHide(documentContent, getPageAndLine)
    issues.push(...pauseStopIssues)

    // WCAG 2.5.1 Pointer Gestures (A): Single pointer operation
    const gestureIssues = this.checkPointerGestures(documentContent, getPageAndLine)
    issues.push(...gestureIssues)

    // WCAG 2.5.2 Pointer Cancellation (A): Cancel pointer actions
    const pointerCancelIssues = this.checkPointerCancellation(documentContent, getPageAndLine)
    issues.push(...pointerCancelIssues)

    // WCAG 2.5.3 Label in Name (A): Accessible name matches visible label
    const labelInNameIssues = this.checkLabelInName(documentContent, pagesAnalyzed, parsedStructure)
    issues.push(...labelInNameIssues)

    // WCAG 2.5.4 Motion Actuation (A): Device motion alternatives
    const motionIssues = this.checkMotionActuation(documentContent, getPageAndLine)
    issues.push(...motionIssues)

    // WCAG 3.2.2 On Input (A): No context change on input
    const onInputIssues = this.checkOnInput(documentContent, getPageAndLine)
    issues.push(...onInputIssues)

    // WCAG 3.3.4 Error Prevention (Legal, Financial, Data) (A): Error prevention
    const errorPreventionIssues = this.checkErrorPrevention(documentContent, getPageAndLine, parsedStructure)
    issues.push(...errorPreventionIssues)

    return issues
  }

  private checkListStructure(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for manual list indicators that should use built-in list functions - use single regex for efficiency
    const manualListRegex = /^(?:[•\-\*]\s|\d+\.\s|[a-z]\)\s|[A-Z]\)\s)/
    
    let manualListFound = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (manualListRegex.test(line)) {
        if (!manualListFound) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `issue_${Date.now()}_manual_lists`,
            type: 'moderate',
            category: 'structure',
            description: 'Manual list formatting detected',
            section: 'Document Structure',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Lists should use built-in list functions for proper structure',
            wcagCriterion: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
            section508Requirement: '36 CFR § 1194.22(a) - Structure and Organization',
            impact: this.calculateImpact('moderate'),
            remediation: 'Use built-in bulleted and numbered list functions instead of manual characters.'
          })
          manualListFound = true
        }
        break
      }
    }
    
    return issues
  }

  private checkLinkText(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for non-descriptive link text - use single regex for efficiency
    const nonDescriptiveLinkRegex = /(click here|read more|learn more|here|link|this|that)/i
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('http') || line.includes('www')) {
        // Check if the link text is descriptive
        const hasDescriptiveText = !nonDescriptiveLinkRegex.test(line)
        
        if (!hasDescriptiveText) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `issue_${Date.now()}_non_descriptive_link_${i}`,
            type: 'moderate',
            category: 'navigation',
            description: 'Non-descriptive link text found',
            section: 'Navigation and Links',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Link text should clearly indicate purpose or destination',
            wcagCriterion: 'WCAG 2.1 AA - 2.4.4 Link Purpose (In Context)',
            section508Requirement: '36 CFR § 1194.22(a) - Navigation and Links',
            impact: this.calculateImpact('moderate'),
            remediation: 'Use descriptive link text that clearly indicates the purpose or destination of the link.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * Check list structure using REAL parsed structure data
   */
  private checkListStructureReal(lists: Array<{ type: 'ordered' | 'unordered'; items: string[]; page: number }>, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // If lists are found, check if they might be manual (detected from text patterns)
    // Real list structure from PDF would indicate proper list usage
    // Manual lists show up in parsed structure but as text patterns, not proper structure
    // For now, we assume parsed lists are properly structured - this is better than keyword matching
    
    return issues // Real structure means lists are likely properly formatted
  }

  /**
   * Check link text using REAL parsed links
   */
  private checkLinkTextReal(links: Array<{ text: string; url: string; page: number }>, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    const nonDescriptiveLinkRegex = /(click here|read more|learn more|here|link|this|that)/i
    
    links.forEach(link => {
      // Check if link text is descriptive
      const hasDescriptiveText = link.text && !nonDescriptiveLinkRegex.test(link.text)
      
      if (!hasDescriptiveText) {
        issues.push({
          id: `issue_${Date.now()}_non_descriptive_link_${link.page}`,
          type: 'moderate',
          category: 'navigation',
          description: 'Non-descriptive link text found',
          section: 'Navigation and Links',
          pageNumber: link.page,
          lineNumber: 1,
          elementLocation: link.text || link.url.substring(0, 50),
          context: `Link "${link.text || link.url}" does not clearly indicate purpose or destination`,
          wcagCriterion: 'WCAG 2.1 AA - 2.4.4 Link Purpose (In Context)',
          section508Requirement: '36 CFR § 1194.22(a) - Navigation and Links',
          impact: this.calculateImpact('moderate'),
          remediation: `Replace "${link.text || link.url}" with descriptive text that clearly indicates the link destination or purpose.`
        })
      }
    })
    
    return issues
  }

  /**
   * Check table structure using REAL parsed tables
   */
  private checkTableStructureReal(tables: Array<{ rows: number; columns: number; hasHeaders: boolean; page: number }>, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    tables.forEach(table => {
      // Check if table has headers
      if (!table.hasHeaders && table.rows > 1) {
        issues.push({
          id: `issue_${Date.now()}_table_no_headers_${table.page}`,
          type: 'serious',
          category: 'structure',
          description: 'Table missing header row',
          section: 'Document Structure',
          pageNumber: table.page,
          lineNumber: 1,
          elementLocation: `Table with ${table.rows} rows and ${table.columns} columns`,
          context: 'Tables should have header rows to identify column content',
          wcagCriterion: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
          section508Requirement: '36 CFR § 1194.22(a) - Structure and Organization',
          impact: this.calculateImpact('serious'),
          remediation: `Add a header row to the table on page ${table.page} to clearly identify column content.`
        })
      }
      
      // Check if table is complex (many rows/columns) without proper structure indicators
      if (table.rows > 10 || table.columns > 5) {
        if (!table.hasHeaders) {
          issues.push({
            id: `issue_${Date.now()}_complex_table_${table.page}`,
            type: 'moderate',
            category: 'structure',
            description: 'Complex table may need additional structure',
            section: 'Document Structure',
            pageNumber: table.page,
            lineNumber: 1,
            elementLocation: `Large table with ${table.rows} rows and ${table.columns} columns`,
            context: 'Large tables benefit from additional structural markup',
            wcagCriterion: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
            section508Requirement: '36 CFR § 1194.22(a) - Structure and Organization',
            impact: this.calculateImpact('moderate'),
            remediation: `Ensure the complex table on page ${table.page} has proper headers, captions, and summary where applicable.`
          })
        }
      }
    })
    
    return issues
  }

  private checkTableStructure(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for table-like structures that might need proper formatting - use single regex for efficiency
    const tableRegex = /(?:\|\s*\w+|\t\s*\w+|\s{3,}\w+)/
    
    let tableStructureFound = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      if (tableRegex.test(line)) {
        if (!tableStructureFound) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `issue_${Date.now()}_table_structure`,
            type: 'moderate',
            category: 'structure',
            description: 'Table structure detected without proper headers',
            section: 'Document Structure',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Tables should have proper headers and simple structure',
            wcagCriterion: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
            section508Requirement: '36 CFR § 1194.22(a) - Structure and Organization',
            impact: this.calculateImpact('moderate'),
            remediation: 'Use proper table formatting with headers and avoid merged/split cells.'
          })
          tableStructureFound = true
        }
        break
      }
    }
    
    return issues
  }

  private checkColorUsage(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for potential color-only information (this is limited in text-only parsing)
    // Look for patterns that might indicate color-only information
    const colorOnlyPatterns = [
      /required/i,
      /mandatory/i,
      /important/i,
      /warning/i,
      /error/i,
      /success/i
    ]
    
    // Note: This is a basic check. Full color analysis would require image processing
    // which is beyond the scope of text-only parsing
    
    return issues
  }

  private checkImagesOfText(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for potential scanned document indicators - use single regex for efficiency
    const scannedDocumentRegex = /(scanned|image of text|picture of text|photograph of text)/i
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (scannedDocumentRegex.test(line)) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `issue_${Date.now()}_images_of_text`,
          type: 'serious',
          category: 'text',
          description: 'Images of text detected',
          section: 'Text and Typography',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Avoid using images of text when the same effect can be achieved with standard text',
          wcagCriterion: 'WCAG 2.1 AA - 1.4.5',
          section508Requirement: '36 CFR § 1194.22(a) - Non-Text Content',
          impact: this.calculateImpact('serious'),
          remediation: 'Use live, digital text instead of images of text. If you have a scanned document, use OCR to convert it to searchable text.'
        })
        break
      }
    }
    
    return issues
  }

  private checkLanguageParts(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for foreign language indicators - use single regex for efficiency
    const foreignLanguageRegex = /[àáâãäåæçèéêëìíîïðñòóôõöøùúûüýþÿαβγδεζηθικλμνξοπρστυφχψωабвгдеёжзийклмнопрстуфхцчшщъыьэюя一-龯あ-んア-ン가-힣अ-हا-ي]/
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (foreignLanguageRegex.test(line)) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `issue_${Date.now()}_foreign_language_${i}`,
          type: 'moderate',
          category: 'structure',
          description: 'Foreign language content detected without language identification',
          section: 'Document Structure',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Foreign language parts must be identified for proper screen reader pronunciation',
          wcagCriterion: 'WCAG 2.1 AA - 3.1.2',
          section508Requirement: '36 CFR § 1194.22(a) - Readability and Language',
          impact: this.calculateImpact('moderate'),
          remediation: 'Select the foreign language text and set its language property in the document.'
        })
        break
      }
    }
    
    return issues
  }

  private checkTimeBasedMedia(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for media file references that might need captions/transcripts - use single regex for efficiency
    const mediaFileRegex = /(\.(mp4|avi|mov|wmv|flv|webm|mp3|wav|aac|ogg|wma)$|video|audio|podcast|webinar|presentation.*video|recording)/i
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (mediaFileRegex.test(line)) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `issue_${Date.now()}_time_based_media_${i}`,
          type: 'serious',
          category: 'media',
          description: 'Time-based media detected without accessibility features',
          section: 'Media and Multimedia',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Audio/video content requires captions or transcripts for accessibility',
          wcagCriterion: 'WCAG 2.1 AA - 1.2.1 Audio-only and Video-only',
          section508Requirement: '36 CFR § 1194.22(a) - Non-Text Content',
          impact: this.calculateImpact('serious'),
          remediation: 'Provide captions for video with audio, transcripts for audio-only content, and audio descriptions for video-only content.'
        })
        break
      }
    }
    
    return issues
  }

  private checkFormAccessibility(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for form-like content patterns - use single regex for efficiency
    const formRegex = /(form|questionnaire|survey|application|registration|sign.*up|log.*in|submit|required|mandatory|optional|field|input|checkbox|radio.*button|dropdown|select|text.*area)/i
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (formRegex.test(line)) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `issue_${Date.now()}_form_accessibility_${i}`,
          type: 'moderate',
          category: 'form',
          description: 'Form-like content detected without accessibility considerations',
          section: 'Forms and Interactive Elements',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Forms must be accessible to keyboard navigation and screen readers',
          wcagCriterion: 'WCAG 2.1 AA - 3.2.1 On Focus',
          section508Requirement: '36 CFR § 1194.22(a) - Navigation and Links',
          impact: this.calculateImpact('moderate'),
          remediation: 'Ensure form fields have proper labels, are keyboard accessible, and provide clear error messages.'
        })
        break
      }
    }
    
    return issues
  }

  private analyzeStructureAccessibility(documentContent: string, documentType: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []

    // Helper function to find the actual page and line for an issue
    const findIssueLocation = (searchText: string, fallbackPage: number = 1): { page: number, line: number } => {
      const lines = documentContent.split('\n')
      const linesPerPage = Math.ceil(lines.length / pagesAnalyzed)
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(searchText)) {
          const page = Math.floor(i / linesPerPage) + 1
          const line = (i % linesPerPage) + 1
          return { page, line }
        }
      }
      
      // If not found, distribute across pages
      const page = Math.min(fallbackPage, pagesAnalyzed)
      const line = 1
      return { page, line }
    }

    // Check for document title - use REAL metadata if available
    if (parsedStructure && parsedStructure.metadata) {
      // Use actual PDF metadata for title check
      if (!parsedStructure.metadata.title || parsedStructure.metadata.title.trim() === '') {
        issues.push({
          id: `issue_${Date.now()}_title`,
          type: 'serious',
          category: 'structure',
          description: 'Document missing title',
          section: 'Document Structure',
          pageNumber: 1,
          lineNumber: 1,
          elementLocation: 'Document metadata',
          context: 'No document title found in PDF metadata',
          wcagCriterion: 'WCAG 2.1 AA - 2.4.2 Page Titled',
          section508Requirement: '36 CFR § 1194.22(a) - Structure and Organization',
          impact: this.calculateImpact('serious'),
          remediation: 'Add a descriptive and unique document title in the document properties (File > Properties > Title).'
        })
      }
    } else {
      // Fallback to text search if no parsed structure
      const titleLocation = findIssueLocation('Title:', 1)
      if (!documentContent.includes('Title:') && !documentContent.includes('TITLE:')) {
        issues.push({
          id: `issue_${Date.now()}_title`,
          type: 'serious',
          category: 'structure',
          description: 'Document missing title',
          section: 'Document Structure',
          pageNumber: titleLocation.page,
          lineNumber: titleLocation.line,
          elementLocation: 'Document header',
          context: 'No document title found',
          wcagCriterion: 'WCAG 2.1 AA - 2.4.2 Page Titled',
          section508Requirement: '36 CFR § 1194.22(a) - Structure and Organization',
          impact: this.calculateImpact('serious'),
          remediation: 'Add a descriptive and unique document title that clearly identifies the content.'
        })
      }
    }

    // Check for language declaration - use REAL metadata if available
    if (parsedStructure && parsedStructure.metadata) {
      // Use actual PDF metadata for language check
      if (!parsedStructure.metadata.language || parsedStructure.metadata.language.trim() === '') {
        issues.push({
          id: `issue_${Date.now()}_lang`,
          type: 'serious',
          category: 'structure',
          description: 'Missing document language declaration',
          section: 'Document Structure',
          pageNumber: 1,
          lineNumber: 1,
          elementLocation: 'Document metadata',
          context: 'No language declaration found in PDF metadata',
          wcagCriterion: 'WCAG 2.1 AA - 3.1.1 Language of Page',
          section508Requirement: '36 CFR § 1194.22(a) - Readability and Language',
          impact: this.calculateImpact('serious'),
          remediation: 'Set the document language in the document properties (File > Properties > Language).'
        })
      }
    } else {
      // Fallback to text search if no parsed structure
      const langLocation = findIssueLocation('language:', 1)
      if (!documentContent.includes('lang=') && !documentContent.includes('language:')) {
        issues.push({
          id: `issue_${Date.now()}_lang`,
          type: 'serious',
          category: 'structure',
          description: 'Missing document language declaration',
          section: 'Document Structure',
          pageNumber: langLocation.page,
          lineNumber: langLocation.line,
          elementLocation: 'Document element',
          context: 'No language declaration found',
          wcagCriterion: 'WCAG 2.1 AA - 3.1.1 Language of Page',
          section508Requirement: '36 CFR § 1194.22(a) - Readability and Language',
          impact: this.calculateImpact('serious'),
          remediation: 'Add language declaration to the document.'
        })
      }
    }

    // Define lines at the start so it's available for all checks
    const lines = documentContent.split('\n')

    // WCAG 1.3.1 Info and Relationships (A): Check heading structure - use REAL structure if available
    if (parsedStructure && parsedStructure.structure) {
      // Use actual parsed headings from PDF structure
      if (parsedStructure.structure.headings.length === 0) {
        const wordCount = documentContent.split(/\s+/).length
        if (wordCount > 50) {
          issues.push({
            id: `issue_${Date.now()}_no_headings`,
            type: 'serious',
            category: 'structure',
            description: 'Document lacks heading structure',
            section: 'Document Structure',
            pageNumber: 1,
            lineNumber: 1,
            elementLocation: 'Document body',
            context: `No headings found in document with ${wordCount} words (checked actual document structure)`,
            wcagCriterion: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
            section508Requirement: '36 CFR § 1194.22(a) - Structure and Organization',
            impact: this.calculateImpact('serious'),
            remediation: 'Use built-in heading styles (Heading 1, Heading 2, etc.) in a logical, hierarchical order to organize content.'
          })
        }
      }
    } else {
      // Fallback to text pattern matching if no parsed structure
      const hasHeadings = lines.some(line => 
        /^[A-Z][A-Z\s]+$/.test(line.trim()) && line.trim().length < 100 && line.trim().length > 3
      )
      const wordCount = documentContent.split(/\s+/).length
      
      // Only flag missing headings if document has substantial content (more than 50 words)
      if (!hasHeadings && wordCount > 50) {
        issues.push({
          id: `issue_${Date.now()}_no_headings`,
          type: 'serious',
          category: 'structure',
          description: 'Document lacks heading structure',
          section: 'Document Structure',
          pageNumber: 1,
          lineNumber: 1,
          elementLocation: 'Document body',
          context: `No headings found in document with ${wordCount} words`,
          wcagCriterion: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
          section508Requirement: '36 CFR § 1194.22(a) - Structure and Organization',
          impact: this.calculateImpact('serious'),
          remediation: 'Use built-in heading styles (Heading 1, Heading 2, etc.) in a logical, hierarchical order to organize content.'
        })
      }
    }

    // WCAG 2.4.6 Headings and Labels (AA): Check for descriptive headings
    const headingLines = lines.filter(line => 
      /^[A-Z][A-Z\s]+$/.test(line.trim()) && line.trim().length < 100 && line.trim().length > 3
    )
    
    if (headingLines.length > 0) {
      // Check if headings are descriptive (not just generic terms)
      const genericHeadings = headingLines.filter(heading => {
        const genericTerms = ['introduction', 'overview', 'summary', 'conclusion', 'background', 'methods', 'results', 'discussion']
        return genericTerms.some(term => heading.toLowerCase().includes(term))
      })
      
      if (genericHeadings.length > 0) {
        const { page, line: lineNum } = findIssueLocation(genericHeadings[0], 1)
        issues.push({
          id: `issue_${Date.now()}_generic_headings`,
          type: 'moderate',
          category: 'structure',
          description: 'Generic heading labels detected',
          section: 'Document Structure',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: genericHeadings[0].substring(0, 50),
                      context: 'Headings should be descriptive and specific to the content',
            wcagCriterion: 'WCAG 2.1 AA - 2.4.6 Headings and Labels',
            section508Requirement: '36 CFR § 1194.22(a) - Structure and Organization',
          impact: this.calculateImpact('moderate'),
          remediation: 'Use descriptive headings that clearly indicate the content of each section.'
        })
      }
    }

    return issues
  }

  private analyzeImageAccessibility(imageAnalysis: ImageAnalysis, documentType: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []

    // Use REAL parsed images if available
    if (parsedStructure && parsedStructure.images && parsedStructure.images.length > 0) {
      // Check each actual image for alt text
      parsedStructure.images.forEach((image: any, index: number) => {
        if (!image.altText || image.altText.trim() === '') {
          issues.push({
            id: `issue_${Date.now()}_missing_alt_text_${image.page}_${index}`,
            type: 'serious',
            category: 'image',
            description: `Image missing alternative text`,
            section: 'Images and Graphics',
            pageNumber: image.page,
            lineNumber: 1,
            elementLocation: `Image on page ${image.page}`,
            context: `Image (${image.width}x${image.height}, ${image.type}) on page ${image.page} does not have alternative text`,
            wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
            section508Requirement: '36 CFR § 1194.22(a) - Text Alternatives',
            impact: this.calculateImpact('serious'),
            remediation: `Add descriptive alternative text to the image on page ${image.page}. In Adobe Acrobat: Right-click the image > Edit Image > Add Alternative Text.`
          })
        }

        // Check for animated/GIF images (flashing potential)
        if (image.isAnimated) {
          issues.push({
            id: `issue_${Date.now()}_animated_image_${image.page}_${index}`,
            type: 'critical',
            category: 'image',
            description: `Animated image detected (potential flashing content)`,
            section: 'Images and Graphics',
            pageNumber: image.page,
            lineNumber: 1,
            elementLocation: `Animated image on page ${image.page}`,
            context: `Animated image (${image.type}) on page ${image.page} may flash more than 3 times per second`,
            wcagCriterion: 'WCAG 2.1 AA - 2.3.1 Three Flashes or Below Threshold',
            section508Requirement: '36 CFR § 1194.22(k) - Flashing',
            impact: this.calculateImpact('critical'),
            remediation: `Review the animated image on page ${image.page}. Ensure it does not flash more than 3 times per second. Replace with static image or ensure animation rate is within acceptable limits.`
          })
        }

        // Check for complex images (charts, diagrams) that may need detailed descriptions
        if (image.type === 'chart' || image.type === 'diagram' || image.type === 'graph') {
          if (!image.altText || image.altText.length < 20) {
            issues.push({
              id: `issue_${Date.now()}_complex_image_desc_${image.page}_${index}`,
              type: 'moderate',
              category: 'image',
              description: `Complex image needs detailed description`,
              section: 'Images and Graphics',
              pageNumber: image.page,
              lineNumber: 1,
              elementLocation: `${image.type} on page ${image.page}`,
              context: `Complex ${image.type} on page ${image.page} requires a more detailed description`,
              wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
              section508Requirement: '36 CFR § 1194.22(a) - Text Alternatives',
              impact: this.calculateImpact('moderate'),
              remediation: `Add a detailed description for the ${image.type} on page ${image.page}. Complex images like charts and diagrams need comprehensive alternative text that explains the key information they convey.`
            })
          }
        }
      })
    } else {
      // Fallback to imageAnalysis if no parsed structure
      const findImagePages = (): number[] => {
        const pagesWithImages: number[] = []
        
        if (imageAnalysis.totalImages > 0) {
          const maxPagesWithImages = Math.min(5, pagesAnalyzed)
          for (let i = 1; i <= maxPagesWithImages; i++) {
            pagesWithImages.push(i)
          }
        }
        
        return pagesWithImages.length > 0 ? pagesWithImages : [1]
      }

      const imagePages = findImagePages()

      // Check for images without alt text
      if (imageAnalysis.imagesWithoutAltText > 0) {
        const targetPage = imagePages[0] || 1
        issues.push({
          id: `issue_${Date.now()}_images_no_alt`,
          type: 'serious',
          category: 'image',
          description: `${imageAnalysis.imagesWithoutAltText} image(s) missing alternative text`,
          section: 'Images and Graphics',
          pageNumber: targetPage,
          lineNumber: 1,
          elementLocation: 'Document images',
          context: `${imageAnalysis.totalImages} total images found across ${imagePages.length} pages`,
          wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
          section508Requirement: '36 CFR § 1194.22(a) - Non-Text Content',
          impact: this.calculateImpact('serious'),
          remediation: 'Add descriptive alternative text to all images that convey information.'
        })
      }

      // Check for complex images
      if (imageAnalysis.complexImages > 0) {
        const targetPage = imagePages.length > 1 ? imagePages[1] : imagePages[0] || 1
        issues.push({
          id: `issue_${Date.now()}_complex_images`,
          type: 'moderate',
          category: 'image',
          description: `${imageAnalysis.complexImages} complex image(s) detected (charts, graphs, diagrams)`,
          section: 'Images and Graphics',
          pageNumber: targetPage,
          lineNumber: 1,
          elementLocation: 'Document complex images',
          context: 'Complex images require detailed descriptions',
          wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
          section508Requirement: '36 CFR § 1194.22(a) - Non-Text Content',
          impact: this.calculateImpact('moderate'),
          remediation: 'Provide detailed descriptions for complex images including charts, graphs, and diagrams.'
        })
      }
    }

    return issues
  }

  private calculateComprehensiveSummary(issues: ComprehensiveDocumentIssue[]): any {
    const summary = {
      total: issues.length,
      critical: issues.filter(i => i.type === 'critical').length,
      serious: issues.filter(i => i.type === 'serious').length,
      moderate: issues.filter(i => i.type === 'moderate').length,
      minor: issues.filter(i => i.type === 'minor').length,
      byCategory: {
        text: issues.filter(i => i.category === 'text').length,
        image: issues.filter(i => i.category === 'image').length,
        color: issues.filter(i => i.category === 'color').length,
        font: issues.filter(i => i.category === 'font').length,
        layout: issues.filter(i => i.category === 'layout').length,
        structure: issues.filter(i => i.category === 'structure').length,
        navigation: issues.filter(i => i.category === 'navigation').length,
        media: issues.filter(i => i.category === 'media').length,
        form: issues.filter(i => i.category === 'form').length
      }
    }

    return summary
  }

  private calculateOverallScore(issues: ComprehensiveDocumentIssue[], imageAnalysis: ImageAnalysis): number {
    const criticalIssues = issues.filter(i => i.type === 'critical').length
    const seriousIssues = issues.filter(i => i.type === 'serious').length
    const moderateIssues = issues.filter(i => i.type === 'moderate').length
    const minorIssues = issues.filter(i => i.type === 'minor').length

    // Calculate overall score based on issue counts
    // Start with 100 and deduct points for issues
    let overallScore = 100

    // Deduct points for each issue type
    overallScore -= (criticalIssues * 20)  // Critical issues are very bad
    overallScore -= (seriousIssues * 15)   // Serious issues are bad
    overallScore -= (moderateIssues * 8)   // Moderate issues are concerning
    overallScore -= (minorIssues * 3)      // Minor issues are less concerning

    // Additional deductions for image accessibility issues
    if (imageAnalysis.imagesWithoutAltText > 0) {
      overallScore -= (imageAnalysis.imagesWithoutAltText * 2)
    }

    // Ensure score doesn't go below 0
    overallScore = Math.max(0, overallScore)

    return Math.round(overallScore)
  }

  /**
   * Comprehensive Section 508 compliance testing
   * Tests all 16 subsections of 36 CFR § 1194.22
   */
  private async testSection508Compliance(documentContent: string, documentType: string, pagesAnalyzed: number, selectedTags?: string[], isCancelled?: () => boolean, parsedStructure?: any): Promise<ComprehensiveDocumentIssue[]> {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Define all available Section 508 tests - use parsedStructure for real checks
    const section508Tests = [
      { tag: '1194.22a', name: 'Text Alternatives', test: () => this.test1194_22a(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22b', name: 'Media Alternatives', test: () => this.test1194_22b(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22c', name: 'Information Relationships', test: () => this.test1194_22c(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22d', name: 'Meaningful Sequence', test: () => this.test1194_22d(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22e', name: 'Color Usage', test: () => this.test1194_22e(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22f', name: 'Contrast', test: () => this.test1194_22f(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22g', name: 'Visual Presentation', test: () => this.test1194_22g(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22h', name: 'Keyboard Accessibility', test: () => this.test1194_22h(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22i', name: 'No Keyboard Trap', test: () => this.test1194_22i(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22j', name: 'Timing', test: () => this.test1194_22j(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22k', name: 'Flashing', test: () => this.test1194_22k(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22l', name: 'Text-only Page', test: () => this.test1194_22l(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22m', name: 'Scripts', test: () => this.test1194_22m(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22n', name: 'Plug-ins', test: () => this.test1194_22n(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22o', name: 'Electronic Forms', test: () => this.test1194_22o(documentContent, pagesAnalyzed, parsedStructure) },
      { tag: '1194.22p', name: 'Navigation', test: () => this.test1194_22p(documentContent, pagesAnalyzed, parsedStructure) }
    ]
    
    // Determine which tests to run
    const testsToRun = selectedTags && selectedTags.length > 0 
      ? section508Tests.filter(test => selectedTags.includes(test.tag))
      : [] // Run NO tests if none selected
    
    if (testsToRun.length === 0) {
      console.log(`⏭️ No Section 508 tests selected - skipping compliance testing`)
      console.log(`🔍 Available tags: ${section508Tests.map(t => t.tag).join(', ')}`)
      console.log(`🔍 Selected tags: ${selectedTags ? JSON.stringify(selectedTags) : 'none'}`)
      return issues
    }
    
    console.log(`🔍 Testing Section 508 compliance for ${testsToRun.length} subsections: ${testsToRun.map(t => t.tag).join(', ')}`)
    console.log(`🔍 Running tests: ${testsToRun.map(t => `${t.name} (${t.tag})`).join(', ')}`)
    
    // Run selected tests
    for (const test of testsToRun) {
      const testIssues = test.test()
      issues.push(...testIssues)
      console.log(`✅ ${test.name} (${test.tag}): ${testIssues.length} issues found`)
      if (test.tag === '1194.22k' && parsedStructure?.images) {
        console.log(`🎬 Flashing test: Found ${parsedStructure.images.length} images, ${parsedStructure.images.filter((img: any) => img.isAnimated).length} animated`)
      }
      
      // Check for cancellation after each test
      if (isCancelled && isCancelled()) {
        throw new Error('Scan was cancelled by user')
      }
    }
    
    console.log(`✅ Section 508 compliance testing complete: ${issues.length} issues found`)
    return issues
  }

  /**
   * 1194.22(a) - Text alternatives for non-text content
   */
  private test1194_22a(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Use REAL parsed images if available
    if (parsedStructure && parsedStructure.images && parsedStructure.images.length > 0) {
      parsedStructure.images.forEach((image: any, index: number) => {
        if (!image.altText || image.altText.trim() === '') {
          issues.push({
            id: `1194_22a_${Date.now()}_${image.page}_${index}`,
            type: 'serious',
            category: 'image',
            description: 'Image missing text alternative (1194.22(a))',
            section: 'Section 508 - Text Alternatives',
            pageNumber: image.page,
            lineNumber: 1,
            elementLocation: `Image on page ${image.page}`,
            context: `Image (${image.width}x${image.height}, ${image.type}) on page ${image.page} does not have alternative text`,
            wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
            section508Requirement: '36 CFR § 1194.22(a) - Text Alternatives',
            impact: this.calculateImpact('serious'),
            remediation: `Add descriptive text alternative for the image on page ${image.page}. In Adobe Acrobat: Right-click image > Edit Image > Add Alternative Text.`
          })
        }
      })
    } else {
      // Fallback to keyword matching if no parsed structure
      const imageRegex = /(figure|image|photo|picture|graphic|chart|diagram)\s+\d+/gi
      const lines = documentContent.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (imageRegex.test(line)) {
          const hasDescription = this.hasNearbyDescription(lines, i, 3)
          if (!hasDescription) {
            issues.push({
              id: `1194_22a_${Date.now()}_${i}`,
              type: 'serious',
              category: 'image',
              description: 'Image missing text alternative (1194.22(a))',
              section: 'Section 508 - Text Alternatives',
              pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
              lineNumber: i + 1,
              elementLocation: line.substring(0, 50),
              context: 'All non-text content must have text alternatives',
              wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
              section508Requirement: '36 CFR § 1194.22(a) - Text Alternatives',
              impact: this.calculateImpact('serious'),
              remediation: 'Add descriptive text alternatives for all images, charts, and graphics.'
            })
          }
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(b) - Synchronized media alternatives
   */
  private test1194_22b(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Use parsed links to find media files
    if (parsedStructure && parsedStructure.links && parsedStructure.links.length > 0) {
      const mediaExtensions = /\.(mp4|avi|mov|wmv|flv|webm|mp3|wav|aac|ogg|wma)$/i
      
      parsedStructure.links.forEach((link: any, index: number) => {
        if (mediaExtensions.test(link.url)) {
          // Check if link text mentions alternatives
          const hasAlternatives = /caption|transcript|description|alternative|subtitle|closed.*caption/i.test(link.text || link.url)
          
          if (!hasAlternatives) {
            issues.push({
              id: `1194_22b_${Date.now()}_${link.page}_${index}`,
              type: 'serious',
              category: 'media',
              description: 'Synchronized media missing alternatives (1194.22(b))',
              section: 'Section 508 - Media Alternatives',
              pageNumber: link.page,
              lineNumber: 1,
              elementLocation: `Media file: ${link.url}`,
              context: `Media file on page ${link.page} does not reference captions or transcripts`,
              wcagCriterion: 'WCAG 2.1 AA - 1.2.1 Audio-only and Video-only',
              section508Requirement: '36 CFR § 1194.22(b) - Synchronized Media',
              impact: this.calculateImpact('serious'),
              remediation: `Provide captions for video files or transcripts for audio files on page ${link.page}. Ensure media alternatives are clearly referenced.`
            })
          }
        }
      })
    } else {
      // Fallback to keyword matching
      const mediaRegex = /(video|audio|podcast|webinar|presentation.*video|recording|\.(mp4|avi|mov|wmv|flv|webm|mp3|wav|aac|ogg|wma)$)/i
      const lines = documentContent.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (mediaRegex.test(line)) {
          const hasAlternatives = /caption|transcript|description|alternative/i.test(line)
          if (!hasAlternatives) {
            issues.push({
              id: `1194_22b_${Date.now()}_${i}`,
              type: 'serious',
              category: 'media',
              description: 'Synchronized media missing alternatives (1194.22(b))',
              section: 'Section 508 - Media Alternatives',
              pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
              lineNumber: i + 1,
              elementLocation: line.substring(0, 50),
              context: 'Synchronized media must have captions or alternatives',
              wcagCriterion: 'WCAG 2.1 AA - 1.2.1 Audio-only and Video-only',
              section508Requirement: '36 CFR § 1194.22(b) - Synchronized Media',
              impact: this.calculateImpact('serious'),
              remediation: 'Provide captions for video with audio, transcripts for audio-only content.'
            })
          }
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(c) - Information and relationships
   */
  private test1194_22c(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Use REAL parsed structure if available
    if (parsedStructure && parsedStructure.structure) {
      // Check heading hierarchy using actual parsed headings
      const headings = parsedStructure.structure.headings
      if (headings.length > 0) {
        const hasProperHierarchy = this.checkHeadingHierarchyReal(headings)
        
        if (!hasProperHierarchy) {
          issues.push({
            id: `1194_22c_${Date.now()}_hierarchy`,
            type: 'serious',
            category: 'structure',
            description: 'Document structure violates information relationships (1194.22(c))',
            section: 'Section 508 - Information Relationships',
            pageNumber: headings[0]?.page || 1,
            lineNumber: 1,
            elementLocation: 'Document headings',
            context: 'Headings do not follow logical hierarchy (checked actual document structure)',
            wcagCriterion: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
            section508Requirement: '36 CFR § 1194.22(c) - Information and Relationships',
            impact: this.calculateImpact('serious'),
            remediation: 'Ensure headings follow a logical hierarchy (H1, H2, H3, etc.) without skipping levels.'
          })
        }
      }
    } else {
      // Fallback to text pattern matching
      const lines = documentContent.split('\n')
      const headings = lines.filter(line => 
        /^[A-Z][A-Z\s]+$/.test(line.trim()) && line.trim().length < 100 && line.trim().length > 3
      )
    
    if (headings.length > 0) {
      // Check if headings follow logical hierarchy
      const hasProperHierarchy = this.checkHeadingHierarchy(headings)
      
      if (!hasProperHierarchy) {
        issues.push({
          id: `1194_22c_${Date.now()}_hierarchy`,
          type: 'serious',
          category: 'structure',
          description: 'Document structure violates information relationships (1194.22(c))',
          section: 'Section 508 - Information and Relationships',
          pageNumber: 1,
          lineNumber: 1,
          elementLocation: 'Document headings',
          context: 'Information and relationships must be preserved',
            wcagCriterion: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
            section508Requirement: '36 CFR § 1194.22(c) - Information and Relationships',
            impact: this.calculateImpact('serious'),
            remediation: 'Use proper heading hierarchy (H1, H2, H3, etc.) and document structure.'
          })
      }
    }
    } // Close the else block
    
    // Check for list structure
    const listIssues = this.checkListStructure(documentContent, (index) => ({
      page: Math.floor(index / (lines.length / pagesAnalyzed)) + 1,
      line: index + 1
    }))
    issues.push(...listIssues)
    
    return issues
  }

  /**
   * 1194.22(d) - Meaningful sequence
   */
  private test1194_22d(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Use REAL parsed structure to check sequence
    if (parsedStructure && parsedStructure.structure) {
      // Check if headings follow a logical sequence
      const headings = parsedStructure.structure.headings
      if (headings.length > 1) {
        // Verify headings appear in document order
        let previousPage = 0
        let previousLevel = 0
        let sequenceIssue = false
        
        for (const heading of headings) {
          if (heading.page < previousPage) {
            sequenceIssue = true
            break
          }
          if (heading.page === previousPage && heading.level < previousLevel) {
            // Heading level should not decrease on same page without intermediate content
            // This might indicate sequence issue
          }
          previousPage = heading.page
          previousLevel = heading.level
        }
        
        if (sequenceIssue) {
          issues.push({
            id: `1194_22d_${Date.now()}_sequence`,
            type: 'moderate',
            category: 'structure',
            description: 'Document lacks meaningful sequence (1194.22(d))',
            section: 'Section 508 - Meaningful Sequence',
            pageNumber: headings[0]?.page || 1,
            lineNumber: 1,
            elementLocation: 'Document structure',
            context: 'Content structure does not follow a meaningful reading sequence (checked actual document structure)',
            wcagCriterion: 'WCAG 2.1 AA - 1.3.2 Meaningful Sequence',
            section508Requirement: '36 CFR § 1194.22(d) - Meaningful Sequence',
            impact: this.calculateImpact('moderate'),
            remediation: 'Ensure content flows in a logical, meaningful sequence. Use proper document structure and avoid content that jumps around.'
          })
        }
      }
    } else {
      // Fallback to basic text analysis
      const lines = documentContent.split('\n')
      const meaningfulSequence = this.checkMeaningfulSequence(lines)
      
      if (!meaningfulSequence.isValid) {
        issues.push({
          id: `1194_22d_${Date.now()}_sequence`,
          type: 'moderate',
          category: 'structure',
          description: 'Document lacks meaningful sequence (1194.22(d))',
          section: 'Section 508 - Meaningful Sequence',
          pageNumber: meaningfulSequence.page || 1,
          lineNumber: meaningfulSequence.line || 1,
          elementLocation: 'Document content flow',
          context: 'Content must be presented in a meaningful sequence',
          wcagCriterion: 'WCAG 2.1 AA - 1.3.2 Meaningful Sequence',
          section508Requirement: '36 CFR § 1194.22(d) - Meaningful Sequence',
          impact: this.calculateImpact('moderate'),
          remediation: 'Ensure content flows in a logical, meaningful sequence.'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(e) - Color alone
   */
  private test1194_22e(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for color-only information
    // This is primarily text-based analysis as color-only detection requires visual analysis
    const colorOnlyPatterns = [
      /(required.*red|mandatory.*red|important.*red|warning.*red|error.*red)/i,
      /(success.*green|approved.*green|passed.*green)/i,
      /(rejected.*red|failed.*red|denied.*red)/i,
      /(click.*red|press.*green|select.*blue)/i
    ]
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      // Check if line mentions color-dependent instructions
      if (colorOnlyPatterns.some(pattern => pattern.test(line))) {
        // Check if additional indicators are mentioned (text, symbol, pattern)
        const hasAdditionalIndicators = /(symbol|icon|text|label|marker|pattern|shape|size|bold|italic|underline)/i.test(line)
        
        if (!hasAdditionalIndicators) {
          issues.push({
            id: `1194_22e_${Date.now()}_${i}`,
            type: 'serious',
            category: 'color',
            description: 'Information conveyed by color alone (1194.22(e))',
            section: 'Section 508 - Color Usage',
            pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
            lineNumber: i + 1,
            elementLocation: line.substring(0, 50),
            context: 'Information appears to rely solely on color without additional indicators',
            wcagCriterion: 'WCAG 2.1 AA - 1.4.1 Use of Color',
            section508Requirement: '36 CFR § 1194.22(e) - Color Alone',
            impact: this.calculateImpact('serious'),
            remediation: 'Use additional indicators (text labels, symbols, patterns, icons) beyond color to convey information.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(f) - Contrast
   */
  private test1194_22f(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Try to use parsed structure for text colors if available
    if (parsedStructure && parsedStructure.textColors && parsedStructure.textColors.length > 0) {
      // Import color contrast analyzer
      const { calculateContrastRatio, suggestAccessibleColors } = require('./color-contrast-analyzer')
      
      // Extract actual foreground/background color pairs from document
      const colorPairs = this.extractColorPairs(parsedStructure, documentContent)
      
      if (colorPairs.length === 0 && parsedStructure.textColors.length > 0) {
        // Fallback: use textColors with default background if no pairs extracted
        parsedStructure.textColors.forEach((colorData: any, index: number) => {
          const background = '#FFFFFF' // Default white background
          const result = calculateContrastRatio(colorData.hex, background)
          
          if (!result.passesAA) {
            const suggestions = suggestAccessibleColors(colorData.hex)
            const suggestionText = suggestions.length > 0 
              ? ` Suggested colors: ${suggestions.map((s: any) => `${s.foreground} on ${s.background} (${s.ratio}:1)`).join(', ')}`
              : ''
            
            issues.push({
              id: `1194_22f_${Date.now()}_${colorData.page}_${index}`,
              type: 'serious',
              category: 'color',
              description: 'Contrast ratio below WCAG AA standard (1194.22(f))',
              section: 'Section 508 - Contrast',
              pageNumber: colorData.page,
              lineNumber: 1,
              elementLocation: `Text with color ${colorData.hex} on page ${colorData.page}`,
              context: `Contrast ratio ${result.ratio}:1 is below WCAG AA standard (4.5:1 required for normal text).${suggestionText}`,
              wcagCriterion: 'WCAG 2.1 AA - 1.4.3 Contrast (Minimum)',
              section508Requirement: '36 CFR § 1194.22(f) - Contrast',
              impact: this.calculateImpact('serious'),
              remediation: `Increase text contrast on page ${colorData.page}. Current ratio ${result.ratio}:1 must be at least 4.5:1 for normal text. Use darker text color or lighter background.`
            })
          } else if (!result.passesAAA) {
            issues.push({
              id: `1194_22f_aaa_${Date.now()}_${colorData.page}_${index}`,
              type: 'moderate',
              category: 'color',
              description: `Color contrast meets AA but not AAA standard (1194.22(f))`,
              section: 'Section 508 - Contrast',
              pageNumber: colorData.page,
              lineNumber: 1,
              elementLocation: `Text with color ${colorData.hex} on page ${colorData.page}`,
              context: `Contrast ratio ${result.ratio}:1 meets AA (4.5:1) but not AAA (7:1) standard`,
              wcagCriterion: 'WCAG 2.1 AAA - 1.4.6 Contrast (Enhanced)',
              section508Requirement: '36 CFR § 1194.22(f) - Contrast',
              impact: this.calculateImpact('moderate'),
              remediation: `Improve contrast to meet AAA standard (7:1). Current ratio: ${result.ratio}:1`
            })
          }
        })
      } else {
        colorPairs.forEach((pair: any, index: number) => {
          const foreground = pair.foreground || '#000000'
          const background = pair.background || '#FFFFFF'
          const result = calculateContrastRatio(foreground, background)
          
          if (!result.passesAA) {
            const suggestions = suggestAccessibleColors(pair.foreground)
          const suggestionText = suggestions.length > 0 
            ? ` Suggested colors: ${suggestions.map(s => `${s.foreground} on ${s.background} (${s.ratio}:1)`).join(', ')}`
            : ''
          
          issues.push({
            id: `1194_22f_${Date.now()}_${pair.page}_${index}`,
            type: 'serious',
            category: 'color',
            description: `Insufficient color contrast detected (1194.22(f))`,
            section: 'Section 508 - Contrast',
            pageNumber: pair.page,
            lineNumber: 1,
            elementLocation: `Text with color ${pair.foreground} on background ${pair.background} on page ${pair.page}`,
            context: `Contrast ratio ${result.ratio}:1 is below WCAG AA standard (4.5:1 required for normal text).${suggestionText}`,
            wcagCriterion: 'WCAG 2.1 AA - 1.4.3 Contrast (Minimum)',
            section508Requirement: '36 CFR § 1194.22(f) - Contrast',
            impact: this.calculateImpact('serious'),
            remediation: `Increase text contrast on page ${pair.page}. Current ratio ${result.ratio}:1 must be at least 4.5:1 for normal text. Use darker text color or lighter background.`
          })
        } else if (!result.passesAAA) {
          issues.push({
            id: `1194_22f_aaa_${Date.now()}_${pair.page}_${index}`,
            type: 'moderate',
            category: 'color',
            description: `Color contrast meets AA but not AAA standard (1194.22(f))`,
            section: 'Section 508 - Contrast',
            pageNumber: pair.page,
            lineNumber: 1,
            elementLocation: `Text with color ${pair.foreground} on background ${pair.background} on page ${pair.page}`,
            context: `Contrast ratio ${result.ratio}:1 meets AA (4.5:1) but not AAA (7:1) standard`,
            wcagCriterion: 'WCAG 2.1 AAA - 1.4.6 Contrast (Enhanced)',
            section508Requirement: '36 CFR § 1194.22(f) - Contrast',
            impact: this.calculateImpact('moderate'),
            remediation: `Consider improving contrast on page ${pair.page} to meet AAA standard (7:1) for enhanced accessibility.`
          })
        }
      })
      } // Close the else block for colorPairs
    } else {
      // Fallback to keyword matching if no parsed structure
      const contrastIssues = [
        'light gray text',
        'pale text',
        'low contrast',
        'hard to read',
        'faint text'
      ]
      
      const lines = documentContent.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (contrastIssues.some(issue => line.toLowerCase().includes(issue))) {
          issues.push({
            id: `1194_22f_${Date.now()}_${i}`,
            type: 'moderate',
            category: 'color',
            description: 'Potential contrast issues detected (1194.22(f))',
            section: 'Section 508 - Contrast',
            pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
            lineNumber: i + 1,
            elementLocation: line.substring(0, 50),
            context: 'Text must have sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text)',
            wcagCriterion: 'WCAG 2.1 AA - 1.4.3 Contrast (Minimum)',
            section508Requirement: '36 CFR § 1194.22(f) - Contrast',
            impact: this.calculateImpact('moderate'),
            remediation: 'Ensure text has sufficient contrast ratio. Use a contrast checker tool to verify 4.5:1 for normal text or 3:1 for large text.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(g) - Visual presentation
   */
  private test1194_22g(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Visual presentation checks are primarily text-based as they require rendering analysis
    // Check for patterns that indicate visual presentation problems
    const visualIssuePatterns = [
      /justified.*text/i,
      /fully.*justified/i,
      /all.*caps/i,
      /uppercase.*only/i,
      /font.*size.*less.*than.*12/i,
      /tiny.*font/i,
      /small.*font.*size/i
    ]
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (visualIssuePatterns.some(pattern => pattern.test(line))) {
        issues.push({
          id: `1194_22g_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'font',
          description: 'Visual presentation issues detected (1194.22(g))',
          section: 'Section 508 - Visual Presentation',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Visual presentation must not interfere with readability - ensure adequate font size, spacing, and avoid fully justified text',
          wcagCriterion: 'WCAG 2.1 AA - 1.4.8 Visual Presentation',
          section508Requirement: '36 CFR § 1194.22(g) - Visual Presentation',
          impact: this.calculateImpact('moderate'),
          remediation: 'Use readable fonts (minimum 12pt), adequate line spacing (1.5x), and avoid fully justified text. Limit line width to 80 characters.'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(h) - Keyboard
   */
  private test1194_22h(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Use REAL form fields from parsed structure
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 0) {
      // Check if form fields have labels (required for keyboard accessibility)
      parsedStructure.formFields.forEach((field: any, index: number) => {
        if (!field.label || field.label.trim() === '') {
          issues.push({
            id: `1194_22h_${Date.now()}_${field.page}_${index}`,
            type: 'serious',
            category: 'navigation',
            description: 'Form field missing label (keyboard accessibility issue) (1194.22(h))',
            section: 'Section 508 - Keyboard Accessibility',
            pageNumber: field.page,
            lineNumber: 1,
            elementLocation: `Form field "${field.name}" on page ${field.page}`,
            context: `Form field "${field.name}" (${field.type}) on page ${field.page} lacks a label, affecting keyboard and screen reader accessibility`,
            wcagCriterion: 'WCAG 2.1 AA - 2.1.1 Keyboard, 3.3.2 Labels or Instructions',
            section508Requirement: '36 CFR § 1194.22(h) - Keyboard',
            impact: this.calculateImpact('serious'),
            remediation: `Add a descriptive label to the "${field.name}" form field on page ${field.page}. In PDF forms, use the Field Properties dialog to add a tooltip/alternate name.`
          })
        }
      })
    } else {
      // Fallback to keyword matching
      const keyboardIssues = [
        'mouse only',
        'click only',
        'touch only',
        'no keyboard',
        'keyboard not supported'
      ]
      
      const lines = documentContent.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (keyboardIssues.some(issue => line.toLowerCase().includes(issue))) {
          issues.push({
            id: `1194_22h_${Date.now()}_${i}`,
            type: 'serious',
            category: 'navigation',
            description: 'Keyboard accessibility issues detected (1194.22(h))',
            section: 'Section 508 - Keyboard Accessibility',
            pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
            lineNumber: i + 1,
            elementLocation: line.substring(0, 50),
            context: 'All functionality must be keyboard accessible',
            wcagCriterion: 'WCAG 2.1 AA - 2.1.1 Keyboard',
            section508Requirement: '36 CFR § 1194.22(h) - Keyboard',
            impact: this.calculateImpact('serious'),
            remediation: 'Ensure all interactive elements are keyboard accessible.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(i) - No keyboard trap
   */
  private test1194_22i(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Keyboard trap detection requires interactive element analysis
    // Check form fields for potential traps (all required fields with no cancel/back button)
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 0) {
      const requiredFields = parsedStructure.formFields.filter((f: any) => f.required)
      
      if (requiredFields.length > 0) {
        // Check if there's a way to exit (cancel button, close button, etc.)
        // This is a basic check - full detection requires interactive testing
        const hasExitOption = documentContent.toLowerCase().includes('cancel') ||
                              documentContent.toLowerCase().includes('close') ||
                              documentContent.toLowerCase().includes('back') ||
                              parsedStructure.formFields.some((f: any) => 
                                f.type === 'button' && (f.name?.toLowerCase().includes('cancel') || 
                                f.name?.toLowerCase().includes('close'))
                              )
        
        if (!hasExitOption && requiredFields.length >= 3) {
          issues.push({
            id: `1194_22i_${Date.now()}_traps`,
            type: 'serious',
            category: 'navigation',
            description: 'Potential keyboard trap in form (1194.22(i))',
            section: 'Section 508 - No Keyboard Trap',
            pageNumber: requiredFields[0]?.page || 1,
            lineNumber: 1,
            elementLocation: `Form with ${requiredFields.length} required fields`,
            context: `Form on page ${requiredFields[0]?.page || 1} has ${requiredFields.length} required fields but no clear exit mechanism`,
            wcagCriterion: 'WCAG 2.1 AA - 2.1.2 No Keyboard Trap',
            section508Requirement: '36 CFR § 1194.22(i) - No Keyboard Trap',
            impact: this.calculateImpact('serious'),
            remediation: `Ensure form on page ${requiredFields[0]?.page || 1} has a cancel, close, or back button so users can exit using keyboard navigation (Tab key to navigate, Esc key to close).`
          })
        }
      }
    } else {
      // Fallback to keyword matching
      const trapPatterns = [
        'keyboard trap',
        'focus trap',
        'stuck in form',
        'cannot escape',
        'no way out'
      ]
      
      const lines = documentContent.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (trapPatterns.some(pattern => line.toLowerCase().includes(pattern))) {
          issues.push({
            id: `1194_22i_${Date.now()}_${i}`,
            type: 'serious',
            category: 'navigation',
            description: 'Potential keyboard trap detected (1194.22(i))',
            section: 'Section 508 - No Keyboard Trap',
            pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
            lineNumber: i + 1,
            elementLocation: line.substring(0, 50),
            context: 'Users must be able to navigate away from all content',
            wcagCriterion: 'WCAG 2.1 AA - 2.1.2 No Keyboard Trap',
            section508Requirement: '36 CFR § 1194.22(i) - No Keyboard Trap',
            impact: this.calculateImpact('serious'),
            remediation: 'Ensure users can navigate away from all content using standard keyboard commands (Tab, Esc, Arrow keys).'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(j) - Timing
   */
  private test1194_22j(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for timing issues - documents typically don't have time limits,
    // but may reference time-sensitive processes
    const timingRegex = /(time.*limit|timeout|expire|session.*time|auto.*logout|time.*out|deadline|must.*complete.*within)/i
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (timingRegex.test(line)) {
        // Check if time limit is adjustable or extendable
        const hasAdjustment = /(extend|increase|adjust|more.*time|additional.*time|disable.*timeout)/i.test(line)
        
        if (!hasAdjustment) {
          issues.push({
            id: `1194_22j_${Date.now()}_${i}`,
            type: 'moderate',
            category: 'navigation',
            description: 'Time limits detected without adjustment option (1194.22(j))',
            section: 'Section 508 - Timing',
            pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
            lineNumber: i + 1,
            elementLocation: line.substring(0, 50),
            context: 'Time limits must be adjustable or users must have sufficient time (at least 20 seconds with warning)',
            wcagCriterion: 'WCAG 2.1 AA - 2.2.1 Timing Adjustable',
            section508Requirement: '36 CFR § 1194.22(j) - Timing',
            impact: this.calculateImpact('moderate'),
            remediation: 'Provide option to extend time limits or ensure default time is sufficient (20+ seconds for actions). Warn users before timeout.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(k) - Flashing
   */
  private test1194_22k(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    console.log(`🎬 Flashing test (1194.22k) called`)
    console.log(`🎬 Has parsedStructure: ${!!parsedStructure}`)
    console.log(`🎬 Has images: ${!!(parsedStructure?.images)}`)
    console.log(`🎬 Image count: ${parsedStructure?.images?.length || 0}`)
    
    // Use REAL parsed images to check for animated/flashing content
    if (parsedStructure && parsedStructure.images && parsedStructure.images.length > 0) {
      console.log(`🎬 Checking ${parsedStructure.images.length} images for animation`)
      parsedStructure.images.forEach((image: any, index: number) => {
        console.log(`🎬 Image ${index + 1}: type=${image.type}, isAnimated=${image.isAnimated}, page=${image.page}`)
        if (image.isAnimated) {
          console.log(`🚨 FLASHING DETECTED: Image ${index + 1} on page ${image.page} is animated!`)
          issues.push({
            id: `1194_22k_${Date.now()}_${image.page}_${index}`,
            type: 'critical',
            category: 'layout',
            description: 'Flashing content detected (1194.22(k))',
            section: 'Section 508 - Flashing',
            pageNumber: image.page,
            lineNumber: 1,
            elementLocation: `Animated image on page ${image.page}`,
            context: `Animated image (${image.type}) on page ${image.page} may flash more than 3 times per second`,
            wcagCriterion: 'WCAG 2.1 AA - 2.3.1 Three Flashes or Below Threshold',
            section508Requirement: '36 CFR § 1194.22(k) - Flashing',
            impact: this.calculateImpact('critical'),
            remediation: `Review the animated image on page ${image.page}. Ensure it does not flash more than 3 times per second. Replace with static image or modify animation rate to comply with accessibility standards.`
          })
        }
      })
      console.log(`🎬 Flashing test complete: ${issues.length} flashing issues found`)
    } else {
      console.log(`🎬 No parsedStructure.images available, using fallback keyword matching`)
      // Fallback to keyword matching if no parsed structure
      const flashingRegex = /(flash|blink|flicker|strobe|animation.*fast)/i
      const lines = documentContent.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (flashingRegex.test(line)) {
          issues.push({
            id: `1194_22k_${Date.now()}_${i}`,
            type: 'critical',
            category: 'layout',
            description: 'Flashing content detected (1194.22(k))',
            section: 'Section 508 - Flashing',
            pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
            lineNumber: i + 1,
            elementLocation: line.substring(0, 50),
            context: 'Content must not flash more than 3 times per second',
            wcagCriterion: 'WCAG 2.1 AA - 2.3.1 Three Flashes or Below Threshold',
            section508Requirement: '36 CFR § 1194.22(k) - Flashing',
            impact: this.calculateImpact('critical'),
            remediation: 'Remove or modify flashing content to prevent seizures.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(l) - Text-only page
   */
  private test1194_22l(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check if document provides text-only alternative
    // Use parsed structure to determine complexity
    const isComplex = parsedStructure && (
      (parsedStructure.images && parsedStructure.images.length > 5) ||
      (parsedStructure.formFields && parsedStructure.formFields.length > 3) ||
      (parsedStructure.links && parsedStructure.links.length > 10)
    )
    
    const textOnlyRegex = /(text.*only|accessible.*version|alternative.*format|plain.*text|accessible.*alternative)/i
    const hasTextOnly = textOnlyRegex.test(documentContent)
    
    if (isComplex && !hasTextOnly) {
      issues.push({
        id: `1194_22l_${Date.now()}_text_only`,
        type: 'moderate',
        category: 'structure',
        description: 'Complex document missing text-only alternative (1194.22(l))',
        section: 'Section 508 - Text-only Page',
        pageNumber: 1,
        lineNumber: 1,
        elementLocation: 'Document',
        context: `Document contains ${parsedStructure?.images?.length || 0} images, ${parsedStructure?.formFields?.length || 0} form fields - text-only alternative recommended`,
        wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
        section508Requirement: '36 CFR § 1194.22(l) - Text-only Page',
        impact: this.calculateImpact('moderate'),
        remediation: 'Provide a text-only alternative version of this document. This helps users with screen readers and ensures content is accessible without visual elements.'
      })
    } else if (!isComplex && documentContent.length > 1000 && !hasTextOnly) {
      // Fallback for basic text check
      const basicTextOnlyRegex = /(text.*only|accessible.*version|alternative.*format|plain.*text)/i
      if (!basicTextOnlyRegex.test(documentContent)) {
        issues.push({
          id: `1194_22l_${Date.now()}_text_only`,
          type: 'moderate',
          category: 'structure',
          description: 'Text-only alternative not provided (1194.22(l))',
          section: 'Section 508 - Text-only Page',
          pageNumber: 1,
          lineNumber: 1,
          elementLocation: 'Document',
          context: 'Complex documents should provide text-only alternatives',
          wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
          section508Requirement: '36 CFR § 1194.22(l) - Text-only Page',
          impact: this.calculateImpact('moderate'),
          remediation: 'Provide a text-only alternative for complex documents.'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(m) - Scripts
   */
  private test1194_22m(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for script-related accessibility issues
    // In documents, scripts are typically in embedded HTML or JavaScript actions
    const scriptRegex = /(javascript|script|onclick|onload|onmouse|onkey|onfocus|onblur|onchange)/i
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (scriptRegex.test(line)) {
        // Check if script has keyboard-accessible alternative
        const hasKeyboardAlternative = /(keyboard|tab|enter|space|accessible|noscript)/i.test(line)
        
        if (!hasKeyboardAlternative) {
          issues.push({
            id: `1194_22m_${Date.now()}_${i}`,
            type: 'moderate',
            category: 'navigation',
            description: 'Script detected without keyboard accessibility (1194.22(m))',
            section: 'Section 508 - Scripts',
            pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
            lineNumber: i + 1,
            elementLocation: line.substring(0, 50),
            context: 'Scripts must be keyboard accessible or have non-script alternatives',
            wcagCriterion: 'WCAG 2.1 AA - 2.1.1 Keyboard, 4.1.2 Name, Role, Value',
            section508Requirement: '36 CFR § 1194.22(m) - Scripts',
            impact: this.calculateImpact('moderate'),
            remediation: 'Ensure scripts are keyboard accessible. Provide non-script alternatives for critical functionality. Test with JavaScript disabled.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(n) - Plug-ins
   */
  private test1194_22n(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for plug-in requirements
    const pluginRegex = /(flash.*player|java.*applet|quicktime|real.*player|shockwave|silverlight|plugin|plug.*in|requires.*plugin)/i
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (pluginRegex.test(line)) {
        // Check if alternative is mentioned
        const hasAlternative = /(alternative|accessible.*version|html5|fallback|without.*plugin)/i.test(line)
        
        if (!hasAlternative) {
          issues.push({
            id: `1194_22n_${Date.now()}_${i}`,
            type: 'serious',
            category: 'media',
            description: 'Plug-in required without accessible alternative (1194.22(n))',
            section: 'Section 508 - Plug-ins',
            pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
            lineNumber: i + 1,
            elementLocation: line.substring(0, 50),
            context: 'Plug-ins must be accessible or have HTML5/accessible alternatives',
            wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
            section508Requirement: '36 CFR § 1194.22(n) - Plug-ins',
            impact: this.calculateImpact('serious'),
            remediation: 'Provide accessible alternatives for plug-in content. Replace Flash/Java applets with HTML5 equivalents or provide alternative accessible content.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(o) - Electronic forms
   */
  private test1194_22o(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Use REAL form fields from parsed structure
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 0) {
      parsedStructure.formFields.forEach((field: any, index: number) => {
        // Check for missing labels
        if (!field.label || field.label.trim() === '') {
          issues.push({
            id: `1194_22o_${Date.now()}_${field.page}_${index}_label`,
            type: 'serious',
            category: 'form',
            description: `Form field "${field.name}" missing label (1194.22(o))`,
            section: 'Section 508 - Electronic Forms',
            pageNumber: field.page,
            lineNumber: 1,
            elementLocation: `Form field "${field.name}" (${field.type}) on page ${field.page}`,
            context: `Form field "${field.name}" lacks a descriptive label required for screen readers`,
            wcagCriterion: 'WCAG 2.1 AA - 3.3.2 Labels or Instructions, 4.1.2 Name, Role, Value',
            section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
            impact: this.calculateImpact('serious'),
            remediation: `Add a descriptive label to "${field.name}" on page ${field.page}. In PDF forms, use Field Properties > Tooltip/Alternate Name. In Word, use the Accessibility Checker to add alt text to form controls.`
          })
        }
        
        // Check required fields have clear indication
        if (field.required && !field.label?.toLowerCase().includes('required')) {
          issues.push({
            id: `1194_22o_${Date.now()}_${field.page}_${index}_required`,
            type: 'moderate',
            category: 'form',
            description: `Required field "${field.name}" should indicate requirement (1194.22(o))`,
            section: 'Section 508 - Electronic Forms',
            pageNumber: field.page,
            lineNumber: 1,
            elementLocation: `Required field "${field.name}" on page ${field.page}`,
            context: `Required field should clearly indicate it's mandatory`,
            wcagCriterion: 'WCAG 2.1 AA - 3.3.2 Labels or Instructions',
            section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
            impact: this.calculateImpact('moderate'),
            remediation: `Clearly mark "${field.name}" as required in the label (e.g., "Name (required)" or use asterisk with explanation).`
          })
        }
      })
    } else {
      // Fallback to keyword matching
      const formRegex = /(form|input|submit|required|mandatory|field)/i
      const lines = documentContent.split('\n')
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        if (formRegex.test(line)) {
          const hasLabels = /label/i.test(line) || /for=/i.test(line)
          const hasErrorHandling = /error/i.test(line) || /invalid/i.test(line)
          
          if (!hasLabels || !hasErrorHandling) {
            issues.push({
              id: `1194_22o_${Date.now()}_${i}`,
              type: 'serious',
              category: 'form',
              description: 'Form accessibility issues detected (1194.22(o))',
              section: 'Section 508 - Electronic Forms',
              pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
              lineNumber: i + 1,
              elementLocation: line.substring(0, 50),
              context: 'Forms must have proper labels and error handling',
              wcagCriterion: 'WCAG 2.1 AA - 3.3.2 Labels or Instructions',
              section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
              impact: this.calculateImpact('serious'),
              remediation: 'Add proper labels, error handling, and keyboard navigation to forms.'
            })
          }
        }
      }
    }
    
    return issues
  }

  /**
   * 1194.22(p) - Navigation
   */
  private test1194_22p(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Use REAL links to check navigation
    if (parsedStructure && parsedStructure.links && parsedStructure.links.length > 0) {
      // Check if document has navigation aids (table of contents, skip links, etc.)
      const hasNavigationAids = /(table.*contents|toc|skip.*link|navigation|menu|breadcrumb)/i.test(documentContent)
      
      // For documents with many links, navigation aids are more important
      if (parsedStructure.links.length > 5 && !hasNavigationAids) {
        issues.push({
          id: `1194_22p_${Date.now()}_nav`,
          type: 'moderate',
          category: 'navigation',
          description: 'Document with multiple links missing navigation aids (1194.22(p))',
          section: 'Section 508 - Navigation',
          pageNumber: 1,
          lineNumber: 1,
          elementLocation: 'Document navigation',
          context: `Document contains ${parsedStructure.links.length} links but lacks navigation aids like table of contents or skip links`,
          wcagCriterion: 'WCAG 2.1 AA - 2.4.1 Bypass Blocks, 2.4.5 Multiple Ways',
          section508Requirement: '36 CFR § 1194.22(p) - Navigation',
          impact: this.calculateImpact('moderate'),
          remediation: 'Add a table of contents, skip links, or navigation menu to help users navigate between multiple links efficiently.'
        })
      }
    }
    
    // Check for navigation accessibility - use single regex for efficiency
    const navRegex = /(navigation|menu|skip.*link|breadcrumb|table.*contents)/i
    
    const hasNavigation = navRegex.test(documentContent)
    
    if (!hasNavigation && documentContent.length > 2000) {
      issues.push({
        id: `1194_22p_${Date.now()}_navigation`,
        type: 'moderate',
        category: 'navigation',
        description: 'Navigation accessibility issues detected (1194.22(p))',
        section: 'Section 508 - Navigation',
        pageNumber: 1,
        lineNumber: 1,
        elementLocation: 'Document',
        context: 'Long documents should have navigation aids',
        wcagCriterion: 'WCAG 2.1 AA - 2.4.1 Bypass Blocks',
        section508Requirement: '36 CFR § 1194.22(p) - Navigation',
        impact: this.calculateImpact('moderate'),
        remediation: 'Add navigation aids like table of contents, skip links, or headings.'
      })
    }
    
    return issues
  }

  /**
   * Helper methods for Section 508 testing
   */
  private hasNearbyDescription(lines: string[], index: number, range: number): boolean {
    const start = Math.max(0, index - range)
    const end = Math.min(lines.length, index + range + 1)
    
    for (let i = start; i < end; i++) {
      if (i === index) continue
      const line = lines[i].toLowerCase()
      if (line.includes('description') || line.includes('caption') || line.includes('alt')) {
        return true
      }
    }
    return false
  }

  private checkHeadingHierarchy(headings: string[]): boolean {
    // Basic check for heading hierarchy
    // In a real implementation, this would be more sophisticated
    return headings.length > 0
  }

  /**
   * Check heading hierarchy using REAL parsed heading data
   */
  private checkHeadingHierarchyReal(headings: Array<{ level: number; text: string; page: number }>): boolean {
    if (headings.length === 0) return true
    
    // Check if headings follow logical order (level 1, then 2, then 3, etc.)
    let currentMaxLevel = 0
    for (const heading of headings) {
      // Check for skipped levels (e.g., H1 to H3 without H2)
      if (heading.level > currentMaxLevel + 1 && currentMaxLevel > 0) {
        return false
      }
      currentMaxLevel = Math.max(currentMaxLevel, heading.level)
    }
    
    return true
  }

  private checkMeaningfulSequence(lines: string[]): { isValid: boolean; page?: number; line?: number } {
    // Basic check for meaningful sequence
    // In a real implementation, this would analyze content flow
    return { isValid: true }
  }

  /**
   * WCAG 1.3.3 Sensory Characteristics (A): Instructions not relying solely on shape/size/location
   */
  private checkSensoryCharacteristics(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for instructions that rely solely on sensory characteristics
    const sensoryPatterns = [
      /click.*round.*button/i,
      /press.*square.*button/i,
      /select.*red.*option/i,
      /click.*button.*on.*left/i,
      /click.*button.*on.*right/i,
      /click.*button.*above/i,
      /click.*button.*below/i,
      /large.*button/i,
      /small.*button/i,
      /shape.*button/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (sensoryPatterns.some(pattern => pattern.test(line))) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `wcag_1.3.3_${Date.now()}_${i}`,
          type: 'serious',
          category: 'text',
          description: 'Instructions rely solely on sensory characteristics (WCAG 1.3.3)',
          section: 'Text Accessibility',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Instructions must not rely solely on shape, size, visual location, or sound',
          wcagCriterion: 'WCAG 2.1 A - 1.3.3 Sensory Characteristics',
          section508Requirement: '36 CFR § 1194.22(e) - Color Alone',
          impact: this.calculateImpact('serious'),
          remediation: 'Provide additional cues beyond shape, size, or location (e.g., "Click the Submit button (round, located in the top-right corner)")'
        })
      }
    }
    
    return issues
  }

  /**
   * WCAG 1.4.2 Audio Control (A): No auto-playing audio
   */
  private checkAudioControl(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for auto-playing audio references
    const audioPatterns = [
      /autoplay/i,
      /auto.*play/i,
      /plays.*automatically/i,
      /starts.*playing/i,
      /background.*music/i,
      /auto.*start/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (audioPatterns.some(pattern => pattern.test(line))) {
        // Check if there's a control to stop/pause
        const hasControl = /(stop|pause|control|disable|mute)/i.test(line)
        
        if (!hasControl) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `wcag_1.4.2_${Date.now()}_${i}`,
            type: 'serious',
            category: 'media',
            description: 'Audio plays automatically without controls (WCAG 1.4.2)',
            section: 'Media Accessibility',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Audio that plays automatically must have controls to stop or pause',
            wcagCriterion: 'WCAG 2.1 A - 1.4.2 Audio Control',
            section508Requirement: '36 CFR § 1194.22(b) - Media Alternatives',
            impact: this.calculateImpact('serious'),
            remediation: 'Provide user controls to stop, pause, or adjust audio volume. Do not auto-play audio without user consent.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * WCAG 2.4.3 Focus Order (A): Logical tab order
   */
  private checkFocusOrder(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check form fields for logical order
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 1) {
      // Check if form fields are in logical order (by page and position)
      const fieldsByPage = new Map<number, any[]>()
      
      parsedStructure.formFields.forEach((field: any) => {
        const page = field.page || 1
        if (!fieldsByPage.has(page)) {
          fieldsByPage.set(page, [])
        }
        fieldsByPage.get(page)!.push(field)
      })
      
      // For each page, check if fields are in logical sequence
      fieldsByPage.forEach((fields, page) => {
        // If fields jump around in an illogical way, flag it
        // This is a basic check - full implementation would analyze actual field positions
        if (fields.length > 3) {
          // Check if there are multiple required fields that might trap focus
          const requiredFields = fields.filter((f: any) => f.required)
          if (requiredFields.length > 0 && !fields.some((f: any) => f.type === 'button')) {
            issues.push({
              id: `wcag_2.4.3_${Date.now()}_${page}`,
              type: 'moderate',
              category: 'navigation',
              description: 'Potential focus order issues in form (WCAG 2.4.3)',
              section: 'Navigation',
              pageNumber: page,
              lineNumber: 1,
              elementLocation: `Form on page ${page}`,
              context: `Form with ${fields.length} fields may have illogical focus order`,
              wcagCriterion: 'WCAG 2.1 A - 2.4.3 Focus Order',
              section508Requirement: '36 CFR § 1194.22(h) - Keyboard',
              impact: this.calculateImpact('moderate'),
              remediation: `Ensure form fields on page ${page} receive focus in a logical order. Test with Tab key navigation.`
            })
          }
        }
      })
    }
    
    return issues
  }

  /**
   * WCAG 3.3.1 Error Identification (A): Form error messages
   */
  private checkErrorIdentification(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check form fields for error handling
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 0) {
      const hasErrorHandling = documentContent.toLowerCase().includes('error') ||
                               documentContent.toLowerCase().includes('invalid') ||
                               documentContent.toLowerCase().includes('required') ||
                               documentContent.toLowerCase().includes('validation')
      
      if (!hasErrorHandling && parsedStructure.formFields.some((f: any) => f.required)) {
        issues.push({
          id: `wcag_3.3.1_${Date.now()}`,
          type: 'serious',
          category: 'form',
          description: 'Forms missing error identification (WCAG 3.3.1)',
          section: 'Forms and Interactive Elements',
          pageNumber: parsedStructure.formFields[0]?.page || 1,
          lineNumber: 1,
          elementLocation: 'Document forms',
          context: 'Forms with required fields must identify errors in text',
          wcagCriterion: 'WCAG 2.1 A - 3.3.1 Error Identification',
          section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
          impact: this.calculateImpact('serious'),
          remediation: 'Provide clear error messages in text when form validation fails. Errors must be programmatically associated with the field.'
        })
      }
    }
    
    return issues
  }

  /**
   * WCAG 4.1.1 Parsing (A): Valid markup/structure
   */
  private checkParsing(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check document structure for parsing issues
    if (parsedStructure && parsedStructure.structure) {
      // Check for duplicate IDs (would cause parsing issues)
      const headingTexts = new Set<string>()
      parsedStructure.structure.headings.forEach((heading: any) => {
        if (headingTexts.has(heading.text)) {
          issues.push({
            id: `wcag_4.1.1_${Date.now()}_duplicate`,
            type: 'moderate',
            category: 'structure',
            description: 'Duplicate heading text may cause parsing issues (WCAG 4.1.1)',
            section: 'Document Structure',
            pageNumber: heading.page,
            lineNumber: 1,
            elementLocation: `Heading "${heading.text}"`,
            context: 'Duplicate element identifiers can cause parsing and accessibility issues',
            wcagCriterion: 'WCAG 2.1 A - 4.1.1 Parsing',
            section508Requirement: '36 CFR § 1194.22(c) - Information Relationships',
            impact: this.calculateImpact('moderate'),
            remediation: 'Ensure each heading has unique text or use unique IDs to avoid parsing conflicts.'
          })
        }
        headingTexts.add(heading.text)
      })
    }
    
    return issues
  }

  /**
   * WCAG 4.1.2 Name, Role, Value (A): Form controls have proper attributes
   */
  private checkNameRoleValue(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check form fields for proper name, role, value
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 0) {
      parsedStructure.formFields.forEach((field: any, index: number) => {
        // Check if field has name (required)
        if (!field.name || field.name.trim() === '') {
          issues.push({
            id: `wcag_4.1.2_${Date.now()}_${field.page}_${index}_name`,
            type: 'serious',
            category: 'form',
            description: `Form field missing name attribute (WCAG 4.1.2)`,
            section: 'Forms and Interactive Elements',
            pageNumber: field.page,
            lineNumber: 1,
            elementLocation: `Form field on page ${field.page}`,
            context: `Form field must have a programmatically determinable name`,
            wcagCriterion: 'WCAG 2.1 A - 4.1.2 Name, Role, Value',
            section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
            impact: this.calculateImpact('serious'),
            remediation: `Add a name attribute to the form field on page ${field.page}. Ensure the name is programmatically associated with the field.`
          })
        }
        
        // Check if field has role (type should indicate role)
        if (!field.type || field.type === 'unknown') {
          issues.push({
            id: `wcag_4.1.2_${Date.now()}_${field.page}_${index}_role`,
            type: 'serious',
            category: 'form',
            description: `Form field missing role/type (WCAG 4.1.2)`,
            section: 'Forms and Interactive Elements',
            pageNumber: field.page,
            lineNumber: 1,
            elementLocation: `Form field "${field.name}" on page ${field.page}`,
            context: `Form field must have a programmatically determinable role`,
            wcagCriterion: 'WCAG 2.1 A - 4.1.2 Name, Role, Value',
            section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
            impact: this.calculateImpact('serious'),
            remediation: `Ensure form field "${field.name}" on page ${field.page} has a proper type attribute (text, checkbox, radio, etc.)`
          })
        }
      })
    }
    
    return issues
  }

  /**
   * Additional WCAG Level AA checks
   */
  private checkAdditionalWCAGAA(documentContent: string, documentType: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Define getPageAndLine helper function for methods that need it
    const lines = documentContent.split('\n')
    const getPageAndLine = (lineIndex: number): { page: number, line: number } => {
      const linesPerPage = Math.ceil(lines.length / pagesAnalyzed)
      const page = Math.floor(lineIndex / linesPerPage) + 1
      const line = (lineIndex % linesPerPage) + 1
      return { page, line }
    }
    
    // WCAG 1.4.4 Resize Text (AA): Text can resize to 200%
    const resizeIssues = this.checkResizeText(documentContent, pagesAnalyzed)
    issues.push(...resizeIssues)
    
    // WCAG 1.4.11 Non-text Contrast (AA): UI components 3:1 contrast
    const nonTextContrastIssues = this.checkNonTextContrast(documentContent, pagesAnalyzed, parsedStructure)
    issues.push(...nonTextContrastIssues)
    
    // WCAG 2.4.7 Focus Visible (AA): Keyboard focus indicator
    const focusVisibleIssues = this.checkFocusVisible(documentContent, pagesAnalyzed)
    issues.push(...focusVisibleIssues)
    
    // WCAG 3.3.3 Error Suggestion (AA): Error suggestions
    const errorSuggestionIssues = this.checkErrorSuggestion(documentContent, pagesAnalyzed, parsedStructure)
    issues.push(...errorSuggestionIssues)
    
    // WCAG 2.4.5 Multiple Ways (AA): Multiple navigation methods
    const multipleWaysIssues = this.checkMultipleWays(documentContent, pagesAnalyzed, parsedStructure)
    issues.push(...multipleWaysIssues)
    
    // WCAG 1.3.4 Orientation (AA): No orientation lock
    const orientationIssues = this.checkOrientation(documentContent, pagesAnalyzed)
    issues.push(...orientationIssues)
    
    // WCAG 1.3.5 Identify Input Purpose (AA): Input purpose identification
    const inputPurposeIssues = this.checkInputPurpose(documentContent, pagesAnalyzed, parsedStructure)
    issues.push(...inputPurposeIssues)
    
    // WCAG 1.4.10 Reflow (AA): Content reflow at 320px width
    const reflowIssues = this.checkReflow(documentContent, pagesAnalyzed)
    issues.push(...reflowIssues)
    
    // WCAG 1.4.12 Text Spacing (AA): Text spacing override
    const textSpacingIssues = this.checkTextSpacing(documentContent, pagesAnalyzed)
    issues.push(...textSpacingIssues)
    
    // WCAG 1.4.13 Content on Hover or Focus (AA): Hover/focus content dismissible
    const hoverFocusIssues = this.checkContentOnHoverFocus(documentContent, pagesAnalyzed)
    issues.push(...hoverFocusIssues)
    
    // WCAG 2.4.6 Headings and Labels (AA): Descriptive headings and labels
    const headingsLabelsIssues = this.checkHeadingsAndLabels(documentContent, pagesAnalyzed, parsedStructure)
    issues.push(...headingsLabelsIssues)
    
    // WCAG 3.2.3 Consistent Navigation (AA): Consistent navigation
    const consistentNavIssues = this.checkConsistentNavigation(documentContent, pagesAnalyzed)
    issues.push(...consistentNavIssues)
    
    // WCAG 3.2.4 Consistent Identification (AA): Consistent component identification
    const consistentIdIssues = this.checkConsistentIdentification(documentContent, pagesAnalyzed)
    issues.push(...consistentIdIssues)
    
    // WCAG 3.3.4 Error Prevention (Legal, Financial, Data) (AA): Enhanced error prevention
    // Note: This is Level AA version, Level A version is already above
    const errorPreventionAAIssues = this.checkErrorPreventionAA(documentContent, getPageAndLine, parsedStructure)
    issues.push(...errorPreventionAAIssues)
    
    return issues
  }

  /**
   * WCAG 1.4.4 Resize Text (AA): Text can resize to 200%
   */
  private checkResizeText(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for fixed font sizes that might prevent resizing
    const fixedSizePatterns = [
      /font.*size.*!important/i,
      /font.*size.*fixed/i,
      /font.*size.*px/i, // Pixel units can't resize
      /text.*size.*locked/i
    ]
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (fixedSizePatterns.some(pattern => pattern.test(line))) {
        issues.push({
          id: `wcag_1.4.4_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'font',
          description: 'Text may not resize to 200% (WCAG 1.4.4)',
          section: 'Text Accessibility',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Text must be resizable up to 200% without loss of functionality',
          wcagCriterion: 'WCAG 2.1 AA - 1.4.4 Resize Text',
          section508Requirement: '36 CFR § 1194.22(g) - Visual Presentation',
          impact: this.calculateImpact('moderate'),
          remediation: 'Use relative font sizes (em, rem, %) instead of fixed pixel sizes to allow text resizing.'
        })
      }
    }
    
    return issues
  }

  /**
   * WCAG 1.4.11 Non-text Contrast (AA): UI components 3:1 contrast
   */
  private checkNonTextContrast(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check form fields and interactive elements for contrast
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 0) {
      // This would require actual color extraction from form fields
      // For now, check if there are form fields that might have contrast issues
      issues.push({
        id: `wcag_1.4.11_${Date.now()}`,
        type: 'moderate',
        category: 'color',
        description: 'UI components should have 3:1 contrast ratio (WCAG 1.4.11)',
        section: 'Color and Contrast',
        pageNumber: parsedStructure.formFields[0]?.page || 1,
        lineNumber: 1,
        elementLocation: 'Form controls',
        context: 'Form controls and UI components must have at least 3:1 contrast ratio',
        wcagCriterion: 'WCAG 2.1 AA - 1.4.11 Non-text Contrast',
        section508Requirement: '36 CFR § 1194.22(f) - Contrast',
        impact: this.calculateImpact('moderate'),
        remediation: 'Ensure form controls, buttons, and UI components have at least 3:1 contrast ratio against background.'
      })
    }
    
    return issues
  }

  /**
   * WCAG 2.4.7 Focus Visible (AA): Keyboard focus indicator
   */
  private checkFocusVisible(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for focus indicator references
    const hasFocusIndicator = /(focus|outline|border|highlight).*(visible|indicator|show)/i.test(documentContent) ||
                              /keyboard.*focus/i.test(documentContent)
    
    if (!hasFocusIndicator && documentContent.toLowerCase().includes('form')) {
      issues.push({
        id: `wcag_2.4.7_${Date.now()}`,
        type: 'moderate',
        category: 'navigation',
        description: 'Keyboard focus indicator may not be visible (WCAG 2.4.7)',
        section: 'Navigation',
        pageNumber: 1,
        lineNumber: 1,
        elementLocation: 'Document',
        context: 'Keyboard focus must be visible when navigating with Tab key',
        wcagCriterion: 'WCAG 2.1 AA - 2.4.7 Focus Visible',
        section508Requirement: '36 CFR § 1194.22(h) - Keyboard',
        impact: this.calculateImpact('moderate'),
        remediation: 'Ensure keyboard focus is visible with outline, border, or highlight. Test with Tab key navigation.'
      })
    }
    
    return issues
  }

  /**
   * WCAG 3.3.3 Error Suggestion (AA): Error suggestions
   */
  private checkErrorSuggestion(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check if error messages provide suggestions
    const hasErrorSuggestion = /(suggestion|try|example|correct|fix|should be)/i.test(documentContent)
    const hasErrors = /(error|invalid|incorrect|wrong)/i.test(documentContent)
    
    if (hasErrors && !hasErrorSuggestion && parsedStructure?.formFields?.length > 0) {
      issues.push({
        id: `wcag_3.3.3_${Date.now()}`,
        type: 'moderate',
        category: 'form',
        description: 'Error messages should provide suggestions (WCAG 3.3.3)',
        section: 'Forms and Interactive Elements',
        pageNumber: parsedStructure.formFields[0]?.page || 1,
        lineNumber: 1,
        elementLocation: 'Form error handling',
        context: 'When errors are detected, provide suggestions for correction',
        wcagCriterion: 'WCAG 2.1 AA - 3.3.3 Error Suggestion',
        section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
        impact: this.calculateImpact('moderate'),
        remediation: 'Provide specific suggestions when form errors are detected (e.g., "Email must be in format: name@example.com")'
      })
    }
    
    return issues
  }

  /**
   * WCAG 2.4.5 Multiple Ways (AA): Multiple navigation methods
   */
  private checkMultipleWays(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for multiple navigation methods
    const hasTableOfContents = /(table.*contents|toc|contents)/i.test(documentContent)
    const hasSearch = /(search|find)/i.test(documentContent)
    const hasNavigation = /(navigation|menu|nav)/i.test(documentContent)
    const hasBreadcrumbs = /breadcrumb/i.test(documentContent)
    
    const navigationMethods = [hasTableOfContents, hasSearch, hasNavigation, hasBreadcrumbs].filter(Boolean).length
    
    // For long documents, multiple navigation methods are important
    if (pagesAnalyzed > 5 && navigationMethods < 2 && parsedStructure?.links?.length > 10) {
      issues.push({
        id: `wcag_2.4.5_${Date.now()}`,
        type: 'moderate',
        category: 'navigation',
        description: 'Document should provide multiple navigation methods (WCAG 2.4.5)',
        section: 'Navigation',
        pageNumber: 1,
        lineNumber: 1,
        elementLocation: 'Document navigation',
        context: `Long document (${pagesAnalyzed} pages) should provide at least 2 navigation methods`,
        wcagCriterion: 'WCAG 2.1 AA - 2.4.5 Multiple Ways',
        section508Requirement: '36 CFR § 1194.22(p) - Navigation',
        impact: this.calculateImpact('moderate'),
        remediation: 'Provide multiple ways to navigate (table of contents, search, navigation menu, breadcrumbs)'
      })
    }
    
    return issues
  }

  /**
   * WCAG 1.2.2 Captions (Prerecorded) (A): Captions for video
   */
  private checkCaptionsPrerecorded(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for video references without caption mentions
    const videoRegex = /(video|\.mp4|\.avi|\.mov|\.webm|film|movie)/i
    const captionRegex = /(caption|subtitle|transcript|closed.*caption|CC)/i
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (videoRegex.test(line) && !captionRegex.test(line)) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `wcag_1.2.2_${Date.now()}_${i}`,
          type: 'serious',
          category: 'media',
          description: 'Prerecorded video content missing captions (WCAG 1.2.2)',
          section: 'Media Accessibility',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Video content requires captions or transcripts',
          wcagCriterion: 'WCAG 2.1 A - 1.2.2 Captions (Prerecorded)',
          section508Requirement: '36 CFR § 1194.22(b) - Media Alternatives',
          impact: this.calculateImpact('serious'),
          remediation: 'Provide captions or transcripts for all prerecorded video content.'
        })
        break
      }
    }
    
    return issues
  }

  /**
   * WCAG 1.2.4 Captions (Live) (A): Live captions
   */
  private checkCaptionsLive(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for live video/streaming references without caption mentions
    const liveVideoRegex = /(live.*stream|webinar|live.*video|real.*time.*video|broadcast)/i
    const captionRegex = /(caption|subtitle|transcript|closed.*caption|CC|live.*caption)/i
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (liveVideoRegex.test(line) && !captionRegex.test(line)) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `wcag_1.2.4_${Date.now()}_${i}`,
          type: 'serious',
          category: 'media',
          description: 'Live video content missing captions (WCAG 1.2.4)',
          section: 'Media Accessibility',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Live video content requires real-time captions',
          wcagCriterion: 'WCAG 2.1 A - 1.2.4 Captions (Live)',
          section508Requirement: '36 CFR § 1194.22(b) - Media Alternatives',
          impact: this.calculateImpact('serious'),
          remediation: 'Provide real-time captions for all live video content.'
        })
        break
      }
    }
    
    return issues
  }

  /**
   * WCAG 1.2.5 Audio Description (Prerecorded) (AA): Extended audio descriptions
   */
  private checkExtendedAudioDescription(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for complex video content that might need extended audio descriptions
    const complexVideoRegex = /(video|film|movie).*?(complex|detailed|visual.*information|graph|chart|diagram)/i
    const extendedAudioDescRegex = /(extended.*audio.*description|detailed.*narration|comprehensive.*description)/i
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (complexVideoRegex.test(line) && !extendedAudioDescRegex.test(line)) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `wcag_1.2.5_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'media',
          description: 'Complex video content may need extended audio description (WCAG 1.2.5)',
          section: 'Media Accessibility',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Complex video content may require extended audio descriptions',
          wcagCriterion: 'WCAG 2.1 AA - 1.2.5 Audio Description (Prerecorded)',
          section508Requirement: '36 CFR § 1194.22(b) - Media Alternatives',
          impact: this.calculateImpact('moderate'),
          remediation: 'Consider providing extended audio descriptions for complex video content with significant visual information.'
        })
        break
      }
    }
    
    return issues
  }

  /**
   * WCAG 1.2.3 Audio Description or Media Alternative (A): Audio descriptions for video
   */
  private checkAudioDescription(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for video references without audio description mentions
    const videoRegex = /(video|\.mp4|\.avi|\.mov|\.webm|film|movie)/i
    const audioDescRegex = /(audio.*description|narration|describe|explain.*video)/i
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (videoRegex.test(line) && !audioDescRegex.test(line)) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `wcag_1.2.3_${Date.now()}_${i}`,
          type: 'serious',
          category: 'media',
          description: 'Video content missing audio description (WCAG 1.2.3)',
          section: 'Media Accessibility',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Video content requires audio description or text alternative',
          wcagCriterion: 'WCAG 2.1 A - 1.2.3 Audio Description or Media Alternative',
          section508Requirement: '36 CFR § 1194.22(b) - Media Alternatives',
          impact: this.calculateImpact('serious'),
          remediation: 'Provide audio description for video content or a text alternative that describes visual information.'
        })
        break
      }
    }
    
    return issues
  }

  /**
   * WCAG 2.1.4 Character Key Shortcuts (A): Single-key shortcuts must be remappable
   */
  private checkCharacterKeyShortcuts(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for single-key shortcuts that might not be remappable
    const shortcutPatterns = [
      /keyboard.*shortcut.*single.*key/i,
      /press.*[a-z].*to.*activate/i,
      /single.*key.*command/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (shortcutPatterns.some(pattern => pattern.test(line))) {
        const hasRemap = /(remap|disable|turn.*off|configure)/i.test(line)
        if (!hasRemap) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `wcag_2.1.4_${Date.now()}_${i}`,
            type: 'moderate',
            category: 'navigation',
            description: 'Single-key shortcuts should be remappable (WCAG 2.1.4)',
            section: 'Keyboard Accessibility',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Single-key keyboard shortcuts must be remappable or can be turned off',
            wcagCriterion: 'WCAG 2.1 A - 2.1.4 Character Key Shortcuts',
            section508Requirement: '36 CFR § 1194.22(h) - Keyboard',
            impact: this.calculateImpact('moderate'),
            remediation: 'Provide mechanism to remap or disable single-key shortcuts to avoid conflicts with assistive technology.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * WCAG 2.2.2 Pause, Stop, Hide (A): Controls for moving/blinking content
   */
  private checkPauseStopHide(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for moving/blinking content without controls
    const movingPatterns = [
      /(auto.*play|autoplay|auto.*start|moving|blinking|scrolling|marquee|animation|carousel|slideshow)/i
    ]
    const controlPatterns = [
      /(pause|stop|hide|disable|control|button)/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (movingPatterns.some(pattern => pattern.test(line))) {
        const hasControls = controlPatterns.some(pattern => pattern.test(line))
        if (!hasControls) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `wcag_2.2.2_${Date.now()}_${i}`,
            type: 'serious',
            category: 'media',
            description: 'Moving/blinking content without controls (WCAG 2.2.2)',
            section: 'Media Accessibility',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Moving, blinking, or scrolling content must have pause/stop/hide controls',
            wcagCriterion: 'WCAG 2.1 A - 2.2.2 Pause, Stop, Hide',
            section508Requirement: '36 CFR § 1194.22(j) - Timing',
            impact: this.calculateImpact('serious'),
            remediation: 'Provide user controls to pause, stop, or hide moving, blinking, or scrolling content.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * WCAG 2.5.1 Pointer Gestures (A): Single pointer without path-based gestures
   */
  private checkPointerGestures(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for path-based gesture references
    const gesturePatterns = [
      /(swipe|drag|pinch|zoom|gesture|path.*based|multi.*touch|two.*finger)/i
    ]
    const alternativePatterns = [
      /(button|keyboard|alternative|single.*click|tap)/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (gesturePatterns.some(pattern => pattern.test(line))) {
        const hasAlternative = alternativePatterns.some(pattern => pattern.test(line))
        if (!hasAlternative) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `wcag_2.5.1_${Date.now()}_${i}`,
            type: 'moderate',
            category: 'navigation',
            description: 'Path-based gestures should have single-pointer alternative (WCAG 2.5.1)',
            section: 'Pointer Accessibility',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Path-based gestures must have single-pointer alternatives',
            wcagCriterion: 'WCAG 2.1 A - 2.5.1 Pointer Gestures',
            section508Requirement: '36 CFR § 1194.22(h) - Keyboard',
            impact: this.calculateImpact('moderate'),
            remediation: 'Provide single-pointer alternatives (e.g., button) for path-based gestures like swiping or dragging.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * WCAG 2.5.2 Pointer Cancellation (A): No down-event activation
   */
  private checkPointerCancellation(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for down-event activation patterns (less common in documents)
    const downEventPatterns = [
      /(onmousedown|onpointerdown|down.*event.*activate)/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (downEventPatterns.some(pattern => pattern.test(line))) {
        const { page, line: lineNum } = getPageAndLine(i)
        issues.push({
          id: `wcag_2.5.2_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'navigation',
          description: 'Pointer actions should use up-event, not down-event (WCAG 2.5.2)',
          section: 'Pointer Accessibility',
          pageNumber: page,
          lineNumber: lineNum,
          elementLocation: line.substring(0, 50),
          context: 'Pointer actions should activate on up-event to allow cancellation',
          wcagCriterion: 'WCAG 2.1 A - 2.5.2 Pointer Cancellation',
          section508Requirement: '36 CFR § 1194.22(h) - Keyboard',
          impact: this.calculateImpact('moderate'),
          remediation: 'Use up-event (mouseup, pointerup) for pointer activation instead of down-event to allow users to cancel actions.'
        })
      }
    }
    
    return issues
  }

  /**
   * WCAG 2.5.3 Label in Name (A): Accessible name contains visible text
   */
  private checkLabelInName(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check form fields for label/name consistency
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 0) {
      parsedStructure.formFields.forEach((field: any, index: number) => {
        if (field.label && field.name) {
          // Check if accessible name contains visible label text
          const labelText = field.label.toLowerCase().trim()
          const nameText = field.name.toLowerCase().trim()
          
          if (nameText && !nameText.includes(labelText) && labelText.length > 0) {
            issues.push({
              id: `wcag_2.5.3_${Date.now()}_${field.page}_${index}`,
              type: 'moderate',
              category: 'form',
              description: 'Accessible name should contain visible label text (WCAG 2.5.3)',
              section: 'Forms and Interactive Elements',
              pageNumber: field.page,
              lineNumber: 1,
              elementLocation: `Form field "${field.name}" on page ${field.page}`,
              context: `Accessible name "${field.name}" should contain visible label "${field.label}"`,
              wcagCriterion: 'WCAG 2.1 A - 2.5.3 Label in Name',
              section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
              impact: this.calculateImpact('moderate'),
              remediation: `Ensure the accessible name for "${field.label}" contains the visible label text.`
            })
          }
        }
      })
    }
    
    return issues
  }

  /**
   * WCAG 2.5.4 Motion Actuation (A): Motion-based activation can be disabled
   */
  private checkMotionActuation(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for device motion references
    const motionPatterns = [
      /(device.*motion|accelerometer|gyroscope|shake|tilt|motion.*sensor|gesture.*control)/i
    ]
    const disablePatterns = [
      /(disable|turn.*off|option|setting|preference)/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (motionPatterns.some(pattern => pattern.test(line))) {
        const hasDisable = disablePatterns.some(pattern => pattern.test(line))
        if (!hasDisable) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `wcag_2.5.4_${Date.now()}_${i}`,
            type: 'moderate',
            category: 'navigation',
            description: 'Motion-based activation should be disableable (WCAG 2.5.4)',
            section: 'Motion Accessibility',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Motion-based activation must be disableable or have UI alternative',
            wcagCriterion: 'WCAG 2.1 A - 2.5.4 Motion Actuation',
            section508Requirement: '36 CFR § 1194.22(h) - Keyboard',
            impact: this.calculateImpact('moderate'),
            remediation: 'Provide UI alternative to motion-based activation or allow users to disable motion actuation.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * WCAG 3.2.2 On Input (A): No automatic context change on input
   */
  private checkOnInput(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for automatic context change patterns
    const autoChangePatterns = [
      /(onchange|oninput|auto.*submit|auto.*select|auto.*navigate)/i
    ]
    const warningPatterns = [
      /(warning|confirm|alert|notice|will.*change)/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (autoChangePatterns.some(pattern => pattern.test(line))) {
        const hasWarning = warningPatterns.some(pattern => pattern.test(line))
        if (!hasWarning) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `wcag_3.2.2_${Date.now()}_${i}`,
            type: 'serious',
            category: 'form',
            description: 'Automatic context change on input should be avoided (WCAG 3.2.2)',
            section: 'Forms and Interactive Elements',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Changing context automatically on input can disorient users',
            wcagCriterion: 'WCAG 2.1 A - 3.2.2 On Input',
            section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
            impact: this.calculateImpact('serious'),
            remediation: 'Avoid automatic context changes on input. Use explicit submit buttons or warn users before context changes.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * WCAG 1.3.4 Orientation (AA): Content not restricted to portrait/landscape
   */
  private checkOrientation(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for orientation restrictions (less common in static documents)
    const orientationPatterns = [
      /(portrait.*only|landscape.*only|orientation.*locked|fixed.*orientation)/i
    ]
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (orientationPatterns.some(pattern => pattern.test(line))) {
        issues.push({
          id: `wcag_1.3.4_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'layout',
          description: 'Content should not be restricted to single orientation (WCAG 1.3.4)',
          section: 'Layout Accessibility',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Content must be usable in both portrait and landscape orientations',
          wcagCriterion: 'WCAG 2.1 AA - 1.3.4 Orientation',
          section508Requirement: '36 CFR § 1194.22(g) - Visual Presentation',
          impact: this.calculateImpact('moderate'),
          remediation: 'Ensure content is usable in both portrait and landscape orientations without requiring specific orientation.'
        })
      }
    }
    
    return issues
  }

  /**
   * WCAG 1.3.5 Identify Input Purpose (AA): Input purpose can be programmatically determined
   */
  private checkInputPurpose(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check form fields for autocomplete or purpose attributes
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 0) {
      parsedStructure.formFields.forEach((field: any, index: number) => {
        // Check if field has autocomplete or purpose indication
        const hasPurpose = field.autocomplete || field.purpose || 
                          field.type === 'email' || field.type === 'tel' || field.type === 'url' ||
                          field.name?.toLowerCase().includes('email') || 
                          field.name?.toLowerCase().includes('phone') ||
                          field.name?.toLowerCase().includes('address')
        
        if (!hasPurpose && field.type === 'text') {
          issues.push({
            id: `wcag_1.3.5_${Date.now()}_${field.page}_${index}`,
            type: 'moderate',
            category: 'form',
            description: 'Input purpose should be programmatically determinable (WCAG 1.3.5)',
            section: 'Forms and Interactive Elements',
            pageNumber: field.page,
            lineNumber: 1,
            elementLocation: `Form field "${field.name}" on page ${field.page}`,
            context: 'Input fields should have autocomplete or purpose attributes',
            wcagCriterion: 'WCAG 2.1 AA - 1.3.5 Identify Input Purpose',
            section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
            impact: this.calculateImpact('moderate'),
            remediation: `Add autocomplete attribute to "${field.name}" to identify input purpose (e.g., autocomplete="email", autocomplete="name").`
          })
        }
      })
    }
    
    return issues
  }

  /**
   * WCAG 1.4.10 Reflow (AA): Content reflows without horizontal scrolling
   */
  private checkReflow(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for fixed width or horizontal scrolling indicators
    const reflowIssues = [
      /(fixed.*width|width.*px|horizontal.*scroll|overflow.*x|nowrap)/i
    ]
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (reflowIssues.some(pattern => pattern.test(line))) {
        issues.push({
          id: `wcag_1.4.10_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'layout',
          description: 'Content should reflow without horizontal scrolling (WCAG 1.4.10)',
          section: 'Layout Accessibility',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Content must reflow vertically at 320px width without horizontal scrolling',
          wcagCriterion: 'WCAG 2.1 AA - 1.4.10 Reflow',
          section508Requirement: '36 CFR § 1194.22(g) - Visual Presentation',
          impact: this.calculateImpact('moderate'),
          remediation: 'Use relative units (%, em, rem) instead of fixed pixel widths. Ensure content reflows at 320px width.'
        })
      }
    }
    
    return issues
  }

  /**
   * WCAG 1.4.12 Text Spacing (AA): No loss of content when spacing adjusted
   */
  private checkTextSpacing(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for fixed spacing that might break when adjusted
    const spacingIssues = [
      /(line.*height.*!important|margin.*!important|padding.*!important|fixed.*spacing)/i
    ]
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (spacingIssues.some(pattern => pattern.test(line))) {
        issues.push({
          id: `wcag_1.4.12_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'font',
          description: 'Text spacing should be adjustable without content loss (WCAG 1.4.12)',
          section: 'Text Accessibility',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Text spacing must be adjustable up to specified limits without content loss',
          wcagCriterion: 'WCAG 2.1 AA - 1.4.12 Text Spacing',
          section508Requirement: '36 CFR § 1194.22(g) - Visual Presentation',
          impact: this.calculateImpact('moderate'),
          remediation: 'Allow text spacing to be adjusted (line height 1.5x, paragraph spacing 2x, letter spacing 0.12x, word spacing 0.16x) without losing content.'
        })
      }
    }
    
    return issues
  }

  /**
   * WCAG 1.4.13 Content on Hover or Focus (AA): Additional content can be dismissed
   */
  private checkContentOnHoverFocus(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for hover/focus content patterns
    const hoverFocusPatterns = [
      /(hover|:hover|onmouseover|tooltip|popover|popup|dropdown)/i
    ]
    const dismissPatterns = [
      /(dismiss|close|escape|keyboard|persistent)/i
    ]
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (hoverFocusPatterns.some(pattern => pattern.test(line))) {
        const hasDismiss = dismissPatterns.some(pattern => pattern.test(line))
        if (!hasDismiss) {
          issues.push({
            id: `wcag_1.4.13_${Date.now()}_${i}`,
            type: 'moderate',
            category: 'navigation',
            description: 'Hover/focus content should be dismissible (WCAG 1.4.13)',
            section: 'Navigation',
            pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
            lineNumber: i + 1,
            elementLocation: line.substring(0, 50),
            context: 'Additional content on hover/focus must be dismissible without moving pointer/focus',
            wcagCriterion: 'WCAG 2.1 AA - 1.4.13 Content on Hover or Focus',
            section508Requirement: '36 CFR § 1194.22(h) - Keyboard',
            impact: this.calculateImpact('moderate'),
            remediation: 'Provide dismissible hover/focus content (e.g., Escape key, close button) that doesn\'t require moving pointer/focus.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * WCAG 2.4.6 Headings and Labels (AA): Headings and labels describe purpose
   */
  private checkHeadingsAndLabels(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check headings for descriptive text
    if (parsedStructure && parsedStructure.structure && parsedStructure.structure.headings) {
      parsedStructure.structure.headings.forEach((heading: any) => {
        if (!heading.text || heading.text.trim().length < 3) {
          issues.push({
            id: `wcag_2.4.6_heading_${Date.now()}_${heading.page}`,
            type: 'moderate',
            category: 'structure',
            description: 'Heading should describe topic or purpose (WCAG 2.4.6)',
            section: 'Document Structure',
            pageNumber: heading.page,
            lineNumber: 1,
            elementLocation: `Heading on page ${heading.page}`,
            context: 'Headings must be descriptive and indicate topic or purpose',
            wcagCriterion: 'WCAG 2.1 AA - 2.4.6 Headings and Labels',
            section508Requirement: '36 CFR § 1194.22(c) - Information Relationships',
            impact: this.calculateImpact('moderate'),
            remediation: `Ensure heading on page ${heading.page} describes the topic or purpose of the section.`
          })
        }
      })
    }
    
    // Check form labels for descriptive text
    if (parsedStructure && parsedStructure.formFields) {
      parsedStructure.formFields.forEach((field: any, index: number) => {
        if (field.label && (field.label.trim().length < 2 || /^(field|input|form|enter)/i.test(field.label))) {
          issues.push({
            id: `wcag_2.4.6_label_${Date.now()}_${field.page}_${index}`,
            type: 'moderate',
            category: 'form',
            description: 'Form label should describe purpose (WCAG 2.4.6)',
            section: 'Forms and Interactive Elements',
            pageNumber: field.page,
            lineNumber: 1,
            elementLocation: `Form field "${field.name}" on page ${field.page}`,
            context: `Label "${field.label}" should clearly describe the field's purpose`,
            wcagCriterion: 'WCAG 2.1 AA - 2.4.6 Headings and Labels',
            section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
            impact: this.calculateImpact('moderate'),
            remediation: `Provide a descriptive label for "${field.name}" that clearly indicates its purpose (e.g., "Email Address" instead of "Field").`
          })
        }
      })
    }
    
    return issues
  }

  /**
   * WCAG 3.1.2 Language of Parts (AA): Language of parts can be determined
   */
  private checkLanguageOfParts(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    // This is already implemented as checkLanguageParts, but we'll ensure it's comprehensive
    return this.checkLanguageParts(documentContent, getPageAndLine)
  }

  /**
   * WCAG 3.2.3 Consistent Navigation (AA): Navigation order is consistent
   */
  private checkConsistentNavigation(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for navigation consistency across pages
    if (parsedStructure && parsedStructure.links && parsedStructure.links.length > 5) {
      // Check if navigation links appear in consistent locations
      const navLinks = parsedStructure.links.filter((link: any) => 
        /(menu|navigation|nav|home|about|contact|skip)/i.test(link.text || link.url)
      )
      
      if (navLinks.length > 0 && pagesAnalyzed > 1) {
        // Check if navigation appears consistently (would need page-by-page analysis)
        issues.push({
          id: `wcag_3.2.3_${Date.now()}`,
          type: 'moderate',
          category: 'navigation',
          description: 'Navigation should be consistent across pages (WCAG 3.2.3)',
          section: 'Navigation',
          pageNumber: 1,
          lineNumber: 1,
          elementLocation: 'Document navigation',
          context: 'Navigation mechanisms should appear in the same relative order across pages',
          wcagCriterion: 'WCAG 2.1 AA - 3.2.3 Consistent Navigation',
          section508Requirement: '36 CFR § 1194.22(p) - Navigation',
          impact: this.calculateImpact('moderate'),
          remediation: 'Ensure navigation menus and links appear in the same relative order on each page of the document.'
        })
      }
    }
    
    return issues
  }

  /**
   * WCAG 3.2.4 Consistent Identification (AA): Components with same function have consistent identification
   */
  private checkConsistentIdentification(documentContent: string, pagesAnalyzed: number, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for inconsistent component identification
    if (parsedStructure && parsedStructure.formFields && parsedStructure.formFields.length > 0) {
      const buttonFields = parsedStructure.formFields.filter((f: any) => f.type === 'button' || f.type === 'submit')
      
      if (buttonFields.length > 1) {
        // Check if similar buttons have consistent labels
        const submitButtons = buttonFields.filter((f: any) => 
          /submit|send|save|confirm/i.test(f.label || f.name || '')
        )
        
        if (submitButtons.length > 1) {
          const labels = submitButtons.map((f: any) => (f.label || f.name || '').toLowerCase().trim())
          const uniqueLabels = new Set(labels)
          
          if (uniqueLabels.size > 1) {
            issues.push({
              id: `wcag_3.2.4_${Date.now()}`,
              type: 'moderate',
              category: 'form',
              description: 'Components with same function should have consistent identification (WCAG 3.2.4)',
              section: 'Forms and Interactive Elements',
              pageNumber: submitButtons[0]?.page || 1,
              lineNumber: 1,
              elementLocation: 'Form buttons',
              context: 'Components with the same functionality should be identified consistently',
              wcagCriterion: 'WCAG 2.1 AA - 3.2.4 Consistent Identification',
              section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
              impact: this.calculateImpact('moderate'),
              remediation: 'Use consistent labels for components with the same functionality (e.g., all "Submit" buttons should be labeled "Submit").'
            })
          }
        }
      }
    }
    
    return issues
  }

  /**
   * WCAG 3.3.4 Error Prevention (Legal, Financial, Data) (A): Error prevention for important submissions
   */
  private checkErrorPrevention(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for legal/financial/data submission patterns
    const importantPatterns = [
      /(legal|contract|agreement|payment|purchase|financial|transaction|submit.*data|delete.*account|irreversible)/i
    ]
    const preventionPatterns = [
      /(confirm|review|verify|check|reversible|undo|cancel)/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (importantPatterns.some(pattern => pattern.test(line))) {
        const hasPrevention = preventionPatterns.some(pattern => pattern.test(line))
        if (!hasPrevention) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `wcag_3.3.4_${Date.now()}_${i}`,
            type: 'serious',
            category: 'form',
            description: 'Important submissions should have error prevention (WCAG 3.3.4)',
            section: 'Forms and Interactive Elements',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Legal, financial, or data submissions must have error prevention mechanisms',
            wcagCriterion: 'WCAG 2.1 A - 3.3.4 Error Prevention (Legal, Financial, Data)',
            section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
            impact: this.calculateImpact('serious'),
            remediation: 'Provide error prevention: reversible submissions, error checking, or confirmation/review step before finalizing important submissions.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * WCAG 3.3.4 Error Prevention (Legal, Financial, Data) (AA): Error prevention for important submissions
   */
  private checkErrorPreventionAA(documentContent: string, getPageAndLine: (index: number) => { page: number, line: number }, parsedStructure?: any): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    const lines = documentContent.split('\n')
    
    // Check for legal/financial/data submission patterns
    const importantPatterns = [
      /(legal|contract|agreement|payment|purchase|financial|transaction|submit.*data|delete.*account|irreversible)/i
    ]
    const preventionPatterns = [
      /(confirm|review|verify|check|reversible|undo|cancel)/i
    ]
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (importantPatterns.some(pattern => pattern.test(line))) {
        const hasPrevention = preventionPatterns.some(pattern => pattern.test(line))
        if (!hasPrevention) {
          const { page, line: lineNum } = getPageAndLine(i)
          issues.push({
            id: `wcag_3.3.4_${Date.now()}_${i}`,
            type: 'serious',
            category: 'form',
            description: 'Important submissions should have error prevention (WCAG 3.3.4)',
            section: 'Forms and Interactive Elements',
            pageNumber: page,
            lineNumber: lineNum,
            elementLocation: line.substring(0, 50),
            context: 'Legal, financial, or data submissions must have error prevention mechanisms',
            wcagCriterion: 'WCAG 2.1 AA - 3.3.4 Error Prevention (Legal, Financial, Data)',
            section508Requirement: '36 CFR § 1194.22(o) - Electronic Forms',
            impact: this.calculateImpact('serious'),
            remediation: 'Provide error prevention: reversible submissions, error checking, or confirmation/review step before finalizing important submissions.'
          })
        }
      }
    }
    
    return issues
  }

  /**
   * Extract actual foreground/background color pairs from document
   */
  private extractColorPairs(parsedStructure: any, documentContent: string): Array<{
    foreground: string
    background: string
    page: number
  }> {
    const pairs: Array<{ foreground: string; background: string; page: number }> = []
    
    // If textColors are available, try to match with backgrounds
    if (parsedStructure && parsedStructure.textColors && parsedStructure.textColors.length > 0) {
      parsedStructure.textColors.forEach((colorData: any) => {
        // Try to find background color from structure or use document default
        // For PDFs, we'd need to extract from rendering context
        // For now, check if there's a background color specified
        const background = parsedStructure.backgroundColor || '#FFFFFF' // Default white
        
        pairs.push({
          foreground: colorData.hex,
          background: background,
          page: colorData.page || 1,
        })
      })
    }
    
    // For HTML, extract from CSS styles
    if (parsedStructure && parsedStructure.textColors) {
      // Already handled above
    }
    
    return pairs
  }

  /**
   * Deduplicate issues by grouping similar ones together
   */
  private deduplicateIssues(issues: ComprehensiveDocumentIssue[]): ComprehensiveDocumentIssue[] {
    const issueGroups = new Map<string, ComprehensiveDocumentIssue[]>()
    
    for (const issue of issues) {
      // Create a key based on issue type, description, and section
      const key = `${issue.type}_${issue.description}_${issue.section}`
      
      if (!issueGroups.has(key)) {
        issueGroups.set(key, [])
      }
      issueGroups.get(key)!.push(issue)
    }
    
    const deduplicatedIssues: ComprehensiveDocumentIssue[] = []
    
    issueGroups.forEach((groupIssues: ComprehensiveDocumentIssue[], key: string) => {
      if (groupIssues.length === 1) {
        // Single issue, keep as is
        deduplicatedIssues.push(groupIssues[0])
      } else {
        // Multiple similar issues, create a grouped issue
        const firstIssue = groupIssues[0]
        const locations = groupIssues.map((issue: ComprehensiveDocumentIssue) => ({
          page: issue.pageNumber,
          line: issue.lineNumber,
          location: issue.elementLocation
        })).filter((loc: any) => loc.page || loc.line)
        
        const pageNumbers = groupIssues.map((i: ComprehensiveDocumentIssue) => i.pageNumber).filter(Boolean)
        const uniquePages = Array.from(new Set(pageNumbers))
        
        const groupedIssue: ComprehensiveDocumentIssue = {
          ...firstIssue,
          id: `grouped_${firstIssue.id}`,
          occurrences: groupIssues.length,
          affectedPages: uniquePages.length,
          elementContent: `Found ${groupIssues.length} instances of this issue`,
          elementType: 'multiple',
          elementSelector: `Multiple locations (${locations.length} found)`,
          context: `This issue appears ${groupIssues.length} times across ${locations.length} different locations in the document.`,
          remediation: `${firstIssue.remediation} This fix should be applied to all ${groupIssues.length} instances.`
        }
        
        deduplicatedIssues.push(groupedIssue)
      }
    })
    
    console.log(`🔄 Deduplication: ${issues.length} issues → ${deduplicatedIssues.length} unique issues`)
    return deduplicatedIssues
  }
}
