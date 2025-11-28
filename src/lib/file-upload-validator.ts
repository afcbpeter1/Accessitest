/**
 * File upload security validation utilities
 */

// Allowed file types for document scanning
const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/msword', // .doc (legacy)
  'application/vnd.ms-powerpoint', // .ppt (legacy)
]

// Allowed file extensions
const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.pptx', '.doc', '.ppt']

// Maximum file size: 50MB
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB in bytes

export interface FileValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validate file type
 */
export function validateFileType(fileName: string, fileType?: string): FileValidationResult {
  // Get file extension
  const extension = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${ALLOWED_EXTENSIONS.join(', ')}`
    }
  }
  
  // If MIME type is provided, validate it too
  if (fileType && !ALLOWED_FILE_TYPES.includes(fileType)) {
    return {
      valid: false,
      error: `File MIME type not allowed: ${fileType}`
    }
  }
  
  return { valid: true }
}

/**
 * Validate file size
 */
export function validateFileSize(fileSize: number): FileValidationResult {
  if (fileSize <= 0) {
    return {
      valid: false,
      error: 'File size must be greater than 0'
    }
  }
  
  if (fileSize > MAX_FILE_SIZE) {
    const maxSizeMB = MAX_FILE_SIZE / (1024 * 1024)
    return {
      valid: false,
      error: `File size exceeds maximum allowed size of ${maxSizeMB}MB`
    }
  }
  
  return { valid: true }
}

/**
 * Sanitize filename to prevent path traversal and other attacks
 */
export function sanitizeFileName(fileName: string): string {
  // Remove path separators and dangerous characters
  let sanitized = fileName
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/\.\./g, '') // Remove parent directory references
    .replace(/[<>:"|?*\x00-\x1f]/g, '') // Remove control characters and invalid chars
    .trim()
  
  // Ensure it has a valid extension
  const extension = sanitized.substring(sanitized.lastIndexOf('.'))
  if (!ALLOWED_EXTENSIONS.includes(extension.toLowerCase())) {
    // If no valid extension, add .pdf as default (or reject)
    sanitized = sanitized.replace(/\.[^.]*$/, '') + '.pdf'
  }
  
  // Limit filename length
  if (sanitized.length > 255) {
    const ext = sanitized.substring(sanitized.lastIndexOf('.'))
    sanitized = sanitized.substring(0, 255 - ext.length) + ext
  }
  
  // Generate safe filename if original was too dangerous
  if (sanitized.length === 0 || sanitized === extension) {
    sanitized = `document_${Date.now()}${extension}`
  }
  
  return sanitized
}

/**
 * Validate base64 file content
 */
export function validateBase64Content(base64Content: string, expectedSize?: number): FileValidationResult {
  if (!base64Content || base64Content.length === 0) {
    return {
      valid: false,
      error: 'File content is required'
    }
  }
  
  // Check if it's valid base64
  try {
    const buffer = Buffer.from(base64Content, 'base64')
    
    // Validate decoded size matches expected size (with some tolerance)
    if (expectedSize) {
      const sizeDifference = Math.abs(buffer.length - expectedSize)
      // Allow 10% difference due to base64 encoding overhead
      if (sizeDifference > expectedSize * 0.1) {
        return {
          valid: false,
          error: 'File content size mismatch'
        }
      }
    }
    
    // Check decoded size
    if (buffer.length > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `Decoded file size exceeds maximum allowed size of ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      }
    }
    
    // Basic magic number validation (file signature)
    // PDF files start with %PDF
    const isPDF = buffer.slice(0, 4).toString() === '%PDF'
    // DOCX files are ZIP archives starting with PK
    const isDOCX = buffer.slice(0, 2).toString() === 'PK'
    
    if (!isPDF && !isDOCX) {
      // For other formats, we'll be more lenient but log a warning
      console.warn('File content does not match expected format signature')
    }
    
  } catch (error) {
    return {
      valid: false,
      error: 'Invalid base64 file content'
    }
  }
  
  return { valid: true }
}

/**
 * Comprehensive file validation
 */
export function validateFileUpload(
  fileName: string,
  fileType: string | undefined,
  fileSize: number,
  fileContent: string
): FileValidationResult {
  // Validate filename
  const sanitizedFileName = sanitizeFileName(fileName)
  if (sanitizedFileName !== fileName) {
    console.warn(`Filename sanitized: "${fileName}" -> "${sanitizedFileName}"`)
  }
  
  // Validate file type
  const typeValidation = validateFileType(sanitizedFileName, fileType)
  if (!typeValidation.valid) {
    return typeValidation
  }
  
  // Validate file size
  const sizeValidation = validateFileSize(fileSize)
  if (!sizeValidation.valid) {
    return sizeValidation
  }
  
  // Validate base64 content
  const contentValidation = validateBase64Content(fileContent, fileSize)
  if (!contentValidation.valid) {
    return contentValidation
  }
  
  return { valid: true }
}

/**
 * Get maximum allowed file size
 */
export function getMaxFileSize(): number {
  return MAX_FILE_SIZE
}

/**
 * Get allowed file extensions
 */
export function getAllowedExtensions(): string[] {
  return [...ALLOWED_EXTENSIONS]
}

