import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedUser } from '@/lib/auth-middleware'

/**
 * Quick PDF page count check endpoint
 * Used to validate PDFs before upload/scan
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
    
    // Only process PDFs
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json(
        { success: false, error: 'File is not a PDF' },
        { status: 400 }
      )
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const fileBuffer = Buffer.from(arrayBuffer)
    
    // Adobe PDF Services API limits
    const ADOBE_STANDARD_PAGE_LIMIT = 400
    const ADOBE_SCANNED_PAGE_LIMIT = 150
    const ADOBE_FILE_SIZE_LIMIT = 100 * 1024 * 1024 // 100MB
    
    // Check file size first
    if (fileBuffer.length > ADOBE_FILE_SIZE_LIMIT) {
      return NextResponse.json(
        { 
          success: false, 
          error: `PDF exceeds file size limit`,
          details: `This PDF is ${Math.round(fileBuffer.length / (1024 * 1024))}MB, but Adobe PDF Services supports a maximum of ${Math.round(ADOBE_FILE_SIZE_LIMIT / (1024 * 1024))}MB for auto-tagging and accessibility checking.`,
          fileSize: fileBuffer.length,
          maxFileSize: ADOBE_FILE_SIZE_LIMIT,
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
      
      const pageLimit = isScanned ? ADOBE_SCANNED_PAGE_LIMIT : ADOBE_STANDARD_PAGE_LIMIT
      
      // Check page count
      if (pageCount > pageLimit) {
        const pdfType = isScanned ? 'scanned' : 'standard'
        return NextResponse.json(
          { 
            success: false, 
            error: `PDF exceeds page limit`,
            details: `This ${pdfType} PDF has ${pageCount} pages, but Adobe PDF Services supports a maximum of ${pageLimit} pages for ${pdfType} PDFs during auto-tagging and accessibility checking.`,
            pageCount: pageCount,
            maxPages: pageLimit,
            pdfType: pdfType,
            isScanned: isScanned,
            suggestion: `Please split the PDF into smaller documents (under ${pageLimit} pages each) or use our manual accessibility checker for larger documents.`
          },
          { status: 400 }
        )
      }
      
      return NextResponse.json({
        success: true,
        pageCount: pageCount,
        fileName: file.name,
        fileSize: fileBuffer.length,
        isScanned: isScanned,
        pdfType: isScanned ? 'scanned' : 'standard',
        maxPages: pageLimit
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

