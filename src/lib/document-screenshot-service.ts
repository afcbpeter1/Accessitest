import { PDFDocument } from 'pdf-lib'
import { createCanvas } from 'canvas'
import { JSDOM } from 'jsdom'

export interface DocumentScreenshotResult {
  pageScreenshots: Array<{
    pageNumber: number
    screenshot: string // base64 encoded
    annotations: Array<{
      x: number
      y: number
      width: number
      height: number
      issue: string
      severity: 'critical' | 'serious' | 'moderate' | 'minor'
    }>
  }>
  elementScreenshots: Array<{
    element: string
    screenshot: string
    pageNumber: number
    boundingBox: {
      x: number
      y: number
      width: number
      height: number
    }
  }>
}

export class DocumentScreenshotService {
  
  async capturePDFScreenshots(pdfBuffer: Buffer, issues: any[]): Promise<DocumentScreenshotResult> {
    try {
      const pdfDoc = await PDFDocument.load(pdfBuffer)
      const pageCount = pdfDoc.getPageCount()
      
      const pageScreenshots: DocumentScreenshotResult['pageScreenshots'] = []
      const elementScreenshots: DocumentScreenshotResult['elementScreenshots'] = []

      // For each page, create a visual representation
      for (let i = 0; i < pageCount; i++) {
        const page = pdfDoc.getPage(i)
        const { width, height } = page.getSize()

        // Create canvas for page visualization
        const canvas = createCanvas(width, height)
        const ctx = canvas.getContext('2d')

        // Fill with white background
        ctx.fillStyle = 'white'
        ctx.fillRect(0, 0, width, height)

        // Add page content representation (simplified)
        ctx.fillStyle = 'black'
        ctx.font = '12px Arial'
        ctx.fillText(`Page ${i + 1}`, 20, 30)
        ctx.fillText('Document content would be rendered here', 20, 60)

        // Add issue annotations
        const pageIssues = issues.filter(issue => issue.pageNumber === i + 1)
        const annotations: DocumentScreenshotResult['pageScreenshots'][0]['annotations'] = []

        pageIssues.forEach((issue, index) => {
          const x = 20 + (index * 200) % (width - 200)
          const y = 100 + Math.floor(index / 3) * 50

          // Draw issue highlight
          const colors: Record<string, string> = {
            critical: '#ff0000',
            serious: '#ff8800', 
            moderate: '#ffaa00',
            minor: '#ffdd00'
          }

          ctx.fillStyle = colors[issue.severity as string] || '#ffdd00'
          ctx.fillRect(x, y, 180, 40)
          
          ctx.fillStyle = 'black'
          ctx.font = '10px Arial'
          ctx.fillText(issue.title || 'Accessibility Issue', x + 5, y + 15)
          ctx.fillText(issue.severity, x + 5, y + 30)

          annotations.push({
            x,
            y,
            width: 180,
            height: 40,
            issue: issue.title || 'Accessibility Issue',
            severity: issue.severity
          })
        })

        const pageScreenshot = canvas.toDataURL('image/png').split(',')[1] // Remove data:image/png;base64, prefix

        pageScreenshots.push({
          pageNumber: i + 1,
          screenshot: pageScreenshot,
          annotations
        })
      }

      return {
        pageScreenshots,
        elementScreenshots
      }

    } catch (error) {
      console.error('Error capturing PDF screenshots:', error)
      throw new Error('Failed to capture document screenshots')
    }
  }

  async captureWordScreenshots(docxBuffer: Buffer, issues: any[]): Promise<DocumentScreenshotResult> {
    // For Word documents, we'll create a simplified visual representation
    const pageScreenshots: DocumentScreenshotResult['pageScreenshots'] = []
    const elementScreenshots: DocumentScreenshotResult['elementScreenshots'] = []

    // Create a mock page representation
    const canvas = createCanvas(800, 1000)
    const ctx = canvas.getContext('2d')

    // Fill with white background
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 800, 1000)

    // Add document content representation
    ctx.fillStyle = 'black'
    ctx.font = '14px Arial'
    ctx.fillText('Word Document Content', 50, 50)
    ctx.fillText('This would show the actual document content', 50, 80)

    // Add issue annotations
    const annotations: DocumentScreenshotResult['pageScreenshots'][0]['annotations'] = []
    issues.forEach((issue, index) => {
      const x = 50 + (index * 200) % 600
      const y = 120 + Math.floor(index / 3) * 60

      const colors: Record<string, string> = {
        critical: '#ff0000',
        serious: '#ff8800',
        moderate: '#ffaa00', 
        minor: '#ffdd00'
      }

      ctx.fillStyle = colors[issue.severity as string] || '#ffdd00'
      ctx.fillRect(x, y, 180, 50)
      
      ctx.fillStyle = 'black'
      ctx.font = '10px Arial'
      ctx.fillText(issue.title || 'Accessibility Issue', x + 5, y + 15)
      ctx.fillText(issue.severity, x + 5, y + 30)
      ctx.fillText(issue.description?.substring(0, 30) + '...', x + 5, y + 45)

      annotations.push({
        x,
        y,
        width: 180,
        height: 50,
        issue: issue.title || 'Accessibility Issue',
        severity: issue.severity
      })
    })

    const screenshot = canvas.toDataURL('image/png').split(',')[1]

    pageScreenshots.push({
      pageNumber: 1,
      screenshot,
      annotations
    })

    return {
      pageScreenshots,
      elementScreenshots
    }
  }

  async capturePowerPointScreenshots(pptxBuffer: Buffer, issues: any[]): Promise<DocumentScreenshotResult> {
    // Similar to Word but for PowerPoint slides
    const pageScreenshots: DocumentScreenshotResult['pageScreenshots'] = []
    const elementScreenshots: DocumentScreenshotResult['elementScreenshots'] = []

    // Create mock slide representations
    const canvas = createCanvas(1024, 768)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, 1024, 768)

    ctx.fillStyle = 'black'
    ctx.font = '16px Arial'
    ctx.fillText('PowerPoint Slide Content', 50, 50)

    const annotations: DocumentScreenshotResult['pageScreenshots'][0]['annotations'] = []
    issues.forEach((issue, index) => {
      const x = 50 + (index * 250) % 700
      const y = 100 + Math.floor(index / 3) * 80

      const colors: Record<string, string> = {
        critical: '#ff0000',
        serious: '#ff8800',
        moderate: '#ffaa00',
        minor: '#ffdd00'
      }

      ctx.fillStyle = colors[issue.severity as string] || '#ffdd00'
      ctx.fillRect(x, y, 200, 60)
      
      ctx.fillStyle = 'black'
      ctx.font = '12px Arial'
      ctx.fillText(issue.title || 'Accessibility Issue', x + 5, y + 20)
      ctx.fillText(issue.severity, x + 5, y + 40)

      annotations.push({
        x,
        y,
        width: 200,
        height: 60,
        issue: issue.title || 'Accessibility Issue',
        severity: issue.severity
      })
    })

    const screenshot = canvas.toDataURL('image/png').split(',')[1]

    pageScreenshots.push({
      pageNumber: 1,
      screenshot,
      annotations
    })

    return {
      pageScreenshots,
      elementScreenshots
    }
  }
}

export const documentScreenshotService = new DocumentScreenshotService()
