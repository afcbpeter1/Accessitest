// PowerPoint parser using pptx library for structure extraction

export interface ParsedPowerPointStructure {
  text: string
  pages: number // slides
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
      page: number // slide number
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
 * Real PowerPoint parser that extracts actual document structure, metadata, and elements
 * PowerPoint files are ZIP archives containing XML files
 */
export class PowerPointParser {
  async parsePowerPoint(buffer: Buffer): Promise<ParsedPowerPointStructure> {
    try {
      // PowerPoint files (.pptx) are ZIP archives
      // We'll use a library to extract content, but for now we'll parse the XML structure
      // Try using pptx library if available
      let slides: any[] = []
      let text = ''
      let metadata: any = {}
      
      try {
        // PowerPoint files are ZIP archives - extract and parse XML
        // Note: pptx library is not currently used, parsing ZIP structure directly
        const JSZip = require('jszip')
        const zip = await JSZip.loadAsync(buffer)
        
        // Extract presentation metadata
        const coreProps = await zip.file('docProps/core.xml')?.async('string')
        if (coreProps) {
          metadata = this.extractMetadataFromXML(coreProps)
        }
        
        // Extract slide content
        const presentationXML = await zip.file('ppt/presentation.xml')?.async('string')
        if (presentationXML) {
          const slideRels = this.extractSlideReferences(presentationXML)
          
          // Parse each slide
          for (let i = 0; i < slideRels.length; i++) {
            const slideId = slideRels[i]
            const slideXML = await zip.file(`ppt/slides/slide${slideId}.xml`)?.async('string')
            if (slideXML) {
              const slideContent = this.parseSlideXML(slideXML, i + 1)
              slides.push(slideContent)
              text += slideContent.text + '\n'
            }
          }
        }
      } catch (libraryError) {
        console.warn('⚠️ PowerPoint library parsing failed, using fallback:', libraryError)
        // Fallback: Extract text from buffer (basic approach)
        text = buffer.toString('utf-8')
          .replace(/[^\x20-\x7E\n\r\t]/g, '')
          .substring(0, 5000)
      }
      
      // Extract structure from slides
      const structure = this.extractStructureFromSlides(slides)
      
      // Extract images
      const images = this.extractImagesFromSlides(slides)
      
      // Extract links
      const links = this.extractLinksFromSlides(slides)
      
      return {
        text,
        pages: slides.length || Math.max(1, Math.ceil(text.split(/\s+/).length / 100)),
        metadata: {
          title: metadata.title || null,
          author: metadata.author || null,
          subject: metadata.subject || null,
          creator: metadata.creator || null,
          language: metadata.language || null,
          creationDate: metadata.creationDate || null,
          modificationDate: metadata.modificationDate || null,
        },
        structure,
        images,
        links,
        formFields: [], // PowerPoint doesn't typically have form fields
        textColors: [], // Will be populated when we add contrast analysis
      }
    } catch (error) {
      console.error('❌ PowerPoint parsing error:', error)
      throw new Error(`Failed to parse PowerPoint: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Extract metadata from core.xml
   */
  private extractMetadataFromXML(xml: string): any {
    const metadata: any = {}
    
    // Simple XML parsing (for production, use proper XML parser)
    const titleMatch = xml.match(/<dc:title>(.*?)<\/dc:title>/i)
    if (titleMatch) metadata.title = titleMatch[1]
    
    const authorMatch = xml.match(/<dc:creator>(.*?)<\/dc:creator>/i)
    if (authorMatch) metadata.author = authorMatch[1]
    
    const subjectMatch = xml.match(/<dc:subject>(.*?)<\/dc:subject>/i)
    if (subjectMatch) metadata.subject = subjectMatch[1]
    
    return metadata
  }
  
  /**
   * Extract slide references from presentation.xml
   */
  private extractSlideReferences(xml: string): string[] {
    const slideIds: string[] = []
    const matches = xml.match(/rId(\d+)/g)
    if (matches) {
      slideIds.push(...matches.map(m => m.replace('rId', '')))
    }
    return slideIds.length > 0 ? slideIds : ['1'] // Default to slide 1
  }
  
  /**
   * Parse individual slide XML
   */
  private parseSlideXML(slideXML: string, slideNumber: number): {
    text: string
    headings: Array<{ level: number; text: string }>
    lists: Array<{ type: 'ordered' | 'unordered'; items: string[] }>
    tables: Array<{ rows: number; columns: number; hasHeaders: boolean }>
    images: Array<{ altText: string | null }>
    links: Array<{ text: string; url: string }>
  } {
    const text = slideXML.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
    
    // Extract headings (text in shape elements with larger font sizes)
    const headings: Array<{ level: number; text: string }> = []
    const headingRegex = /<a:t[^>]*>(.*?)<\/a:t>/gi
    let match
    while ((match = headingRegex.exec(slideXML)) !== null) {
      const headingText = match[1].trim()
      if (headingText.length > 0 && headingText.length < 200) {
        headings.push({ level: 1, text: headingText })
      }
    }
    
    // Extract lists (bullets in PowerPoint)
    const lists: Array<{ type: 'ordered' | 'unordered'; items: string[] }> = []
    // PowerPoint uses bullet points - detect bullet lists
    const bulletMatches = slideXML.match(/<a:buFont[^>]*>.*?<\/a:buFont>/gi)
    if (bulletMatches) {
      const items: string[] = []
      const textMatches = slideXML.match(/<a:t[^>]*>(.*?)<\/a:t>/gi)
      if (textMatches) {
        textMatches.forEach(tm => {
          const itemText = tm.replace(/<[^>]*>/g, '').trim()
          if (itemText.length > 0) items.push(itemText)
        })
      }
      if (items.length > 0) {
        lists.push({ type: 'unordered', items })
      }
    }
    
    // Extract tables
    const tables: Array<{ rows: number; columns: number; hasHeaders: boolean }> = []
    const tableMatches = slideXML.match(/<a:tbl[^>]*>.*?<\/a:tbl>/gi)
    if (tableMatches) {
      tableMatches.forEach(() => {
        const rowMatches = slideXML.match(/<a:tr[^>]*>/gi)
        const colMatches = slideXML.match(/<a:tc[^>]*>/gi)
        tables.push({
          rows: rowMatches ? rowMatches.length : 0,
          columns: colMatches && rowMatches ? Math.floor(colMatches.length / rowMatches.length) : 0,
          hasHeaders: false, // Would need to check first row styling
        })
      })
    }
    
    // Extract images
    const images: Array<{ altText: string | null }> = []
    const imageMatches = slideXML.match(/<a:blip[^>]*r:embed="([^"]*)"/gi)
    if (imageMatches) {
      imageMatches.forEach(() => {
        images.push({ altText: null }) // PowerPoint doesn't store alt text in XML easily
      })
    }
    
    // Extract links
    const links: Array<{ text: string; url: string }> = []
    const linkRegex = /<a:hlinkClick[^>]*r:id="([^"]*)"[^>]*>.*?<a:t[^>]*>(.*?)<\/a:t>/gi
    let linkMatch
    while ((linkMatch = linkRegex.exec(slideXML)) !== null) {
      links.push({
        text: linkMatch[2] || '',
        url: linkMatch[1] || '',
      })
    }
    
    return { text, headings, lists, tables, images, links }
  }
  
  /**
   * Extract structure from parsed slides
   */
  private extractStructureFromSlides(slides: any[]): {
    headings: Array<{ level: number; text: string; page: number }>
    lists: Array<{ type: 'ordered' | 'unordered'; items: string[]; page: number }>
    tables: Array<{ rows: number; columns: number; hasHeaders: boolean; page: number }>
  } {
    const headings: Array<{ level: number; text: string; page: number }> = []
    const lists: Array<{ type: 'ordered' | 'unordered'; items: string[]; page: number }> = []
    const tables: Array<{ rows: number; columns: number; hasHeaders: boolean; page: number }> = []
    
    slides.forEach((slide, index) => {
      const slideNumber = index + 1
      
      // Add headings
      if (slide.headings) {
        slide.headings.forEach((h: any) => {
          headings.push({
            level: h.level,
            text: h.text,
            page: slideNumber,
          })
        })
      }
      
      // Add lists
      if (slide.lists) {
        slide.lists.forEach((l: any) => {
          lists.push({
            type: l.type,
            items: l.items,
            page: slideNumber,
          })
        })
      }
      
      // Add tables
      if (slide.tables) {
        slide.tables.forEach((t: any) => {
          tables.push({
            rows: t.rows,
            columns: t.columns,
            hasHeaders: t.hasHeaders,
            page: slideNumber,
          })
        })
      }
    })
    
    return { headings, lists, tables }
  }
  
  /**
   * Extract images from slides
   */
  private extractImagesFromSlides(slides: any[]): Array<{
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
    
    slides.forEach((slide, index) => {
      if (slide.images) {
        slide.images.forEach((img: any, imgIndex: number) => {
        // Extract dimensions from XML if available
        const slideXML = (slide as any).xml || ''
        const widthMatch = slideXML ? slideXML.match(/<a:ext[^>]*cx=["'](\d+)["']/i) : null
        const heightMatch = slideXML ? slideXML.match(/<a:ext[^>]*cy=["'](\d+)["']/i) : null
        const width = widthMatch ? parseInt(widthMatch[1]) : 0 // 0 if unknown
        const height = heightMatch ? parseInt(heightMatch[1]) : 0 // 0 if unknown
        
        images.push({
          id: `slide_${index + 1}_image_${imgIndex}`,
          page: index + 1,
          altText: img.altText,
          width: width, // Actual width, 0 if unknown
          height: height, // Actual height, 0 if unknown
          type: 'image',
          isAnimated: false, // PowerPoint animations are separate from images
        })
        })
      }
    })
    
    return images
  }
  
  /**
   * Extract links from slides
   */
  private extractLinksFromSlides(slides: any[]): Array<{
    text: string
    url: string
    page: number
  }> {
    const links: Array<{ text: string; url: string; page: number }> = []
    
    slides.forEach((slide, index) => {
      if (slide.links) {
        slide.links.forEach((link: any) => {
          links.push({
            text: link.text,
            url: link.url,
            page: index + 1,
          })
        })
      }
    })
    
    return links
  }
}
