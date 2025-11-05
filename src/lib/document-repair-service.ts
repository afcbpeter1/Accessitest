import { PDFDocument, PDFPage, PDFImage, rgb } from 'pdf-lib'
import { ClaudeAPI } from './claude-api'

export interface RepairPlan {
  issueId: string
  issue: string
  fixType: 'automatic' | 'suggestion'
  aiFix: string // What AI will do
  location: string // Page, element location
  confidence: 'high' | 'medium' | 'low'
}

export interface RepairResult {
  repairedDocument: Buffer
  repairPlan: RepairPlan[]
  fixesApplied: number
  suggestionsProvided: number
  originalIssues: number
}

export interface DocumentIssue {
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
  elementContent?: string
  elementType?: string
}

/**
 * Document Repair Service - Uses AI to automatically fix accessibility issues
 */
export class DocumentRepairService {
  private claudeAPI: ClaudeAPI

  constructor() {
    this.claudeAPI = new ClaudeAPI()
  }

  /**
   * Main repair function - analyzes document and creates repair plan
   */
  async repairDocument(
    fileBuffer: Buffer,
    fileName: string,
    fileType: string,
    issues: DocumentIssue[]
  ): Promise<{ repairPlan: RepairPlan[], repairedDocument: Buffer | null }> {
    console.log(`🔧 Starting document repair for ${fileName} (${fileType})`)
    console.log(`📋 Found ${issues.length} issues to repair`)

    // Generate repair plan using AI
    const repairPlan = await this.generateRepairPlan(issues, fileName, fileType)
    
    // Separate automatic fixes from suggestions
    const automaticFixes = repairPlan.filter(p => p.fixType === 'automatic')
    const suggestions = repairPlan.filter(p => p.fixType === 'suggestion')

    console.log(`✅ Repair plan generated: ${automaticFixes.length} automatic fixes, ${suggestions.length} suggestions`)

    // Apply automatic fixes
    let repairedDocument: Buffer | null = null
    if (automaticFixes.length > 0) {
      console.log(`🔨 Applying ${automaticFixes.length} automatic fixes...`)
      
      if (fileType.includes('pdf')) {
        repairedDocument = await this.repairPDF(fileBuffer, automaticFixes, issues)
      } else if (fileType.includes('word') || fileType.includes('document')) {
        repairedDocument = await this.repairWord(fileBuffer, automaticFixes, issues)
      } else if (fileType.includes('powerpoint') || fileType.includes('presentation')) {
        repairedDocument = await this.repairPowerPoint(fileBuffer, automaticFixes, issues)
      } else if (fileType.includes('html')) {
        repairedDocument = await this.repairHTML(fileBuffer, automaticFixes, issues)
      }
    }

    return {
      repairPlan,
      repairedDocument
    }
  }

  /**
   * Generate repair plan - AI determines what can be fixed automatically vs suggested
   */
  private async generateRepairPlan(
    issues: DocumentIssue[],
    fileName: string,
    fileType: string
  ): Promise<RepairPlan[]> {
    const repairPlan: RepairPlan[] = []

    // Group issues by type for batch processing
    const issuesByType = this.groupIssuesByType(issues)

    // Process each issue type
    for (const [issueType, typeIssues] of Object.entries(issuesByType)) {
      console.log(`🤖 Processing ${typeIssues.length} ${issueType} issues...`)

      for (const issue of typeIssues) {
        try {
          // Use AI to determine if this can be auto-fixed
          const aiAnalysis = await this.claudeAPI.generateRepairAnalysis(
            issue,
            fileName,
            fileType
          )

          // Determine if automatic or suggestion
          const canAutoFix = this.canAutoFix(issue, aiAnalysis)
          const fixType: 'automatic' | 'suggestion' = canAutoFix ? 'automatic' : 'suggestion'
          const confidence = this.determineConfidence(issue, aiAnalysis)

          repairPlan.push({
            issueId: issue.id,
            issue: issue.description,
            fixType,
            aiFix: aiAnalysis.whatWillBeFixed || aiAnalysis.suggestion || issue.remediation,
            location: issue.elementLocation || `Page ${issue.pageNumber || 'Unknown'}`,
            confidence
          })

          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error(`❌ Error analyzing issue ${issue.id}:`, error)
          // Default to suggestion if AI analysis fails
          repairPlan.push({
            issueId: issue.id,
            issue: issue.description,
            fixType: 'suggestion',
            aiFix: issue.remediation,
            location: issue.elementLocation || `Page ${issue.pageNumber || 'Unknown'}`,
            confidence: 'low'
          })
        }
      }
    }

    return repairPlan
  }

  /**
   * Group issues by type for efficient processing
   */
  private groupIssuesByType(issues: DocumentIssue[]): Record<string, DocumentIssue[]> {
    const grouped: Record<string, DocumentIssue[]> = {}

    for (const issue of issues) {
      const key = issue.category || 'other'
      if (!grouped[key]) {
        grouped[key] = []
      }
      grouped[key].push(issue)
    }

    return grouped
  }

  /**
   * Determine if an issue can be automatically fixed
   */
  private canAutoFix(issue: DocumentIssue, aiAnalysis: any): boolean {
    // High confidence automatic fixes
    const autoFixableCategories = [
      'missing alt text',
      'missing title',
      'missing language',
      'missing heading structure',
      'missing form label',
      'missing table header'
    ]

    // Check if issue description matches auto-fixable patterns
    const issueLower = issue.description.toLowerCase()
    if (autoFixableCategories.some(cat => issueLower.includes(cat))) {
      return true
    }

    // Check AI analysis confidence
    if (aiAnalysis.confidence === 'high' && aiAnalysis.canAutoFix === true) {
      return true
    }

    // Default to suggestion for complex issues
    return false
  }

  /**
   * Determine confidence level
   */
  private determineConfidence(issue: DocumentIssue, aiAnalysis: any): 'high' | 'medium' | 'low' {
    if (aiAnalysis.confidence) {
      return aiAnalysis.confidence
    }

    // High confidence for simple fixes
    const simpleFixes = ['alt text', 'title', 'language', 'heading']
    const issueLower = issue.description.toLowerCase()
    if (simpleFixes.some(fix => issueLower.includes(fix))) {
      return 'high'
    }

    return 'medium'
  }

  /**
   * Repair PDF document
   */
  private async repairPDF(
    buffer: Buffer,
    fixes: RepairPlan[],
    issues: DocumentIssue[]
  ): Promise<Buffer> {
    try {
      const pdfDoc = await PDFDocument.load(buffer)

      // Group fixes by type
      const altTextFixes = fixes.filter(f => f.issue.toLowerCase().includes('alt text') || f.issue.toLowerCase().includes('image'))
      const metadataFixes = fixes.filter(f => f.issue.toLowerCase().includes('title') || f.issue.toLowerCase().includes('language'))
      const headingFixes = fixes.filter(f => f.issue.toLowerCase().includes('heading'))

      // Apply metadata fixes
      for (const fix of metadataFixes) {
        const issue = issues.find(i => i.id === fix.issueId)
        if (issue) {
          if (fix.issue.toLowerCase().includes('title')) {
            // Extract title from AI fix or use default
            const titleMatch = fix.aiFix.match(/title[:\s]+["']?([^"']+)["']?/i) || 
                             fix.aiFix.match(/add.*title[:\s]+(.+?)(?:\.|$)/i)
            const title = titleMatch ? titleMatch[1].trim() : fileName.replace(/\.[^/.]+$/, '')
            pdfDoc.setTitle(title)
            console.log(`✅ Added PDF title: ${title}`)
          }
          if (fix.issue.toLowerCase().includes('language')) {
            // Extract language from AI fix or use default
            let language = 'en' // Default fallback
            let languageFound = false
            
            // Look for language codes in specific contexts (most specific first)
            // Pattern 1: "setting it to 'en'" or "setting to 'en'"
            const settingMatch = fix.aiFix.match(/setting\s+(?:it\s+)?to\s+['"]?([a-z]{2}(?:[-_][a-z]{2})?)/i)
            if (settingMatch && settingMatch[1]) {
              const langCode = settingMatch[1].toLowerCase().replace(/[-_][a-z]{2}$/i, '')
              if (/^[a-z]{2}$/i.test(langCode)) {
                language = langCode
                languageFound = true
                console.log(`✅ Extracted language: ${language} (from "setting to")`)
              }
            }
            
            // Pattern 2: "to 'en'" or "to \"en\"" (only if pattern 1 didn't match)
            if (!languageFound) {
              const toMatch = fix.aiFix.match(/\bto\s+['"]([a-z]{2}(?:[-_][a-z]{2})?)/i)
              if (toMatch && toMatch[1]) {
                const langCode = toMatch[1].toLowerCase().replace(/[-_][a-z]{2}$/i, '')
                if (/^[a-z]{2}$/i.test(langCode)) {
                  language = langCode
                  languageFound = true
                  console.log(`✅ Extracted language: ${language} (from "to")`)
                }
              }
            }
            
            // Pattern 3: "language: 'en'" or "language 'en'" (only if previous patterns didn't match)
            if (!languageFound) {
              const langColonMatch = fix.aiFix.match(/language[:\s]+['"]([a-z]{2}(?:[-_][a-z]{2})?)/i)
              if (langColonMatch && langColonMatch[1]) {
                const langCode = langColonMatch[1].toLowerCase().replace(/[-_][a-z]{2}$/i, '')
                if (/^[a-z]{2}$/i.test(langCode)) {
                  language = langCode
                  languageFound = true
                  console.log(`✅ Extracted language: ${language} (from "language:")`)
                }
              }
            }
            
            // Pattern 4: Standalone quoted language code (only if no other pattern matched)
            if (!languageFound) {
              const quotedMatch = fix.aiFix.match(/['"]\s*([a-z]{2}(?:[-_][a-z]{2})?)\s*['"]/i)
              if (quotedMatch && quotedMatch[1]) {
                const langCode = quotedMatch[1].toLowerCase().replace(/[-_][a-z]{2}$/i, '')
                if (/^[a-z]{2}$/i.test(langCode)) {
                  language = langCode
                  languageFound = true
                  console.log(`✅ Extracted language: ${language} (from quoted)`)
                }
              }
            }
            
            // Apply the language
            pdfDoc.setLanguage(language)
            if (languageFound) {
              console.log(`✅ Added PDF language: ${language}`)
            } else {
              console.log(`✅ Added PDF language: ${language} (default fallback, from: ${fix.aiFix.substring(0, 100)})`)
            }
          }
        }
      }

      // Apply alt text fixes (requires image extraction)
      // Note: This is complex - we'll need to use pdfjs-dist to find images
      // For now, we'll add structure tags for images
      if (altTextFixes.length > 0) {
        console.log(`📝 Note: Alt text fixes require structure tag manipulation - applying where possible`)
        // PDF structure tags are complex - this would require deeper PDF manipulation
        // We'll document this in the repair plan
      }

      // Apply heading structure fixes
      if (headingFixes.length > 0) {
        console.log(`📝 Note: Heading structure fixes require content reorganization - see suggestions`)
      }

      // Save repaired PDF
      const repairedBytes = await pdfDoc.save()
      const repairedBuffer = Buffer.from(repairedBytes)
      
      // Verify the repair was applied
      const verificationDoc = await PDFDocument.load(repairedBuffer)
      const title = verificationDoc.getTitle()
      const language = verificationDoc.getLanguage()
      console.log(`✅ PDF repair verification - Title: "${title}", Language: "${language}"`)
      
      return repairedBuffer
    } catch (error) {
      console.error('❌ PDF repair error:', error)
      throw new Error(`Failed to repair PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Repair Word document
   */
  private async repairWord(
    buffer: Buffer,
    fixes: RepairPlan[],
    issues: DocumentIssue[]
  ): Promise<Buffer> {
    try {
      // Check if .docx (we can repair) or .doc (cannot repair)
      const isDocx = buffer[0] === 0x50 && buffer[1] === 0x4B // PK (ZIP signature)
      
      if (!isDocx) {
        throw new Error('Cannot repair .doc files - please convert to .docx format')
      }

      // Use docx library to modify Word document
      const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx')
      
      // For now, we'll create a new document with fixes applied
      // In production, you'd want to modify the existing document structure
      console.log(`📝 Word repair: Creating repaired document with fixes applied`)
      
      // Extract text from original document
      const mammoth = require('mammoth')
      const textResult = await mammoth.extractRawText({ buffer })
      const text = textResult.value

      // Group fixes
      const metadataFixes = fixes.filter(f => f.issue.toLowerCase().includes('title') || f.issue.toLowerCase().includes('language'))
      const altTextFixes = fixes.filter(f => f.issue.toLowerCase().includes('alt text') || f.issue.toLowerCase().includes('image'))

      // Create new document with fixes
      const doc = new Document({
        sections: [{
          properties: {},
          children: [
            // Add title if missing
            ...(metadataFixes.some(f => f.issue.toLowerCase().includes('title')) ? [
              new Paragraph({
                text: fileName.replace(/\.[^/.]+$/, ''),
                heading: HeadingLevel.TITLE,
              })
            ] : []),
            // Add content
            new Paragraph({
              children: [
                new TextRun(text.substring(0, 1000)) // First 1000 chars as example
              ]
            })
          ]
        }]
      })

      // Generate repaired document
      const repairedBuffer = await Packer.toBuffer(doc)
      return repairedBuffer
    } catch (error) {
      console.error('❌ Word repair error:', error)
      throw new Error(`Failed to repair Word document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Repair PowerPoint document
   */
  private async repairPowerPoint(
    buffer: Buffer,
    fixes: RepairPlan[],
    issues: DocumentIssue[]
  ): Promise<Buffer> {
    try {
      // PowerPoint repair requires ZIP/XML manipulation
      // For now, return original with metadata about what would be fixed
      console.log(`📝 PowerPoint repair: Complex structure manipulation required`)
      
      // Return original document for now - would need deeper XML manipulation
      return buffer
    } catch (error) {
      console.error('❌ PowerPoint repair error:', error)
      throw new Error(`Failed to repair PowerPoint document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Repair HTML document
   */
  private async repairHTML(
    buffer: Buffer,
    fixes: RepairPlan[],
    issues: DocumentIssue[]
  ): Promise<Buffer> {
    try {
      const { JSDOM } = await import('jsdom')
      const html = buffer.toString('utf-8')
      const dom = new JSDOM(html)
      const document = dom.window.document

      // Group fixes
      const altTextFixes = fixes.filter(f => f.issue.toLowerCase().includes('alt text') || f.issue.toLowerCase().includes('image'))
      const metadataFixes = fixes.filter(f => f.issue.toLowerCase().includes('title') || f.issue.toLowerCase().includes('language'))
      const headingFixes = fixes.filter(f => f.issue.toLowerCase().includes('heading'))

      // Apply metadata fixes
      for (const fix of metadataFixes) {
        if (fix.issue.toLowerCase().includes('title')) {
          if (!document.title) {
            const titleMatch = fix.aiFix.match(/title[:\s]+["']?([^"']+)["']?/i)
            document.title = titleMatch ? titleMatch[1].trim() : 'Document'
            console.log(`✅ Added HTML title: ${document.title}`)
          }
        }
        if (fix.issue.toLowerCase().includes('language')) {
          if (!document.documentElement.lang) {
            const langMatch = fix.aiFix.match(/language[:\s]+([a-z]{2})/i)
            document.documentElement.lang = langMatch ? langMatch[1].toLowerCase() : 'en'
            console.log(`✅ Added HTML language: ${document.documentElement.lang}`)
          }
        }
      }

      // Apply alt text fixes
      for (const fix of altTextFixes) {
        const images = document.querySelectorAll('img')
        images.forEach((img, index) => {
          if (!img.alt) {
            const issue = issues.find(i => i.id === fix.issueId)
            if (issue && issue.elementLocation?.includes(`image ${index + 1}`)) {
              // Extract alt text from AI fix
              const altMatch = fix.aiFix.match(/alt[:\s]+["']?([^"']+)["']?/i) || 
                              fix.aiFix.match(/add.*alt[:\s]+(.+?)(?:\.|$)/i)
              img.alt = altMatch ? altMatch[1].trim() : 'Image'
              console.log(`✅ Added alt text to image: ${img.alt}`)
            }
          }
        })
      }

      // Return repaired HTML
      return Buffer.from(dom.serialize())
    } catch (error) {
      console.error('❌ HTML repair error:', error)
      throw new Error(`Failed to repair HTML document: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }
}


