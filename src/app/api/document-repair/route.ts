import { NextRequest, NextResponse } from 'next/server'

/**
 * Document Repair API - DEPRECATED
 * This endpoint is no longer used. Document repair functionality has been removed.
 * The tool now focuses on scanning documents and providing AI suggestions.
 * Use /api/document-scan instead.
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    { 
      success: false, 
      error: 'Document repair functionality has been removed. Please use the document scanner instead. Use /api/document-scan to scan documents and get AI suggestions.' 
    },
    { status: 410 } // 410 Gone - indicates the resource is no longer available
  )
}
