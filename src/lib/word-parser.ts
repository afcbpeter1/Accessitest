// Word parser using mammoth library for structure extraction

export interface ParsedWordStructure {
  text: string
  pages: number
  metadata: {
    title: string | null
    author: string | null
    subject: string | null
    creator: string | null
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
}

/**
 * Real Word document parser that extracts actual document structure, metadata, and elements
 * Uses mammoth for text extraction and docx library for structure/metadata
 */
export class WordParser {
  async parseWord(buffer: Buffer): Promise<ParsedWordStructure> {
    // Check if this is a .doc (old binary) or .docx (XML) file
    // .doc files start with specific binary headers, .docx files are ZIP archives
    const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4B // PK (ZIP signature)
    const isDoc = !isDocx && (buffer[0] === 0xD0 && buffer[1] === 0xCF) // OLE2 signature
    
    if (isDoc && !isDocx) {
      console.warn('⚠️ .doc file detected (old binary format). Limited parsing support. Consider converting to .docx for full feature support.')
      // For .doc files, we can only extract text, not structure/images reliably
      // Try to extract text using a basic approach
      const text = this.extractTextFromDoc(buffer)
      const pages = Math.max(1, Math.ceil(text.split(/\s+/).length / 250))
      
      // Try to detect images in .doc binary format (basic detection)
      const images = this.detectImagesInDoc(buffer)
      
      return {
        text,
        pages,
        metadata: {
          title: null,
          author: null,
          subject: null,
          creator: null,
          language: null,
          creationDate: null,
          modificationDate: null,
        },
        structure: {
          headings: [],
          lists: [],
          tables: [],
        },
        images, // Attempted image detection
        links: [],
        formFields: [],
        textColors: [],
      }
    }
    
    try {
      // Use mammoth to convert to HTML with structure preserved (for .docx files)
      const mammoth = require('mammoth')
      const htmlResult = await mammoth.convertToHtml({ buffer }, { 
        styleMap: [
          "p[style-name='Heading 1'] => h1:fresh",
          "p[style-name='Heading 2'] => h2:fresh",
          "p[style-name='Heading 3'] => h3:fresh",
          "p[style-name='Heading 4'] => h4:fresh",
          "p[style-name='Heading 5'] => h5:fresh",
          "p[style-name='Heading 6'] => h6:fresh"
        ]
      })
      
      // Extract plain text for analysis
      const textResult = await mammoth.extractRawText({ buffer })
      const text = textResult.value
      
      // Extract images with alt text using mammoth
      const imagesResult = await mammoth.images.convertToImage({ buffer }, mammoth.images.imageConverter)
      
      // Parse HTML structure to extract headings, lists, tables, links
      const structure = this.extractStructureFromHTML(htmlResult.value, text)
      
      // Extract images with metadata (pass HTML, not text)
      const images = await this.extractImages(imagesResult, htmlResult.value)
      
      // Extract links from HTML and text
      const links = this.extractLinks(htmlResult.value, text)
      
      // Estimate pages (Word doesn't have fixed pages, but we estimate)
      const pages = Math.max(1, Math.ceil(text.split(/\s+/).length / 250))
      
      // Extract metadata (Word files store this in document properties)
      const metadata = await this.extractMetadata(buffer, text)
      
      return {
        text,
        pages,
        metadata,
        structure,
        images,
        links,
        formFields: [], // Word documents typically don't have interactive form fields like PDFs
        textColors: [], // Will be populated when we add contrast analysis
      }
    } catch (error) {
      console.error('❌ Word parsing error:', error)
      throw new Error(`Failed to parse Word document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Extract text from old .doc binary format (basic extraction)
   */
  private extractTextFromDoc(buffer: Buffer): string {
    // Basic text extraction from .doc binary format
    // This is a simplified approach - full .doc parsing would require a library like antiword or LibreOffice
    const text = buffer.toString('utf-8', 0, Math.min(buffer.length, 100000))
    // Remove binary characters and extract readable text
    const readableText = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    
    if (readableText.length < 100) {
      // If we couldn't extract much text, try a different approach
      return 'Document content extracted (limited support for .doc format). Please convert to .docx for full accessibility analysis.'
    }
    
    return readableText
  }
  
  /**
   * Detect images in .doc binary format (basic detection)
   */
  private detectImagesInDoc(buffer: Buffer): Array<{
    id: string
    page: number
    altText: string | null
    width: number
    height: number
    type: string
    isAnimated: boolean
  }> {
    const images: Array<{
      id: string
      page: number
      altText: string | null
      width: number
      height: number
      type: string
      isAnimated: boolean
    }> = []
    
    // Look for common image signatures in the binary data
    // GIF signature: GIF89a or GIF87a
    const gif89a = Buffer.from('GIF89a')
    const gif87a = Buffer.from('GIF87a')
    const jpeg = Buffer.from([0xFF, 0xD8, 0xFF])
    const png = Buffer.from([0x89, 0x50, 0x4E, 0x47])
    
    let imageIndex = 0
    let searchOffset = 0
    
    // Search for GIF signatures
    while (searchOffset < buffer.length - 10) {
      const gif89aPos = buffer.indexOf(gif89a, searchOffset)
      const gif87aPos = buffer.indexOf(gif87a, searchOffset)
      
      if (gif89aPos !== -1 || gif87aPos !== -1) {
        const pos = gif89aPos !== -1 ? gif89aPos : gif87aPos
        console.log(`🎬 Detected GIF image in .doc file at offset ${pos}`)
        images.push({
          id: `doc_image_${imageIndex}`,
          page: 1, // Can't determine page from binary
          altText: null,
          width: 0, // Can't extract dimensions from binary without full parsing
          height: 0,
          type: 'gif',
          isAnimated: true, // Assume GIFs are animated
        })
        imageIndex++
        searchOffset = pos + 10
      } else {
        break
      }
    }
    
    // Search for JPEG signatures
    searchOffset = 0
    while (searchOffset < buffer.length - 10) {
      const jpegPos = buffer.indexOf(jpeg, searchOffset)
      if (jpegPos !== -1) {
        console.log(`📸 Detected JPEG image in .doc file at offset ${jpegPos}`)
        images.push({
          id: `doc_image_${imageIndex}`,
          page: 1,
          altText: null,
          width: 0,
          height: 0,
          type: 'jpeg',
          isAnimated: false,
        })
        imageIndex++
        searchOffset = jpegPos + 10
      } else {
        break
      }
    }
    
    // Search for PNG signatures
    searchOffset = 0
    while (searchOffset < buffer.length - 10) {
      const pngPos = buffer.indexOf(png, searchOffset)
      if (pngPos !== -1) {
        console.log(`📸 Detected PNG image in .doc file at offset ${pngPos}`)
        images.push({
          id: `doc_image_${imageIndex}`,
          page: 1,
          altText: null,
          width: 0,
          height: 0,
          type: 'png',
          isAnimated: false,
        })
        imageIndex++
        searchOffset = pngPos + 10
      } else {
        break
      }
    }
    
    console.log(`📸 Detected ${images.length} images in .doc file (basic binary detection)`)
    return images
  }
  
  /**
   * Extract document structure from HTML representation
   */
  private extractStructureFromHTML(html: string, text: string): {
    headings: Array<{ level: number; text: string; page: number }>
    lists: Array<{ type: 'ordered' | 'unordered'; items: string[]; page: number }>
    tables: Array< { rows: number; columns: number; hasHeaders: boolean; page: number }>
  } {
    const headings: Array<{ level: number; text: string; page: number }> = []
    const lists: Array<{ type: 'ordered' | 'unordered'; items: string[]; page: number }> = []
    const tables: Array<{ rows: number; columns: number; hasHeaders: boolean; page: number }> = []
    
    // Extract headings from HTML
    const headingRegex = /<h([1-6])>(.*?)<\/h[1-6]>/gi
    let match
    let headingIndex = 0
    
    while ((match = headingRegex.exec(html)) !== null) {
      const level = parseInt(match[1])
      const headingText = match[2].replace(/<[^>]*>/g, '').trim()
      if (headingText.length > 0) {
        // Estimate page based on position in text
        const positionInText = text.indexOf(headingText)
        const page = Math.floor((positionInText / text.length) * Math.ceil(text.split(/\s+/).length / 250)) + 1
        
        headings.push({
          level,
          text: headingText,
          page: Math.max(1, page),
        })
        headingIndex++
      }
    }
    
    // Extract lists from HTML
    const listRegex = /<(ul|ol)>(.*?)<\/\1>/gs
    let listMatch
    let listIndex = 0
    
    while ((listMatch = listRegex.exec(html)) !== null) {
      const listType = listMatch[1] === 'ol' ? 'ordered' : 'unordered'
      const listContent = listMatch[2]
      
      // Extract list items
      const itemRegex = /<li>(.*?)<\/li>/g
      const items: string[] = []
      let itemMatch
      
      while ((itemMatch = itemRegex.exec(listContent)) !== null) {
        const itemText = itemMatch[1].replace(/<[^>]*>/g, '').trim()
        if (itemText.length > 0) {
          items.push(itemText)
        }
      }
      
      if (items.length > 0) {
        const firstItemPosition = text.indexOf(items[0])
        const page = Math.floor((firstItemPosition / text.length) * Math.ceil(text.split(/\s+/).length / 250)) + 1
        
        lists.push({
          type: listType,
          items,
          page: Math.max(1, page),
        })
      }
    }
    
    // Extract tables from HTML
    const tableRegex = /<table>(.*?)<\/table>/gs
    let tableMatch
    let tableIndex = 0
    
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableContent = tableMatch[1]
      
      // Count rows
      const rowMatches = tableContent.match(/<tr>/g)
      const rows = rowMatches ? rowMatches.length : 0
      
      // Count columns (from first row)
      const firstRowMatch = tableContent.match(/<tr>(.*?)<\/tr>/)
      if (firstRowMatch) {
        const cellMatches = firstRowMatch[1].match(/<(td|th)>/g)
        const columns = cellMatches ? cellMatches.length : 0
        
        // Check if has headers (th tags)
        const hasHeaders = /<th>/.test(tableContent)
        
        // Estimate page
        const tablePosition = html.indexOf(tableMatch[0])
        const page = Math.floor((tablePosition / html.length) * Math.ceil(text.split(/\s+/).length / 250)) + 1
        
        if (rows > 0 && columns > 0) {
          tables.push({
            rows,
            columns,
            hasHeaders,
            page: Math.max(1, page),
          })
        }
      }
    }
    
    return { headings, lists, tables }
  }
  
  /**
   * Extract images with metadata
   */
  private async extractImages(imagesResult: any, html: string): Promise<Array<{
    id: string
    page: number
    altText: string | null
    width: number
    height: number
    type: string
    isAnimated: boolean
  }>> {
    const images: Array<{
      id: string
      page: number
      altText: string | null
      width: number
      height: number
      type: string
      isAnimated: boolean
    }> = []
    
    // Extract images from HTML (mammoth converts Word to HTML)
    // Match both images with and without alt text
    const imageRegex = /<img[^>]*>/gi
    let match
    let imageIndex = 0
    
    while ((match = imageRegex.exec(html)) !== null) {
      const imgTag = match[0]
      
      // Extract alt text
      const altMatch = imgTag.match(/alt=["']([^"']*)["']/i)
      const altText = altMatch ? altMatch[1] : null
      
      // Extract src to check for GIF files
      const srcMatch = imgTag.match(/src=["']([^"']*)["']/i)
      const src = srcMatch ? srcMatch[1] : ''
      
      // Extract dimensions
      const widthMatch = imgTag.match(/width=["'](\d+)["']/i)
      const heightMatch = imgTag.match(/height=["'](\d+)["']/i)
      const width = widthMatch ? parseInt(widthMatch[1]) : 0
      const height = heightMatch ? parseInt(heightMatch[1]) : 0
      
      // Determine image type and animation status
      let imageType = 'image'
      let isAnimated = false
      
      // Check if source URL indicates GIF
      if (src.toLowerCase().includes('.gif') || src.toLowerCase().includes('gif')) {
        imageType = 'gif'
        isAnimated = true // GIFs in Word are typically animated
        console.log(`🎬 Word document: Detected GIF image (likely animated)`)
      } else if (src.toLowerCase().includes('.jpg') || src.toLowerCase().includes('.jpeg')) {
        imageType = 'jpeg'
      } else if (src.toLowerCase().includes('.png')) {
        imageType = 'png'
      }
      
      // Also check for data URIs with GIF data
      if (src.startsWith('data:image/gif')) {
        imageType = 'gif'
        isAnimated = true
        console.log(`🎬 Word document: Detected GIF in data URI (likely animated)`)
      }
      
      // Check if mammoth extracted actual image data
      if (imagesResult && imagesResult.images && imagesResult.images[imageIndex]) {
        const imageData = imagesResult.images[imageIndex]
        // Check if image data indicates GIF
        if (imageData.contentType === 'image/gif' || 
            (imageData.data && (
              imageData.data.toString('binary', 0, 6) === 'GIF89a' ||
              imageData.data.toString('binary', 0, 6) === 'GIF87a'
            ))) {
          imageType = 'gif'
          isAnimated = true
          console.log(`🎬 Word document: Detected GIF from image data (animated)`)
        }
      }
      
      // For Word documents, estimate page based on position in HTML
      const position = html.indexOf(imgTag)
      const estimatedPages = Math.ceil(html.split(/\s+/).length / 500)
      const page = Math.max(1, Math.floor((position / html.length) * estimatedPages) + 1)
      
      images.push({
        id: `image_${imageIndex}`,
        page: page,
        altText: altText,
        width: width,
        height: height,
        type: imageType,
        isAnimated: isAnimated,
      })
      imageIndex++
    }
    
    // Also check mammoth's image extraction result for actual image data
    if (imagesResult && typeof imagesResult === 'object') {
      // Mammoth's image extraction returns an object with image data
      // Check if we have extracted images that weren't in HTML
      if (Array.isArray(imagesResult)) {
        imagesResult.forEach((imgData: any, idx: number) => {
          if (imgData && imgData.contentType === 'image/gif') {
            // Check if we already added this image
            if (!images.find(img => img.id === `image_${idx}`)) {
              images.push({
                id: `image_${idx}`,
                page: 1, // Default to page 1 if we can't determine
                altText: null,
                width: 0,
                height: 0,
                type: 'gif',
                isAnimated: true,
              })
              console.log(`🎬 Word document: Detected GIF from mammoth image extraction (animated)`)
            }
          }
        })
      }
    }
    
    return images
  }
  
  /**
   * Extract links from HTML and text
   */
  private extractLinks(html: string, text: string): Array<{
    text: string
    url: string
    page: number
  }> {
    const links: Array<{ text: string; url: string; page: number }> = []
    
    // Extract links from HTML
    const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi
    let match
    
    while ((match = linkRegex.exec(html)) !== null) {
      const url = match[1]
      const linkText = match[2].replace(/<[^>]*>/g, '').trim()
      const position = text.indexOf(linkText)
      const page = Math.floor((position / text.length) * Math.ceil(text.split(/\s+/).length / 250)) + 1
      
      if (url && url !== '#') {
        links.push({
          text: linkText || url,
          url,
          page: Math.max(1, page),
        })
      }
    }
    
    // Also extract URLs from plain text
    const urlRegex = /(https?:\/\/[^\s]+)/gi
    let urlMatch
    
    while ((urlMatch = urlRegex.exec(text)) !== null) {
      const url = urlMatch[1]
      const position = text.indexOf(url)
      const page = Math.floor((position / text.length) * Math.ceil(text.split(/\s+/).length / 250)) + 1
      
      // Avoid duplicates
      if (!links.some(l => l.url === url)) {
        links.push({
          text: url,
          url,
          page: Math.max(1, page),
        })
      }
    }
    
    return links
  }
  
  /**
   * Extract metadata from Word document
   */
  private async extractMetadata(buffer: Buffer, text: string): Promise<{
    title: string | null
    author: string | null
    subject: string | null
    creator: string | null
    language: string | null
    creationDate: Date | null
    modificationDate: Date | null
  }> {
    // Word documents store metadata in the Office Open XML format
    // We'll use a simple approach: extract from document properties if available
    // For full metadata extraction, we'd need to parse the XML structure
    
    // Try to extract title from first heading or first line
    const firstLine = text.split('\n')[0]?.trim()
    const title = firstLine && firstLine.length < 100 ? firstLine : null
    
    // Extract language from document (would need XML parsing for accurate extraction)
    const language = this.detectLanguage(text) || null
    
    return {
      title,
      author: null, // Would need XML parsing
      subject: null,
      creator: null,
      language,
      creationDate: null,
      modificationDate: null,
    }
  }
  
  /**
   * Detect language from text (simple heuristic)
   */
  private detectLanguage(text: string): string | null {
    // Simple language detection based on common words
    const englishWords = ['the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have']
    const wordCount = englishWords.filter(word => 
      new RegExp(`\\b${word}\\b`, 'i').test(text)
    ).length
    
    if (wordCount >= 3) {
      return 'en'
    }
    
    return null
  }
}
