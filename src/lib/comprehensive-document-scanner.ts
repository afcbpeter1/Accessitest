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
    selectedTags?: string[]
  ): Promise<ComprehensiveScanResult> {
    const startTime = Date.now()
    console.log(`🚀 Starting COMPREHENSIVE document scan for: ${fileName}`)

    try {
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
      if (fileType.includes('pdf')) {
        const pdfResult = await this.parsePDFComprehensive(fileBuffer)
        documentContent = pdfResult.text
        documentType = 'PDF'
        pagesAnalyzed = pdfResult.pages || 1
        wordCount = documentContent.split(/\s+/).length
        characterCount = documentContent.length
        imageCount = pdfResult.imageCount || 0
        tableCount = pdfResult.tableCount || 0
        linkCount = pdfResult.linkCount || 0
        imageAnalysis = pdfResult.imageAnalysis || imageAnalysis
        pageAnalysis = pdfResult.pageAnalysis || []
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
      } else if (fileType.includes('html')) {
        documentContent = fileBuffer.toString('utf-8')
        documentType = 'HTML'
        pagesAnalyzed = 1
        wordCount = documentContent.split(/\s+/).length
        characterCount = documentContent.length
        imageCount = 0
        tableCount = 0
        linkCount = 0
      } else {
        documentContent = fileBuffer.toString('utf-8')
        documentType = 'Text'
        pagesAnalyzed = 1
        wordCount = documentContent.split(/\s+/).length
        characterCount = documentContent.length
        imageCount = 0
        tableCount = 0
        linkCount = 0
      }

      // Analyze document structure
      const structureAnalysis = this.analyzeDocumentStructure(documentContent, pagesAnalyzed)
      headingCount = structureAnalysis.headingCount
      paragraphCount = structureAnalysis.paragraphCount

      // If no page analysis was done, create basic page analysis
      if (pageAnalysis.length === 0) {
        pageAnalysis = this.createBasicPageAnalysis(documentContent, pagesAnalyzed)
      }

      console.log(`📄 Document parsed: ${documentType}, ${pagesAnalyzed} pages, ${wordCount} words, ${characterCount} characters`)
      console.log(`🖼️ Images detected: ${imageCount} total images (${imageAnalysis.complexImages} complex, ${imageAnalysis.decorativeImages} decorative, ${imageAnalysis.informativeImages} informative)`)
      console.log(`📋 Content elements: ${tableCount} tables, ${linkCount} links, ${headingCount} headings, ${paragraphCount} paragraphs`)

      // Run comprehensive accessibility analysis with selected tags
      const allIssues = await this.analyzeComprehensive(documentContent, documentType, pagesAnalyzed, imageAnalysis, pageAnalysis, selectedTags)
      
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
    pageAnalysis: PageAnalysis[]
  }> {
    try {
      // Use dynamic import to avoid webpack issues
      let pdfParse
      try {
        pdfParse = require('pdf-parse')
      } catch (importError) {
        console.error('❌ Failed to import pdf-parse:', importError)
        throw new Error('pdf-parse library not available')
      }
      
      console.log(`🔍 Attempting to parse PDF with ${buffer.length} bytes`)
      
      // Pass buffer with options to ensure it's treated as buffer, not file path
      const data = await pdfParse(buffer, {
        max: 0, // No page limit
        version: 'v2.0.550'
      })
      
      console.log(`📄 PDF parsed successfully: ${data.numpages} pages, ${data.text.length} characters`)
      
      // Verify we got actual content
      if (!data.text || data.text.length < 10) {
        throw new Error('PDF parsing returned insufficient text content')
      }
      
      // Log the actual page count for debugging
      console.log(`🔍 PDF parse result - Pages: ${data.numpages}, Text length: ${data.text.length}`)
      
      // Analyze content for various elements
      const contentAnalysis = this.analyzeContentElements(data.text)
      const imageCount = contentAnalysis.imageCount
      const tableCount = contentAnalysis.tableCount
      const linkCount = contentAnalysis.linkCount
      
      // Create detailed page analysis
      const pageAnalysis = this.createDetailedPageAnalysis(data.text, data.numpages || 1)
      
      // More intelligent image analysis - only flag complex images if there's evidence
      const hasComplexImageIndicators = this.detectComplexImageIndicators(data.text)
      const complexImages = hasComplexImageIndicators ? Math.min(1, imageCount) : 0
      
      const imageAnalysis: ImageAnalysis = {
        totalImages: imageCount,
        imagesWithAltText: 0, // PDFs don't have alt text in the same way
        imagesWithoutAltText: imageCount,
        decorativeImages: Math.floor(imageCount * 0.3), // Estimate 30% decorative
        informativeImages: Math.floor(imageCount * 0.7), // Estimate 70% informative
        complexImages: complexImages, // Only flag if there's evidence of complex images
        imageIssues: [],
        imagesByPage: this.distributeImagesAcrossPages(imageCount, data.numpages || 1)
      }
      
      console.log(`✅ Returning PDF result with ${data.numpages} pages and ${data.text.length} characters`)
      console.log(`🖼️ Image analysis: ${imageCount} total images detected`)
      console.log(`📊 Complex image detection: ${hasComplexImageIndicators ? 'Found indicators' : 'No indicators found'}`)
      
      return { 
        text: data.text, 
        pages: data.numpages || 1,
        imageCount,
        tableCount,
        linkCount,
        imageAnalysis,
        pageAnalysis
      }
    } catch (error) {
      console.error('❌ PDF parsing failed:', error)
      console.error('❌ Error details:', error instanceof Error ? error.message : 'Unknown error')
      console.error('❌ Buffer size:', buffer.length, 'bytes')
      
      // Final fallback to basic text extraction
      console.log('⚠️ Using basic text extraction fallback')
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
    pageAnalysis: PageAnalysis[]
  }> {
    try {
      // Use mammoth for Word document parsing
      const mammoth = require('mammoth')
      
      const result = await mammoth.extractRawText({ buffer })
      const text = result.value
      const messages = result.messages
      
      console.log(`📄 Word document parsed: ${text.length} characters`)
      
      // Estimate pages based on word count (rough estimate: 250 words per page)
      const pages = Math.max(1, Math.ceil(text.split(/\s+/).length / 250))
      
      // Analyze content for various elements
      const contentAnalysis = this.analyzeContentElements(text)
      const imageCount = contentAnalysis.imageCount
      const tableCount = contentAnalysis.tableCount
      const linkCount = contentAnalysis.linkCount
      
      // Create detailed page analysis
      const pageAnalysis = this.createDetailedPageAnalysis(text, pages)
      
      // More intelligent image analysis for Word documents
      const hasComplexImageIndicators = this.detectComplexImageIndicators(text)
      const complexImages = hasComplexImageIndicators ? Math.min(1, imageCount) : 0
      
      const imageAnalysis: ImageAnalysis = {
        totalImages: imageCount,
        imagesWithAltText: 0, // Word docs don't have alt text in the same way
        imagesWithoutAltText: imageCount,
        decorativeImages: Math.floor(imageCount * 0.3),
        informativeImages: Math.floor(imageCount * 0.7),
        complexImages: complexImages, // Only flag if there's evidence of complex images
        imageIssues: [],
        imagesByPage: this.distributeImagesAcrossPages(imageCount, pages)
      }
      
      return { 
        text, 
        pages,
        imageCount,
        tableCount,
        linkCount,
        imageAnalysis,
        pageAnalysis
      }
    } catch (error) {
      console.error('Word document parsing failed:', error)
      // Fallback to basic text extraction
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

  private async parsePowerPointComprehensive(buffer: Buffer): Promise<{
    text: string, 
    pages: number, 
    imageCount: number,
    tableCount: number,
    linkCount: number,
    imageAnalysis: ImageAnalysis,
    pageAnalysis: PageAnalysis[]
  }> {
    try {
      // For PowerPoint, we'll extract text content
      // In a full implementation, you'd use pptxjs to extract slides and images
      const text = buffer.toString('utf-8').substring(0, 2000) + '... [PowerPoint content extracted]'
      
      // Estimate pages (slides) based on content
      const pages = Math.max(1, Math.ceil(text.length / 500)) // Rough estimate
      
      // Analyze content for various elements
      const contentAnalysis = this.analyzeContentElements(text)
      const imageCount = contentAnalysis.imageCount
      const tableCount = contentAnalysis.tableCount
      const linkCount = contentAnalysis.linkCount
      
      // Create detailed page analysis
      const pageAnalysis = this.createDetailedPageAnalysis(text, pages)
      
      const imageAnalysis: ImageAnalysis = {
        totalImages: imageCount,
        imagesWithAltText: 0,
        imagesWithoutAltText: imageCount,
        decorativeImages: Math.floor(imageCount * 0.4), // PowerPoints tend to have more decorative images
        informativeImages: Math.floor(imageCount * 0.6),
        complexImages: Math.floor(imageCount * 0.3), // PowerPoints often have charts/diagrams
        imageIssues: [],
        imagesByPage: this.distributeImagesAcrossPages(imageCount, pages)
      }
      
      return { 
        text, 
        pages,
        imageCount,
        tableCount,
        linkCount,
        imageAnalysis,
        pageAnalysis
      }
    } catch (error) {
      console.error('PowerPoint parsing failed:', error)
      return { 
        text: buffer.toString('utf-8').substring(0, 1000) + '... [PowerPoint content extracted]',
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
      imageCount: Math.min(imageCount, 20), // Cap at 20
      tableCount: Math.min(tableCount, 10), // Cap at 10
      linkCount: Math.min(linkCount, 50)    // Cap at 50
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
    selectedTags?: string[]
  ): Promise<ComprehensiveDocumentIssue[]> {
    const issues: ComprehensiveDocumentIssue[] = []

    // Text analysis
    const textIssues = this.analyzeTextAccessibility(documentContent, documentType, pagesAnalyzed)
    issues.push(...textIssues)

    // Structure analysis
    const structureIssues = this.analyzeStructureAccessibility(documentContent, documentType, pagesAnalyzed)
    issues.push(...structureIssues)

    // Image analysis
    const imageIssues = this.analyzeImageAccessibility(imageAnalysis, documentType, pagesAnalyzed)
    issues.push(...imageIssues)

    // Comprehensive Section 508 compliance testing with selected tags
    const section508Issues = await this.testSection508Compliance(documentContent, documentType, pagesAnalyzed, selectedTags)
    issues.push(...section508Issues)

    return issues
  }

  private analyzeTextAccessibility(documentContent: string, documentType: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
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
    const listIssues = this.checkListStructure(documentContent, getPageAndLine)
    issues.push(...listIssues)

    // WCAG 2.4.4 Link Purpose (A): Descriptive link text
    const linkIssues = this.checkLinkText(documentContent, getPageAndLine)
    issues.push(...linkIssues)

    // WCAG 1.3.1 Info and Relationships (A): Table structure with headers
    const tableIssues = this.checkTableStructure(documentContent, getPageAndLine)
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

  private analyzeStructureAccessibility(documentContent: string, documentType: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
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

    // Check for document title - look for it in the first few lines
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

    // Check for language declaration - look for it in the first few lines
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

    // WCAG 1.3.1 Info and Relationships (A): Check heading structure
    const lines = documentContent.split('\n')
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

  private analyzeImageAccessibility(imageAnalysis: ImageAnalysis, documentType: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []

    // Helper function to find pages with images
    const findImagePages = (): number[] => {
      const pagesWithImages: number[] = []
      
      // Only include pages that actually have images (not just distributed)
      if (imageAnalysis.totalImages > 0) {
        // For now, assume images are on the first few pages if we can't determine exact location
        // This is a conservative approach - only flag pages we're confident have images
        const maxPagesWithImages = Math.min(5, pagesAnalyzed) // Assume max 5 pages have actual images
        for (let i = 1; i <= maxPagesWithImages; i++) {
          pagesWithImages.push(i)
        }
        console.log(`🎯 Assuming images are on pages 1-${maxPagesWithImages} (conservative estimate)`)
      }
      
      return pagesWithImages.length > 0 ? pagesWithImages : [1] // Default to page 1 if no specific pages found
    }

    const imagePages = findImagePages()

    // Check for images without alt text
    if (imageAnalysis.imagesWithoutAltText > 0) {
      // Distribute image issues across pages that have images
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
      // Use a different page if available to avoid clustering all issues on one page
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
  private async testSection508Compliance(documentContent: string, documentType: string, pagesAnalyzed: number, selectedTags?: string[]): Promise<ComprehensiveDocumentIssue[]> {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Define all available Section 508 tests
    const section508Tests = [
      { tag: '1194.22a', name: 'Text Alternatives', test: () => this.test1194_22a(documentContent, pagesAnalyzed) },
      { tag: '1194.22b', name: 'Media Alternatives', test: () => this.test1194_22b(documentContent, pagesAnalyzed) },
      { tag: '1194.22c', name: 'Information Relationships', test: () => this.test1194_22c(documentContent, pagesAnalyzed) },
      { tag: '1194.22d', name: 'Meaningful Sequence', test: () => this.test1194_22d(documentContent, pagesAnalyzed) },
      { tag: '1194.22e', name: 'Color Usage', test: () => this.test1194_22e(documentContent, pagesAnalyzed) },
      { tag: '1194.22f', name: 'Contrast', test: () => this.test1194_22f(documentContent, pagesAnalyzed) },
      { tag: '1194.22g', name: 'Visual Presentation', test: () => this.test1194_22g(documentContent, pagesAnalyzed) },
      { tag: '1194.22h', name: 'Keyboard Accessibility', test: () => this.test1194_22h(documentContent, pagesAnalyzed) },
      { tag: '1194.22i', name: 'No Keyboard Trap', test: () => this.test1194_22i(documentContent, pagesAnalyzed) },
      { tag: '1194.22j', name: 'Timing', test: () => this.test1194_22j(documentContent, pagesAnalyzed) },
      { tag: '1194.22k', name: 'Flashing', test: () => this.test1194_22k(documentContent, pagesAnalyzed) },
      { tag: '1194.22l', name: 'Text-only Page', test: () => this.test1194_22l(documentContent, pagesAnalyzed) },
      { tag: '1194.22m', name: 'Scripts', test: () => this.test1194_22m(documentContent, pagesAnalyzed) },
      { tag: '1194.22n', name: 'Plug-ins', test: () => this.test1194_22n(documentContent, pagesAnalyzed) },
      { tag: '1194.22o', name: 'Electronic Forms', test: () => this.test1194_22o(documentContent, pagesAnalyzed) },
      { tag: '1194.22p', name: 'Navigation', test: () => this.test1194_22p(documentContent, pagesAnalyzed) }
    ]
    
    // Determine which tests to run
    const testsToRun = selectedTags && selectedTags.length > 0 
      ? section508Tests.filter(test => selectedTags.includes(test.tag))
      : section508Tests
    
    console.log(`🔍 Testing Section 508 compliance for ${testsToRun.length} subsections: ${testsToRun.map(t => t.tag).join(', ')}`)
    
    // Run selected tests
    for (const test of testsToRun) {
      const testIssues = test.test()
      issues.push(...testIssues)
      console.log(`✅ ${test.name} (${test.tag}): ${testIssues.length} issues`)
    }
    
    console.log(`✅ Section 508 compliance testing complete: ${issues.length} issues found`)
    return issues
  }

  /**
   * 1194.22(a) - Text alternatives for non-text content
   */
  private test1194_22a(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for images without alt text - use single regex for efficiency
    const imageRegex = /(figure|image|photo|picture|graphic|chart|diagram)\s+\d+/gi
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (imageRegex.test(line)) {
        // Check if there's descriptive text nearby
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
    
    return issues
  }

  /**
   * 1194.22(b) - Synchronized media alternatives
   */
  private test1194_22b(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for media references - use single regex for efficiency
    const mediaRegex = /(video|audio|podcast|webinar|presentation.*video|recording|\.(mp4|avi|mov|wmv|flv|webm|mp3|wav|aac|ogg|wma)$)/i
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (mediaRegex.test(line)) {
        // Check if there are captions/transcripts mentioned
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
    
    return issues
  }

  /**
   * 1194.22(c) - Information and relationships
   */
  private test1194_22c(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for proper document structure
    const lines = documentContent.split('\n')
    
    // Check for heading hierarchy
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
  private test1194_22d(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check if content flows in a meaningful sequence
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
    
    return issues
  }

  /**
   * 1194.22(e) - Color alone
   */
  private test1194_22e(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for color-only information - use single regex for efficiency
    const colorRegex = /(required.*red|mandatory.*red|important.*red|warning.*red|error.*red|success.*green|approved.*green|rejected.*red)/i
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (colorRegex.test(line)) {
        issues.push({
          id: `1194_22e_${Date.now()}_${i}`,
          type: 'serious',
          category: 'color',
          description: 'Information conveyed by color alone (1194.22(e))',
          section: 'Section 508 - Color Usage',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Information must not be conveyed by color alone',
          wcagCriterion: 'WCAG 2.1 AA - 1.4.1 Use of Color',
          section508Requirement: '36 CFR § 1194.22(e) - Color Alone',
          impact: this.calculateImpact('serious'),
          remediation: 'Use additional indicators (text, symbols, patterns) beyond color.'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(f) - Contrast
   */
  private test1194_22f(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Note: Full contrast testing requires visual analysis
    // This is a basic check for potential contrast issues
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
          context: 'Text must have sufficient contrast ratio',
          wcagCriterion: 'WCAG 2.1 AA - 1.4.3 Contrast (Minimum)',
          section508Requirement: '36 CFR § 1194.22(f) - Contrast',
          impact: this.calculateImpact('moderate'),
          remediation: 'Ensure text has sufficient contrast ratio (4.5:1 for normal text, 3:1 for large text).'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(g) - Visual presentation
   */
  private test1194_22g(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for visual presentation issues
    const visualIssues = [
      'justified text',
      'centered text',
      'all caps',
      'small font',
      'tiny text'
    ]
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (visualIssues.some(issue => line.toLowerCase().includes(issue))) {
        issues.push({
          id: `1194_22g_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'font',
          description: 'Visual presentation issues detected (1194.22(g))',
          section: 'Section 508 - Visual Presentation',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Visual presentation must not interfere with readability',
          wcagCriterion: 'WCAG 2.1 AA - 1.4.8 Visual Presentation',
          section508Requirement: '36 CFR § 1194.22(g) - Visual Presentation',
          impact: this.calculateImpact('moderate'),
          remediation: 'Use readable fonts, adequate spacing, and avoid justified text.'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(h) - Keyboard
   */
  private test1194_22h(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for keyboard accessibility in forms and interactive elements
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
    
    return issues
  }

  /**
   * 1194.22(i) - No keyboard trap
   */
  private test1194_22i(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for potential keyboard traps
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
          remediation: 'Ensure users can navigate away from all content using standard keyboard commands.'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(j) - Timing
   */
  private test1194_22j(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for timing issues - use single regex for efficiency
    const timingRegex = /(time.*limit|timeout|expire|session.*time|auto.*logout|time.*out)/i
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (timingRegex.test(line)) {
        issues.push({
          id: `1194_22j_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'navigation',
          description: 'Timing issues detected (1194.22(j))',
          section: 'Section 508 - Timing',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Users must have sufficient time to read and use content',
          wcagCriterion: 'WCAG 2.1 AA - 2.2.1 Timing Adjustable',
          section508Requirement: '36 CFR § 1194.22(j) - Timing',
          impact: this.calculateImpact('moderate'),
          remediation: 'Provide sufficient time for users to read and interact with content.'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(k) - Flashing
   */
  private test1194_22k(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for flashing content - use single regex for efficiency
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
    
    return issues
  }

  /**
   * 1194.22(l) - Text-only page
   */
  private test1194_22l(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check if document provides text-only alternative - use single regex for efficiency
    const textOnlyRegex = /(text.*only|accessible.*version|alternative.*format|plain.*text)/i
    
    const hasTextOnly = textOnlyRegex.test(documentContent)
    
    if (!hasTextOnly && documentContent.length > 1000) {
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
    
    return issues
  }

  /**
   * 1194.22(m) - Scripts
   */
  private test1194_22m(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for script-related accessibility issues - use single regex for efficiency
    const scriptRegex = /(javascript|script|onclick|onload|onmouse)/i
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (scriptRegex.test(line)) {
        issues.push({
          id: `1194_22m_${Date.now()}_${i}`,
          type: 'moderate',
          category: 'navigation',
          description: 'Script accessibility issues detected (1194.22(m))',
          section: 'Section 508 - Scripts',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Scripts must be accessible or have alternatives',
          wcagCriterion: 'WCAG 2.1 AA - 2.1.1 Keyboard',
          section508Requirement: '36 CFR § 1194.22(m) - Scripts',
          impact: this.calculateImpact('moderate'),
          remediation: 'Ensure scripts are keyboard accessible or provide alternatives.'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(n) - Plug-ins
   */
  private test1194_22n(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for plug-in requirements - use single regex for efficiency
    const pluginRegex = /(flash.*player|java.*applet|quicktime|real.*player|shockwave|silverlight)/i
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (pluginRegex.test(line)) {
        issues.push({
          id: `1194_22n_${Date.now()}_${i}`,
          type: 'serious',
          category: 'media',
          description: 'Plug-in accessibility issues detected (1194.22(n))',
          section: 'Section 508 - Plug-ins',
          pageNumber: Math.floor(i / (lines.length / pagesAnalyzed)) + 1,
          lineNumber: i + 1,
          elementLocation: line.substring(0, 50),
          context: 'Plug-ins must be accessible or have alternatives',
          wcagCriterion: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
          section508Requirement: '36 CFR § 1194.22(n) - Plug-ins',
          impact: this.calculateImpact('serious'),
          remediation: 'Provide accessible alternatives for plug-in content.'
        })
      }
    }
    
    return issues
  }

  /**
   * 1194.22(o) - Electronic forms
   */
  private test1194_22o(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
    // Check for form accessibility - use single regex for efficiency
    const formRegex = /(form|input|submit|required|mandatory|field)/i
    
    const lines = documentContent.split('\n')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (formRegex.test(line)) {
        // Check for form accessibility issues
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
    
    return issues
  }

  /**
   * 1194.22(p) - Navigation
   */
  private test1194_22p(documentContent: string, pagesAnalyzed: number): ComprehensiveDocumentIssue[] {
    const issues: ComprehensiveDocumentIssue[] = []
    
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

  private checkMeaningfulSequence(lines: string[]): { isValid: boolean; page?: number; line?: number } {
    // Basic check for meaningful sequence
    // In a real implementation, this would analyze content flow
    return { isValid: true }
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
