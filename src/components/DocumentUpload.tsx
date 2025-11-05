'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle, X, Download, Eye, Sparkles, CreditCard, Plus, ChevronUp, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import ScanHistory from './ScanHistory'
import CollapsibleIssue from './CollapsibleIssue'
import { useScan } from '@/contexts/ScanContext'
import { authenticatedFetch } from '@/lib/auth-utils'
import { useToast } from './Toast'

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
        <h4 key={index} className="text-base font-semibold text-gray-900 mt-4 mb-2">
          {headingText}
        </h4>
      )
      return
    }
    
    // Handle markdown-style headings (# Heading)
    if (trimmedLine.startsWith('# ')) {
      const headingText = trimmedLine.substring(2).trim()
      elements.push(
        <h3 key={index} className="text-lg font-bold text-gray-900 mt-4 mb-3">
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
          <span className="font-semibold text-gray-900">{stepNumber}.</span>{' '}
          <span className="text-gray-800">{content.trim()}</span>
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
          <span className="text-gray-700">•</span>{' '}
          <span className="text-gray-800">{content}</span>
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
      <p key={index} className="mb-2 text-gray-800" dangerouslySetInnerHTML={{ __html: formattedText }} />
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
  const fileInputRef = useRef<HTMLInputElement>(null)
  
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
    }
  }, [activeScans, removeScan])
  
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
        addScanLog('📋 Document ready for AI-powered repair')
        
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

  const removeDocument = (documentId: string) => {
    // Clear any scan state if this was the current document being scanned
    if (currentScanId && uploadedDocuments.find(doc => doc.id === documentId)?.status === 'scanning') {
      setCurrentScanId(null)
      setIsScanning(false)
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

  const startRepair = async (documentId: string) => {
    const document = uploadedDocuments.find(doc => doc.id === documentId)
    if (!document) {
      addScanLog('❌ Document not found')
      return
    }

    if (!document.fileContent) {
      addScanLog('❌ Document content is missing - please re-upload the document')
      return
    }

    // Update status to repairing
    setUploadedDocuments(prev => 
      prev.map(doc => 
        doc.id === documentId 
          ? { ...doc, status: 'scanning' } // Reuse scanning status for repair
          : doc
      )
    )

    addScanLog('🔧 Starting AI-powered document repair...')
    addScanLog('🤖 AI will analyze and fix accessibility issues automatically')

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
        return
      }

      const response = await fetch('/api/document-repair', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: document.name,
          fileType: document.type,
          fileContent: document.fileContent
        })
      })

      if (!response.ok) {
        throw new Error('Scan failed')
      }

      const result = await response.json()
      
      if (!result.success) {
        throw new Error(result.error || 'Repair failed')
      }

      // Show repair plan
      if (result.repairPlan && result.repairPlan.length > 0) {
        const automaticFixes = result.repairPlan.filter((p: any) => p.fixType === 'automatic')
        const suggestions = result.repairPlan.filter((p: any) => p.fixType === 'suggestion')
        
        addScanLog(`✅ AI Analysis Complete!`)
        addScanLog(`🔨 ${automaticFixes.length} issue${automaticFixes.length !== 1 ? 's' : ''} will be automatically fixed`)
        addScanLog(`💡 ${suggestions.length} suggestion${suggestions.length !== 1 ? 's' : ''} provided for manual fixes`)
        
        // Show what AI will fix
        if (automaticFixes.length > 0) {
          addScanLog('')
          addScanLog('🔨 Automatic Fixes:')
          automaticFixes.forEach((fix: any, index: number) => {
            addScanLog(`${index + 1}. ${fix.issue}`)
            addScanLog(`   → ${fix.aiFix}`)
          })
        }
      } else {
        addScanLog('✅ Document has no accessibility issues!')
      }
      
      // Store repair results
      const repairResults = {
        repairPlan: result.repairPlan || [],
        repairedDocument: result.repairedDocument,
        fixesApplied: result.fixesApplied || 0,
        suggestionsProvided: result.suggestionsProvided || 0,
        originalIssues: result.originalIssues || 0
      }
      
      addScanLog(`✅ Repair completed in ${result.repairDuration || 'N/A'}`)
      
      // Update document with repair results
      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { 
                ...doc, 
                status: 'completed',
                repairResults: repairResults
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
          message: `Repair complete: ${repairResults.fixesApplied} fixes applied`
        })
        // Remove scan after a short delay to show completion
        setTimeout(() => {
          removeScan(scanId)
        }, 2000)
      }
      
      // Refresh credits after repair
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
      console.error('❌ Document repair error:', error)
      addScanLog(`❌ Error: ${error instanceof Error ? error.message : 'Failed to repair document'}`)
      
      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, status: 'error', error: error instanceof Error ? error.message : 'Repair failed' }
            : doc
        )
      )
      
      // Update scan status to error in global context
      if (scanId) {
        updateScan(scanId, {
          status: 'error',
          message: error instanceof Error ? error.message : 'Repair failed'
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
            Upload documents to automatically repair accessibility issues using AI. The system will fix issues automatically and provide suggestions for manual fixes. Supported formats: PDF, Word, PowerPoint, HTML, and text files.
          </p>

        </div>


                 {/* AI Document Repair Info */}
         <div className="mb-6">
           <div className="p-4 bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg">
             <div className="flex items-start space-x-3">
               <Sparkles className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
               <div className="flex-1">
                 <h4 className="text-md font-semibold text-gray-900 mb-2">AI-Powered Document Repair</h4>
                 <p className="text-sm text-gray-700 mb-3">
                   Upload your document and AI will scan for accessibility issues, automatically fix what it can, and provide detailed suggestions for manual fixes.
                 </p>
                 
                 {/* What We Automatically Fix */}
                 <div className="mb-3 p-3 bg-white rounded border border-green-200">
                   <h5 className="text-xs font-semibold text-green-800 mb-2 flex items-center">
                     <CheckCircle className="h-3 w-3 mr-1" />
                     Automatically Fixed (No manual work needed):
                   </h5>
                   <ul className="text-xs text-gray-700 space-y-1 ml-5 list-disc">
                     <li><strong>PDF:</strong> Document title, language metadata</li>
                     <li><strong>HTML:</strong> Document title, language tag, alt text for images</li>
                     <li><strong>Word (.docx only):</strong> Basic metadata fixes</li>
                   </ul>
                 </div>

                 {/* What We Detect & Suggest */}
                 <div className="mb-3 p-3 bg-white rounded border border-blue-200">
                   <h5 className="text-xs font-semibold text-blue-800 mb-2 flex items-center">
                     <Eye className="h-3 w-3 mr-1" />
                     What We Detect & Provide Suggestions For:
                   </h5>
                   <ul className="text-xs text-gray-700 space-y-1 ml-5 list-disc">
                     <li><strong>Real Detection:</strong> Document structure (headings, lists, tables from parsed document structure)</li>
                     <li><strong>Real Detection:</strong> Missing alt text on images (from actual image tags in document)</li>
                     <li><strong>Real Detection:</strong> Missing document title and language metadata</li>
                     <li><strong>Real Detection:</strong> Non-descriptive links (from actual link elements in document)</li>
                     <li><strong>Real Detection:</strong> GIF/animated images (detects GIF file signatures)</li>
                     <li><strong>Real Detection:</strong> Form fields without labels (from actual form elements in PDF/HTML)</li>
                     <li><strong>Real Detection:</strong> Color contrast (when document provides color data - PDFs with extracted colors)</li>
                     <li><strong>Text Pattern Matching:</strong> Media, scripts, plug-ins, timing, keyboard traps - searches document text for keywords</li>
                     <li><strong>16 Section 508 compliance tests run automatically</strong> - mix of real document structure analysis and text pattern matching</li>
                   </ul>
                 </div>
               </div>
             </div>
           </div>
         </div>

        {/* Cancellation Button */}
        {isScanning && currentScanId && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                <span className="text-sm text-yellow-800">Repair in progress...</span>
              </div>
              <button
                onClick={cancelScan}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Cancel Repair
              </button>
            </div>
          </div>
        )}

        {/* Scan Logs */}
        {scanLogs.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-800">Repair Progress Log</h4>
              <div className="flex space-x-2">
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
              </div>
            </div>
            
            {showLogs && (
              <div className="max-h-48 overflow-y-auto bg-gray-900 text-white p-3 rounded-lg font-mono text-xs">
                {scanLogs.map((log, index) => (
                  <div key={index} className="mb-1">
                    {log}
                  </div>
                ))}
                {scanLogs.length === 0 && (
                  <div className="text-gray-500">No logs yet...</div>
                )}
              </div>
            )}
            
            {!showLogs && scanLogs.length > 0 && (
              <div className="text-xs text-gray-600">
                {scanLogs.length} log entries • Last: {scanLogs[scanLogs.length - 1]}
              </div>
            )}
          </div>
        )}

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
                 !canScan ? 'Insufficient credits to repair documents' :
                 'Drop files here or click to upload'}
              </p>
              <p className="text-sm text-gray-500">
                {!canScan ? 'Purchase credits or upgrade to unlimited plan' :
                 'PDF, Word, PowerPoint, HTML, or text files up to 50MB • Costs 1 token per repair'}
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

                    {/* Scan History */}
       <ScanHistory type="document" />

      {/* Uploaded Documents */}
      {uploadedDocuments.length > 0 && (
        <div className="card">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Current Session</h3>
          <div className="space-y-4">
            {uploadedDocuments.map((document) => (
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
                    
                                         {/* Show scan button for uploaded documents */}
                     {document.status === 'uploaded' && (
                       <button
                         onClick={() => startRepair(document.id)}
                        disabled={!document.fileContent}
                        className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                        title={
                          !document.fileContent ? 'Document content missing - please re-upload' : 
                          'Start AI-powered document repair'
                        }
                      >
                        Repair Document
                      </button>
                     )}
                    
                    <button
                      onClick={() => removeDocument(document.id)}
                      className="text-gray-400 hover:text-red-600 transition-colors"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Scan Results */}
                {(() => {
                  return document.status === 'completed' && (document.repairResults || document.scanResults)
                })() && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    {/* Show repair results first if available */}
                    {document.repairResults ? (
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <span className="font-medium text-gray-900">
                            Document Repair Complete
                          </span>
                        </div>
                        <div className="text-sm text-gray-500">
                          {document.repairResults.fixesApplied} auto-fixed • {document.repairResults.suggestionsProvided} suggestions
                        </div>
                      </div>
                    ) : document.scanResults && (
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
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
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

                    {/* Repair Results */}
                    {document.repairResults && (
                      <div className="space-y-4">
                        {/* Repair Summary */}
                        <div className="grid grid-cols-3 gap-3 mb-4">
                          <div className="text-center p-3 bg-green-100 rounded-lg">
                            <div className="text-2xl font-bold text-green-800">
                              {document.repairResults.fixesApplied}
                            </div>
                            <div className="text-xs text-green-700 mt-1">Auto-Fixed</div>
                          </div>
                          <div className="text-center p-3 bg-blue-100 rounded-lg">
                            <div className="text-2xl font-bold text-blue-800">
                              {document.repairResults.suggestionsProvided}
                            </div>
                            <div className="text-xs text-blue-700 mt-1">Suggestions</div>
                          </div>
                          <div className="text-center p-3 bg-gray-100 rounded-lg">
                            <div className="text-2xl font-bold text-gray-800">
                              {document.repairResults.originalIssues}
                            </div>
                            <div className="text-xs text-gray-700 mt-1">Total Issues</div>
                          </div>
                        </div>

                        {/* Download Repaired Document */}
                        {document.repairResults.repairedDocument ? (
                          <div className="p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h4 className="text-sm font-semibold text-green-900 mb-1">
                                  ✅ Document Repaired Successfully
                                </h4>
                                <p className="text-xs text-green-700">
                                  {document.repairResults.fixesApplied} issue{document.repairResults.fixesApplied !== 1 ? 's' : ''} automatically fixed
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  try {
                                    // Convert base64 to blob for download
                                    const base64Data = document.repairResults.repairedDocument
                                    if (!base64Data) {
                                      console.error('No repaired document data available')
                                      showToast('Repaired document is not available. Please try repairing again.', 'error')
                                      return
                                    }
                                    const byteCharacters = atob(base64Data)
                                    const byteNumbers = new Array(byteCharacters.length)
                                    for (let i = 0; i < byteCharacters.length; i++) {
                                      byteNumbers[i] = byteCharacters.charCodeAt(i)
                                    }
                                    const byteArray = new Uint8Array(byteNumbers)
                                    const blob = new Blob([byteArray], { type: document.type || 'application/pdf' })
                                    const url = URL.createObjectURL(blob)
                                    // Use window.document to avoid conflict with the document variable (uploaded document)
                                    const link = window.document.createElement('a')
                                    link.href = url
                                    link.download = `repaired_${document.name}`
                                    window.document.body.appendChild(link)
                                    link.click()
                                    window.document.body.removeChild(link)
                                    URL.revokeObjectURL(url)
                                    showToast('Document downloaded successfully!', 'success')
                                  } catch (error) {
                                    console.error('Download error:', error)
                                    showToast(`Failed to download document: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error')
                                  }
                                }}
                                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
                              >
                                <Download className="h-4 w-4 mr-2" />
                                Download Repaired Document
                              </button>
                            </div>
                          </div>
                        ) : document.repairResults.fixesApplied === 0 && document.repairResults.suggestionsProvided > 0 ? (
                          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-4">
                            <div className="flex items-center">
                              <AlertTriangle className="h-5 w-5 text-blue-600 mr-2" />
                              <div>
                                <h4 className="text-sm font-semibold text-blue-900 mb-1">
                                  Suggestions Provided
                                </h4>
                                <p className="text-xs text-blue-700">
                                  No automatic fixes were applied. Review the suggestions below and make manual fixes to your document.
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* Repair Plan - What AI Will Fix */}
                        {document.repairResults.repairPlan && document.repairResults.repairPlan.length > 0 && (
                          <div className="space-y-3">
                            <h3 className="text-lg font-medium text-gray-900">AI Repair Plan</h3>
                            
                            {/* Automatic Fixes */}
                            {document.repairResults.repairPlan.filter((p: any) => p.fixType === 'automatic').length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-sm font-semibold text-green-800 flex items-center">
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Automatic Fixes ({document.repairResults.repairPlan.filter((p: any) => p.fixType === 'automatic').length})
                                </h4>
                                {document.repairResults.repairPlan
                                  .filter((p: any) => p.fixType === 'automatic')
                                  .map((fix: any, index: number) => (
                                    <div key={fix.issueId} className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                      <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                          <div className="text-sm font-medium text-gray-900 mb-1">
                                            {index + 1}. {fix.issue}
                                          </div>
                                          <div className="text-xs text-gray-700 mb-2">
                                            Location: {fix.location}
                                          </div>
                                          <div className="text-sm text-green-800 bg-white p-2 rounded border border-green-200">
                                            <span className="font-semibold">AI Will Fix:</span> {fix.aiFix}
                                          </div>
                                        </div>
                                        <span className={`ml-2 px-2 py-1 text-xs rounded ${
                                          fix.confidence === 'high' ? 'bg-green-200 text-green-800' :
                                          fix.confidence === 'medium' ? 'bg-yellow-200 text-yellow-800' :
                                          'bg-gray-200 text-gray-800'
                                        }`}>
                                          {fix.confidence} confidence
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            )}

                            {/* Suggestions */}
                            {document.repairResults.repairPlan.filter((p: any) => p.fixType === 'suggestion').length > 0 && (
                              <div className="space-y-3 mt-6">
                                <h4 className="text-base font-semibold text-gray-900 flex items-center">
                                  <Eye className="h-4 w-4 mr-2 text-gray-700" />
                                  Manual Fix Suggestions ({document.repairResults.repairPlan.filter((p: any) => p.fixType === 'suggestion').length})
                                </h4>
                                {document.repairResults.repairPlan
                                  .filter((p: any) => p.fixType === 'suggestion')
                                  .map((fix: any, index: number) => {
                                    // Parse and extract the suggestion text
                                    const suggestionText = parseAISuggestion(fix.aiFix || '')
                                    
                                    return (
                                      <div key={fix.issueId} className="p-4 bg-gray-50 border border-gray-300 rounded-lg shadow-sm">
                                        <div className="flex items-start justify-between">
                                          <div className="flex-1">
                                            <div className="text-sm font-semibold text-gray-900 mb-2">
                                              {index + 1}. {fix.issue}
                                            </div>
                                            <div className="text-xs text-gray-600 mb-3">
                                              <span className="font-medium">Location:</span> {fix.location}
                                            </div>
                                            <div className="bg-white p-4 rounded border border-gray-200">
                                              <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
                                                AI Suggestion
                                              </div>
                                              <div className="text-sm text-gray-800 leading-relaxed">
                                                {formatSuggestionDescription(suggestionText)}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )
                                  })}
                              </div>
                            )}
                          </div>
                        )}
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