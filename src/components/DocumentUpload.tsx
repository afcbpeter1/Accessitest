'use client'

import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, AlertTriangle, CheckCircle, X, Download, Eye, Sparkles, CreditCard } from 'lucide-react'
import Link from 'next/link'

interface UploadedDocument {
  id: string
  name: string
  size: number
  type: string
  uploadDate: Date
  status: 'uploading' | 'scanning' | 'completed' | 'error'
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
  const [selectedIssue, setSelectedIssue] = useState<any>(null)
  const [showIssueModal, setShowIssueModal] = useState(false)
  const [showAllIssues, setShowAllIssues] = useState(false)
  const [showTagSelector, setShowTagSelector] = useState(false)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [currentScanId, setCurrentScanId] = useState<string | null>(null)
  const [scanLogs, setScanLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [scanHistory, setScanHistory] = useState<any[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
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
          // Refresh history to show completed scan
          loadScanHistory()
        }
      }
    } catch (error) {
      console.error('Failed to check scan status:', error)
    }
  }

  // Load scan history from database
  const loadScanHistory = async () => {
    setIsLoadingHistory(true)
    try {
      const response = await fetch('/api/document-scan')
      if (response.ok) {
        const history = await response.json()
        setScanHistory(history.scans || [])
        // Also save to localStorage as backup
        localStorage.setItem('scanHistory', JSON.stringify(history.scans || []))
      }
    } catch (error) {
      console.error('Failed to load scan history:', error)
      // Fallback to localStorage if API fails
      const savedHistory = localStorage.getItem('scanHistory')
      if (savedHistory) {
        setScanHistory(JSON.parse(savedHistory))
      }
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Load history and check credits on component mount
  useEffect(() => {
    loadScanHistory()
    checkUserCredits()
  }, [])

  // Check user credits
  const checkUserCredits = async () => {
    setIsCheckingCredits(true)
    try {
      const response = await fetch('/api/credits?userId=demo-user')
      if (response.ok) {
        const data = await response.json()
        setUserCredits(data.credits)
        setCanScan(data.canScan)
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
        // Simulate file upload
        addScanLog('⏳ Uploading file to server...')
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        // Update status to scanning
        setUploadedDocuments(prev => 
          prev.map(doc => 
            doc.id === documentId 
              ? { ...doc, status: 'scanning' }
              : doc
          )
        )
        addScanLog('✅ File uploaded successfully')
        addScanLog('🔍 Starting Section 508 compliance scan...')
        addScanLog('⚡ AI enhancements will be applied to critical/serious issues only for faster processing')
        addScanLog('🔄 Duplicate issues will be grouped together for cleaner reporting')

        // Read file content as base64
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

        // Generate scan ID for cancellation support
        const scanId = `scan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        setCurrentScanId(scanId)
        setIsScanning(true)
        addScanLog('🔄 Initializing scan engine...')

        // Add initial scan progress
        addScanLog('📄 Parsing document structure...')
        addScanLog('🔍 Analyzing text accessibility...')
        addScanLog('🖼️ Checking image alternatives...')

        // Call the API for 508 compliance scan
        addScanLog('📡 Sending document to compliance scanner...')
        addScanLog('⏱️ This may take a few minutes for large documents...')
        const response = await fetch('/api/document-scan', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileContent: fileContent,
            selectedTags: selectedTags.length > 0 ? selectedTags : undefined,
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
          return
        }
        
        const scanResults = result.result
        addScanLog(`✅ Scan completed! Found ${scanResults.issues.length} accessibility issues`)
        
        const completedDocument: UploadedDocument = {
          ...newDocument,
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
            },
            body: JSON.stringify({
              userId: 'demo-user',
              scanType: 'document',
              scanId: scanId,
              fileName: file.name
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
        addScanLog('🎉 Document processing complete!')

        // Refresh scan history and credits
        loadScanHistory()
        checkUserCredits()

        if (onScanComplete) {
          onScanComplete(completedDocument)
        }

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

  const cancelScan = async () => {
    if (currentScanId) {
      addScanLog('🚫 User requested scan cancellation...')
      try {
        await fetch(`/api/document-scan?scanId=${currentScanId}`, {
          method: 'DELETE'
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

        {/* Credit Display */}
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Credits Available: {userCredits === 999999 ? 'Unlimited' : userCredits}
              </span>
            </div>
            {!canScan && (
              <span className="text-sm text-red-600 font-medium">
                Insufficient credits to scan
              </span>
            )}
          </div>
          {userCredits < 5 && userCredits !== 999999 && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-xs text-blue-600">
                Running low on credits? <Link href="/pricing" className="underline hover:text-blue-800">Buy more</Link> or upgrade to unlimited.
              </p>
              <Link 
                href="/pricing"
                className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Buy Credits
              </Link>
            </div>
          )}
        </div>

        {/* Section 508 Tag Selector */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-md font-medium text-gray-800">Section 508 Compliance Tests</h4>
            <div className="flex space-x-2">
              <button
                onClick={selectAllTags}
                className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearAllTags}
                className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors"
              >
                Clear All
              </button>
              <button
                onClick={() => setShowTagSelector(!showTagSelector)}
                className="px-3 py-1 text-xs bg-primary-100 text-primary-700 rounded hover:bg-primary-200 transition-colors"
              >
                {showTagSelector ? 'Hide' : 'Show'} Tests
              </button>
            </div>
          </div>
          
          {showTagSelector && (
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
              <div className="max-h-48 overflow-y-auto bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-xs">
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
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium text-gray-900">Scan History</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            >
              {showHistory ? 'Hide' : 'Show'} History
            </button>
            <button
              onClick={loadScanHistory}
              disabled={isLoadingHistory}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              {isLoadingHistory ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="space-y-4">
            {isLoadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <p className="text-gray-500">Loading scan history...</p>
              </div>
            ) : scanHistory.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No scan history yet</p>
                <p className="text-sm">Upload a document to start scanning</p>
              </div>
            ) : (
              <div className="space-y-3">
                {scanHistory.map((scan) => (
                  <div key={scan.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <p className="font-medium text-gray-900">{scan.fileName}</p>
                          <p className="text-sm text-gray-500">
                            {new Date(scan.scanDate).toLocaleDateString()} • {scan.fileType} • {formatFileSize(scan.fileSize)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <div className={`px-2 py-1 text-xs rounded-full ${
                          scan.status === 'completed' ? 'bg-green-100 text-green-800' :
                          scan.status === 'scanning' ? 'bg-yellow-100 text-yellow-800' :
                          scan.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {scan.status === 'completed' ? 'Completed' :
                           scan.status === 'scanning' ? 'In Progress' :
                           scan.status === 'cancelled' ? 'Cancelled' :
                           scan.status}
                        </div>
                        {scan.is508Compliant !== undefined && (
                          <div className={`px-2 py-1 text-xs rounded-full ${
                            scan.is508Compliant ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {scan.is508Compliant ? '508 Compliant' : 'Non-Compliant'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Scan Results Summary */}
                    {scan.status === 'completed' && scan.scanResults && (
                      <div className="grid grid-cols-4 gap-2 mb-3">
                        <div className="text-center p-2 bg-red-50 rounded">
                          <div className="text-sm font-semibold text-red-800">
                            {scan.scanResults.summary?.critical || 0}
                          </div>
                          <div className="text-xs text-red-600">Critical</div>
                        </div>
                        <div className="text-center p-2 bg-orange-50 rounded">
                          <div className="text-sm font-semibold text-orange-800">
                            {scan.scanResults.summary?.serious || 0}
                          </div>
                          <div className="text-xs text-orange-600">Serious</div>
                        </div>
                        <div className="text-center p-2 bg-yellow-50 rounded">
                          <div className="text-sm font-semibold text-yellow-800">
                            {scan.scanResults.summary?.moderate || 0}
                          </div>
                          <div className="text-xs text-yellow-600">Moderate</div>
                        </div>
                        <div className="text-center p-2 bg-blue-50 rounded">
                          <div className="text-sm font-semibold text-blue-800">
                            {scan.scanResults.summary?.minor || 0}
                          </div>
                          <div className="text-xs text-blue-600">Minor</div>
                        </div>
                      </div>
                    )}

                    {/* Scan Metadata */}
                    <div className="text-xs text-gray-500 space-y-1">
                      <div className="flex justify-between">
                        <span>Scan ID: {scan.scanId}</span>
                        <span>Duration: {scan.scanDuration ? Math.round(scan.scanDuration / 1000) + 's' : 'N/A'}</span>
                      </div>
                      {scan.pagesAnalyzed && (
                        <div>Pages Analyzed: {scan.pagesAnalyzed}</div>
                      )}
                      {scan.overallScore && (
                        <div>Score: {scan.overallScore}/100</div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex space-x-2 mt-3">
                      <button
                        onClick={() => {
                          // Show detailed results in a modal or navigate to detailed view
                          console.log('View detailed results for:', scan.id)
                        }}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
                      >
                        View Details
                      </button>
                      {scan.status === 'scanning' && (
                        <button
                          onClick={() => {
                            // Cancel scan
                            console.log('Cancel scan:', scan.scanId)
                          }}
                          className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

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

                    {/* Issues List */}
                    {document.scanResults.issues.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Issues Found:</p>
                        {document.scanResults.issues.slice(0, showAllIssues ? undefined : 3).map((issue) => (
                          <div 
                            key={issue.id} 
                            className="flex items-start space-x-2 p-2 bg-white rounded border cursor-pointer hover:bg-gray-50 transition-colors"
                            onClick={() => {
                              setSelectedIssue(issue)
                              setShowIssueModal(true)
                            }}
                          >
                            <div className={`w-2 h-2 rounded-full mt-2 ${
                              issue.type === 'critical' ? 'bg-red-500' :
                              issue.type === 'serious' ? 'bg-orange-500' :
                              issue.type === 'moderate' ? 'bg-yellow-500' :
                              'bg-blue-500'
                            }`} />
                            <div className="flex-1">
                              <div className="flex items-center space-x-2 mb-1">
                                <p className="text-sm font-medium text-gray-900">{issue.description}</p>
                                {issue.category && (
                                  <span className="px-1 py-0.5 bg-gray-100 text-gray-700 text-xs rounded">
                                    {issue.category}
                                  </span>
                                )}
                                {issue.occurrences && issue.occurrences > 1 && (
                                  <span className="px-1 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                    {issue.occurrences} instances
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">
                                {issue.section}
                                {issue.pageNumber && ` • Page ${issue.pageNumber}`}
                                {issue.lineNumber && ` • Line ${issue.lineNumber}`}
                              </p>
                            </div>
                          </div>
                        ))}
                        {document.scanResults.issues.length > 3 && (
                          <div className="text-center">
                            <button 
                              onClick={() => setShowAllIssues(!showAllIssues)}
                              className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {showAllIssues ? 'Show Less' : `+${document.scanResults.issues.length - 3} more issues`}
                            </button>
                          </div>
                        )}
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