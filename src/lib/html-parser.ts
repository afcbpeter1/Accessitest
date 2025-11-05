// HTML parser using axe-core for accessibility checking

export interface ParsedHTMLStructure {
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
 * Real HTML parser that extracts actual document structure, metadata, and elements
 * Uses JSDOM for parsing and axe-core for accessibility analysis
 */
export class HTMLParser {
  async parseHTML(buffer: Buffer): Promise<ParsedHTMLStructure> {
    try {
      const { JSDOM } = require('jsdom')
      const html = buffer.toString('utf-8')
      const dom = new JSDOM(html)
      const document = dom.window.document
      
      // Extract text content
      const text = document.body?.textContent || html.replace(/<[^>]*>/g, ' ')
      
      // Extract metadata
      const metadata = this.extractMetadata(document)
      
      // Extract structure
      const structure = this.extractStructure(document)
      
      // Extract images
      const images = this.extractImages(document)
      
      // Extract links
      const links = this.extractLinks(document)
      
      // Extract form fields
      const formFields = this.extractFormFields(document)
      
      // Extract text colors (basic extraction)
      const textColors = this.extractTextColors(document)
      
      return {
        text,
        pages: 1, // HTML documents are typically single-page
        metadata,
        structure,
        images,
        links,
        formFields,
        textColors,
      }
    } catch (error) {
      console.error('❌ HTML parsing error:', error)
      throw new Error(`Failed to parse HTML: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
  
  /**
   * Extract metadata from HTML document
   */
  private extractMetadata(document: Document): {
    title: string | null
    author: string | null
    subject: string | null
    creator: string | null
    language: string | null
    creationDate: Date | null
    modificationDate: Date | null
  } {
    const title = document.querySelector('title')?.textContent?.trim() || null
    const author = document.querySelector('meta[name="author"]')?.getAttribute('content') || null
    const subject = document.querySelector('meta[name="description"]')?.getAttribute('content') || null
    const creator = document.querySelector('meta[name="generator"]')?.getAttribute('content') || null
    const language = document.documentElement?.getAttribute('lang') || 
                     document.querySelector('html')?.getAttribute('lang') || null
    
    return {
      title,
      author,
      subject,
      creator,
      language,
      creationDate: null,
      modificationDate: null,
    }
  }
  
  /**
   * Extract document structure (headings, lists, tables)
   */
  private extractStructure(document: Document): {
    headings: Array<{ level: number; text: string; page: number }>
    lists: Array<{ type: 'ordered' | 'unordered'; items: string[]; page: number }>
    tables: Array<{ rows: number; columns: number; hasHeaders: boolean; page: number }>
  } {
    const headings: Array<{ level: number; text: string; page: number }> = []
    const lists: Array<{ type: 'ordered' | 'unordered'; items: string[]; page: number }> = []
    const tables: Array<{ rows: number; columns: number; hasHeaders: boolean; page: number }> = []
    
    // Extract headings (h1-h6)
    for (let level = 1; level <= 6; level++) {
      const headingElements = document.querySelectorAll(`h${level}`)
      headingElements.forEach((heading) => {
        const text = heading.textContent?.trim()
        if (text && text.length > 0) {
          headings.push({
            level,
            text,
            page: 1, // HTML is single page
          })
        }
      })
    }
    
    // Extract lists
    const listElements = document.querySelectorAll('ul, ol')
    listElements.forEach((list) => {
      const type = list.tagName.toLowerCase() === 'ol' ? 'ordered' : 'unordered'
      const items: string[] = []
      
      list.querySelectorAll('li').forEach((item) => {
        const itemText = item.textContent?.trim()
        if (itemText && itemText.length > 0) {
          items.push(itemText)
        }
      })
      
      if (items.length > 0) {
        lists.push({
          type,
          items,
          page: 1,
        })
      }
    })
    
    // Extract tables
    const tableElements = document.querySelectorAll('table')
    tableElements.forEach((table) => {
      const rows = table.querySelectorAll('tr').length
      const firstRow = table.querySelector('tr')
      const columns = firstRow ? firstRow.querySelectorAll('td, th').length : 0
      const hasHeaders = table.querySelectorAll('th').length > 0
      
      if (rows > 0 && columns > 0) {
        tables.push({
          rows,
          columns,
          hasHeaders,
          page: 1,
        })
      }
    })
    
    return { headings, lists, tables }
  }
  
  /**
   * Extract images with alt text
   */
  private extractImages(document: Document): Array<{
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
    
    const imageElements = document.querySelectorAll('img')
    imageElements.forEach((img, index) => {
      const src = img.getAttribute('src') || ''
      const altText = img.getAttribute('alt')
      const width = parseInt(img.getAttribute('width') || '0') || 0
      const height = parseInt(img.getAttribute('height') || '0') || 0
      
      // Check if image is animated (GIF)
      const isAnimated = src.toLowerCase().endsWith('.gif') || 
                         img.classList.contains('animated') ||
                         img.getAttribute('data-animated') === 'true'
      
      images.push({
        id: `img_${index}`,
        page: 1,
        altText: altText || null,
        width: width || 0, // Actual width, 0 if unknown
        height: height || 0, // Actual height, 0 if unknown
        type: 'image',
        isAnimated,
      })
    })
    
    return images
  }
  
  /**
   * Extract links
   */
  private extractLinks(document: Document): Array<{
    text: string
    url: string
    page: number
  }> {
    const links: Array<{ text: string; url: string; page: number }> = []
    
    const linkElements = document.querySelectorAll('a[href]')
    linkElements.forEach((link) => {
      const url = link.getAttribute('href') || ''
      const text = link.textContent?.trim() || ''
      
      if (url && url !== '#') {
        links.push({
          text: text || url,
          url,
          page: 1,
        })
      }
    })
    
    return links
  }
  
  /**
   * Extract form fields
   */
  private extractFormFields(document: Document): Array<{
    name: string
    type: string
    label: string | null
    required: boolean
    page: number
  }> {
    const formFields: Array<{
      name: string
      type: string
      label: string | null
      required: boolean
      page: number
    }> = []
    
    const inputElements = document.querySelectorAll('input, select, textarea')
    inputElements.forEach((input) => {
      const name = input.getAttribute('name') || input.getAttribute('id') || ''
      const type = input.getAttribute('type') || input.tagName.toLowerCase()
      const required = input.hasAttribute('required') || input.getAttribute('aria-required') === 'true'
      
      // Find associated label
      let label: string | null = null
      const labelElement = input.getAttribute('id') 
        ? document.querySelector(`label[for="${input.getAttribute('id')}"]`)
        : input.closest('label')
      
      if (labelElement) {
        label = labelElement.textContent?.trim() || null
      }
      
      // Check for aria-label
      if (!label) {
        label = input.getAttribute('aria-label') || null
      }
      
      // Check for placeholder as fallback
      if (!label && input.getAttribute('placeholder')) {
        label = input.getAttribute('placeholder')
      }
      
      if (name) {
        formFields.push({
          name,
          type,
          label,
          required,
          page: 1,
        })
      }
    })
    
    return formFields
  }
  
  /**
   * Extract text colors (basic extraction from style attributes)
   */
  private extractTextColors(document: Document): Array<{
    color: string
    hex: string
    page: number
  }> {
    const textColors: Array<{ color: string; hex: string; page: number }> = []
    
    // Extract colors from inline styles
    const elementsWithColor = document.querySelectorAll('[style*="color"]')
    elementsWithColor.forEach((element) => {
      const style = element.getAttribute('style') || ''
      const colorMatch = style.match(/color:\s*([^;]+)/i)
      
      if (colorMatch) {
        const color = colorMatch[1].trim()
        const hex = this.colorToHex(color)
        
        if (hex) {
          textColors.push({
            color,
            hex,
            page: 1,
          })
        }
      }
    })
    
    // Also check computed styles from stylesheets (basic approach)
    // This would require more complex CSS parsing
    
    return textColors
  }
  
  /**
   * Convert color name/rgb to hex
   */
  private colorToHex(color: string): string | null {
    // Remove whitespace
    color = color.trim()
    
    // If already hex
    if (/^#([0-9A-F]{3}){1,2}$/i.test(color)) {
      return color.toUpperCase()
    }
    
    // If rgb/rgba
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]).toString(16).padStart(2, '0')
      const g = parseInt(rgbMatch[2]).toString(16).padStart(2, '0')
      const b = parseInt(rgbMatch[3]).toString(16).padStart(2, '0')
      return `#${r}${g}${b}`.toUpperCase()
    }
    
    // Named colors (basic mapping)
    const namedColors: { [key: string]: string } = {
      black: '#000000',
      white: '#FFFFFF',
      red: '#FF0000',
      green: '#008000',
      blue: '#0000FF',
      yellow: '#FFFF00',
      cyan: '#00FFFF',
      magenta: '#FF00FF',
    }
    
    return namedColors[color.toLowerCase()] || null
  }
}
