export interface SimpleDocumentIssue {
  id: string
  type: 'critical' | 'serious' | 'moderate' | 'minor'
  description: string
  section: string
  recommendation: string
}

export interface SimpleScanResult {
  is508Compliant: boolean
  issues: SimpleDocumentIssue[]
  summary: {
    total: number
    critical: number
    serious: number
    moderate: number
    minor: number
  }
  metadata: {
    documentType: string
    scanDate: string
    scanEngine: string
    standard: string
    fileSize?: number
    wordCount?: number
    pagesAnalyzed?: number
  }
}

export class SimpleDocumentScanner {
  async scanDocument(buffer: Buffer, fileName: string, fileType: string): Promise<SimpleScanResult> {
    console.log(`Scanning document: ${fileName} - ${buffer.length} bytes`)
    
    // Extract document content
    let documentContent = ''
    let pagesAnalyzed = 1
    
         try {
       if (fileType.includes('pdf')) {
         // Use pdf-parse for PDF files - pass buffer directly
         const pdfParse = require('pdf-parse')
         const data = await pdfParse(buffer, {})
         documentContent = data.text
         pagesAnalyzed = data.numpages || 1
       } else {
        // For other file types, extract as text
        documentContent = buffer.toString('utf-8')
      }
    } catch (error) {
      console.error('Document parsing failed:', error)
      documentContent = buffer.toString('utf-8').substring(0, 1000) + '... [Content extracted]'
    }
    
    // Analyze document content
    const issues: SimpleDocumentIssue[] = []
    
    // Check for document title
    if (!documentContent.includes('Title:') && !documentContent.includes('TITLE:')) {
      issues.push({
        id: 'issue_1',
        type: 'serious',
        description: 'Document title is missing',
        section: 'Document Structure',
        recommendation: 'Add a descriptive document title to improve accessibility.'
      })
    }
    
    // Check for heading structure
    const lines = documentContent.split('\n')
    const hasHeadings = lines.some(line => 
      /^[A-Z][A-Z\s]+$/.test(line.trim()) && line.trim().length < 100 && line.trim().length > 3
    )
    
    if (!hasHeadings && documentContent.length > 500) {
      issues.push({
        id: 'issue_2',
        type: 'moderate',
        description: 'No heading structure detected',
        section: 'Document Structure',
        recommendation: 'Use proper heading hierarchy (H1, H2, H3) to organize content.'
      })
    }
    
    // Check for long paragraphs
    const longParagraphs = lines.filter(line => line.length > 300)
    if (longParagraphs.length > 0) {
      issues.push({
        id: 'issue_3',
        type: 'moderate',
        description: `Found ${longParagraphs.length} very long paragraph(s)`,
        section: 'Text and Typography',
        recommendation: 'Break long paragraphs into shorter, more digestible sections.'
      })
    }
    
    // Check for all caps text
    const allCapsLines = lines.filter(line => 
      line.length > 10 && line === line.toUpperCase() && /[A-Z]/.test(line)
    )
    if (allCapsLines.length > 0) {
      issues.push({
        id: 'issue_4',
        type: 'minor',
        description: `Found ${allCapsLines.length} line(s) in all caps`,
        section: 'Text and Typography',
        recommendation: 'Use sentence case or title case instead of all caps for better readability.'
      })
    }
    
    // Check for document language (basic check)
    if (!documentContent.includes('lang=') && !documentContent.includes('language:')) {
      issues.push({
        id: 'issue_5',
        type: 'minor',
        description: 'Document language not specified',
        section: 'Document Structure',
        recommendation: 'Specify the document language for better screen reader support.'
      })
    }
    
    const summary = {
      total: issues.length,
      critical: issues.filter(i => i.type === 'critical').length,
      serious: issues.filter(i => i.type === 'serious').length,
      moderate: issues.filter(i => i.type === 'moderate').length,
      minor: issues.filter(i => i.type === 'minor').length
    }
    
    return {
      is508Compliant: issues.length === 0,
      issues,
      summary,
      metadata: {
        documentType: fileType,
        scanDate: new Date().toISOString(),
        scanEngine: 'Enhanced Document Scanner',
        standard: 'Section 508',
        fileSize: buffer.length,
        wordCount: documentContent.split(/\s+/).length,
        pagesAnalyzed: pagesAnalyzed
      }
    }
  }
}
