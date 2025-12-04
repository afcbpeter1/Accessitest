'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle, X, Download, Eye, Sparkles, CreditCard, Plus, ChevronUp, ChevronDown, Wrench, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import CollapsibleIssue from './CollapsibleIssue'
import { useScan } from '@/contexts/ScanContext'
import { authenticatedFetch } from '@/lib/auth-utils'
import { useToast } from './Toast'

// Function to get accessible color classes based on accessibility score
// Uses WCAG-compliant color combinations (text-{color}-800 on bg-{color}-100)
function getScoreColor(score: number): string {
  if (score >= 90) {
    return 'bg-green-100 text-green-800' // Excellent (90-100)
  } else if (score >= 70) {
    return 'bg-yellow-100 text-yellow-800' // Good (70-89)
  } else if (score >= 50) {
    return 'bg-orange-100 text-orange-800' // Needs improvement (50-69)
  } else {
    return 'bg-red-100 text-red-800' // Poor/Failing (0-49)
  }
}

// Function to parse and extract suggestion text from aiFix field
function parseAISuggestion(aiFix: string): string {
  if (!aiFix) return ''
  
  // Try to extract JSON if present
  try {
    // Check if it's a JSON string wrapped in markdown code blocks
    const jsonMatch = aiFix.match(/```json\s*([\s\S]*?)\s*```/i) || aiFix.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const jsonStr = jsonMatch[1] || jsonMatch[0]
      const parsed = JSON.parse(jsonStr)
      // Return suggestion field if available, otherwise whatWillBeFixed
      return parsed.suggestion || parsed.whatWillBeFixed || aiFix
    }
    
    // Try parsing the whole string as JSON
    const parsed = JSON.parse(aiFix)
    return parsed.suggestion || parsed.whatWillBeFixed || aiFix
  } catch (e) {
    // If not JSON, check if there's a JSON object embedded in the text
    const embeddedJson = aiFix.match(/\{[\s\S]*"suggestion"[\s\S]*\}/)
    if (embeddedJson) {
      try {
        const parsed = JSON.parse(embeddedJson[0])
        const suggestion = parsed.suggestion || parsed.whatWillBeFixed
        if (suggestion) {
          // Remove the JSON from the original text and return just the suggestion
          return suggestion
        }
      } catch (e2) {
        // Ignore parsing errors
      }
    }
    
    // If all parsing fails, remove any visible JSON code blocks and return clean text
    let cleaned = aiFix
      .replace(/```json\s*[\s\S]*?\s*```/gi, '') // Remove markdown code blocks
      .replace(/\{[\s\S]*"suggestion"[\s\S]*\}/g, '') // Remove embedded JSON
      .trim()
    
    // If cleaned text is empty or just whitespace, return original
    if (!cleaned || cleaned.length < 10) {
      return aiFix
    }
    
    return cleaned
  }
}

// Function to format AI suggestion descriptions with proper markdown-like formatting
function formatSuggestionDescription(description: string) {
  if (!description) return description
  
  // Split by lines and process each line
  const lines = description.split('\n')
  const elements: JSX.Element[] = []
  let stepNumber = 1
  let inList = false
  
  lines.forEach((line, index) => {
    const trimmedLine = line.trim()
    
    // Skip empty lines but add spacing
    if (!trimmedLine) {
      if (inList) {
        inList = false
        elements.push(<br key={`br-${index}`} />)
      } else {
        elements.push(<br key={`br-${index}`} />)
      }
      return
    }
    
    // Handle markdown-style headings (## Heading)
    if (trimmedLine.startsWith('## ')) {
      const headingText = trimmedLine.substring(3).trim()
      elements.push(
        <h4 key={index} className="text-base font-semibold text-black mt-4 mb-2">
          {headingText}
        </h4>
      )
      return
    }
    
    // Handle markdown-style headings (# Heading)
    if (trimmedLine.startsWith('# ')) {
      const headingText = trimmedLine.substring(2).trim()
      elements.push(
        <h3 key={index} className="text-lg font-bold text-black mt-4 mb-3">
          {headingText}
        </h3>
      )
      return
    }
    
    // Handle numbered lists (1. Item or Step 1:)
    const numberedMatch = trimmedLine.match(/^(?:Step\s+)?(\d+)[\.:]\s*(.+)$/i)
    if (numberedMatch) {
      const [, number, content] = numberedMatch
      elements.push(
        <p key={index} className="mb-2 ml-4">
          <span className="font-semibold text-black">{stepNumber}.</span>{' '}
          <span className="text-black">{content.trim()}</span>
        </p>
      )
      stepNumber++
      return
    }
    
    // Handle bullet points (- Item or * Item)
    if (trimmedLine.match(/^[-*]\s+/)) {
      const content = trimmedLine.replace(/^[-*]\s+/, '')
      elements.push(
        <p key={index} className="mb-1 ml-4">
          <span className="text-black">•</span>{' '}
          <span className="text-black">{content}</span>
        </p>
      )
      inList = true
      return
    }
    
    // Handle bold text (**text** or **text**)
    let formattedText = trimmedLine
    formattedText = formattedText.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    
    // Regular paragraph
    elements.push(
      <p key={index} className="mb-2 text-black" dangerouslySetInnerHTML={{ __html: formattedText }} />
    )
  })
  
  return <div className="space-y-1">{elements}</div>
}

interface UploadedDocument {
  id: string
  name: string
  size: number
  type: string
  uploadDate: Date
  status: 'uploading' | 'uploaded' | 'scanning' | 'completed' | 'error'
  fileContent?: string // Base64 encoded file content for scanning
  preview?: string // Base64 image preview for display
  // No repair results - just scan results with AI suggestions
  scanResults?: {
    is508Compliant: boolean
    overallScore?: number
    issues: Array<{
      id: string
      type: 'critical' | 'serious' | 'moderate' | 'minor'
      category?: 'text' | 'image' | 'color' | 'font' | 'layout' | 'structure' | 'navigation'
      description: string
      section: string
      pageNumber?: number
      lineNumber?: number
      elementLocation?: string
      context?: string
      wcagCriterion?: string
      section508Requirement?: string
      recommendation: string
      impact?: 'high' | 'medium' | 'low'
      remediation?: string
      occurrences?: number
      affectedPages?: number
      elementContent?: string
      elementType?: string
      elementSelector?: string
    }>
    summary: {
      total: number
      critical: number
      serious: number
      moderate: number
      minor: number
      byCategory?: {
        text: number
        image: number
        color: number
        font: number
        layout: number
        structure: number
        navigation: number
      }
    }
    imageAnalysis?: {
      totalImages: number
      imagesWithAltText: number
      imagesWithoutAltText: number
      decorativeImages: number
      informativeImages: number
      complexImages: number
    }
    metadata?: {
      scanEngine?: string
      standard?: string
      scanDuration?: number
      pagesAnalyzed?: number
      fileSize?: number
      wordCount?: number
      imageCount?: number
      tableCount?: number
      linkCount?: number
    }
  }
  error?: string
}

interface DocumentUploadProps {
  onScanComplete?: (document: UploadedDocument) => void
}

export default function DocumentUpload({ onScanComplete }: DocumentUploadProps) {
  // Available Section 508 tags - defined first so it can be used in selectedTags
  const availableTags = [
    { tag: '1194.22a', name: 'Text Alternatives', description: 'Images and non-text content must have text alternatives' },
    { tag: '1194.22b', name: 'Media Alternatives', description: 'Video and audio must have captions or alternatives' },
    { tag: '1194.22c', name: 'Information Relationships', description: 'Document structure must preserve information relationships' },
    { tag: '1194.22d', name: 'Meaningful Sequence', description: 'Content must be presented in a meaningful sequence' },
    { tag: '1194.22e', name: 'Color Usage', description: 'Information must not be conveyed by color alone' },
    { tag: '1194.22f', name: 'Contrast', description: 'Text must have sufficient contrast ratio' },
    { tag: '1194.22g', name: 'Visual Presentation', description: 'Visual presentation must not interfere with readability' },
    { tag: '1194.22h', name: 'Keyboard Accessibility', description: 'All functionality must be keyboard accessible' },
    { tag: '1194.22i', name: 'No Keyboard Trap', description: 'Users must be able to navigate away from all content' },
    { tag: '1194.22j', name: 'Timing', description: 'Users must have sufficient time to read and use content' },
    { tag: '1194.22k', name: 'Flashing', description: 'Content must not flash more than 3 times per second' },
    { tag: '1194.22l', name: 'Text-only Page', description: 'Complex documents should provide text-only alternatives' },
    { tag: '1194.22m', name: 'Scripts', description: 'Scripts must be accessible or have alternatives' },
    { tag: '1194.22n', name: 'Plug-ins', description: 'Plug-ins must be accessible or have alternatives' },
    { tag: '1194.22o', name: 'Electronic Forms', description: 'Forms must have proper labels and error handling' },
    { tag: '1194.22p', name: 'Navigation', description: 'Long documents should have navigation aids' }
  ]

  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  // Auto-select all Section 508 tests by default - all tests run automatically
  const selectedTags = availableTags.map(tag => tag.tag)
  const [currentScanId, setCurrentScanId] = useState<string | null>(null)
  const [scanLogs, setScanLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const { addScan, updateScan, removeScan, getActiveScan, activeScans } = useScan()
  const { showToast, ToastContainer } = useToast()

  const [userCredits, setUserCredits] = useState<number>(10)
  const [canScan, setCanScan] = useState<boolean>(true)
  const [isCheckingCredits, setIsCheckingCredits] = useState<boolean>(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [documentPreview, setDocumentPreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Function to restore the most recent scan from database
  const restoreMostRecentScan = useCallback(async () => {
    try {
      // Check if we've already attempted restoration in this session
      const hasRestored = sessionStorage.getItem('documentScanRestored')
      if (hasRestored === 'true') {
        console.log('ℹ️ Scan restoration already attempted in this session')
        return
      }
      
      // Fetch the most recent document scan from history
      const response = await authenticatedFetch('/api/scan-history?limit=1')
      if (!response.ok) {
        console.log('⚠️ Failed to fetch scan history for restoration')
        return
      }
      
      const data = await response.json()
      if (!data.success || !data.scans || data.scans.length === 0) {
        console.log('ℹ️ No scan history found to restore')
        sessionStorage.setItem('documentScanRestored', 'true') // Mark as attempted even if no scans found
        return
      }
      
      const mostRecentScan = data.scans[0]
      
      // Only restore if it's a document scan
      if (mostRecentScan.scanType === 'document' && mostRecentScan.fileName) {
        console.log('🔄 Restoring document scan:', mostRecentScan.fileName)
        
        // Fetch full scan details
        const detailsResponse = await authenticatedFetch(`/api/scan-history?scanId=${mostRecentScan.id}`)
        if (detailsResponse.ok) {
          const detailsData = await detailsResponse.json()
          if (detailsData.success && detailsData.scan) {
            const scan = detailsData.scan
            
            // Use actual scan results from database (includes issues)
            const actualScanResults = scan.scanResults || {}
            
            // Check if we already have this document restored (use functional update to avoid dependency)
            setUploadedDocuments(prev => {
              const existingDoc = prev.find(doc => 
                doc.name === scan.fileName && doc.status === 'completed'
              )
              
              // Only restore if we don't already have it
              if (!existingDoc) {
                // Reconstruct the document with scan results
                const restoredDocument: UploadedDocument = {
                  id: `restored_${mostRecentScan.id}`,
                  name: scan.fileName || 'Restored Document',
                  size: 0, // Size not stored in history
                  type: scan.fileType || 'application/pdf',
                  uploadDate: new Date(scan.createdAt || scan.updatedAt),
                  status: 'completed',
                  scanResults: {
                    is508Compliant: actualScanResults.is508Compliant ?? scan.is508Compliant ?? false,
                    overallScore: actualScanResults.overallScore ?? scan.overallScore,
                    issues: actualScanResults.issues || [], // Use actual issues from database
                    summary: actualScanResults.summary || {
                      total: scan.totalIssues || 0,
                      critical: scan.criticalIssues || 0,
                      serious: scan.seriousIssues || 0,
                      moderate: scan.moderateIssues || 0,
                      minor: scan.minorIssues || 0
                    },
                    imageAnalysis: actualScanResults.imageAnalysis,
                    metadata: actualScanResults.metadata
                  },
                  // No repair results - just scan results
                }
                
                // Mark as restored to prevent loops
                sessionStorage.setItem('documentScanRestored', 'true')
                
                // Show toast notification only once
                setTimeout(() => {
                  showToast('Restored your most recent scan results.', 'info')
                }, 100)
                
                console.log('✅ Scan restored successfully:', scan.fileName)
                return [restoredDocument, ...prev]
              } else {
                console.log('ℹ️ Document already restored:', scan.fileName)
                sessionStorage.setItem('documentScanRestored', 'true')
                return prev
              }
            })
          }
        } else {
          console.error('⚠️ Failed to fetch scan details for restoration')
          sessionStorage.setItem('documentScanRestored', 'true') // Mark as attempted even on error
        }
      } else {
        sessionStorage.setItem('documentScanRestored', 'true') // Mark as attempted
      }
    } catch (error) {
      console.error('❌ Failed to restore scan from database:', error)
      sessionStorage.setItem('documentScanRestored', 'true') // Mark as attempted even on error
      // Don't show error to user - just log it
    }
  }, [showToast])
  
  // Load scan state from localStorage and global context on component mount
  useEffect(() => {
    const savedScanId = localStorage.getItem('currentScanId')
    const savedScanLogs = localStorage.getItem('scanLogs')
    const savedIsScanning = localStorage.getItem('isScanning')
    
    // First check if there's an active scan in global state
    const documentScans = activeScans.filter(scan => 
      scan.type === 'document' && 
      (scan.status === 'scanning' || scan.status === 'analyzing' || scan.status === 'crawling')
    )
    
    if (documentScans.length > 0) {
      const activeScan = documentScans[0] // Get the most recent active document scan
      setCurrentScanId(activeScan.scanId)
      setIsScanning(true)
      
      if (savedScanLogs) {
        setScanLogs(JSON.parse(savedScanLogs))
      }
    } else {
      // No active scans - clear any stale localStorage state
      if (savedScanId || savedIsScanning === 'true') {
        console.log('🧹 Clearing stale scan state from localStorage')
        localStorage.removeItem('currentScanId')
        localStorage.removeItem('isScanning')
        localStorage.removeItem('scanLogs')
        setCurrentScanId(null)
        setIsScanning(false)
        setScanLogs([])
      }
      
      // Check for completed scans that need cleanup
      const completedScans = activeScans.filter(scan => 
        scan.type === 'document' && 
        (scan.status === 'complete' || scan.status === 'error')
      )
      
      // Remove completed scans from global state
      completedScans.forEach(scan => {
        removeScan(scan.scanId)
      })
      
      // Only restore once on mount - use sessionStorage to prevent loops
      const hasRestored = sessionStorage.getItem('documentScanRestored')
      if (!hasRestored) {
        // Use a small delay to ensure component is fully mounted
        const restoreTimer = setTimeout(() => {
          restoreMostRecentScan()
        }, 500)
        
        return () => clearTimeout(restoreTimer)
      }
    }
  }, [activeScans, removeScan, restoreMostRecentScan])
  
  // Save scan state to localStorage
  useEffect(() => {
    if (currentScanId) {
      localStorage.setItem('currentScanId', currentScanId)
      localStorage.setItem('isScanning', isScanning.toString())
    } else {
      localStorage.removeItem('currentScanId')
      localStorage.removeItem('isScanning')
    }
  }, [currentScanId, isScanning])
  
  // Save logs to localStorage
  useEffect(() => {
    if (scanLogs.length > 0) {
      localStorage.setItem('scanLogs', JSON.stringify(scanLogs))
    } else {
      localStorage.removeItem('scanLogs')
    }
  }, [scanLogs])
  
  // Document scans are synchronous, so no status check needed
  // The scan completes immediately when the API call returns

  // Load credits on component mount
  useEffect(() => {
    checkUserCredits()
    
    // Clear any stale scan state on mount (user just logged in or refreshed)
    // Only keep state if there's actually an active scan in global context
    const hasActiveScan = activeScans.some(scan => 
      scan.type === 'document' && 
      (scan.status === 'scanning' || scan.status === 'analyzing' || scan.status === 'crawling')
    )
    
    if (!hasActiveScan) {
      // No active scans - ensure we're not showing stale state
      const savedIsScanning = localStorage.getItem('isScanning')
      if (savedIsScanning === 'true') {
        console.log('🧹 Clearing stale scan state on mount')
        localStorage.removeItem('currentScanId')
        localStorage.removeItem('isScanning')
        localStorage.removeItem('scanLogs')
        setCurrentScanId(null)
        setIsScanning(false)
        setScanLogs([])
      }
      
      // Clean up any completed scans from global state
      activeScans.filter(scan => 
        scan.type === 'document' && 
        (scan.status === 'complete' || scan.status === 'error')
      ).forEach(scan => {
        removeScan(scan.scanId)
      })
    }
  }, [])

  // Debug: Monitor uploaded documents changes
  useEffect(() => {
    console.log('🔍 Uploaded documents updated:', uploadedDocuments)
    uploadedDocuments.forEach(doc => {
      if (doc.status === 'completed' && doc.scanResults) {
        console.log('🔍 Document with results:', doc.name, doc.scanResults)
      }
    })
  }, [uploadedDocuments])

  // Check user credits
  const checkUserCredits = async () => {
    setIsCheckingCredits(true)
    try {
      const response = await authenticatedFetch('/api/credits')
      if (response.ok) {
        const data = await response.json()
        console.log('🔍 Credit check result:', data)
        setUserCredits(data.credits)
        setCanScan(data.canScan)
      } else {
        console.error('Failed to fetch credits:', response.status, response.statusText)
      }
    } catch (error) {
      console.error('Failed to check credits:', error)
    } finally {
      setIsCheckingCredits(false)
    }
  }

  // Load scan results for a completed document
  const loadScanResultsForDocument = async (fileName: string) => {
    try {
      const response = await authenticatedFetch('/api/document-scan')
      if (response.ok) {
        const data = await response.json()
        const recentScan = data.scans?.find((scan: any) => 
          scan.fileName === fileName && scan.scanResults
        )
        
        if (recentScan && recentScan.scanResults) {
          console.log('🔍 Loading scan results for document:', fileName, recentScan.scanResults)
          
          setUploadedDocuments(prev => 
            prev.map(doc => 
              doc.name === fileName 
                ? { 
                    ...doc, 
                    status: 'completed',
                    scanResults: recentScan.scanResults
                  } 
                : doc
            )
          )
        }
      }
    } catch (error) {
      console.error('Failed to load scan results:', error)
    }
  }


  const supportedFormats = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/html',
    'text/plain'
  ]

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    setIsUploading(true)
    clearScanLogs()
    addScanLog('🚀 Starting file upload process...')

    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      
      // Check file type
      if (!supportedFormats.includes(file.type)) {
        addScanLog(`❌ File ${file.name} has unsupported type: ${file.type}`)
        continue
      }

      // Check file size (50MB limit)
      if (file.size > 50 * 1024 * 1024) {
        addScanLog(`❌ File ${file.name} is too large (${formatFileSize(file.size)})`)
        continue
      }

      const documentId = `doc_${Date.now()}_${i}`
      const newDocument: UploadedDocument = {
        id: documentId,
        name: file.name,
        size: file.size,
        type: file.type,
        uploadDate: new Date(),
        status: 'uploading'
      }

      setUploadedDocuments(prev => [...prev, newDocument])
      addScanLog(`📁 Processing file: ${file.name} (${formatFileSize(file.size)})`)

      try {
        // Process file locally (no server upload yet)
        addScanLog('📁 Processing file locally...')
        await new Promise(resolve => setTimeout(resolve, 500)) // Reduced delay
        
        // Update status to uploaded (not scanning yet)
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { ...doc, status: 'uploaded' }
              : doc
          )
        )
        addScanLog('✅ File processed successfully')
        addScanLog('📋 Document ready for accessibility scan')
        
        // Store file content for later scanning
        const fileContent = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            // Remove data URL prefix to get just the base64 content
            const base64 = result.split(',')[1]
            resolve(base64)
          }
          reader.readAsDataURL(file)
        })
        
        // Store file content in the document object for later scanning
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { ...doc, fileContent }
              : doc
          )
        )

        // Generate document preview for PDFs
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
          try {
            console.log('📄 PDF detected, generating preview...')
            await generatePDFPreview(file, documentId)
            console.log('✅ PDF preview generation completed')
          } catch (error) {
            console.error('❌ Could not generate PDF preview:', error)
            // Continue without preview - not critical
          }
        } else {
          console.log('ℹ️ Not a PDF file, skipping preview generation:', file.type)
        }

        addScanLog('🎉 Document upload complete!')

      } catch (error) {
        addScanLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { ...doc, status: 'error', error: 'Upload failed' }
              : doc
          )
        )
        // Reset scanning state on error
        setCurrentScanId(null)
        setIsScanning(false)
      }
    }

    setIsUploading(false)
  }

  // Generate PDF preview thumbnail
  const generatePDFPreview = async (file: File, documentId: string) => {
    try {
      console.log('🖼️ Generating PDF preview for:', file.name)
      
      // Use pdfjs-dist to render first page as image
      const pdfjsLib = await import('pdfjs-dist')
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`
      
      const arrayBuffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      const page = await pdf.getPage(1) // Get first page
      
      // Use higher scale for better quality
      const viewport = page.getViewport({ scale: 2.0 })
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      
      if (!context) {
        console.error('❌ Could not get canvas context')
        return
      }
      
      canvas.height = viewport.height
      canvas.width = viewport.width
      
      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise
      
      // Convert to base64 data URL with better quality
      const preview = canvas.toDataURL('image/jpeg', 0.85)
      
      console.log('✅ PDF preview generated successfully, size:', preview.length, 'chars')
      
      // Store preview for this document
      setDocumentPreview(preview)
      
      // Also store in document object for later use
      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, preview }
            : doc
        )
      )
    } catch (error) {
      console.error('❌ Failed to generate PDF preview:', error)
      // Don't throw - preview is optional
    }
  }

  const fixPDF = async (documentId: string) => {
    const document = uploadedDocuments.find(doc => doc.id === documentId)
    if (!document) {
      addScanLog('❌ Document not found')
      return
    }

    if (!document.fileContent) {
      addScanLog('❌ Document content is missing - please re-upload the document')
      return
    }

    if (!document.type.toLowerCase().includes('pdf')) {
      addScanLog('❌ This feature only works with PDF files')
      return
    }

    // Update status to scanning
    setUploadedDocuments(prev => 
      prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, status: 'scanning' }
          : doc
      )
    )

    addScanLog('🏷️ Starting PDF repair using Adobe PDF Services...')
    addScanLog('📋 Step 1: Auto-tagging PDF for accessibility...')
    setIsScanning(true)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        addScanLog('❌ Authentication required. Please log in again.')
        setIsScanning(false)
        return
      }

      // Convert base64 fileContent back to File for FormData
      const fileBlob = await fetch(`data:${document.type};base64,${document.fileContent}`)
        .then(res => res.blob())
      const file = new File([fileBlob], document.name, { type: document.type })

      const formData = new FormData()
      formData.append('file', file)
      formData.append('fileName', document.name)

      addScanLog('🔄 Calling Adobe PDF Services API...')

      const response = await fetch('/api/pdf-repair', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'PDF repair failed')
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'PDF repair failed')
      }

      addScanLog('✅ PDF successfully auto-tagged!')
      addScanLog(`🔍 Step 2: Rescanning to verify fixes...`)
      addScanLog(`📊 Original: ${result.originalScan.issues.length} issues`)
      addScanLog(`📊 After fix: ${result.repairedScan.issues.length} issues`)
      
      if (result.improvement.issuesFixed > 0) {
        addScanLog(`✅ Fixed ${result.improvement.issuesFixed} issue(s)!`)
        addScanLog(`📈 Score improved: ${result.originalScan.score} → ${result.repairedScan.score}`)
      } else {
        addScanLog(`⚠️ No issues were automatically fixed`)
      }

      // Update document with repaired PDF and new scan results
      const repairedPdfBase64 = result.repairedPdf
      
      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { 
                ...doc, 
                status: 'completed',
                fileContent: repairedPdfBase64, // Update with repaired PDF
                scanResults: result.repairedScan, // Update with new scan results
                repairResults: {
                  originalScan: result.originalScan,
                  repairedScan: result.repairedScan,
                  improvement: result.improvement,
                  repairPlan: result.repairPlan
                }
              }
            : doc
        )
      )

      showToast('PDF repaired successfully!', 'success')
      
    } catch (error) {
      console.error('❌ PDF repair error:', error)
      addScanLog(`❌ Error: ${error instanceof Error ? error.message : 'Failed to repair PDF'}`)
      
      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, status: 'completed' } // Revert to completed (don't mark as error)
            : doc
        )
      )
      
      showToast(error instanceof Error ? error.message : 'Failed to repair PDF', 'error')
    } finally {
      setIsScanning(false)
    }
  }

  const removeDocument = (documentId: string) => {
    // Clear any scan state if this was the current document being scanned
    if (currentScanId && uploadedDocuments.find(doc => doc.id === documentId)?.status === 'scanning') {
      setCurrentScanId(null)
      setIsScanning(false)
      setScanProgress(0)
      setDocumentPreview(null)
      addScanLog('🚫 Document removed - scan cancelled')
    }
    
    setUploadedDocuments(prev => prev.filter(doc => doc.id !== documentId))
  }

  // All tests run automatically - no need for toggle functions

  const addScanLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString()
    setScanLogs(prev => [...prev, `[${timestamp}] ${message}`])
  }

  const clearScanLogs = () => {
    setScanLogs([])
  }

  const addIssuesToBacklog = async (issues: any[]) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        addScanLog('❌ Authentication required to add issues to backlog')
        return
      }

      addScanLog('🔄 Adding issues to product backlog...')

      // Transform document issues to match the expected format for backlog
      const transformedIssues = issues.map(issue => ({
        ruleName: issue.description || issue.section || 'Accessibility Issue',
        description: issue.description,
        impact: issue.type,
        wcagLevel: issue.wcagCriterion || 'AA',
        elementSelector: issue.elementLocation || '',
        elementHtml: issue.context || '',
        failureSummary: issue.recommendation || '',
        url: `Document: ${uploadedDocuments.find(doc => doc.scanResults)?.name || 'Unknown'}`,
        domain: 'document-scan'
      }))

      const response = await fetch('/api/backlog/auto-add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scanResults: transformedIssues,
          domain: 'document-scan'
        })
      })

      const data = await response.json()

      if (data.success) {
        addScanLog(`✅ Added ${data.added.length} issues to product backlog`)
        if (data.skipped.length > 0) {
          addScanLog(`ℹ️ Skipped ${data.skipped.length} duplicate issues`)
        }
      } else {
        addScanLog(`❌ Failed to add issues to backlog: ${data.error}`)
      }
    } catch (error) {
      console.error('Error adding issues to backlog:', error)
      addScanLog('❌ Error adding issues to backlog')
    }
  }

  const startScan = async (documentId: string) => {
    const document = uploadedDocuments.find(doc => doc.id === documentId)
    if (!document) {
      addScanLog('❌ Document not found')
      return
    }

    if (!document.fileContent) {
      addScanLog('❌ Document content is missing - please re-upload the document')
      return
    }

    // Update status to scanning
    setUploadedDocuments(prev => 
      prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, status: 'scanning' }
          : doc
      )
    )

    addScanLog('🔍 Starting document accessibility scan...')
    addScanLog('🤖 AI will analyze issues and provide suggestions')

    // Reset progress
    setScanProgress(0)
    
    // Get document preview if available - try multiple sources
    const docPreview = document.preview || documentPreview || null
    if (docPreview) {
      console.log('📸 Setting document preview for scan:', docPreview.substring(0, 50) + '...')
      setDocumentPreview(docPreview)
    } else {
      console.log('⚠️ No document preview available for:', document.name)
      // Try to generate preview if it's a PDF and we have the file
      if (document.type === 'application/pdf' && document.fileContent) {
        console.log('🔄 Attempting to generate preview from file content...')
        // We can't generate from base64 fileContent easily, so we'll need the original file
        // For now, just log that preview is missing
      }
    }

    // Generate scan ID for cancellation support
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setCurrentScanId(scanId)
    setIsScanning(true)
    
    // Add to global scan state
    addScan({
      scanId,
      type: 'document',
      status: 'scanning',
      currentPage: 0,
      totalPages: 1,
      startTime: Date.now(),
      fileName: document.name
    })
    
    addScanLog('🔄 Initializing scan engine...')

    try {
      // Call the API for 508 compliance scan
      const token = localStorage.getItem('accessToken')
      if (!token) {
        addScanLog('❌ Authentication required. Please log in again.')
        setIsScanning(false)
        setCurrentScanId(null)
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { ...doc, status: 'error', error: 'Authentication required' }
              : doc
          )
        )
        return
      }

      // Simulate progress during scan
      const progressInterval = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 95) return prev // Don't go to 100 until scan completes
          return prev + Math.random() * 3 // Increment by 0-3% for smoother progress
        })
      }, 300)

      const response = await fetch('/api/document-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: document.name,
          fileType: document.type,
          fileContent: document.fileContent,
          wcagLevel: 'AA',
          selectedTags: [] // All tests
        })
      })
      
      clearInterval(progressInterval)

      if (!response.ok) {
        throw new Error('Scan failed')
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Scan failed')
      }

      const scanResult = result.result
      
      // Animate progress to 100% smoothly
      const completeProgress = setInterval(() => {
        setScanProgress(prev => {
          if (prev >= 100) {
            clearInterval(completeProgress)
            return 100
          }
          return Math.min(100, prev + 2) // Smoothly complete to 100%
        })
      }, 50)
      
      // Show scan results
      if (scanResult.issues && scanResult.issues.length > 0) {
        addScanLog(`✅ Scan Complete!`)
        addScanLog(`📋 Found ${scanResult.issues.length} accessibility issue${scanResult.issues.length !== 1 ? 's' : ''}`)
        addScanLog(`💡 AI suggestions generated for all issues`)
        addScanLog(`📦 Issues automatically added to product backlog`)
      } else {
        addScanLog('✅ Document has no accessibility issues!')
      }
      
      // Update document with scan results (no repair results)
      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { 
                ...doc, 
                status: 'completed',
                scanResults: scanResult,
                repairResults: undefined // No repair results - just scan
              }
            : doc
        )
      )
      
      // Update scan status to complete in global context
      if (scanId) {
        updateScan(scanId, {
          status: 'complete',
          currentPage: 1,
          totalPages: 1,
          message: `Scan complete: ${scanResult.issues?.length || 0} issues found`
        })
        // Remove scan after a short delay to show completion
        setTimeout(() => {
          removeScan(scanId)
        }, 2000)
      }
      
      // Refresh credits after scan
      await checkUserCredits()
      
      setIsScanning(false)
      setCurrentScanId(null)
      
      if (onScanComplete) {
        const updatedDoc = uploadedDocuments.find(doc => doc.id === documentId)
        if (updatedDoc) {
          onScanComplete(updatedDoc)
        }
      }
      
    } catch (error) {
      console.error('❌ Document scan error:', error)
      addScanLog(`❌ Error: ${error instanceof Error ? error.message : 'Failed to scan document'}`)
      
      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, status: 'error', error: error instanceof Error ? error.message : 'Scan failed' }
            : doc
        )
      )
      
      // Update scan status to error in global context
      if (scanId) {
        updateScan(scanId, {
          status: 'error',
          message: error instanceof Error ? error.message : 'Scan failed'
        })
        // Remove scan after a short delay
        setTimeout(() => {
          removeScan(scanId)
        }, 3000)
      }
      
      setIsScanning(false)
      setCurrentScanId(null)
      
      // Refresh credits on error too
      await checkUserCredits()
    }
  }

  const cancelScan = async () => {
    if (currentScanId) {
      addScanLog('🚫 User requested scan cancellation...')
      try {
        const token = localStorage.getItem('accessToken')
        if (!token) {
          addScanLog('❌ Authentication required for cancellation')
          return
        }

        await fetch(`/api/document-scan?scanId=${currentScanId}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
          }
        })
        setCurrentScanId(null)
        setIsScanning(false)
        addScanLog('✅ Scan cancellation request sent successfully')
      } catch (error) {
        addScanLog(`❌ Failed to cancel scan: ${error instanceof Error ? error.message : 'Unknown error'}`)
        console.error('Failed to cancel scan:', error)
      }
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'uploading':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
      case 'uploaded':
        return <FileText className="h-4 w-4 text-blue-600" />
      case 'scanning':
        return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      default:
        return <div className="w-4 h-4"></div>
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'uploading':
        return 'Uploading...'
      case 'uploaded':
        return 'Ready to Scan'
      case 'scanning':
        return 'Scanning...'
      case 'completed':
        return 'Completed'
      case 'error':
        return 'Error occurred'
    }
  }

  return (
    <div className="space-y-6">
      <ToastContainer />
      {/* Upload Section */}
      <div className="card">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Document Upload</h3>
          <p className="text-sm text-gray-600">
            Upload documents to scan for accessibility issues. AI will analyze each issue and provide detailed suggestions for fixing them. All issues are automatically added to your product backlog. Supported formats: PDF, Word, PowerPoint, HTML, and text files.
          </p>

        </div>


                 {/* AI Document Scanner Info */}
         <div className="mb-6">
           <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
             <div className="flex items-start space-x-3">
               <Sparkles className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
               <div className="flex-1">
                 <h4 className="text-md font-semibold text-gray-900 mb-2">AI-Powered Document Accessibility Scanner</h4>
                 <p className="text-sm text-gray-700 mb-3">
                   Upload your document and AI will scan for accessibility issues, analyze each one, and provide detailed step-by-step suggestions for fixing them. All issues are automatically added to your product backlog.
                 </p>
                 
                 {/* What We Do */}
                 <div className="mb-3 p-3 bg-white rounded border border-green-200">
                   <h5 className="text-xs font-semibold text-green-800 mb-2 flex items-center">
                     <CheckCircle className="h-3 w-3 mr-1" />
                     What We Do:
                   </h5>
                   <ul className="text-xs text-gray-700 space-y-1 ml-5 list-disc">
                     <li><strong>Scan:</strong> Comprehensive accessibility analysis (WCAG 2.1 AA, Section 508)</li>
                     <li><strong>Analyze:</strong> AI-powered suggestions for each issue</li>
                     <li><strong>Track:</strong> Issues automatically added to product backlog</li>
                     <li><strong>Guide:</strong> Step-by-step remediation instructions</li>
                   </ul>
                 </div>

               </div>
             </div>
           </div>
         </div>

        {/* Progress Bar - Keep visible even after scan completes */}
        {(isScanning || scanProgress > 0 || uploadedDocuments.some(doc => doc.status === 'scanning')) && (
          <div className="mb-6 bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                {scanProgress >= 100 ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">Scan Complete</span>
                  </>
                ) : (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                    <span className="text-sm font-medium text-gray-900">Scanning your document...</span>
                  </>
                )}
              </div>
              {uploadedDocuments.find(doc => doc.status === 'scanning' || doc.status === 'completed')?.name && (
                <div className="flex items-center space-x-1 text-xs text-gray-500">
                  <FileText className="h-3 w-3" />
                  <span className="truncate max-w-xs">
                    {uploadedDocuments.find(doc => doc.status === 'scanning' || doc.status === 'completed')?.name || 'Document'}
                  </span>
                </div>
              )}
            </div>
            
            {/* Progress bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
                style={{
                  width: `${Math.min(100, Math.max(0, scanProgress))}%`,
                }}
              >
                {/* Animated shimmer effect on progress bar */}
                <div 
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"
                />
              </div>
            </div>
            
            {/* Progress percentage */}
            <div className="mt-2 flex justify-end">
              <span className="text-xs text-gray-600 font-medium">{Math.round(scanProgress)}%</span>
            </div>
            
            {/* Action buttons */}
            {isScanning && (
              <div className="mt-3 flex justify-end">
                <button
                  onClick={cancelScan}
                  className="px-4 py-2 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors flex items-center space-x-2"
                >
                  <span>Cancel Scan</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* Uploaded Documents & Scan Logs */}
        {uploadedDocuments.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-800">
                {uploadedDocuments.length === 1 ? 'Document' : 'Documents'}
              </h4>
              <div className="flex space-x-2">
                {scanLogs.length > 0 && (
                  <>
                    <button
                      onClick={() => setShowLogs(!showLogs)}
                      className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
                    >
                      {showLogs ? 'Hide' : 'Show'} Logs
                    </button>
                    <button
                      onClick={clearScanLogs}
                      className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                    >
                      Clear
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Document List */}
            <div className="space-y-3 mb-3">
              {uploadedDocuments.map((document) => (
                <div key={document.id} className="border border-gray-200 rounded-lg p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <FileText className="h-5 w-5 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">{document.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(document.size)} • {document.type}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 flex-shrink-0">
                      <div className="flex items-center space-x-1">
                        {getStatusIcon(document.status)}
                        <span className="text-xs text-gray-600">{getStatusText(document.status)}</span>
                      </div>
                      
                      {/* Show scan button for uploaded documents */}
                      {document.status === 'uploaded' && (
                        <button
                          onClick={() => startScan(document.id)}
                          disabled={!document.fileContent}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                          title={
                            !document.fileContent ? 'Document content missing - please re-upload' : 
                            'Start accessibility scan with AI suggestions'
                          }
                        >
                          Scan Document
                        </button>
                      )}
                      
                      {/* Show Fix PDF button for scanned PDFs */}
                      {document.status === 'completed' && 
                       document.type.toLowerCase().includes('pdf') && 
                       document.scanResults && 
                       document.scanResults.issues && 
                       document.scanResults.issues.length > 0 && (
                        <button
                          onClick={() => fixPDF(document.id)}
                          disabled={!document.fileContent || isScanning}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium flex items-center gap-1"
                          title="Fix PDF using Adobe PDF Services (auto-tags PDF, then rescans to verify)"
                        >
                          {isScanning ? (
                            <>
                              <RefreshCw className="h-3 w-3 animate-spin" />
                              Fixing...
                            </>
                          ) : (
                            <>
                              <Wrench className="h-3 w-3" />
                              Fix PDF
                            </>
                          )}
                        </button>
                      )}
                      
                      <button
                        onClick={() => removeDocument(document.id)}
                        className="text-gray-400 hover:text-red-600 transition-colors p-1"
                        title="Remove document"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Scan Logs */}
            {scanLogs.length > 0 && showLogs && (
              <div className="max-h-48 overflow-y-auto bg-gray-900 text-white p-3 rounded-lg font-mono text-xs">
                {scanLogs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PDF Tagging Notice */}
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start">
            <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 mb-1">
                For PDFs: Tag your document in Acrobat first
              </p>
              <p className="text-xs text-blue-700">
                In Adobe Acrobat Pro, go to <strong>Prepare for Accessibility</strong> &gt; <strong>Automatically tag for PDF</strong>. 
                Then use <strong>View</strong> &gt; <strong>Show/Hide</strong> &gt; <strong>Side Panels</strong> &gt; <strong>Accessibility Tags</strong> to review and fix tags.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Area */}
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            canScan 
              ? 'border-gray-300 hover:border-gray-400 cursor-pointer' 
              : 'border-red-300 bg-red-50 cursor-not-allowed'
          }`}
          onClick={() => canScan && fileInputRef.current?.click()}
        >
          <div className="space-y-4">
            <Upload className="mx-auto h-12 w-12 text-gray-400" />
            <div>
              <p className="text-lg font-medium text-gray-900">
                {isUploading ? 'Uploading...' : 
                 !canScan ? 'Insufficient credits to scan documents' :
                 'Drop files here or click to upload'}
              </p>
              <p className="text-sm text-gray-500">
                {!canScan ? 'Purchase credits or upgrade to unlimited plan' :
                 'PDF, Word, PowerPoint, HTML, or text files up to 50MB • Costs 1 token per scan'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.html,.htm,.txt"
              onChange={(e) => handleFileUpload(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* Supported Formats */}
        <div className="mt-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Supported Formats:</p>
          <div className="flex flex-wrap gap-2">
            {['PDF', 'Word (.doc, .docx)', 'PowerPoint (.ppt, .pptx)', 'HTML', 'Text'].map(format => (
              <span key={format} className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-full">
                {format}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Document Results - shown after scan completes */}
      {uploadedDocuments.length > 0 && uploadedDocuments.some(doc => doc.status === 'completed' && doc.scanResults) && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Scan Results</h3>
          <div className="space-y-4">
            {uploadedDocuments
              .filter(doc => doc.status === 'completed' && doc.scanResults)
              .map((document) => (
              <div key={document.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <FileText className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900">{document.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(document.size)} • {document.type}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(document.status)}
                      <span className="text-sm text-gray-600">{getStatusText(document.status)}</span>
                    </div>
                    
                    <button
                      onClick={() => removeDocument(document.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Scan Results */}
                {document.status === 'completed' && document.scanResults && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    {/* Show scan results */}
                    {document.scanResults && (
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {document.scanResults.is508Compliant ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-red-600" />
                          )}
                          <span className="font-medium text-gray-900">
                            {document.scanResults.is508Compliant ? '508 Compliant' : '508 Non-Compliant'}
                          </span>
                          {document.scanResults.overallScore && (
                            <span className={`px-2 py-1 ${getScoreColor(document.scanResults.overallScore)} text-xs rounded-full font-medium`}>
                              Score: {document.scanResults.overallScore}/100
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          {document.scanResults.summary.total} issues found
                          {document.scanResults.metadata?.wordCount && ` • ${document.scanResults.metadata.wordCount} words`}
                          {document.scanResults.metadata?.imageCount && ` • ${document.scanResults.metadata.imageCount} images`}
                        </div>
                      </div>
                    )}

                    {/* AI Suggestions - Show issues with AI recommendations */}
                    {document.scanResults.issues && document.scanResults.issues.length > 0 && (
                      <div className="space-y-4 mt-4">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-medium text-gray-900">AI Suggestions</h3>
                          <div className="text-sm text-gray-500">
                            {document.scanResults.issues.length} issue{document.scanResults.issues.length !== 1 ? 's' : ''} found
                          </div>
                        </div>
                        
                        {/* Issues with AI Suggestions */}
                        <div className="space-y-3">
                          {document.scanResults.issues.map((issue: any, index: number) => (
                            <div key={issue.id || index} className="p-4 bg-white border border-gray-300 rounded-lg shadow-sm">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-2 mb-2">
                                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                                      issue.type === 'critical' ? 'bg-red-100 text-red-800' :
                                      issue.type === 'serious' ? 'bg-orange-100 text-orange-800' :
                                      issue.type === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}>
                                      {issue.type || 'moderate'}
                                    </span>
                                    {issue.wcagCriterion && (
                                      <span className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                                        {issue.wcagCriterion}
                                      </span>
                                    )}
                                    {/* Show duplicate indicator if this is a grouped issue */}
                                    {issue.occurrences && issue.occurrences > 1 && (
                                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded border border-purple-200 flex items-center gap-1" title={`This issue appears ${issue.occurrences} times in the document`}>
                                        <span>🔄</span>
                                        <span>Duplicate ({issue.occurrences}x)</span>
                                      </span>
                                    )}
                                    {issue.elementType === 'multiple' && (
                                      <span className="px-2 py-1 text-xs bg-purple-100 text-purple-800 rounded border border-purple-200 flex items-center gap-1" title="This is a grouped duplicate issue">
                                        <span>🔄</span>
                                        <span>Grouped Duplicate</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm font-semibold text-black mb-1">
                                    {index + 1}. {issue.description}
                                    {issue.occurrences && issue.occurrences > 1 && (
                                      <span className="ml-2 text-xs font-normal text-purple-600">
                                        (appears {issue.occurrences} times)
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-600 mb-2">
                                    <span className="font-medium">Location:</span> {issue.elementLocation || issue.section || 'Document'}
                                    {issue.pageNumber && ` • Page ${issue.pageNumber}`}
                                  </div>
                                </div>
                              </div>
                              
                              {/* AI Suggestion */}
                              {issue.recommendation && (
                                <div className="bg-blue-50 p-4 rounded border border-blue-200 mt-3">
                                  <div className="text-xs font-semibold text-blue-900 mb-2 uppercase tracking-wide flex items-center">
                                    <Sparkles className="h-3 w-3 mr-1" />
                                    AI Suggestion
                                  </div>
                                  <div className="text-sm text-gray-900 leading-relaxed">
                                    {formatSuggestionDescription(issue.recommendation)}
                                  </div>
                                </div>
                              )}
                              
                              {/* Additional context if available */}
                              {issue.context && (
                                <div className="mt-2 text-xs text-gray-500 italic">
                                  {issue.context}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        {/* Backlog Notice */}
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg mt-4">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <p className="text-xs text-green-800">
                              All issues have been automatically added to your product backlog. View them in the Issues Board.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* No Issues */}
                    {document.scanResults.issues && document.scanResults.issues.length === 0 && (
                      <div className="p-4 bg-green-50 border border-green-200 rounded-lg mt-4">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div>
                            <h4 className="text-sm font-semibold text-green-900 mb-1">
                              ✅ No Accessibility Issues Found
                            </h4>
                            <p className="text-xs text-green-700">
                              This document appears to be accessible and compliant with WCAG 2.1 AA standards.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Display */}
                {document.status === 'error' && document.error && (
                  <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <AlertTriangle className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-800">{document.error}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}