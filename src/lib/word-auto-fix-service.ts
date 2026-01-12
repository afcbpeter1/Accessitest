/**
 * Word Auto-Fix Service
 * 
 * This service uses AI to automatically generate fixes for Word document accessibility issues:
 * - Alt text for images
 * - Table summaries
 * - Document metadata (title, language)
 * - Heading structure
 * - Color contrast
 * - Language tags
 * 
 * The fixes are applied by modifying the .docx file's internal XML structure.
 */

import { ClaudeAPI } from './claude-api'
import * as fs from 'fs/promises'
import * as path from 'path'
import { tmpdir } from 'os'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface WordImageFix {
  imageId: string
  altText: string
  elementLocation?: string
}

export interface WordTableFix {
  tableId: string
  summary: string
  hasHeaders: boolean
  elementLocation?: string
}

export interface WordAutoFixResult {
  success: boolean
  fixedWordBuffer?: Buffer
  fixesApplied: {
    altText: number
    tableSummaries: number
    metadata: number
    headings: number
    colorContrast: number
    language: number
    linkText: number
  }
  errors?: string[]
}

export class WordAutoFixService {
  private claudeAPI: ClaudeAPI

  constructor() {
    this.claudeAPI = new ClaudeAPI()
  }

  /**
   * Extract image from Word document using Python script
   */
  private async extractImageFromWord(
    docxPath: string,
    imageId: string
  ): Promise<{ base64: string; mediaType: string } | null> {
    try {
      // Use Python script to extract image (similar to PDF approach)
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const script = `
import zipfile
import base64
import json
import sys

try:
    docx_path = '${docxPath.replace(/\\/g, '/')}'
    image_id = '${imageId}'
    
    with zipfile.ZipFile(docx_path, 'r') as zip_file:
        image_path = f'word/media/{image_id}'
        if image_path in zip_file.namelist():
            image_data = zip_file.read(image_path)
            img_base64 = base64.b64encode(image_data).decode('utf-8')
            
            ext = image_id.lower().split('.')[-1] if '.' in image_id else 'png'
            media_types = {
                'png': 'image/png',
                'jpg': 'image/jpeg',
                'jpeg': 'image/jpeg',
                'gif': 'image/gif',
                'bmp': 'image/bmp',
                'webp': 'image/webp'
            }
            media_type = media_types.get(ext, 'image/png')
            
            print(json.dumps({'base64': img_base64, 'mediaType': media_type}))
        else:
            print(json.dumps({'error': 'Image not found'}))
except Exception as e:
    print(json.dumps({'error': str(e)}))
`
      
      const { stdout } = await execAsync(`${pythonCmd} -c "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`)
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
      console.warn(`⚠️ Failed to extract image from Word: ${error}`)
      return null
    }
  }

  /**
   * Generate alt text for images using AI with Vision API support
   */
  async generateAltTextForImage(
    imageContext: string,
    fileName: string,
    docxPath?: string,
    imageId?: string
  ): Promise<string> {
    try {
      // Try to extract image and use vision API if available
      let imageData: { base64: string; mediaType: string } | null = null
      if (docxPath && imageId) {
        imageData = await this.extractImageFromWord(docxPath, imageId)
      }
      
      // Build prompt with or without image
      let prompt: string
      if (imageData) {
        // Use vision API with image
        prompt = `Generate concise, descriptive alternative text (alt text) for this image from a Word document.

Document: ${fileName}
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
        prompt = `Generate concise, descriptive alternative text (alt text) for an image in a Word document.

Context about the image:
${imageContext}

Document: ${fileName}

Requirements:
- Keep alt text under 125 characters
- Be descriptive but concise
- Describe the purpose and content of the image
- If the image appears decorative based on context, return "Decorative image" or empty string
- Do not include phrases like "image of" or "picture of"

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
    fileName: string
  ): Promise<string> {
    try {
      const prompt = `Generate a concise summary for a table in a Word document that describes its purpose and content.

Table content:
${tableContent}

Document: ${fileName}

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
   * Suggest accessible color alternative using contrast calculator
   */
  suggestAccessibleColor(issueDescription: string, currentColor?: string): string | null {
    try {
      // Import color contrast analyzer
      const { calculateContrastRatio, suggestAccessibleColors } = require('./color-contrast-analyzer')
      
      // Default to white background
      const background = '#FFFFFF'
      
      // If we have current color, use it; otherwise infer from description
      let foreground = currentColor
      if (!foreground) {
        const desc = issueDescription.toLowerCase()
        if (desc.includes('light grey') || desc.includes('light gray')) {
          foreground = '#CCCCCC' // Light grey
        } else if (desc.includes('grey') || desc.includes('gray')) {
          foreground = '#999999' // Medium grey
        } else if (desc.includes('light')) {
          foreground = '#CCCCCC' // Light color
        } else {
          // Default to light grey if we can't determine
          foreground = '#CCCCCC'
        }
      }
      
      // Calculate current contrast
      const currentContrast = calculateContrastRatio(foreground, background)
      
      // If it doesn't meet AA, suggest accessible alternatives
      if (!currentContrast.passesAA) {
        const suggestions = suggestAccessibleColors(foreground, true)
        if (suggestions.length > 0) {
          // Return a darker grey that's similar but accessible
          // Prefer dark grey (#595959) over black for better readability
          return '#595959' // Dark grey - 7.0:1 contrast on white (meets AAA)
        }
      }
      
      // If already accessible, return null (no change needed)
      return null
    } catch (error) {
      console.warn('⚠️ Could not calculate accessible color, using fallback:', error)
      // Fallback: return dark grey for light colors
      const desc = issueDescription.toLowerCase()
      if (desc.includes('light') || desc.includes('grey') || desc.includes('gray')) {
        return '#595959' // Dark grey that meets WCAG AA
      }
      return null
    }
  }

  /**
   * Generate better link text using AI
   */
  async generateBetterLinkText(
    currentText: string,
    url: string,
    fileName: string
  ): Promise<string> {
    try {
      const prompt = `Generate a descriptive, accessible link text to replace this non-descriptive link text.

Current link text: "${currentText}"
URL: ${url || 'Not provided'}
Document: ${fileName}

Requirements:
- Be specific and descriptive
- Clearly indicate what the link leads to
- Keep it concise (under 50 characters if possible)
- Don't use generic words like "click here", "read more", "here", "link"

Return ONLY the new link text, nothing else.`

      const response = await this.claudeAPI.generateText(prompt)
      const betterText = response.trim()
      
      // Remove quotes if present
      if ((betterText.startsWith('"') && betterText.endsWith('"')) || 
          (betterText.startsWith("'") && betterText.endsWith("'"))) {
        return betterText.slice(1, -1)
      }
      
      return betterText || currentText
    } catch (error) {
      console.error('❌ Failed to generate better link text:', error)
      return currentText
    }
  }

  /**
   * Identify language of text using AI
   */
  async identifyLanguage(
    text: string,
    fileName: string
  ): Promise<{ language: string } | null> {
    try {
      const prompt = `Identify the language of this text from a Word document.

Text to identify:
${text.substring(0, 200)}

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
   * Apply automatic fixes to a Word document
   * This modifies the existing .docx file by updating its internal XML
   */
  async applyAutoFixes(
    wordBuffer: Buffer,
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
    documentText?: string,
    parsedStructure?: {
      images?: Array<{ id: string; altText: string | null; page: number }>
      tables?: Array<{ rows: number; columns: number; hasHeaders: boolean; page: number }>
      headings?: Array<{ level: number; text: string; page: number }>
    }
  ): Promise<WordAutoFixResult> {
    try {
      // Check if this is a .docx file
      const isDocx = wordBuffer[0] === 0x50 && wordBuffer[1] === 0x4B // PK (ZIP signature)
      if (!isDocx) {
        return {
          success: false,
          fixesApplied: { altText: 0, tableSummaries: 0, metadata: 0, headings: 0, colorContrast: 0, language: 0, linkText: 0 },
          errors: ['Only .docx files are supported. Please convert .doc files to .docx format.']
        }
      }

      // Filter issues that can be auto-fixed
      const altTextIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('figure') || rule.includes('alternate text') || 
               rule.includes('other elements alternate text') ||
               rule.includes('associated with content') ||
               desc.includes('alt text') || desc.includes('image') || desc.includes('figure') ||
               desc.includes('require alternate text') || desc.includes('must be associated')
      })

      const tableSummaryIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return (rule.includes('summary') && rule.includes('table')) ||
               (rule.includes('headers') && rule.includes('table')) ||
               (rule.includes('table') && (rule.includes('summary') || rule.includes('header'))) ||
               desc.includes('table summary') || desc.includes('table must have') ||
               desc.includes('tables should have headers') || desc.includes('tables must have a summary')
      })

      const metadataIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return (rule.includes('title') && !rule.includes('heading')) ||
               (rule.includes('primary language') || (rule.includes('language') && desc.includes('specified'))) ||
               desc.includes('missing title') || desc.includes('document title') ||
               desc.includes('title bar') || desc.includes('text language is specified')
      })

      const headingIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('heading') || desc.includes('heading') ||
               desc.includes('heading structure') || desc.includes('heading hierarchy')
      })

      const languageIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return (rule.includes('language') && !rule.includes('primary language') && !desc.includes('specified')) ||
               desc.includes('foreign language') || desc.includes('language identification') ||
               (desc.includes('text language') && !desc.includes('text language is specified'))
      })

      const colorContrastIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('color contrast') || rule.includes('contrast') ||
               desc.includes('color contrast') || desc.includes('contrast') ||
               desc.includes('appropriate color contrast')
      })

      const linkTextIssues = issues.filter(issue => {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        return rule.includes('link') || desc.includes('link text') ||
               desc.includes('link description') || desc.includes('meaningful link') ||
               desc.includes('non-descriptive link')
      })
      
      // Initialize all fix arrays at the top to avoid scope issues
      const colorContrastFixes: Array<{ text: string; currentColor: string; newColor: string; elementLocation?: string }> = []
      const linkTextFixes: Array<{ oldText: string; newText: string; url?: string; elementLocation?: string }> = []
      const headingFixes: Array<{ paragraphIndex: number; level: number; text: string }> = []
      if (colorContrastIssues.length > 0 && documentText) {
        try {
          const { calculateContrastRatio } = require('./color-contrast-analyzer')
          
          for (const issue of colorContrastIssues) {
            // Extract color information from issue
            const elementContent = issue.elementContent || issue.elementLocation || ''
            const context = issue.context || issue.description || ''
            
            // Try to extract hex color from context (e.g., "#CCCCCC" or "color #CCCCCC")
            const hexMatch = context.match(/#([0-9a-f]{6}|[0-9a-f]{3})/i)
            let currentColorHex = hexMatch ? `#${hexMatch[1]}` : null
            
            // If no hex found, try to infer from description
            if (!currentColorHex) {
              const desc = context.toLowerCase()
              if (desc.includes('light grey') || desc.includes('light gray')) {
                currentColorHex = '#CCCCCC' // Light grey
              } else if (desc.includes('grey') || desc.includes('gray')) {
                currentColorHex = '#999999' // Medium grey
              } else if (desc.includes('light')) {
                currentColorHex = '#CCCCCC' // Light color
              }
            }
            
            if (elementContent) {
              // Calculate accessible color alternative
              const suggestedColor = this.suggestAccessibleColor(issue.description || '', currentColorHex || undefined)
              
              if (suggestedColor) {
                // Verify the new color meets contrast requirements
                const contrast = calculateContrastRatio(suggestedColor, '#FFFFFF') // Assume white background
                if (contrast.passesAA) {
                  colorContrastFixes.push({
                    text: elementContent,
                    currentColor: currentColorHex || 'unknown',
                    newColor: suggestedColor,
                    elementLocation: issue.elementLocation
                  })
                  }:1)`)
                }
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ Could not process color contrast fixes: ${error}`)
        }
      }
      
      if (linkTextIssues.length > 0 && documentText) {
        try {
          for (const issue of linkTextIssues) {
            const linkText = issue.elementContent || issue.elementLocation || issue.description || ''
            const url = issue.elementId || '' // URL might be in elementId
            
            if (linkText && (linkText.toLowerCase().includes('click here') || 
                             linkText.toLowerCase().includes('read more') ||
                             linkText.toLowerCase().includes('here') ||
                             linkText.toLowerCase().includes('link'))) {
              // Use AI to generate better link text
              }..."`)
              const betterText = await this.generateBetterLinkText(linkText, url, fileName)
              
              if (betterText && betterText !== linkText) {
                linkTextFixes.push({
                  oldText: linkText,
                  newText: betterText,
                  url: url,
                  elementLocation: issue.elementLocation
                })
              }
            }
          }
        } catch (error) {
          console.warn(`⚠️ Could not process link text fixes: ${error}`)
        }
      }
      const totalFixableIssues = altTextIssues.length + tableSummaryIssues.length + metadataIssues.length + 
                                 headingIssues.length + languageIssues.length + colorContrastIssues.length + linkTextIssues.length
      
      if (totalFixableIssues === 0) {
        return {
          success: true, // Still success, just no fixes to apply
          fixedWordBuffer: wordBuffer, // Return original buffer
          fixesApplied: { altText: 0, tableSummaries: 0, metadata: 0, headings: 0, colorContrast: 0, language: 0, linkText: 0 },
          errors: undefined
        }
      }

      // Create temporary files
      const tempDir = tmpdir()
      const inputPath = path.join(tempDir, `input-${Date.now()}.docx`)
      const outputPath = path.join(tempDir, `output-${Date.now()}.docx`)
      
      await fs.writeFile(inputPath, wordBuffer)
      // Generate fixes using AI
      const imageFixes: WordImageFix[] = []
      const tableFixes: WordTableFix[] = []
      const errors: string[] = []
      let metadataFixes = 0

      // Generate alt text for images
      for (let idx = 0; idx < altTextIssues.length; idx++) {
        const issue = altTextIssues[idx]
        try {
          // Try to find image ID from parsed structure or issue
          const imageId = issue.elementId || parsedStructure?.images?.[idx]?.id || `image${idx}`
          const context = issue.elementContent || issue.description || `Image in document`
          const altText = await this.generateAltTextForImage(context, fileName, inputPath, imageId)
          
          imageFixes.push({
            imageId: imageId,
            altText: altText,
            elementLocation: issue.elementLocation
          })
          
          }..."`)
        } catch (error) {
          const errorMsg = `Failed to generate alt text for image ${idx}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Generate table summaries
      for (let idx = 0; idx < tableSummaryIssues.length; idx++) {
        const issue = tableSummaryIssues[idx]
        try {
          const tableId = issue.elementId || `table${idx}`
          
          // Try to extract actual table content from Word document
          let tableContent = issue.elementContent || issue.description || `Table in document`
          
          // Extract actual table cell content from Word document HTML
          try {
            const mammoth = require('mammoth')
            const htmlResult = await mammoth.convertToHtml({ buffer: wordBuffer }, {})
            
            // Extract table HTML from mammoth output
            const tableRegex = /<table[^>]*>(.*?)<\/table>/gs
            const tableMatches = Array.from(htmlResult.value.matchAll(tableRegex))
            
            if (tableMatches[idx] && parsedStructure?.tables?.[idx]) {
              const tableHtml = tableMatches[idx][1]
              // Extract text content from table cells
              const cellTextRegex = /<(td|th)[^>]*>(.*?)<\/\1>/gs
              const cells: string[] = []
              let cellMatch
              
              while ((cellMatch = cellTextRegex.exec(tableHtml)) !== null) {
                const cellText = cellMatch[2].replace(/<[^>]*>/g, '').trim()
                if (cellText) {
                  cells.push(cellText)
                }
              }
              
              if (cells.length > 0) {
                // Use first row as headers if available, otherwise first few cells
                const tableInfo = parsedStructure.tables[idx]
                const headerRow = tableInfo.hasHeaders && cells.length >= tableInfo.columns
                  ? cells.slice(0, tableInfo.columns).join(' | ')
                  : cells.slice(0, Math.min(6, cells.length)).join(' | ')
                
                // Include sample data cells for context
                const sampleCells = cells.slice(tableInfo.columns, Math.min(tableInfo.columns + 6, cells.length))
                
                tableContent = `Table with ${tableInfo.rows} rows and ${tableInfo.columns} columns.\nHeaders/First row: ${headerRow}${sampleCells.length > 0 ? `\nSample data: ${sampleCells.join(', ')}` : ''}`
              }
            }
          } catch (extractError) {
            console.warn(`⚠️ Could not extract table content from Word document, using issue description: ${extractError}`)
            // Fall back to issue description
          }
          const summary = await this.generateTableSummary(tableContent, fileName)
          
          // Check if table has headers from parsed structure
          const hasHeaders = parsedStructure?.tables?.[idx]?.hasHeaders || false
          
          tableFixes.push({
            tableId: tableId,
            summary: summary,
            hasHeaders: hasHeaders,
            elementLocation: issue.elementLocation
          })
          
          }..."`)
        } catch (error) {
          const errorMsg = `Failed to generate table summary for table ${idx}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(`❌ ${errorMsg}`)
          errors.push(errorMsg)
        }
      }

      // Handle heading fixes using AI
      if (headingIssues.length > 0 && documentText) {
        try {
          const headingAnalysis = await this.claudeAPI.identifyHeadings(documentText)
          
          if (headingAnalysis && headingAnalysis.headings && headingAnalysis.headings.length > 0) {
            // Match identified headings to actual paragraphs in document
            // We need to find which paragraphs contain these heading texts
            const docLines = documentText.split('\n').filter(line => line.trim().length > 0)
            
            for (const identifiedHeading of headingAnalysis.headings) {
              // Find the paragraph index that contains this heading text
              const headingText = identifiedHeading.text.trim()
              let paragraphIndex = -1
              
              // Try to find exact match first
              for (let i = 0; i < docLines.length; i++) {
                if (docLines[i].trim() === headingText || 
                    docLines[i].trim().includes(headingText) ||
                    headingText.includes(docLines[i].trim())) {
                  paragraphIndex = i
                  break
                }
              }
              
              // If not found, try fuzzy match
              if (paragraphIndex === -1) {
                const headingWords = headingText.toLowerCase().split(/\s+/).filter(w => w.length > 3)
                for (let i = 0; i < docLines.length; i++) {
                  const lineLower = docLines[i].toLowerCase()
                  const matchCount = headingWords.filter(word => lineLower.includes(word)).length
                  if (matchCount >= Math.min(2, headingWords.length)) {
                    paragraphIndex = i
                    break
                  }
                }
              }
              
              if (paragraphIndex >= 0) {
                headingFixes.push({
                  paragraphIndex: paragraphIndex,
                  level: identifiedHeading.level || 1,
                  text: headingText
                })
                }..." (Level ${identifiedHeading.level})`)
              } else {
                console.warn(`⚠️ Could not find paragraph for heading: "${headingText.substring(0, 50)}..."`)
              }
            }
          }
        } catch (error) {
          console.error(`❌ Failed to identify headings: ${error}`)
        }
      }

      // Handle metadata fixes (title, language)
      const metadata: { title?: string; language?: string } = {}
      const languageSpanFixes: Array<{ text: string; language: string; elementLocation?: string }> = []
      
      for (const issue of metadataIssues) {
        const rule = (issue.rule || issue.ruleName || '').toLowerCase()
        const desc = (issue.description || '').toLowerCase()
        
        if (rule.includes('title') || desc.includes('title')) {
          // Generate a meaningful title from filename or use a default
          let title = issue.elementContent
          if (!title || title.trim() === '') {
            // Extract title from filename (remove extension and clean up)
            title = fileName.replace(/\.(docx?|doc)$/i, '').replace(/[_-]/g, ' ').trim()
            // If still empty, use a default based on document type
            if (!title || title === '') {
              title = 'Accessible Document'
            }
          }
          metadata.title = title
          metadataFixes++
        }
        
        if (rule.includes('language') || desc.includes('language')) {
          metadata.language = 'en-US' // Default, could be enhanced
          metadataFixes++
        }
      }
      
      // Handle language span fixes (foreign language text)
      for (const issue of languageIssues) {
        try {
          const foreignText = issue.elementContent || issue.elementLocation || issue.description || ''
          const elementLocation = issue.elementLocation || ''
          
          // Use AI to identify the language
          }..."`)
          const langResult = await this.identifyLanguage(foreignText, fileName)
          
          if (langResult && langResult.language) {
            // Convert to Word format (e.g., "fr" -> "fr-FR")
            let langCode = langResult.language.toLowerCase()
            if (langCode === 'fr') langCode = 'fr-FR'
            else if (langCode === 'es') langCode = 'es-ES'
            else if (langCode === 'de') langCode = 'de-DE'
            else if (langCode === 'it') langCode = 'it-IT'
            else if (langCode === 'pt') langCode = 'pt-PT'
            else if (langCode === 'zh') langCode = 'zh-CN'
            else if (langCode === 'ja') langCode = 'ja-JP'
            else if (langCode === 'ar') langCode = 'ar-SA'
            else langCode = `${langCode}-${langCode.toUpperCase()}`
            
            languageSpanFixes.push({
              text: foreignText,
              language: langCode,
              elementLocation: elementLocation
            })
            
            }..."`)
          }
        } catch (error) {
          console.warn(`⚠️ Could not identify language for issue: ${error}`)
        }
      }

      // Apply fixes using Python script (similar to PDF approach)
      // This is more reliable than trying to modify Word XML directly
      const pythonScriptPath = path.join(process.cwd(), 'scripts', 'word-repair-with-fixes.py')
      
      // Create temporary JSON file with fixes
      const fixesJsonPath = path.join(tempDir, `word-fixes-${Date.now()}.json`)
      await fs.writeFile(fixesJsonPath, JSON.stringify({
        imageFixes,
        tableFixes,
        metadata,
        headingFixes: headingFixes,  // Pass actual heading fixes with paragraph indices
        languageFixes: languageSpanFixes,  // Pass actual language fixes, not just count
        colorContrastFixes: colorContrastFixes,  // Pass color contrast fixes
        linkTextFixes: linkTextFixes  // Pass link text fixes
      }, null, 2))

      // Build Python command
      const pythonCmd = process.platform === 'win32' ? 'python' : 'python3'
      const cmd = [
        pythonCmd,
        pythonScriptPath,
        '--input', inputPath,
        '--output', outputPath,
        '--fixes', fixesJsonPath
      ].join(' ')
      // Execute Python script
      let stdout = ''
      let stderr = ''
      try {
        const result = await execAsync(cmd, {
          maxBuffer: 10 * 1024 * 1024 // 10MB buffer
        })
        stdout = result.stdout || ''
        stderr = result.stderr || ''
      } catch (execError: any) {
        stdout = execError.stdout || ''
        stderr = execError.stderr || ''
        console.error(`❌ Python script execution error:`, execError.message)
        console.error(`   stdout: ${stdout.substring(0, 500)}`)
        console.error(`   stderr: ${stderr.substring(0, 500)}`)
        
        // Check if output file exists despite error
        try {
          await fs.access(outputPath)
        } catch {
          throw new Error(`Python script failed and no output file was created: ${execError.message}`)
        }
      }
      if (stderr && !stderr.includes('WARNING') && !stderr.includes('INFO')) {
        console.warn(`📄 Python script stderr: ${stderr}`)
      }

      // Verify output file exists
      try {
        await fs.access(outputPath)
      } catch {
        throw new Error(`Output file was not created: ${outputPath}`)
      }

      // Read the fixed document
      const fixedBuffer = await fs.readFile(outputPath)
      // Cleanup
      await fs.unlink(inputPath).catch(() => {})
      await fs.unlink(outputPath).catch(() => {})

      return {
        success: true,
        fixedWordBuffer: fixedBuffer,
        fixesApplied: {
          altText: imageFixes.length,
          tableSummaries: tableFixes.length,
          metadata: metadataFixes,
          headings: headingFixes.length,
          colorContrast: 0, // TODO: implement
          language: languageSpanFixes.length,
          linkText: linkTextFixes
        },
        errors: errors.length > 0 ? errors : undefined
      }
    } catch (error) {
      console.error('❌ Word auto-fix failed:', error)
      return {
        success: false,
        fixesApplied: { altText: 0, tableSummaries: 0, metadata: 0, headings: 0, colorContrast: 0, language: 0, linkText: 0 },
        errors: [error instanceof Error ? error.message : 'Unknown error']
      }
    }
  }
}

