/**
 * File Security Validator
 * Validates file types by checking actual file content (magic numbers)
 * Prevents file spoofing attacks where malicious files have .pdf extensions
 */

/**
 * Validate PDF by checking magic number (%PDF at start of file)
 * This prevents file spoofing where a malicious file has a .pdf extension
 */
export function validatePDFMagicNumber(buffer: Buffer): { valid: boolean; error?: string } {
  if (!buffer || buffer.length < 4) {
    return { valid: false, error: 'File is too small to be a valid PDF' }
  }

  // Check for PDF magic number: %PDF (25 50 44 46 in hex)
  const header = buffer.slice(0, 4).toString('ascii')
  if (header !== '%PDF') {
    return { 
      valid: false, 
      error: `Invalid PDF file: File does not start with PDF magic number. Detected header: ${buffer.slice(0, 8).toString('hex')}` 
    }
  }

  // Additional validation: Check PDF version number (should be 1.x)
  // PDF header format: %PDF-1.x or %PDF-x.x
  if (buffer.length >= 8) {
    const versionHeader = buffer.slice(0, 8).toString('ascii')
    if (!/^%PDF-\d\.\d/.test(versionHeader)) {
      // Some PDFs might have %PDF-1.4 or similar, but we'll be lenient
      // The important check is the %PDF prefix
    }
  }

  return { valid: true }
}

/**
 * Validate Word document by checking magic number
 * .docx files are ZIP archives with specific structure
 * .doc files have specific binary headers
 */
export function validateWordMagicNumber(buffer: Buffer, fileName: string): { valid: boolean; error?: string } {
  if (!buffer || buffer.length < 4) {
    return { valid: false, error: 'File is too small to be a valid Word document' }
  }

  const fileNameLower = fileName.toLowerCase()

  if (fileNameLower.endsWith('.docx')) {
    // .docx files are ZIP archives - check for ZIP magic number
    // ZIP files start with: 50 4B 03 04 (PK..)
    const zipHeader = buffer.slice(0, 4)
    if (zipHeader[0] !== 0x50 || zipHeader[1] !== 0x4B || zipHeader[2] !== 0x03 || zipHeader[3] !== 0x04) {
      return { 
        valid: false, 
        error: 'Invalid .docx file: File does not have ZIP archive signature (expected for .docx files)' 
      }
    }

    // Additional check: .docx files should contain [Content_Types].xml
    // But we'll let the Word parser handle this to avoid false positives
    return { valid: true }
  } else if (fileNameLower.endsWith('.doc')) {
    // .doc files (OLE2 format) start with specific binary headers
    // OLE2 files start with: D0 CF 11 E0 A1 B1 1A E1
    const oleHeader = buffer.slice(0, 8)
    if (oleHeader[0] !== 0xD0 || oleHeader[1] !== 0xCF || 
        oleHeader[2] !== 0x11 || oleHeader[3] !== 0xE0 ||
        oleHeader[4] !== 0xA1 || oleHeader[5] !== 0xB1 ||
        oleHeader[6] !== 0x1A || oleHeader[7] !== 0xE1) {
      return { 
        valid: false, 
        error: 'Invalid .doc file: File does not have OLE2 format signature' 
      }
    }
    return { valid: true }
  }

  return { valid: false, error: 'Unknown Word document format' }
}

/**
 * Sanitize file path to prevent directory traversal attacks
 */
export function sanitizeFilePath(filePath: string): string {
  // Remove any path traversal attempts
  let sanitized = filePath.replace(/\.\./g, '').replace(/\/\//g, '/')
  
  // Remove leading slashes and drive letters (Windows)
  sanitized = sanitized.replace(/^[A-Z]:/i, '').replace(/^[\/\\]+/, '')
  
  // Replace backslashes with forward slashes for consistency
  sanitized = sanitized.replace(/\\/g, '/')
  
  // Remove any remaining dangerous characters
  sanitized = sanitized.replace(/[<>:"|?*]/g, '_')
  
  return sanitized
}

/**
 * Validate file name to prevent injection attacks
 */
export function validateFileName(fileName: string): { valid: boolean; error?: string } {
  if (!fileName || fileName.length === 0) {
    return { valid: false, error: 'File name cannot be empty' }
  }

  if (fileName.length > 255) {
    return { valid: false, error: 'File name is too long (maximum 255 characters)' }
  }

  // Check for path traversal attempts
  if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
    return { valid: false, error: 'File name contains invalid characters (path traversal attempt detected)' }
  }

  // Check for null bytes (can be used in injection attacks)
  if (fileName.includes('\0')) {
    return { valid: false, error: 'File name contains null bytes' }
  }

  // Check for dangerous characters
  const dangerousChars = /[<>:"|?*\x00-\x1f]/
  if (dangerousChars.test(fileName)) {
    return { valid: false, error: 'File name contains invalid characters' }
  }

  return { valid: true }
}

/**
 * Comprehensive file validation for PDFs
 */
export function validatePDFFile(
  buffer: Buffer, 
  fileName: string, 
  fileType?: string,
  maxSizeBytes: number = 50 * 1024 * 1024 // 50MB default
): { valid: boolean; error?: string; details?: string } {
  // 1. Validate file name
  const nameValidation = validateFileName(fileName)
  if (!nameValidation.valid) {
    return nameValidation
  }

  // 2. Check file size
  if (buffer.length > maxSizeBytes) {
    return {
      valid: false,
      error: `PDF exceeds file size limit`,
      details: `This PDF is ${Math.round(buffer.length / (1024 * 1024))}MB, but the maximum file size is ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`
    }
  }

  if (buffer.length < 4) {
    return { valid: false, error: 'File is too small to be a valid PDF' }
  }

  // 3. Validate MIME type (if provided) - but don't rely on it alone
  if (fileType && !fileType.toLowerCase().includes('pdf')) {
    return { valid: false, error: 'File MIME type does not indicate PDF' }
  }

  // 4. Validate file extension
  if (!fileName.toLowerCase().endsWith('.pdf')) {
    return { valid: false, error: 'File does not have .pdf extension' }
  }

  // 5. CRITICAL: Validate actual file content (magic number)
  const magicValidation = validatePDFMagicNumber(buffer)
  if (!magicValidation.valid) {
    return magicValidation
  }

  return { valid: true }
}

/**
 * Comprehensive file validation for Word documents
 */
export function validateWordFile(
  buffer: Buffer,
  fileName: string,
  fileType?: string,
  maxSizeBytes: number = 50 * 1024 * 1024 // 50MB default
): { valid: boolean; error?: string; details?: string } {
  // 1. Validate file name
  const nameValidation = validateFileName(fileName)
  if (!nameValidation.valid) {
    return nameValidation
  }

  // 2. Check file size
  if (buffer.length > maxSizeBytes) {
    return {
      valid: false,
      error: `Word document exceeds file size limit`,
      details: `This document is ${Math.round(buffer.length / (1024 * 1024))}MB, but the maximum file size is ${Math.round(maxSizeBytes / (1024 * 1024))}MB.`
    }
  }

  if (buffer.length < 4) {
    return { valid: false, error: 'File is too small to be a valid Word document' }
  }

  // 3. Validate file extension
  const fileNameLower = fileName.toLowerCase()
  if (!fileNameLower.endsWith('.docx') && !fileNameLower.endsWith('.doc')) {
    return { valid: false, error: 'File does not have .docx or .doc extension' }
  }

  // 4. CRITICAL: Validate actual file content (magic number)
  const magicValidation = validateWordMagicNumber(buffer, fileName)
  if (!magicValidation.valid) {
    return magicValidation
  }

  return { valid: true }
}

