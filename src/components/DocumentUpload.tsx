'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle, X, Download, Eye, Sparkles, CreditCard, Plus, ChevronUp, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import ScanHistory from './ScanHistory'
import CollapsibleIssue from './CollapsibleIssue'

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
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [isScanning, setIsScanning] = useState(false)
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [currentScanId, setCurrentScanId] = useState<string | null>(null)
  const [scanLogs, setScanLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)

  const [userCredits, setUserCredits] = useState<number>(10)
  const [canScan, setCanScan] = useState<boolean>(true)
  const [isCheckingCredits, setIsCheckingCredits] = useState<boolean>(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Load scan state from localStorage on component mount
  useEffect(() => {
    const savedScanId = localStorage.getItem('currentScanId')
    const savedScanLogs = localStorage.getItem('scanLogs')
    const savedIsScanning = localStorage.getItem('isScanning')
    
    if (savedScanId && savedIsScanning === 'true') {
      setCurrentScanId(savedScanId)
      setIsScanning(true)
      if (savedScanLogs) {
        setScanLogs(JSON.parse(savedScanLogs))
      }
      // Check if scan is still active on backend
      checkScanStatus(savedScanId)
    }
  }, [])
  
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
  
  // Check if scan is still active on backend
  const checkScanStatus = async (scanId: string) => {
    try {
      const response = await fetch(`/api/document-scan/status?scanId=${scanId}`)
      if (response.ok) {
        const result = await response.json()
        if (result.status === 'completed' || result.status === 'cancelled') {
          // Scan finished, clear state
          setCurrentScanId(null)
          setIsScanning(false)
          localStorage.removeItem('currentScanId')
          localStorage.removeItem('isScanning')
                     addScanLog('🔄 Scan completed while page was refreshed')
        }
      }
    } catch (error) {
      console.error('Failed to check scan status:', error)
    }
  }

  // Load credits on component mount
  useEffect(() => {
    checkUserCredits()
  }, [])

  // Check user credits
  const checkUserCredits = async () => {
    setIsCheckingCredits(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        console.error('No access token found')
        return
      }

      const response = await fetch('/api/credits', {
        headers: {
          'Authorization': `Bearer ${token}`,
        }
      })
      if (response.ok) {
        const data = await response.json()
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

  // Available Section 508 tags for selection
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
        addScanLog('📋 Document ready for scanning - select tests and click "Start Scan"')
        
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

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    )
  }

  const selectAllTags = () => {
    setSelectedTags(availableTags.map(tag => tag.tag))
  }

  const clearAllTags = () => {
    setSelectedTags([])
  }

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
        ruleName: issue.id || issue.description,
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

    if (selectedTags.length === 0) {
      addScanLog('❌ Please select at least one Section 508 test to run')
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

    addScanLog('🔍 Starting Section 508 compliance scan...')
    addScanLog(`📋 Selected tests: ${selectedTags.join(', ')}`)

    // Generate scan ID for cancellation support
    const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setCurrentScanId(scanId)
    setIsScanning(true)
    addScanLog('🔄 Initializing scan engine...')

    try {
      // Call the API for 508 compliance scan
      const token = localStorage.getItem('accessToken')
      if (!token) {
        addScanLog('❌ Authentication required. Please log in again.')
        return
      }

      const response = await fetch('/api/document-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileName: document.name,
          fileType: document.type,
          fileSize: document.size,
          fileContent: document.fileContent,
          selectedTags: selectedTags,
          scanId: scanId
        })
      })

      if (!response.ok) {
        throw new Error('Scan failed')
      }

      const result = await response.json()
      
      // Scan completed
      if (result.cancelled) {
        addScanLog('🚫 Scan was cancelled by user')
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { ...doc, status: 'uploaded' }
              : doc
          )
        )
        return
      }
      
      const scanResults = result.result
      console.log('🔍 Document scan results structure:', scanResults)
      console.log('🔍 Issues array:', scanResults.issues)
      console.log('🔍 Issues length:', scanResults.issues?.length)
      addScanLog(`✅ Scan completed! Found ${scanResults.issues.length} accessibility issues`)
      
      const completedDocument: UploadedDocument = {
        ...document,
        status: 'completed',
        scanResults
      }

      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? completedDocument
            : doc
        )
      )

      // Deduct credits for the scan
      try {
        const creditResponse = await fetch('/api/credits', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            scanType: 'document',
            scanId: scanId,
            fileName: document.name
          })
        })
        
        if (creditResponse.ok) {
          const creditData = await creditResponse.json()
          setUserCredits(creditData.credits)
          addScanLog(`💳 Scan completed! Credits remaining: ${creditData.credits}`)
        }
      } catch (error) {
        console.error('Failed to deduct credits:', error)
        addScanLog('⚠️ Scan completed but credit deduction failed')
      }

             // Reset scanning state
       setCurrentScanId(null)
       setIsScanning(false)
       
       // Show professional success notification
       const totalIssues = scanResults.summary.total
       const criticalIssues = scanResults.summary.critical
       const seriousIssues = scanResults.summary.serious
       const pagesAnalyzed = scanResults.metadata?.pagesAnalyzed || 1
       
       addScanLog(`🎉 Document scan completed successfully!`)
       addScanLog(`📊 Pages analyzed: ${pagesAnalyzed}`)
       addScanLog(`📋 Total issues: ${totalIssues}`)
       addScanLog(`🔴 Critical issues: ${criticalIssues}`)
       addScanLog(`🟠 Serious issues: ${seriousIssues}`)
       addScanLog(`✅ Issues automatically added to product backlog`)

       // Refresh credits
       checkUserCredits()

      if (onScanComplete) {
        onScanComplete(completedDocument)
      }

    } catch (error) {
      addScanLog(`❌ Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`)
      setUploadedDocuments(prev => 
        prev.map(doc => 
          doc.id === documentId 
            ? { ...doc, status: 'error', error: 'Scan failed' }
            : doc
        )
      )
      // Reset scanning state on error
      setCurrentScanId(null)
      setIsScanning(false)
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
      {/* Upload Section */}
      <div className="card">
        <div className="mb-4">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Document Upload</h3>
          <p className="text-sm text-gray-600">
            Upload documents to check for Section 508 compliance. Supported formats: PDF, Word, PowerPoint, HTML, and text files.
          </p>

        </div>


                 {/* ADA & Section 508 Tag Selector */}
         <div className="mb-6">
           <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
             <div className="flex items-center space-x-2">
               <CheckCircle className="h-5 w-5 text-green-600" />
               <div>
                 <p className="text-sm font-medium text-green-800">ADA Compliant Document Scans</p>
                 <p className="text-xs text-green-600">Meets Americans with Disabilities Act requirements through Section 508 + WCAG 2.1 AA compliance</p>
               </div>
             </div>
           </div>
           <div className="flex items-center justify-between mb-3">
             <h4 className="text-md font-medium text-gray-800">Section 508 Compliance Tests</h4>
             <div className="flex space-x-2">
               <button
                 onClick={selectAllTags}
                 disabled={uploadedDocuments.length === 0}
                 className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
               >
                 Select All
               </button>
               <button
                 onClick={clearAllTags}
                 disabled={uploadedDocuments.length === 0}
                 className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
               >
                 Clear All
               </button>
             </div>
           </div>
          
                     {uploadedDocuments.length === 0 ? (
             <div className="text-center py-8 p-4 bg-gray-50 rounded-lg">
               <FileText className="mx-auto h-12 w-12 text-gray-300 mb-2" />
               <p className="text-gray-500 mb-2">No documents uploaded</p>
               <p className="text-sm text-gray-400">Upload a document first to select compliance tests</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg">
               {availableTags.map((tag) => (
                 <label key={tag.tag} className="flex items-start space-x-2 cursor-pointer">
                   <input
                     type="checkbox"
                     checked={selectedTags.includes(tag.tag)}
                     onChange={() => toggleTag(tag.tag)}
                     className="mt-1 h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                   />
                   <div className="flex-1">
                     <div className="text-sm font-medium text-gray-900">{tag.name}</div>
                     <div className="text-xs text-gray-600">{tag.description}</div>
                   </div>
                 </label>
               ))}
             </div>
           )}
          
          {selectedTags.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-gray-600">
                Selected tests: {selectedTags.length} of {availableTags.length} 
                {selectedTags.length === availableTags.length && ' (All tests)'}
              </p>
            </div>
          )}
        </div>

        {/* Cancellation Button */}
        {isScanning && currentScanId && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-yellow-600"></div>
                <span className="text-sm text-yellow-800">Scan in progress...</span>
              </div>
              <button
                onClick={cancelScan}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Cancel Scan
              </button>
            </div>
          </div>
        )}

        {/* Scan Logs */}
        {scanLogs.length > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-800">Scan Progress Log</h4>
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
                 !canScan ? 'Insufficient credits to scan' :
                 'Drop files here or click to upload'}
              </p>
              <p className="text-sm text-gray-500">
                {!canScan ? 'Purchase credits or upgrade to unlimited plan' :
                 'PDF, Word, PowerPoint, HTML, or text files up to 50MB'}
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
                         onClick={() => startScan(document.id)}
                         disabled={selectedTags.length === 0 || !document.fileContent}
                         className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                         title={
                           !document.fileContent ? 'No document content available' :
                           selectedTags.length === 0 ? 'Select at least one test to start scanning' : 
                           'Start Section 508 compliance scan'
                         }
                       >
                         Start Scan
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
                {document.status === 'completed' && document.scanResults && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
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

                    {/* Issue Summary */}
                    {document.scanResults.summary.total > 0 && (
                      <div className="grid grid-cols-4 gap-2 mb-4">
                        <div className="text-center p-2 bg-red-100 rounded">
                          <div className="text-lg font-semibold text-red-800">
                            {document.scanResults.summary.critical}
                          </div>
                          <div className="text-xs text-red-600">Critical</div>
                        </div>
                        <div className="text-center p-2 bg-orange-100 rounded">
                          <div className="text-lg font-semibold text-orange-800">
                            {document.scanResults.summary.serious}
                          </div>
                          <div className="text-xs text-orange-600">Serious</div>
                        </div>
                        <div className="text-center p-2 bg-yellow-100 rounded">
                          <div className="text-lg font-semibold text-yellow-800">
                            {document.scanResults.summary.moderate}
                          </div>
                          <div className="text-xs text-yellow-600">Moderate</div>
                        </div>
                        <div className="text-center p-2 bg-blue-100 rounded">
                          <div className="text-lg font-semibold text-blue-800">
                            {document.scanResults.summary.minor}
                          </div>
                          <div className="text-xs text-blue-600">Minor</div>
                        </div>
                      </div>
                    )}

                    {/* Enhanced Issues List - Similar to Web Scan */}
                    {(() => {
                      console.log('🔍 Rendering issues - scanResults:', document.scanResults)
                      console.log('🔍 Rendering issues - issues array:', document.scanResults.issues)
                      console.log('🔍 Rendering issues - issues length:', document.scanResults.issues?.length)
                      return document.scanResults.issues && document.scanResults.issues.length > 0
                    })() ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-medium text-gray-900">Accessibility Issues</h3>
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => {
                                // Auto-add issues to backlog
                                addIssuesToBacklog(document.scanResults.issues)
                              }}
                              className="inline-flex items-center px-3 py-1 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Add to Backlog
                            </button>
                            <Link
                              href="/scan-history"
                              className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                            >
                              <FileText className="h-4 w-4 mr-1" />
                              View All Scans
                            </Link>
                          </div>
                        </div>
                        
                        {/* Display issues using CollapsibleIssue component like web scan */}
                        {document.scanResults.issues.map((issue, issueIndex) => {
                          // Transform document issue to match CollapsibleIssue format
                          const collapsibleIssue = {
                            issueId: issue.id,
                            ruleName: issue.id || issue.description,
                            description: issue.description,
                            impact: issue.type,
                            wcag22Level: issue.wcagCriterion || 'AA',
                            help: issue.recommendation || issue.description,
                            helpUrl: '', // Document issues don't have help URLs
                            totalOccurrences: 1,
                            affectedUrls: [`Document: ${document.name}`],
                            offendingElements: [{
                              html: issue.context || '',
                              target: issue.elementLocation || '',
                              failureSummary: issue.recommendation || '',
                              impact: issue.type,
                              url: `Document: ${document.name}`
                            }],
                            suggestions: [{
                              type: 'fix' as const,
                              description: issue.recommendation || issue.description,
                              priority: (issue.type === 'critical' || issue.type === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                            }],
                            priority: (issue.type === 'critical' || issue.type === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                          };

                          return (
                            <CollapsibleIssue
                              key={`${document.id}-${issueIndex}`}
                              {...collapsibleIssue}
                              screenshots={null} // Document scans don't have screenshots
                              scanId={document.scanResults.metadata?.scanId}
                              onStatusChange={(issueId, status) => {
                                console.log('Document issue status changed:', issueId, status)
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Issues Found</h3>
                        <p className="text-gray-600">Great! No accessibility issues were detected in this scan.</p>
                      </div>
                    )}

                    {/* Scan Metadata */}
                    {document.scanResults.metadata && (
                      <div className="mt-3 p-2 bg-gray-100 rounded text-xs text-gray-600">
                        <div className="flex items-center justify-between">
                          <span>Scan Engine: {document.scanResults.metadata.scanEngine || 'Unknown'}</span>
                          <span>Standard: {document.scanResults.metadata.standard || 'Section 508'}</span>
                        </div>
                        {document.scanResults.metadata.scanDuration && (
                          <div className="mt-1">
                            Scan Duration: {Math.round(document.scanResults.metadata.scanDuration / 1000)}s
                          </div>
                        )}
                        {document.scanResults.metadata.pagesAnalyzed && (
                          <div className="mt-1">
                            Pages Analyzed: {document.scanResults.metadata.pagesAnalyzed}
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

      {/* Issue Detail Modal */}
      {showIssueModal && selectedIssue && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Issue Details</h3>
                <button
                  onClick={() => setShowIssueModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                {/* Issue Header */}
                <div className="flex items-center space-x-3">
                  <div className={`w-3 h-3 rounded-full ${
                    selectedIssue.type === 'critical' ? 'bg-red-500' :
                    selectedIssue.type === 'serious' ? 'bg-orange-500' :
                    selectedIssue.type === 'moderate' ? 'bg-yellow-500' :
                    'bg-blue-500'
                  }`} />
                  <div>
                    <h4 className="font-medium text-gray-900 capitalize">{selectedIssue.type} Issue</h4>
                    <p className="text-sm text-gray-500">
                      {selectedIssue.section}
                      {selectedIssue.pageNumber && ` • Page ${selectedIssue.pageNumber}`}
                      {selectedIssue.lineNumber && ` • Line ${selectedIssue.lineNumber}`}
                    </p>
                  </div>
                </div>

                {/* Issue Description */}
                <div>
                  <h5 className="font-medium text-gray-900 mb-2">Issue Description</h5>
                  <p className="text-gray-700">{selectedIssue.description}</p>
                  {selectedIssue.elementLocation && (
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Location:</strong> {selectedIssue.elementLocation}
                    </p>
                  )}
                  {selectedIssue.context && (
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Context:</strong> {selectedIssue.context}
                    </p>
                  )}
                  {selectedIssue.occurrences && selectedIssue.occurrences > 1 && (
                    <p className="text-sm text-gray-600 mt-1">
                      <strong>Occurrences:</strong> This issue appears {selectedIssue.occurrences} times across {selectedIssue.affectedPages || 1} pages
                    </p>
                  )}
                </div>

                {/* Compliance Standards */}
                {(selectedIssue.wcagCriterion || selectedIssue.section508Requirement) && (
                  <div>
                    <h5 className="font-medium text-gray-900 mb-2">Compliance Standards</h5>
                    <div className="space-y-2">
                      {selectedIssue.wcagCriterion && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-blue-600">WCAG:</span>
                          <span className="text-sm text-gray-700">{selectedIssue.wcagCriterion}</span>
                        </div>
                      )}
                      {selectedIssue.section508Requirement && (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-medium text-green-600">Section 508:</span>
                          <span className="text-sm text-gray-700">{selectedIssue.section508Requirement}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                                 {/* AI Recommendation */}
                 {selectedIssue.recommendation ? (
                   <div>
                     <h5 className="font-medium text-gray-900 mb-2">Recommendation</h5>
                     <div className="bg-gray-50 rounded-lg p-4">
                       <div className="prose prose-sm max-w-none">
                         {selectedIssue.recommendation.split('\n').map((line: string, index: number) => (
                           <p key={index} className="text-gray-700 mb-2 last:mb-0">
                             {line}
                           </p>
                         ))}
                       </div>
                     </div>
                   </div>
                 ) : (
                   <div>
                     <h5 className="font-medium text-gray-700 mb-2">Recommendation</h5>
                     <div className="bg-gray-50 rounded-lg p-4">
                       <p className="text-gray-500 italic">No AI recommendation available for this issue.</p>
                     </div>
                   </div>
                 )}

                {/* Action Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowIssueModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                  <button className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                    Mark as Fixed
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}