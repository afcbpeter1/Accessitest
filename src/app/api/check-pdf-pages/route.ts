import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'
import { validatePDFFile } from '@/lib/file-security-validator'

/**
 * Quick PDF page count check endpoint
 * Used to validate PDFs before upload/scan
 * Includes security validation to prevent file spoofing attacks
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await getAuthenticatedUser(request)
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    
    // CRITICAL: Validate PDF file (prevents file spoofing)
    // Checks: file name, size, extension, and actual file content (magic number)
    const FILE_SIZE_LIMIT = 50 * 1024 * 1024 // 50MB
    const validation = validatePDFFile(fileBuffer, file.name, file.type, FILE_SIZE_LIMIT)
    
    if (!validation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: validation.error || 'Invalid PDF file',
          details: validation.details
        },
        { status: 400 }
      )
    }
    
    // Check file size first
    if (fileBuffer.length > FILE_SIZE_LIMIT) {
      return NextResponse.json(
        { 
          success: false, 
          error: `PDF exceeds file size limit`,
          details: `This PDF is ${Math.round(fileBuffer.length / (1024 * 1024))}MB, but the maximum file size for document scanning is ${Math.round(FILE_SIZE_LIMIT / (1024 * 1024))}MB.`,
          fileSize: fileBuffer.length,
          maxFileSize: FILE_SIZE_LIMIT,
          suggestion: 'Please compress the PDF or split it into smaller documents to reduce file size.'
        },
        { status: 400 }
      )
    }
    
    // Quick page count check and scanned PDF detection using pdf-parse
    try {
      const pdfParse = require('pdf-parse')
      // Parse first 3 pages to detect if scanned
      const pdfParseResult = await pdfParse(fileBuffer, { max: 3 })
      const pageCount = pdfParseResult.numpages || 0
      
      // Detect if PDF is scanned (image-based) vs standard (text-based)
      const textLength = pdfParseResult.text?.length || 0
      const avgTextPerPage = pageCount > 0 ? textLength / pageCount : 0
      const textToSizeRatio = textLength / fileBuffer.length
      
      // Heuristic: If average text per page is less than 100 characters, likely scanned
      // Also check if file size is large but text is small (indicates image-heavy/scanned)
      const isScanned = avgTextPerPage < 100 || (fileBuffer.length > 1024 * 1024 && textToSizeRatio < 0.01)
      
      // No page limit - we can process any size PDF now
      return NextResponse.json({
        success: true,
        pageCount: pageCount,
        fileName: file.name,
        fileSize: fileBuffer.length,
        isScanned: isScanned,
        pdfType: isScanned ? 'scanned' : 'standard'
      })
    } catch (parseError: any) {
      console.error('Error parsing PDF:', parseError)
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to parse PDF',
          details: parseError.message 
        },
        { status: 400 }
      )
    }
    
  } catch (error: any) {
    console.error('Check PDF pages error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to check PDF pages' 
      },
      { status: 500 }
    )
  }
}

