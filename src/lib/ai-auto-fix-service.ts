/**
 * AI Auto-Fix Service
 * 
 * This service uses AI to automatically generate fixes for PDF accessibility issues:
 * - Alt text for images (using AI vision or text analysis)
 * - Table summaries (using AI to analyze table content)
 * - Document metadata (title, language)
 * - Bookmarks (generated from headings)
 * - Reading order (AI-analyzed logical flow)
 * 
 * The fixes are then applied using PyMuPDF without affecting the PDF layout.
 */

import { ClaudeAPI } from './claude-api'
import { PyMuPDFWrapper, PDFStructureFix } from './pymupdf-wrapper'
import * as fs from 'fs/promises'
import * as path from 'path'
import { tmpdir } from 'os'

export interface ImageFix {
  page: number
  imageIndex: number
  altText: string
  elementId?: string
  elementLocation?: string
}

export interface TableFix {
  page: number
  tableIndex: number
  summary: string
  elementId?: string
  elementLocation?: string
}

export interface AutoFixResult {
  success: boolean
  fixedPdfBuffer?: Buffer
  fixesApplied: {
    altText: number
    tableSummaries: number
    metadata: number
    bookmarks: number
    readingOrder: number
    colorContrast: number
    language: number
    formLabel: number
    linkText: number
    textSize: number
    fontEmbedding: number
    tabOrder: number
    formFieldProperties: number
    linkValidation: number
    securitySettings: number
  }
  errors?: string[]
}

export class AIAutoFixService {
  private claudeAPI: ClaudeAPI
  private pymupdfWrapper: PyMuPDFWrapper

  constructor() {
    this.claudeAPI = new ClaudeAPI()
    this.pymupdfWrapper = new PyMuPDFWrapper()
  }

  /**
   * Extract text from a specific page of document text
   * Assumes document text may have page markers or can be split by pages
   */
  private extractPageText(documentText: string, pageNumber: number): string | null {
    try {
      // Try to find page markers (common patterns: "Page X", "--- Page X ---", etc.)
      const pagePattern = new RegExp(`(?:^|\\n)(?:Page\\s+${pageNumber}|-+\\s*Page\\s+${pageNumber}|\\[Page\\s+${pageNumber}\\]).*?\\n`, 'i')
      const match = documentText.match(pagePattern)
      
      if (match) {
        const startIndex = match.index! + match[0].length
        // Find next page marker or end of document
        const nextPagePattern = new RegExp(`(?:^|\\n)(?:Page\\s+${pageNumber + 1}|-+\\s*Page\\s+${pageNumber + 1}|\\[Page\\s+${pageNumber + 1}\\]).*?\\n`, 'i')
        const nextMatch = documentText.substring(startIndex).match(nextPagePattern)
        const endIndex = nextMatch ? startIndex + nextMatch.index! : documentText.length
        return documentText.substring(startIndex, endIndex).trim()
      }
      
      // If no page markers, try to split by approximate page length (assuming ~2000 chars per page)
      const charsPerPage = 2000
      const startIndex = (pageNumber - 1) * charsPerPage
      const endIndex = startIndex + charsPerPage
      return documentText.substring(startIndex, endIndex).trim() || null
    } catch (error) {
      return null
    }
  }

  /**
   * Extract image from PDF using PyMuPDF and convert to base64
   */
  private async extractImageFromPDF(
    pdfPath: string,
    pageNumber: number,
    imageIndex: number
  ): Promise<{ base64: string; mediaType: string } | null> {
    try {
      const { exec } = require('child_process')
      const { promisify } = require('util')
      const execAsync = promisify(exec)
      
      // Use Python script to extract image
      const script = `
import fitz
import sys
import base64
import json

try:
    doc = fitz.open('${pdfPath.replace(/\\/g, '/')}')
    if ${pageNumber - 1} < len(doc):
        page = doc[${pageNumber - 1}]
        images = page.get_images()
        if ${imageIndex} < len(images):
            xref = images[${imageIndex}][0]
            img_obj = doc.extract_image(xref)
            img_data = img_obj['image']
            ext = img_obj['ext']
            
            # Convert to base64
            img_base64 = base64.b64encode(img_data).decode('utf-8')
            
            # Determine media type
            media_types = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'bmp': 'image/bmp'
            }
            media_type = media_types.get(ext.lower(), 'image/png')
            
            print(json.dumps({'base64': img_base64, 'mediaType': media_type}))
        else:
            print(json.dumps({'error': 'Image index out of range'}))
    else:
        print(json.dumps({'error': 'Page out of range'}))
    doc.close()
except Exception as e:
    print(json.dumps({'error': str(e)}))
`
      
      const { stdout, stderr } = await execAsync(`python -c "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`)
      const result = JSON.parse(stdout.trim())
      
      if (result.error) {
        console.warn(`⚠️ Could not extract image: ${result.error}`)
        return null
      }
      
      return {
        base64: result.base64,
        mediaType: result.mediaType
      }
    } catch (error) {
      console.warn(`⚠️ Failed to extract image from PDF: ${error}`)
      return null
    }
  }

  /**
   * Generate alt text for images using AI with Vision API support
   */
  async generateAltTextForImage(
    imageContext: string,
    pageNumber: number,
    fileName: string,
    pdfPath?: string,
    imageIndex?: number
  ): Promise<string> {
    try {
      // Try to extract image and use vision API if available
      let imageData: { base64: string; mediaType: string } | null = null
      if (pdfPath !== undefined && imageIndex !== undefined) {

        imageData = await this.extractImageFromPDF(pdfPath, pageNumber, imageIndex)
      }
      
      // Build prompt with or without image
      let prompt: string
      if (imageData) {
        // Use vision API with image
        prompt = `Generate concise, descriptive alternative text (alt text) for this image from a PDF document.

Document: ${fileName}
Page: ${pageNumber}
Context: ${imageContext}

Requirements:
- Keep alt text under 125 characters
- Be descriptive but concise
- Describe what you see in the image
- If the image appears decorative, return "Decorative image"
- Do not include phrases like "image of" or "picture of"

Return ONLY the alt text, nothing else.`
        
        // Use vision API
        const response = await this.claudeAPI.generateTextWithVision(
          prompt,
          imageData.base64,
          imageData.mediaType
        )
        
        let altText = response.trim()
        
        // Remove quotes if present
        if ((altText.startsWith('"') && altText.endsWith('"')) || 
            (altText.startsWith("'") && altText.endsWith("'"))) {
          altText = altText.slice(1, -1)
        }
        
        // If response is too long, truncate
        if (altText.length > 125) {
          altText = altText.substring(0, 122) + '...'
        }
        
        return altText || 'Image'
      } else {
        // Fallback to text-only analysis
        prompt = `Generate concise, descriptive alternative text (alt text) for an image in a PDF document.

Context about the image:
${imageContext}

Document: ${fileName}
Page: ${pageNumber}

Requirements:
- Keep alt text under 125 characters
- Be descriptive but concise
- Describe the purpose and content of the image
- If the image appears decorative based on context, return "Decorative image" or empty string
- Do not include phrases like "image of" or "picture of" (screen readers already announce it's an image)

Return ONLY the alt text, nothing else.`

        const response = await this.claudeAPI.generateText(prompt)
        
        // Clean up the response
        let altText = response.trim()
        
        // Remove quotes if present
        if ((altText.startsWith('"') && altText.endsWith('"')) || 
            (altText.startsWith("'") && altText.endsWith("'"))) {
          altText = altText.slice(1, -1)
        }
        
        // If response is too long, truncate
        if (altText.length > 125) {
          altText = altText.substring(0, 122) + '...'
        }
        
        return altText || 'Image'
      }
    } catch (error) {
      console.error('❌ Failed to generate alt text:', error)
      return 'Image' // Fallback
    }
  }

  /**
   * Generate table summary using AI
   */
  async generateTableSummary(
    tableContent: string,
    pageNumber: number,
    fileName: string
  ): Promise<string> {
    try {
      const prompt = `Generate a concise summary for a table in a PDF document that describes its purpose and content.

Table content:
${tableContent}

Document: ${fileName}
Page: ${pageNumber}

Requirements:
- Keep summary under 200 characters
- Describe what information the table contains
- Explain the table's purpose in the document
- Be specific but concise

Return ONLY the summary text, nothing else.`

      const response = await this.claudeAPI.generateText(prompt)
      
      // Clean up the response
      let summary = response.trim()
      
      // Remove quotes if present
      if ((summary.startsWith('"') && summary.endsWith('"')) || 
          (summary.startsWith("'") && summary.endsWith("'"))) {
        summary = summary.slice(1, -1)
      }
      
      // If response is too long, truncate
      if (summary.length > 200) {
        summary = summary.substring(0, 197) + '...'
      }
      
      return summary || 'Table with data'
    } catch (error) {
      console.error('❌ Failed to generate table summary:', error)
      return 'Table with data' // Fallback
    }
  }

  /**
   * Generate bookmarks from document structure using AI
   */
  async generateBookmarks(
    documentText: string,
    fileName: string
  ): Promise<Array<{ title: string; page: number; level: number }>> {
    try {
      const prompt = `Analyze this PDF document and identify headings that should become bookmarks.

Document text (first 5000 characters):
${documentText ? documentText.substring(0, 5000) : 'Document text not available'}

Document: ${fileName}

Requirements:
- Identify main headings (H1, H2, H3, etc.)
- Estimate which page each heading appears on (based on text position)
- Return a JSON array of bookmarks with: title, page (estimated), level (1-6)

Format:
[
  {"title": "Introduction", "page": 1, "level": 1},
  {"title": "Chapter 1", "page": 2, "level": 1},
  {"title": "Section 1.1", "page": 2, "level": 2}
]

Return ONLY the JSON array, nothing else.`

      const response = await this.claudeAPI.generateText(prompt)
      
      // Try to parse JSON
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const bookmarks = JSON.parse(jsonMatch[0])
          return Array.isArray(bookmarks) ? bookmarks : []
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse bookmarks JSON:', parseError)
      }
      
      return []
    } catch (error) {
      console.error('❌ Failed to generate bookmarks:', error)
      return []
    }
  }

  /**
   * Analyze reading order using AI
   */
  async analyzeReadingOrder(
    documentText: string,
    pageNumber: number
  ): Promise<number[]> {
    try {
      const prompt = `Analyze the reading order of content on page ${pageNumber} of this PDF.

Page content:
${documentText.substring(0, 2000)}

Return a JSON array of reading order sequence numbers for each content block.
Each number represents the order in which content should be read (1 = first, 2 = second, etc.).

Return ONLY the JSON array of numbers, nothing else. Example: [1, 2, 3, 4]`

      const response = await this.claudeAPI.generateText(prompt)
      
      // Try to parse JSON
      try {
        const jsonMatch = response.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const order = JSON.parse(jsonMatch[0])
          return Array.isArray(order) ? order : []
        }
      } catch (parseError) {
        console.warn('⚠️ Failed to parse reading order JSON:', parseError)
      }
      
      return []
    } catch (error) {
      console.error('❌ Failed to analyze reading order:', error)
      return []
    }
  }

  /**
   * Identify language of text using AI
   */
  async identifyLanguage(
    text: string,
    pageText: string,
    fileName: string
  ): Promise<{ language: string } | null> {
    try {
      const prompt = `Identify the language of this text from a PDF document.

Text to identify:
${text.substring(0, 200)}

Surrounding context:
${pageText.substring(0, 500)}

Document: ${fileName}

Return ONLY the ISO 639-1 language code (e.g., "en", "es", "fr", "de", "zh", "ja", "ar").
If the text is English, return "en".
If you cannot identify the language, return "en".

Return ONLY the language code, nothing else.`

      const response = await this.claudeAPI.generateText(prompt)
      const langCode = response.trim().toLowerCase().substring(0, 2)
      
      // Validate it's a reasonable language code
      if (langCode && /^[a-z]{2}$/.test(langCode)) {
        return { language: langCode }
      }
      
      return { language: 'en' } // Default to English
    } catch (error) {
      console.error('❌ Failed to identify language:', error)
      return null
    }
  }

  /**
   * Generate form label using AI
   */
  async generateFormLabel(
    context: string,
    pageNumber: number,
    fileName: string
  ): Promise<string | null> {
    try {
      const prompt = `Generate a descriptive label for a form field in a PDF document.

Form field context:
${context.substring(0, 300)}

Document: ${fileName}
Page: ${pageNumber}

Requirements:
- Keep label under 50 characters
- Be clear and descriptive
- Describe what information the form field collects
- Use proper capitalization

Return ONLY the label text, nothing else.`

      const response = await this.claudeAPI.generateText(prompt)
      const label = response.trim()
      
      if (label && label.length > 0 && label.length < 100) {
        return label
      }
      
      return null
    } catch (error) {
      console.error('❌ Failed to generate form label:', error)
      return null
    }
  }

  /**
   * Improve link text using AI
   */
  async improveLinkText(
    linkText: string,
    pageText: string,
    pageNumber: number,
    fileName: string
  ): Promise<string | null> {
    try {
      const prompt = `Improve the link text to be more descriptive and meaningful for accessibility.

Current link text:
${linkText.substring(0, 200)}

Surrounding context:
${pageText.substring(0, 500)}

Document: ${fileName}
Page: ${pageNumber}

Requirements:
- Make the link text descriptive (not just "click here" or "read more")
- Keep it concise (under 100 characters)
- Describe what the link leads to
- Maintain the meaning and context

Return ONLY the improved link text, nothing else.`

      const response = await this.claudeAPI.generateText(prompt)
      const improved = response.trim()
      
      if (improved && improved.length > 0 && improved.length < 150) {
        return improved
      }
      
      return null
    } catch (error) {
      console.error('❌ Failed to improve link text:', error)
      return null
    }
  }

  /**
   * Apply automatic fixes to a PDF
   * This is the main entry point that:
   * 1. Generates fixes using AI
   * 2. Applies fixes using PyMuPDF
   */
  async applyAutoFixes(
    pdfBuffer: Buffer,
    issues: Array<{
      type: string
      rule?: string
      ruleName?: string
      description?: string
      page?: number
      pageNumber?: number
      elementId?: string
      elementLocation?: string
      elementType?: string
      elementContent?: string
    }>,
    fileName: string,
    documentText?: string // Optional: full document text for bookmarks/reading order
  ): Promise<AutoFixResult> {
    try {


      // Filter issues that can be auto-fixed
      const altTextIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        // Match all alt text issues: figures, other elements, and association issues
        return rule.includes('figure') || rule.includes('alternate text') || 
               rule.includes('other elements alternate text') ||
               rule.includes('associated with content') ||
               desc.includes('alt text') || desc.includes('image') || desc.includes('figure') ||
               desc.includes('require alternate text') || desc.includes('must be associated')
      })

      const tableSummaryIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        // Match table issues: summary, headers, and structure
        return (rule.includes('summary') && rule.includes('table')) ||
               (rule.includes('headers') && rule.includes('table')) ||
               (rule.includes('table') && (rule.includes('summary') || rule.includes('header'))) ||
               desc.includes('table summary') || desc.includes('table must have') ||
               desc.includes('tables should have headers') || desc.includes('tables must have a summary')
      })

      const metadataIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        // Match document-level metadata: title and primary language (not language spans)
        return (rule.includes('title') && !rule.includes('heading')) ||
               (rule.includes('primary language') || (rule.includes('language') && desc.includes('specified'))) ||
               desc.includes('missing title') || desc.includes('document title') ||
               desc.includes('title bar') || desc.includes('text language is specified')
      })

      const bookmarkIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('bookmark') || desc.includes('bookmark')
      })

      const readingOrderIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('reading order') || desc.includes('reading order') ||
               desc.includes('logical reading order')
      })

      const colorContrastIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('color contrast') || rule.includes('contrast') ||
               desc.includes('color contrast') || desc.includes('contrast') ||
               desc.includes('appropriate color contrast')
      })

      const languageIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        // Language SPANS (foreign language text), NOT primary document language
        // Primary language goes to metadataIssues, language spans go here
        return (rule.includes('language') && !rule.includes('primary language') && !desc.includes('specified')) ||
               desc.includes('foreign language') || desc.includes('language identification') ||
               (desc.includes('text language') && !desc.includes('text language is specified'))
      })
      
      // Tagged annotations - complex issue that may need manual intervention
      const taggedAnnotationsIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('tagged annotations') || rule.includes('annotations are tagged') ||
               desc.includes('annotations are tagged') || desc.includes('all annotations')
      })

      const formLabelIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('form') || rule.includes('label') ||
               desc.includes('form label') || desc.includes('form field') ||
               desc.includes('missing label')
      })

      const linkTextIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('link') || desc.includes('link text') ||
               desc.includes('link description') || desc.includes('meaningful link')
      })

      const textSizeIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('text size') || rule.includes('font size') ||
               desc.includes('text is too small') || desc.includes('font size') ||
               desc.includes('minimum font size') || desc.includes('text size')
      })

      const fontEmbeddingIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('font') || rule.includes('embed') ||
               desc.includes('font') || desc.includes('embedded') ||
               desc.includes('font embedding')
      })

      const tabOrderIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('tab order') || rule.includes('tab') ||
               desc.includes('tab order') || desc.includes('focus order') ||
               desc.includes('logical tab')
      })

      const formFieldPropertiesIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('form field properties') || rule.includes('field properties') ||
               desc.includes('form field properties') || desc.includes('field properties') ||
               desc.includes('missing properties')
      })

      const linkValidationIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('link destination') || rule.includes('link invalid') ||
               desc.includes('link destination') || desc.includes('invalid link') ||
               desc.includes('broken link')
      })

      const securitySettingsIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('security') || rule.includes('encrypt') ||
               desc.includes('security settings') || desc.includes('encryption') ||
               desc.includes('assistive technologies')
      })















      `)

      // Check if PyMuPDF is available
      const deps = await this.pymupdfWrapper.checkDependencies()
      if (!deps.python || !deps.pymupdf) {
        console.warn('⚠️ PyMuPDF not available - cannot apply fixes')
        return {
          success: false,
          fixesApplied: { altText: 0, tableSummaries: 0, metadata: 0, bookmarks: 0, readingOrder: 0, colorContrast: 0, language: 0, formLabel: 0, linkText: 0, textSize: 0, fontEmbedding: 0, tabOrder: 0, formFieldProperties: 0, linkValidation: 0, securitySettings: 0 },
          errors: ['PyMuPDF not available. Install with: pip install pymupdf']
        }
      }

      // Create temporary files
      const tempDir = tmpdir()
      const inputPath = path.join(tempDir, `input-${Date.now()}.pdf`)
      const outputPath = path.join(tempDir, `output-${Date.now()}.pdf`)
      
      await fs.writeFile(inputPath, pdfBuffer)

      // Generate fixes using AI
      const fixes: PDFStructureFix[] = []
      const errors: string[] = []
      let metadataFixes = 0
      let bookmarkFixes = 0
      let readingOrderFixes = 0
      let colorContrastFixes = 0

      // Generate alt text for images
      for (let idx = 0; idx < altTextIssues.length; idx++) {
        const issue = altTextIssues[idx]
        try {
          const page = issue.page || issue.pageNumber || 1
          // Build better context: include document text around the image if available
          let context = issue.elementContent || issue.description || `Image on page ${page}`
          
          // If we have document text, extract context around this page
          if (documentText) {
            const pageText = this.extractPageText(documentText, page)
            if (pageText) {
              context = `${context}\n\nSurrounding text on page ${page}:\n${pageText.substring(0, 500)}`
            }
          }

          // Pass PDF path and image index for vision API
          const altText = await this.generateAltTextForImage(context, page, fileName, inputPath, idx)
          
          fixes.push({
            type: 'altText',
            page: page,
            altText: altText,
            elementLocation: issue.elementLocation
          })
          
          }..."`)
        } catch (error) {
          const errorMsg = `Failed to generate alt text for page ${issue.page || issue.pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Generate table summaries
      for (const issue of tableSummaryIssues) {
        try {
          const page = issue.page || issue.pageNumber || 1
          // Build better context: include document text around the table if available
          let context = issue.elementContent || issue.description || `Table on page ${page}`
          
          // If we have document text, extract context around this page
          if (documentText) {
            const pageText = this.extractPageText(documentText, page)
            if (pageText) {
              context = `${context}\n\nSurrounding text on page ${page}:\n${pageText.substring(0, 1000)}`
            }
          }

          const summary = await this.generateTableSummary(context, page, fileName)
          
          fixes.push({
            type: 'table',
            page: page,
            tableData: { summary: summary },
            elementLocation: issue.elementLocation
          })
          
          }..."`)
        } catch (error) {
          const errorMsg = `Failed to generate table summary for page ${issue.page || issue.pageNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle metadata fixes (title, language) - these are set via metadata parameter
      const metadata: { title?: string; language?: string } = {}
      for (const issue of metadataIssues) {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        
        if (rule.includes('title') || desc.includes('title')) {
          // Extract title from description or use filename
          metadata.title = issue.elementContent || fileName.replace('.pdf', '') || 'Document'
          metadataFixes++
        }
        
        if (rule.includes('language') || desc.includes('language')) {
          // Default to English, could be enhanced to detect language
          metadata.language = 'en'
          metadataFixes++
        }
      }

      // Generate bookmarks if needed and document text is available
      if (bookmarkIssues.length > 0 && documentText) {
        try {

          const bookmarks = await this.generateBookmarks(documentText, fileName)
          
          if (bookmarks.length > 0) {
            // Add bookmarks as bookmark fixes (PyMuPDF will create actual bookmarks)
            for (const bookmark of bookmarks) {
              fixes.push({
                type: 'bookmark',
                page: bookmark.page,
                text: bookmark.title,
                level: bookmark.level || 1
              })
            }
            bookmarkFixes = bookmarks.length

          }
        } catch (error) {
          const errorMsg = `Failed to generate bookmarks: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle reading order if needed
      if (readingOrderIssues.length > 0 && documentText) {
        try {
          for (const issue of readingOrderIssues) {
            const page = issue.page || issue.pageNumber || 1

            const order = await this.analyzeReadingOrder(documentText, page)
            
            if (order.length > 0) {
              fixes.push({
                type: 'readingOrder',
                page: page,
                readingOrder: order[0] // Use first order value
              })
              readingOrderFixes++
            }
          }
        } catch (error) {
          const errorMsg = `Failed to analyze reading order: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle language span fixes - improved detection
      let languageFixes = 0
      if (languageIssues.length > 0 && documentText) {
        try {
          // Use language detection on full document text to find all foreign language spans
          const pageText = documentText || ''
          
          // Split text into sentences and detect language for each
          const sentences = pageText.split(/[.!?]\s+/).filter(s => s.trim().length > 10)
          
          for (const issue of languageIssues) {
            const page = issue.page || issue.pageNumber || 1
            const context = issue.elementContent || issue.description || ''
            const pageTextForIssue = this.extractPageText(documentText || '', page) || ''

            const langResult = await this.identifyLanguage(context, pageTextForIssue, fileName)
            
            if (langResult && langResult.language !== 'en') {
              fixes.push({
                type: 'language',
                page: page,
                text: context.substring(0, 100),
                language: langResult.language
              })
              languageFixes++

            }
          }
          
          // Also detect foreign language in sentences that don't match issues
          // This improves coverage beyond just reported issues
          for (let i = 0; i < Math.min(sentences.length, 50); i++) {
            const sentence = sentences[i].trim()
            if (sentence.length > 20) {
              try {
                const langResult = await this.identifyLanguage(sentence, pageText, fileName)
                if (langResult && langResult.language !== 'en') {
                  // Estimate page number from sentence position
                  const estimatedPage = Math.floor((i / sentences.length) * (documentText.length / 2000)) + 1
                  fixes.push({
                    type: 'language',
                    page: estimatedPage,
                    text: sentence.substring(0, 100),
                    language: langResult.language
                  })
                  languageFixes++
                }
              } catch (e) {
                // Skip if detection fails
              }
            }
          }
        } catch (error) {
          const errorMsg = `Failed to identify languages: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle color contrast fixes
      if (colorContrastIssues.length > 0) {
        try {
          const { calculateContrastRatio, suggestAccessibleColors } = await import('./color-contrast-analyzer')
          
          for (const issue of colorContrastIssues) {
            const page = issue.page || issue.pageNumber || 1
            const desc = issue.description || ''
            const text = issue.elementContent || ''
            
            // Try to extract color information from description
            // Adobe might provide color info in the description
            const hexColorMatch = desc.match(/#[0-9A-Fa-f]{6}/)
            const rgbMatch = desc.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/i)
            
            let foreground = '#000000' // Default black
            let background = '#FFFFFF' // Default white
            
            if (hexColorMatch) {
              foreground = hexColorMatch[0]
            } else if (rgbMatch) {
              const r = parseInt(rgbMatch[1])
              const g = parseInt(rgbMatch[2])
              const b = parseInt(rgbMatch[3])
              foreground = `#${[r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')}`
            }
            
            // Check current contrast
            const contrast = calculateContrastRatio(foreground, background)
            
            if (!contrast.passesAA) {
              // Get accessible color suggestions
              const suggestions = suggestAccessibleColors(foreground, true)
              
              if (suggestions.length > 0) {
                const newColors = suggestions[0]
                
                fixes.push({
                  type: 'colorContrast',
                  page: page,
                  text: text || desc.substring(0, 100),
                  colorInfo: {
                    foreground: foreground,
                    background: background,
                    newForeground: newColors.foreground,
                    newBackground: newColors.background || background
                  },
                  elementLocation: issue.elementLocation
                })
                
                colorContrastFixes++
                }:1) -> ${newColors.foreground}/${newColors.background || background} (${newColors.ratio.toFixed(2)}:1)`)
              }
            }
          }
        } catch (error) {
          const errorMsg = `Failed to fix color contrast: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle form label fixes
      let formLabelFixes = 0
      if (formLabelIssues.length > 0) {
        try {
          for (const issue of formLabelIssues) {
            const page = issue.page || issue.pageNumber || 1
            const context = issue.elementContent || issue.description || ''

            const label = await this.generateFormLabel(context, page, fileName)
            
            if (label) {
              fixes.push({
                type: 'formLabel',
                page: page,
                text: label,
                elementLocation: issue.elementLocation
              })
              formLabelFixes++

            }
          }
        } catch (error) {
          const errorMsg = `Failed to generate form labels: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle link text improvements
      let linkTextFixes = 0
      if (linkTextIssues.length > 0 && documentText) {
        try {
          for (const issue of linkTextIssues) {
            const page = issue.page || issue.pageNumber || 1
            const context = issue.elementContent || issue.description || ''
            const pageText = this.extractPageText(documentText || '', page) || ''

            const improvedText = await this.improveLinkText(context, pageText, page, fileName)
            
            if (improvedText) {
              fixes.push({
                type: 'linkText',
                page: page,
                text: improvedText,
                originalText: context,
                elementLocation: issue.elementLocation
              })
              linkTextFixes++
              }..." -> "${improvedText.substring(0, 30)}..."`)
            }
          }
        } catch (error) {
          const errorMsg = `Failed to improve link text: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle text size fixes
      let textSizeFixes = 0
      if (textSizeIssues.length > 0) {
        try {
          for (const issue of textSizeIssues) {
            const page = issue.page || issue.pageNumber || 1
            const desc = issue.description || ''
            const text = issue.elementContent || ''
            
            // Extract font size from description if available
            const sizeMatch = desc.match(/(\d+(?:\.\d+)?)\s*pt/i) || desc.match(/(\d+(?:\.\d+)?)\s*px/i)
            const currentSize = sizeMatch ? parseFloat(sizeMatch[1]) : 8
            const minSize = 9 // WCAG minimum
            
            if (currentSize < minSize) {
              fixes.push({
                type: 'textResize',
                page: page,
                text: text || desc.substring(0, 100),
                fontSize: minSize,
                elementLocation: issue.elementLocation
              })
              textSizeFixes++

            }
          }
        } catch (error) {
          const errorMsg = `Failed to fix text size: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle font embedding - note: actual embedding requires font files
      // We'll just flag it for now
      let fontEmbeddingFixes = 0
      if (fontEmbeddingIssues.length > 0) {
        try {
          for (const issue of fontEmbeddingIssues) {
            const page = issue.page || issue.pageNumber || 1
            const desc = issue.description || ''
            
            // Extract font name from description
            const fontMatch = desc.match(/font[:\s]+([A-Za-z0-9\s]+)/i)
            const fontName = fontMatch ? fontMatch[1].trim() : 'Unknown'
            
            // Note: Font embedding requires the actual font file
            // We'll create a fix entry but it may not be fully fixable without font files
            fixes.push({
              type: 'fontEmbedding',
              page: page,
              text: fontName,
              elementLocation: issue.elementLocation
            })
            fontEmbeddingFixes++

          }
        } catch (error) {
          const errorMsg = `Failed to process font embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle tab order fixes
      let tabOrderFixes = 0
      if (tabOrderIssues.length > 0) {
        try {
          for (const issue of tabOrderIssues) {
            const page = issue.page || issue.pageNumber || 1
            
            // Tab order will be set automatically based on field positions
            fixes.push({
              type: 'tabOrder',
              page: page,
              elementLocation: issue.elementLocation
            })
            tabOrderFixes++

          }
        } catch (error) {
          const errorMsg = `Failed to fix tab order: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle form field properties fixes (beyond labels)
      let formFieldPropertiesFixes = 0
      if (formFieldPropertiesIssues.length > 0) {
        try {
          for (const issue of formFieldPropertiesIssues) {
            const page = issue.page || issue.pageNumber || 1
            const fieldName = issue.elementId || issue.elementLocation || ''
            const desc = issue.description || ''
            
            // Extract required status from description
            const isRequired = /required|mandatory/i.test(desc)
            
            // Generate help text if needed
            const helpText = desc.includes('help') ? desc.substring(0, 100) : ''
            
            fixes.push({
              type: 'formFieldProperties',
              page: page,
              fieldName: fieldName,
              required: isRequired,
              helpText: helpText,
              elementLocation: issue.elementLocation
            })
            formFieldPropertiesFixes++

          }
        } catch (error) {
          const errorMsg = `Failed to fix form field properties: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle link destination validation
      let linkValidationFixes = 0
      if (linkValidationIssues.length > 0) {
        try {
          for (const issue of linkValidationIssues) {
            const page = issue.page || issue.pageNumber || 1
            const linkUrl = issue.elementContent || issue.description || ''
            
            // Validate URL format
            let isValid = false
            try {
              const url = new URL(linkUrl)
              isValid = url.protocol === 'http:' || url.protocol === 'https:'
            } catch {
              isValid = false
            }
            
            if (!isValid) {
              fixes.push({
                type: 'linkValidation',
                page: page,
                url: linkUrl,
                isValid: false,
                elementLocation: issue.elementLocation
              })
              linkValidationFixes++
              }... on page ${page}`)
            }
          }
        } catch (error) {
          const errorMsg = `Failed to validate links: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle security settings fixes
      let securitySettingsFixes = 0
      if (securitySettingsIssues.length > 0) {
        try {
          // Security settings fix applies to entire document, not per-page
          fixes.push({
            type: 'securitySettings',
            page: 1,
            elementLocation: 'Document'
          })
          securitySettingsFixes++

        } catch (error) {
          const errorMsg = `Failed to fix security settings: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      if (fixes.length === 0 && Object.keys(metadata).length === 0) {

        // Cleanup
        await fs.unlink(inputPath).catch(() => {})
        return {
          success: true,
          fixedPdfBuffer: pdfBuffer, // Return original if no fixes
          fixesApplied: { altText: 0, tableSummaries: 0, metadata: 0, bookmarks: 0, readingOrder: 0, colorContrast: 0, language: 0, formLabel: 0, linkText: 0, textSize: 0, fontEmbedding: 0, tabOrder: 0, formFieldProperties: 0, linkValidation: 0, securitySettings: 0 },
          errors: errors.length > 0 ? errors : undefined
        }
      }

      // Apply fixes using PyMuPDF
      const fixedBuffer = await this.pymupdfWrapper.repairPDF({
        inputPath,
        outputPath,
        fixes,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined
      })

      // Cleanup
      await fs.unlink(inputPath).catch(() => {})
      await fs.unlink(outputPath).catch(() => {})

      return {
        success: true,
        fixedPdfBuffer: fixedBuffer,
        fixesApplied: {
          altText: altTextIssues.length,
          tableSummaries: tableSummaryIssues.length,
          metadata: metadataFixes,
          bookmarks: bookmarkFixes,
          readingOrder: readingOrderFixes,
          colorContrast: colorContrastFixes,
          language: languageFixes,
          formLabel: formLabelFixes,
          linkText: linkTextFixes,
          textSize: textSizeFixes,
          fontEmbedding: fontEmbeddingFixes,
          tabOrder: tabOrderFixes,
          formFieldProperties: formFieldPropertiesFixes,
          linkValidation: linkValidationFixes,
          securitySettings: securitySettingsFixes
        },
        errors: errors.length > 0 ? errors : undefined
      }
    } catch (error) {
      console.error('❌ Auto-fix failed:', error)
      return {
        success: false,
        fixesApplied: { altText: 0, tableSummaries: 0, metadata: 0, bookmarks: 0, readingOrder: 0, colorContrast: 0, language: 0, formLabel: 0, linkText: 0, textSize: 0, fontEmbedding: 0, tabOrder: 0, formFieldProperties: 0, linkValidation: 0, securitySettings: 0 },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
}
