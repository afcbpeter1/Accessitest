'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Search, Globe, HelpCircle, Settings, AlertTriangle, CheckCircle, FileText, X, Repeat } from 'lucide-react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import DetailedReport from '@/components/DetailedReport'
import CollapsibleIssue from '@/components/CollapsibleIssue'
import { authenticatedFetch } from '@/lib/auth-utils'
import { AlertModal, ConfirmationModal } from '@/components/AccessibleModal'
import { useModal } from '@/hooks/useModal'
import { useScan } from '@/contexts/ScanContext'

interface ScanProgress {
  currentPage: number;
  totalPages: number;
  url?: string;
  status: 'crawling' | 'scanning' | 'analyzing' | 'complete' | 'error';
  message: string;
}

interface ScanResult {
  url: string;
  timestamp: string;
  issues: any[];
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  wcag22Compliance: {
    levelA: boolean;
    levelAA: boolean;
    levelAAA: boolean;
  };
  screenshots?: any;
}

interface DiscoveredPage {
  url: string;
  title: string;
  category: 'home' | 'content' | 'forms' | 'blog' | 'legal' | 'other';
  priority: 'high' | 'medium' | 'low';
}

export default function NewScan() {
  const searchParams = useSearchParams()
  const [url, setUrl] = useState('')
  const [includeSubdomains, setIncludeSubdomains] = useState(true)
  const [wcagLevel, setWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA')
  const [selectedTags, setSelectedTags] = useState<string[]>(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']) // Comprehensive WCAG compliance
  const [isScanning, setIsScanning] = useState(false)
  const { addScan, updateScan, removeScan, getActiveScan, activeScans } = useScan()
  const [activeScanId, setActiveScanId] = useState<string | null>(null)
  
  // Get current scan progress from global state
  const scanProgress = activeScanId ? getActiveScan(activeScanId) : null
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([])
  const [selectedPages, setSelectedPages] = useState<string[]>([])
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [remediationReport, setRemediationReport] = useState<any[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [currentScanId, setCurrentScanId] = useState<string | null>(null)
  const hasAutoStartedRef = useRef(false)
  
  // Modal management
  const { modalState, showAlert, showConfirm, closeModal, handleConfirm } = useModal()

  // Check for active scans when component mounts
  useEffect(() => {
    // Only check for active scans if we're not coming from a rerun
    if (!searchParams || !searchParams.get('url')) {
      checkForActiveScans()
    }
  }, [searchParams])

  // Handle URL parameters for rerun functionality
  useEffect(() => {
    if (searchParams) {
      const urlParam = searchParams.get('url')
      const includeSubdomainsParam = searchParams.get('includeSubdomains')
      const wcagLevelParam = searchParams.get('wcagLevel')
      const selectedTagsParam = searchParams.get('selectedTags')
      const pagesToScanParam = searchParams.get('pagesToScan')
      
      console.log('🔄 URL parameters detected:', {
        url: urlParam,
        includeSubdomains: includeSubdomainsParam,
        wcagLevel: wcagLevelParam,
        selectedTags: selectedTagsParam,
        pagesToScan: pagesToScanParam
      })

      if (urlParam) {
        // Ensure URL has protocol for proper validation
        const normalizedUrl = urlParam.startsWith('http') ? urlParam : `https://${urlParam}`
        setUrl(normalizedUrl)
      }
      if (includeSubdomainsParam) setIncludeSubdomains(includeSubdomainsParam === 'true')
      if (wcagLevelParam && ['A', 'AA', 'AAA'].includes(wcagLevelParam)) {
        setWcagLevel(wcagLevelParam as 'A' | 'AA' | 'AAA')
      }
      if (selectedTagsParam) {
        setSelectedTags(selectedTagsParam.split(','))
      }
      if (pagesToScanParam) {
        const pages = pagesToScanParam.split(',').map(page => {
          // Ensure each page URL has protocol
          return page.startsWith('http') ? page : `https://${page}`
        })
        setDiscoveredPages(pages.map((pageUrl, index) => ({
          url: pageUrl,
          title: `Page ${index + 1}`,
          category: 'other' as const,
          priority: 'medium' as const
        })))
        setSelectedPages(pages)
        
        // Clear any active scans when coming from rerun
        setActiveScanId(null)
        // Note: Global scan state will be managed by the new scan
        setScanResults([])
        setScanError(null)
        hasAutoStartedRef.current = false // Reset auto-start flag for new rerun
        
        // Mark that we should auto-start the scan
        console.log('🚀 Rerun scan detected - will auto-start with settings:', {
          url: urlParam,
          includeSubdomains: includeSubdomainsParam === 'true',
          wcagLevel: wcagLevelParam,
          selectedTags: selectedTagsParam?.split(','),
          pagesToScan: pages
        })
      }
    }
  }, [searchParams])

  // Restore scan state from global context
  useEffect(() => {
    const webScans = activeScans.filter(scan => scan.type === 'web')
    if (webScans.length > 0) {
      const activeScan = webScans[0] // Get the most recent web scan
      console.log('🔄 Restoring web scan state from global context:', activeScan)
      
      setActiveScanId(activeScan.scanId)
      setIsScanning(activeScan.status === 'scanning' || activeScan.status === 'analyzing' || activeScan.status === 'crawling')
      
      // Restore URL and pages if available
      if (activeScan.url && !url) {
        setUrl(activeScan.url)
      }
      
      // If scan is complete, show results
      if (activeScan.status === 'complete') {
        // The scan results should already be loaded from the API
        setActiveScanId(null)
        setIsScanning(false)
      } else {
        // For active scans, ensure we show the progress UI
        // The scanProgress will be available via activeScanId
        console.log('📊 Active scan restored - showing progress UI')
      }
    } else {
      // No active scans - clear the active scan ID
      if (activeScanId) {
        console.log('🧹 No active scans found - clearing active scan ID')
        setActiveScanId(null)
        setIsScanning(false)
      }
    }
  }, [activeScans, url, activeScanId])

  // Auto-start scan when coming from rerun
  useEffect(() => {
    if (searchParams && searchParams.get('url') && selectedPages.length > 0 && !isScanning && !hasAutoStartedRef.current) {
      console.log('🚀 Auto-starting rerun scan now...')
      hasAutoStartedRef.current = true // Prevent multiple auto-starts
      setTimeout(() => {
        scanSelectedPages()
      }, 1500) // Give a bit more time for state to settle
    }
  }, [selectedPages, isScanning, searchParams])

  // Update selectedTags when wcagLevel changes
  // CRITICAL: Tags are NOT hierarchical - must include ALL levels explicitly
  useEffect(() => {
    if (wcagLevel === 'A') {
      // WCAG Level A only
      setSelectedTags(['wcag2a'])
    } else if (wcagLevel === 'AA') {
      // WCAG Level AA includes A + AA (must include both explicitly)
      setSelectedTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    } else if (wcagLevel === 'AAA') {
      // WCAG Level AAA includes A + AA + AAA (must include all explicitly)
      setSelectedTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'wcag2aaa', 'wcag21aaa', 'wcag22aaa'])
    }
  }, [wcagLevel])

  // Update selectedTags when checkboxes change
  const updateSelectedTags = (tag: string, checked: boolean) => {
    if (checked) {
      setSelectedTags(prev => [...prev, tag])
    } else {
      setSelectedTags(prev => prev.filter(t => t !== tag))
    }
  }

  const checkForActiveScans = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/active-scans', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success && data.scans && data.scans.length > 0) {
          // Find the most recent active scan
          const activeScan = data.scans[0]
          if (activeScan.status === 'running') {
            setActiveScanId(activeScan.scanId)
            setIsScanning(true)
            
            // Scan progress is automatically restored via getActiveScan(activeScanId)
            
            // Restore URL if available
            if (activeScan.url) {
              setUrl(activeScan.url)
            }
            
            console.log('Resumed active scan:', activeScan.scanId)
          }
        }
      }
    } catch (error) {
      console.error('Failed to check for active scans:', error)
    }
  }
  const [discoveryLog, setDiscoveryLog] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url) return

    // Always start with page discovery
    await discoverPages()
  }

  // Clear discovered pages when URL changes
  const handleUrlChange = (newUrl: string) => {
    setUrl(newUrl)
    // Clear previous discovery results when URL changes
    setDiscoveredPages([])
    setSelectedPages([])
    setScanResults([])
    setRemediationReport([])
    setScanError(null)
    setDiscoveryLog([])
  }

  // Update progress and add to log
  const updateProgress = (progress: ScanProgress) => {
    if (activeScanId) {
      updateScan(activeScanId, {
        status: progress.status,
        currentPage: progress.currentPage,
        totalPages: progress.totalPages,
        message: progress.message
      })
    }
    if (progress.message && !discoveryLog.includes(progress.message)) {
      setDiscoveryLog(prev => [...prev, progress.message])
    }
  }

  const discoverPages = async () => {
    setIsScanning(true)
    setScanError(null)
    setDiscoveredPages([])
    setSelectedPages([])
    
    // Create a new scan in global state
    const scanId = `web-discovery-${Date.now()}`
    setActiveScanId(scanId)
    addScan({
      scanId,
      type: 'web',
      status: 'crawling',
      currentPage: 0,
      totalPages: 0,
      startTime: Date.now(),
      url: url
    })

    try {
      // Validate URL format
      let normalizedUrl = url.trim()
      if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
        normalizedUrl = `https://${normalizedUrl}`
      }
      
      try {
        new URL(normalizedUrl) // Validate URL format
      } catch (error) {
        alert('Please enter a valid URL (e.g., example.com or https://example.com)')
        setIsScanning(false)
        return
      }

      // Clear previous log and update progress
      setDiscoveryLog([])
      
      // If includeSubdomains is false, skip discovery and just use the single URL
      if (!includeSubdomains) {
        updateScan(scanId, {
          currentPage: 1,
          totalPages: 1,
          status: 'complete',
          message: 'Single page scan ready. Click "Start WCAG 2.2 Scan" to begin.'
        })
        
        // Create a single page entry
        const singlePage: DiscoveredPage = {
          url: normalizedUrl,
          title: 'Homepage',
          category: 'home',
          priority: 'high'
        }
        
        setDiscoveredPages([singlePage])
        setSelectedPages([normalizedUrl])
        
        setIsScanning(false)
        // Clear active scan ID if set
        if (activeScanId) {
          setTimeout(() => {
            setActiveScanId(null)
            removeScan(activeScanId)
          }, 2000)
        }
        return
      }
      
      // Start progress simulation for discovery
      const discoveryTips = [
        "🔍 Checking robots.txt and crawling policies...",
        "🌐 Discovering navigation links...",
        "📄 Finding content pages...",
        "📝 Locating forms and interactive elements...",
        "📰 Searching for blog and news pages...",
        "⚖️ Identifying legal and policy pages...",
        "🔗 Following internal links...",
        "📊 Categorizing discovered pages..."
      ]
      
      let tipIndex = 0
      let pageCount = 0
      
      // Start progress updates
      const progressInterval = setInterval(() => {
        pageCount += Math.floor(Math.random() * 5) + 1
        const tip = discoveryTips[tipIndex % discoveryTips.length]
        
        updateProgress({
          currentPage: pageCount,
          totalPages: 200,
          url: normalizedUrl,
          status: 'crawling',
          message: `${tip} Found ${pageCount} pages so far. Est. ${Math.max(0, 30 - Math.floor(pageCount / 10))}s remaining.`
        })
        
        tipIndex++
      }, 2000)

      updateScan(scanId, {
        currentPage: 0,
        totalPages: 200,
        status: 'crawling',
        message: 'Discovering pages on website...'
      })

      const response = await authenticatedFetch('/api/discover', {
        method: 'POST',
        body: JSON.stringify({
          url: normalizedUrl,
          includeSubdomains,
          deepCrawl: true,
          maxPages: 200
        })
      })

      // Clear the progress interval
      clearInterval(progressInterval)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Page discovery failed')
      }

      const result = await response.json()
      setDiscoveredPages(result.discoveredPages)
      
      // Auto-select high priority pages
      const highPriorityUrls = result.discoveredPages
        .filter((page: DiscoveredPage) => page.priority === 'high')
        .map((page: DiscoveredPage) => page.url)
      setSelectedPages(highPriorityUrls)
      
      // Update progress to complete
      updateScan(scanId, {
        currentPage: result.totalPages,
        totalPages: result.totalPages,
        status: 'complete',
        message: `Discovered ${result.totalPages} pages! Select which ones to scan.`
      })
      
    } catch (error) {
      console.error('Page discovery failed:', error)
      setScanError(error instanceof Error ? error.message : 'Page discovery failed')
    } finally {
      setIsScanning(false)
      setTimeout(() => removeScan(scanId), 2000)
    }
  }

  const scanSelectedPages = async () => {
    console.log('🚀 Starting scan with selectedPages:', selectedPages)
    setIsScanning(true)
    setScanError(null)
    setScanResults([])

    // Create a new scan in global state
    const scanId = `web-scan-${Date.now()}`
    setActiveScanId(scanId)
    addScan({
      scanId,
      type: 'web',
      status: 'scanning',
      currentPage: 0,
      totalPages: selectedPages.length,
      startTime: Date.now(),
      url: selectedPages[0]
    })

    try {
      const pagesToScan = selectedPages
      
      if (pagesToScan.length === 0) {
        console.error('❌ No pages selected for scanning')
        throw new Error('No pages selected for scanning')
      }
      
      console.log('📄 Pages to scan:', pagesToScan)

      // Update progress
      updateScan(scanId, {
        currentPage: 0,
        totalPages: pagesToScan.length,
        status: 'scanning',
        message: 'Scanning pages for accessibility issues...'
      })

      // Use streaming API for real-time progress updates
      const response = await authenticatedFetch('/api/scan-progress', {
        method: 'POST',
        body: JSON.stringify({
          url,
          pagesToScan,
          includeSubdomains,
          wcagLevel,
          selectedTags
        })
      })

      if (!response.ok) {
        if (response.status === 402) {
          // Insufficient credits - show popup with payment page redirect
          showConfirm(
            'Insufficient Credits',
            'You don\'t have enough credits to run this scan. Would you like to purchase more credits?',
            () => {
              window.location.href = '/pricing'
            },
            'warning',
            'Buy Credits',
            'Cancel'
          )
          setIsScanning(false)
          return
        }
        
        const errorData = await response.json()
        throw new Error(errorData.error || 'Scan failed')
      }

      // Handle streaming response for real-time progress
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        console.error('❌ No response body from scan API')
        throw new Error('No response body')
      }
      
      console.log('📡 Starting to read scan response stream...')

      let buffer = ''
      
      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        
        // Keep the last line in buffer as it might be incomplete
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim()
              if (!jsonStr) continue // Skip empty data lines
              
              const data = JSON.parse(jsonStr)
              
              // Update progress based on message type
              if (data.type === 'start') {
                updateScan(scanId, {
                  currentPage: 0,
                  totalPages: data.totalPages,
                  status: 'scanning',
                  message: data.message
                })
              } else if (data.type === 'page_start' || data.type === 'progress') {
                console.log('🔄 Scan progress update:', {
                  type: data.type,
                  currentPage: data.currentPage,
                  totalPages: data.totalPages,
                  status: data.status,
                  message: data.message
                })
                updateScan(scanId, {
                  currentPage: data.currentPage,
                  totalPages: data.totalPages,
                  status: data.status,
                  message: data.message
                })
              } else if (data.type === 'page_complete') {
                updateScan(scanId, {
                  currentPage: data.currentPage,
                  totalPages: data.totalPages,
                  status: data.status,
                  message: data.message
                })
              } else if (data.type === 'complete') {
                console.log('✅ Scan complete data received:', data)
                console.log('📊 Scan results:', data.results)
                updateScan(scanId, {
                  currentPage: data.currentPage,
                  totalPages: data.totalPages,
                  status: 'complete',
                  message: data.message
                })
                
                // Clear active scan ID since scan is complete
                setActiveScanId(null)
                
                // Store the results
                if (data.results) {
                  console.log('💾 Setting scan results:', data.results)
                  console.log('📊 Results count:', data.results.results?.length || 0)
                  setScanResults(data.results.results)
                  setRemediationReport(data.results.remediationReport || [])
                  
                  // Set the scan ID for issue tracking
                  if (data.scanId) {
                    setCurrentScanId(data.scanId)
                  }
                  
                  // Show professional success notification
                  const totalIssues = data.results.complianceSummary.totalIssues
                  const criticalIssues = data.results.complianceSummary.criticalIssues
                  const seriousIssues = data.results.complianceSummary.seriousIssues
                  
                  setSuccessMessage(`Scan completed successfully! 📊\n\n• Pages scanned: ${data.results.pagesScanned}\n• Total issues: ${totalIssues}\n• Critical issues: ${criticalIssues}\n• Serious issues: ${seriousIssues}\n\nCheck the results below for detailed analysis.`)
                  setShowSuccessNotification(true)
                  
                  // Auto-hide notification after 8 seconds
                  setTimeout(() => setShowSuccessNotification(false), 8000)
                } else {
                  console.log('No results in complete data') // Debug log
                }
              } else if (data.type === 'error') {
                // Clear active scan ID on error
                setActiveScanId(null)
                throw new Error(data.message)
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError)
              console.error('Problematic line:', line)
              // Continue processing other lines even if one fails
            }
          }
        }
      }
      
      // Process any remaining data in buffer
      if (buffer.trim()) {
        const lines = buffer.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const jsonStr = line.slice(6).trim()
              if (!jsonStr) continue
              
              const data = JSON.parse(jsonStr)
              
              // Handle the final data
              if (data.type === 'complete') {
                updateScan(scanId, {
                  currentPage: data.currentPage,
                  totalPages: data.totalPages,
                  status: 'complete',
                  message: data.message
                })
                
                setActiveScanId(null)
                
                if (data.results) {
                  setScanResults(data.results.results)
                  setRemediationReport(data.results.remediationReport)
                  
                  // Set the scan ID for issue tracking
                  if (data.scanId) {
                    setCurrentScanId(data.scanId)
                  }
                  
                  const totalIssues = data.results.complianceSummary.totalIssues
                  const criticalIssues = data.results.complianceSummary.criticalIssues
                  const seriousIssues = data.results.complianceSummary.seriousIssues
                  
                  setSuccessMessage(`Scan completed successfully! 📊\n\n• Pages scanned: ${data.results.pagesScanned}\n• Total issues: ${totalIssues}\n• Critical issues: ${criticalIssues}\n• Serious issues: ${seriousIssues}\n\nCheck the results below for detailed analysis.`)
                  setShowSuccessNotification(true)
                  
                  // Refresh user data to update credits
                  window.dispatchEvent(new CustomEvent('refreshUserData'))
                  
                  setTimeout(() => setShowSuccessNotification(false), 8000)
                }
              }
            } catch (parseError) {
              console.error('Error parsing final SSE data:', parseError)
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Scan failed:', error)
      setScanError(error instanceof Error ? error.message : 'Scan failed')
      // Clear active scan ID on error
      setActiveScanId(null)
    } finally {
      setIsScanning(false)
      setTimeout(() => removeScan(scanId), 2000)
    }
  }

  return (
    <Sidebar>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">New Accessibility Scan</h1>
          <p className="text-gray-600 mt-1">Configure and start a new accessibility scan for your website</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          {/* Main Form */}
          <div className="xl:col-span-3">
            <div className="card">
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Discovery Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Discovery Options
                  </label>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                        id="includeSubdomains"
                        type="checkbox"
                        checked={includeSubdomains}
                        onChange={(e) => setIncludeSubdomains(e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="includeSubdomains" className="ml-2 block text-sm text-gray-700">
                        Include subdomains (blog.example.com, shop.example.com, etc.)
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 ml-6">
                      {includeSubdomains 
                        ? "When discovering pages, also include pages from subdomains of your website"
                        : "Only scan the exact URL you entered - no page discovery or subdomain crawling"
                      }
                    </p>
                  </div>
                </div>

                {/* URL Input */}
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-1">
                    Website URL
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Globe className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="url"
                      id="url"
                      value={url}
                      onChange={(e) => handleUrlChange(e.target.value)}
                      placeholder="https://example.com"
                      className="input-field pl-10"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <button
                        type="button"
                        className="text-gray-400 hover:text-gray-600"
                        title="Help"
                      >
                        <HelpCircle className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    Enter the domain you want to scan for accessibility issues
                  </p>
                </div>

                {/* Stage 1: Page Discovery */}
                <div>
                  <div className="flex items-center mb-2">
                    <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center mr-2">
                      <span className="text-blue-600 font-semibold text-xs">1</span>
                    </div>
                    <label className="block text-sm font-medium text-gray-700">
                      Stage 1: Page Discovery
                    </label>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">
                    {includeSubdomains 
                      ? "First, let's discover all pages on your website so you can choose which ones to scan for accessibility issues."
                      : "Since subdomains are disabled, we'll only scan the exact URL you entered above."
                    }
                  </p>
                  
                  {/* Discover Pages Button */}
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={discoverPages}
                      disabled={isScanning || !url}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
                    >
                      <Search className="h-5 w-5" />
                      <span>
                        {isScanning 
                          ? (includeSubdomains ? 'Discovering Pages...' : 'Preparing Single Page...')
                          : (includeSubdomains ? 'Start Page Discovery' : 'Prepare Single Page Scan')
                        }
                      </span>
                    </button>
                  </div>
                </div>

                                  {/* Stage 2: Select Pages to Scan */}
                 {discoveredPages.length > 0 && (
                   <div className="space-y-3">
                     <div className="flex items-center mb-2">
                       <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center mr-2">
                         <span className="text-green-600 font-semibold text-xs">2</span>
                       </div>
                       <div>
                         <h3 className="text-base font-semibold text-gray-900">
                           {includeSubdomains ? 'Stage 2: Select Pages to Scan' : 'Ready to Scan'}
                         </h3>
                         <p className="text-sm text-gray-600">
                           {includeSubdomains 
                             ? 'Choose which pages to scan for WCAG 2.2 accessibility issues'
                             : 'Your single page is ready to scan for WCAG 2.2 accessibility issues'
                           }
                         </p>
                       </div>
                     </div>
                     
                     {includeSubdomains && (
                       <div className="flex items-center justify-between">
                         <span className="text-sm font-medium text-gray-700">Page Selection</span>
                         <div className="flex space-x-2">
                           <button
                             type="button"
                             onClick={() => setSelectedPages(discoveredPages.map(page => page.url))}
                             className="text-sm text-blue-600 hover:text-blue-800"
                           >
                             Select All
                           </button>
                           <button
                             type="button"
                             onClick={() => setSelectedPages([])}
                             className="text-sm text-gray-600 hover:text-gray-800"
                           >
                             Clear All
                           </button>
                         </div>
                       </div>
                     )}

                     {/* Category Filters */}
                     {includeSubdomains && (
                       <div className="flex flex-wrap gap-2">
                         {['home', 'content', 'forms', 'blog', 'legal', 'other'].map(category => {
                         const categoryPages = discoveredPages.filter(page => page.category === category)
                         const selectedInCategory = categoryPages.filter(page => selectedPages.includes(page.url))
                         
                         return (
                           <button
                             key={category}
                             type="button"
                             onClick={() => {
                               if (selectedInCategory.length === categoryPages.length) {
                                 // Deselect all in category
                                 setSelectedPages(selectedPages.filter(url => 
                                   !categoryPages.map(p => p.url).includes(url)
                                 ))
                               } else {
                                 // Select all in category
                                 const newSelected = [...selectedPages]
                                 categoryPages.forEach(page => {
                                   if (!newSelected.includes(page.url)) {
                                     newSelected.push(page.url)
                                   }
                                 })
                                 setSelectedPages(newSelected)
                               }
                             }}
                             className={`px-3 py-1 text-xs rounded-full border ${
                               selectedInCategory.length === categoryPages.length
                                 ? 'bg-blue-100 text-blue-800 border-blue-300'
                                 : 'bg-gray-100 text-gray-600 border-gray-300'
                             }`}
                           >
                             {category.charAt(0).toUpperCase() + category.slice(1)} ({selectedInCategory.length}/{categoryPages.length})
                           </button>
                         )
                       })}
                     </div>
                     )}

                     {/* Priority Filters */}
                     {includeSubdomains && (
                       <div className="flex flex-wrap gap-2">
                         {['high', 'medium', 'low'].map(priority => {
                         const priorityPages = discoveredPages.filter(page => page.priority === priority)
                         const selectedInPriority = priorityPages.filter(page => selectedPages.includes(page.url))
                         
                         return (
                           <button
                             key={priority}
                             type="button"
                             onClick={() => {
                               if (selectedInPriority.length === priorityPages.length) {
                                 // Deselect all in priority
                                 setSelectedPages(selectedPages.filter(url => 
                                   !priorityPages.map(p => p.url).includes(url)
                                 ))
                               } else {
                                 // Select all in priority
                                 const newSelected = [...selectedPages]
                                 priorityPages.forEach(page => {
                                   if (!newSelected.includes(page.url)) {
                                     newSelected.push(page.url)
                                   }
                                 })
                                 setSelectedPages(newSelected)
                               }
                             }}
                             className={`px-3 py-1 text-xs rounded-full border ${
                               priority === 'high' ? 'border-red-300' : 
                               priority === 'medium' ? 'border-yellow-300' : 'border-gray-300'
                             } ${
                               selectedInPriority.length === priorityPages.length
                                 ? priority === 'high' ? 'bg-red-100 text-red-800' :
                                   priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                   'bg-gray-100 text-gray-800'
                                 : 'bg-gray-50 text-gray-600'
                             }`}
                           >
                             {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority ({selectedInPriority.length}/{priorityPages.length})
                           </button>
                         )
                       })}
                       </div>
                     )}

                     {/* Page List */}
                     <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                       {discoveredPages.map((page) => (
                         <div
                           key={page.url}
                           className={`flex items-center p-3 border-b border-gray-100 hover:bg-gray-50 ${
                             selectedPages.includes(page.url) ? 'bg-blue-50' : ''
                           }`}
                         >
                           <input
                             type="checkbox"
                             checked={selectedPages.includes(page.url)}
                             onChange={(e) => {
                               if (e.target.checked) {
                                 setSelectedPages([...selectedPages, page.url])
                               } else {
                                 setSelectedPages(selectedPages.filter(url => url !== page.url))
                               }
                             }}
                             className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                           />
                           <div className="ml-3 flex-1 min-w-0">
                             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-1 sm:space-y-0">
                               <span className="text-sm font-medium text-gray-900 truncate">{page.title}</span>
                               <div className="flex items-center space-x-2 flex-shrink-0">
                                 <span className={`px-2 py-1 text-xs rounded-full ${
                                   page.category === 'home' ? 'bg-blue-100 text-blue-800' :
                                   page.category === 'forms' ? 'bg-green-100 text-green-800' :
                                   page.category === 'blog' ? 'bg-purple-100 text-purple-800' :
                                   page.category === 'legal' ? 'bg-gray-100 text-gray-800' :
                                   page.category === 'content' ? 'bg-orange-100 text-orange-800' :
                                   'bg-gray-100 text-gray-600'
                                 }`}>
                                   {page.category}
                                 </span>
                                 <span className={`px-2 py-1 text-xs rounded-full ${
                                   page.priority === 'high' ? 'bg-red-100 text-red-800' :
                                   page.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                                   'bg-gray-100 text-gray-600'
                                 }`}>
                                   {page.priority}
                                 </span>
                               </div>
                             </div>
                             <p className="text-xs text-gray-500 truncate">{page.url}</p>
                           </div>
                         </div>
                       ))}
                     </div>

                     <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
                       <span className="text-sm text-gray-600">{selectedPages.length} of {discoveredPages.length} pages selected</span>
                       <button
                         type="button"
                         onClick={scanSelectedPages}
                         disabled={selectedPages.length === 0 || isScanning}
                         className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center space-x-2"
                       >
                         {isScanning ? (
                           <>
                             <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                             <span>Scanning...</span>
                           </>
                         ) : (
                           <>
                             <Search className="h-5 w-5" />
                             <span>Start WCAG 2.2 Scan ({selectedPages.length} pages)</span>
                           </>
                         )}
                       </button>
                     </div>
                   </div>
                 )}

                 {/* ADA & WCAG 2.2 Compliance Level */}
                 <div className={`${discoveredPages.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                   <div className="mb-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                     <div className="flex items-center space-x-2">
                       <CheckCircle className="h-5 w-5 text-green-600" />
                       <div>
                         <p className="text-sm font-medium text-green-800">ADA Compliant Scans</p>
                         <p className="text-xs text-green-600">Meets Americans with Disabilities Act requirements through WCAG 2.2 AA compliance</p>
                       </div>
                     </div>
                   </div>
                   <label className="block text-sm font-medium text-gray-700 mb-2">
                     WCAG 2.2 Compliance Level
                   </label>
                   <div className="space-y-2">
                     <div className="flex items-center">
                       <input
                         id="wcag-a"
                         type="radio"
                         name="wcagLevel"
                         value="A"
                         checked={wcagLevel === 'A'}
                         onChange={(e) => {
                           setWcagLevel(e.target.value as 'A' | 'AA' | 'AAA')
                           setSelectedTags(['wcag2a'])
                         }}
                         className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                         disabled={discoveredPages.length === 0}
                       />
                       <label htmlFor="wcag-a" className="ml-3">
                         <span className="block text-sm font-medium text-gray-700">Level A</span>
                         <span className="block text-sm text-gray-500">Basic accessibility requirements</span>
                       </label>
                     </div>
                     <div className="flex items-center">
                       <input
                         id="wcag-aa"
                         type="radio"
                         name="wcagLevel"
                         value="AA"
                         checked={wcagLevel === 'AA'}
                         onChange={(e) => {
                           setWcagLevel(e.target.value as 'A' | 'AA' | 'AAA')
                           setSelectedTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
                         }}
                         className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                         disabled={discoveredPages.length === 0}
                       />
                       <label htmlFor="wcag-aa" className="ml-3">
                         <span className="block text-sm font-medium text-gray-700">Level AA</span>
                         <span className="block text-sm text-gray-500">Standard compliance (recommended)</span>
                       </label>
                     </div>
                     <div className="flex items-center">
                       <input
                         id="wcag-aaa"
                         type="radio"
                         name="wcagLevel"
                         value="AAA"
                         checked={wcagLevel === 'AAA'}
                         onChange={(e) => {
                           setWcagLevel(e.target.value as 'A' | 'AA' | 'AAA')
                           setSelectedTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'wcag2aaa', 'wcag21aaa', 'wcag22aaa'])
                         }}
                         className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300"
                         disabled={discoveredPages.length === 0}
                       />
                       <label htmlFor="wcag-aaa" className="ml-3">
                         <span className="block text-sm font-medium text-gray-700">Level AAA</span>
                         <span className="block text-sm text-gray-500">Highest accessibility standards</span>
                       </label>
                     </div>
                   </div>
                 </div>

                 {/* Additional Standards */}
                 {discoveredPages.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                       Additional Standards
                  </label>
                  <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <h3 className="text-sm font-medium text-blue-800">
                          Current Scan Tags
                        </h3>
                        <div className="mt-2 text-sm text-blue-700">
                          <p className="mb-2">
                            <strong>Standards:</strong> {selectedTags.filter(tag => tag.startsWith('wcag')).map(tag => {
                              switch(tag) {
                                case 'wcag2a': return 'WCAG 2.0 Level A';
                                case 'wcag2aa': return 'WCAG 2.0 Level AA';
                                case 'wcag21aa': return 'WCAG 2.1 Level AA';
                                case 'wcag22aa': return 'WCAG 2.2 Level AA';
                                case 'wcag2aaa': return 'WCAG 2.0 Level AAA';
                                case 'wcag21aaa': return 'WCAG 2.1 Level AAA';
                                case 'wcag22aaa': return 'WCAG 2.2 Level AAA';
                                case 'wcag21a': return 'WCAG 2.1 Level A';
                                case 'wcag21aa': return 'WCAG 2.1 Level AA';
                                case 'wcag21aaa': return 'WCAG 2.1 Level AAA';
                                case 'wcag2a': return 'WCAG 2.0 Level A';
                                case 'wcag2aa': return 'WCAG 2.0 Level AA';
                                case 'wcag2aaa': return 'WCAG 2.0 Level AAA';
                                default: return tag;
                              }
                            }).join(', ')}
                            {selectedTags.filter(tag => !tag.startsWith('wcag')).length > 0 && (
                              <span>, {selectedTags.filter(tag => !tag.startsWith('wcag')).map(tag => {
                                switch(tag) {
                                  case 'best-practice': return 'Best Practices';
                                  case 'section508': return 'Section 508';
                                  case 'EN-301-549': return 'EN 301 549';
                                  case 'ACT': return 'W3C ACT';
                                  case 'experimental': return 'Experimental';
                                  default: return tag;
                                }
                              }).join(', ')}</span>
                            )}
                          </p>
                          <div className="text-xs">
                            <p className="mb-1"><strong>Includes checks for:</strong></p>
                            <div className="flex gap-x-4 text-blue-600">
                              <div className="flex-1 space-y-1">
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Color contrast</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Form labels</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Keyboard navigation</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Semantic HTML</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Table structure</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Heading structure</span>
                                </div>
                                {selectedTags.includes('wcag2aaa') && (
                                  <>
                                    <div className="flex items-start">
                                      <span className="mr-1">•</span>
                                      <span>Enhanced contrast</span>
                                    </div>
                                    <div className="flex items-start">
                                      <span className="mr-1">•</span>
                                      <span>Enhanced focus</span>
                                    </div>
                                  </>
                                )}
                              </div>
                              <div className="flex-1 space-y-1">
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Alt text</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>ARIA attributes</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Button accessibility</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Focus indicators</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Link accessibility</span>
                                </div>
                                <div className="flex items-start">
                                  <span className="mr-1">•</span>
                                  <span>Language attributes</span>
                                </div>
                                {selectedTags.includes('wcag2aaa') && (
                                  <>
                                    <div className="flex items-start">
                                      <span className="mr-1">•</span>
                                      <span>Larger touch targets</span>
                                    </div>
                                    <div className="flex items-start">
                                      <span className="mr-1">•</span>
                                      <span>Stricter requirements</span>
                                    </div>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center">
                      <input
                           id="best-practice"
                        type="checkbox"
                           checked={selectedTags.includes('best-practice')}
                           onChange={(e) => updateSelectedTags('best-practice', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                         <label htmlFor="best-practice" className="ml-2 block text-sm text-gray-700">
                           Best Practices
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                           id="section508"
                        type="checkbox"
                           checked={selectedTags.includes('section508')}
                           onChange={(e) => updateSelectedTags('section508', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                         <label htmlFor="section508" className="ml-2 block text-sm text-gray-700">
                           Section 508 (US Federal)
                      </label>
                    </div>
                    <div className="flex items-center">
                      <input
                           id="en-301-549"
                        type="checkbox"
                           checked={selectedTags.includes('EN-301-549')}
                           onChange={(e) => updateSelectedTags('EN-301-549', e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                         <label htmlFor="en-301-549" className="ml-2 block text-sm text-gray-700">
                           EN 301 549 (EU Standard)
                      </label>
                    </div>
                     </div>
                      </div>
                    )}

                {/* Scan Progress */}
                {(scanProgress || (isScanning && activeScanId)) && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {(!scanProgress || scanProgress.status === 'crawling') && (
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Search className="h-4 w-4 text-blue-600 animate-pulse" />
                            </div>
                          )}
                          {scanProgress?.status === 'scanning' && (
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-600 animate-pulse" />
                            </div>
                          )}
                          {scanProgress?.status === 'analyzing' && (
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <FileText className="h-4 w-4 text-purple-600 animate-pulse" />
                            </div>
                          )}
                          {scanProgress?.status === 'complete' && (
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                          )}
                          {!scanProgress && isScanning && (
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Search className="h-4 w-4 text-blue-600 animate-pulse" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {!scanProgress && isScanning && 'Scan in Progress'}
                            {scanProgress?.status === 'crawling' && 'Discovering Pages'}
                            {scanProgress?.status === 'scanning' && 'Scanning Pages'}
                            {scanProgress?.status === 'analyzing' && 'Analyzing Results'}
                            {scanProgress?.status === 'complete' && 'Scan Complete'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {!scanProgress && isScanning && 'Your scan is running in the background. Progress will appear here shortly.'}
                            {scanProgress?.status === 'crawling' && 'Finding all pages on your website...'}
                            {scanProgress?.status === 'scanning' && 'Checking accessibility compliance...'}
                            {scanProgress?.status === 'analyzing' && 'Generating detailed report...'}
                            {scanProgress?.status === 'complete' && 'All done! Check results below.'}
                          </p>
                        </div>
                      </div>
                      {scanProgress && scanProgress.totalPages > 0 && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                          {scanProgress.currentPage} / {scanProgress.totalPages}
                          </div>
                          <div className="text-sm text-gray-500">Pages</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Progress Bar */}
                    {scanProgress && (
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-4 overflow-hidden">
                        <div 
                          className="bg-gradient-to-r from-blue-500 to-indigo-600 h-3 rounded-full transition-all duration-500 ease-out shadow-sm"
                          style={{ 
                            width: scanProgress.totalPages > 0 
                              ? `${(scanProgress.currentPage / scanProgress.totalPages) * 100}%` 
                              : scanProgress.status === 'crawling' ? '50%' 
                              : scanProgress.status === 'scanning' ? '75%'
                              : scanProgress.status === 'analyzing' ? '90%'
                              : scanProgress.status === 'complete' ? '100%'
                              : '0%' 
                          }}
                        ></div>
                      </div>
                    )}
                    
                    {/* Discovery Progress Details */}
                    {scanProgress && scanProgress.status === 'crawling' && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-blue-800 font-semibold">🔍 Live Discovery Progress</span>
                          <span className="text-blue-600 font-medium">
                            {scanProgress.currentPage} / {scanProgress.totalPages > 0 ? scanProgress.totalPages : '∞'}
                          </span>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-blue-100">
                          <div className="text-sm text-blue-800 font-medium mb-1">Current Activity:</div>
                          <div className="text-sm text-blue-700 leading-relaxed">
                            {scanProgress.message}
                          </div>
                        </div>
                        <div className="mt-3 text-xs text-blue-600">
                          💡 This process is working! The system is actively discovering pages on your website.
                        </div>
                        
                        {/* Discovery Log */}
                        {discoveryLog.length > 0 && (
                          <div className="mt-3">
                            <div className="text-xs text-blue-600 font-medium mb-2">Recent Activity:</div>
                            <div className="max-h-32 overflow-y-auto bg-white rounded border border-blue-100 p-2">
                              {discoveryLog.slice(-5).map((log, index) => (
                                <div key={index} className="text-xs text-blue-700 py-1 border-b border-blue-50 last:border-b-0">
                                  {log}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Scanning Progress Details */}
                    {scanProgress && (scanProgress.status === 'scanning' || scanProgress.status === 'analyzing') && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-green-800 font-semibold">🔍 Live Scanning Progress</span>
                          <span className="text-green-600 font-medium">
                            {scanProgress.currentPage} / {scanProgress.totalPages}
                          </span>
                        </div>
                        <div className="bg-white rounded-lg p-3 border border-green-100">
                          <div className="text-sm text-green-800 font-medium mb-1">Current Activity:</div>
                          <div className="text-sm text-green-700 leading-relaxed">
                            {scanProgress.message}
                          </div>
                          {scanProgress.url && (
                            <div className="text-xs text-green-600 mt-2">
                              📄 Scanning: {scanProgress.url}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 text-xs text-green-600">
                          💡 The system is actively scanning each page for accessibility issues. This may take a few minutes.
                        </div>
                      </div>
                    )}
                    
                    {/* Current Status */}
                    {scanProgress && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">{scanProgress.message}</p>
                        {scanProgress.url && (
                          <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                              {scanProgress.url}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Success Notification */}
                {showSuccessNotification && (
                  <div className="fixed top-4 right-4 z-50 max-w-md">
                    <div className="bg-white border border-green-200 rounded-xl shadow-lg p-6 transform transition-all duration-300 ease-out">
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-6 w-6 text-green-600" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">Scan Complete!</h3>
                          <div className="text-sm text-gray-600 whitespace-pre-line">
                            {successMessage}
                          </div>
                        </div>
                        <button
                          onClick={() => setShowSuccessNotification(false)}
                          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {scanError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
                      <span className="text-sm font-medium text-red-900">Scan Error</span>
                    </div>
                    <p className="text-sm text-red-700 mt-1">{scanError}</p>
                  </div>
                )}



              </form>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Scan Info */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-3">What We Scan</h3>
              <div className="space-y-3">
                                 <div className="flex items-start space-x-3">
                   <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                   <div>
                     <p className="text-sm font-medium text-gray-900">WCAG 2.2 Compliance</p>
                    <p className="text-xs text-gray-500">Level {wcagLevel} standards selected</p>
                   </div>
                 </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Screen Reader Support</p>
                    <p className="text-xs text-gray-500">Alt text, ARIA labels</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Keyboard Navigation</p>
                    <p className="text-xs text-gray-500">Tab order, focus indicators</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Color Contrast</p>
                    <p className="text-xs text-gray-500">Text readability</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Estimated Time */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Estimated Time</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Quick Scan:</span>
                  <span className="text-sm font-medium text-gray-900">2-5 minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Full Scan:</span>
                  <span className="text-sm font-medium text-gray-900">5-15 minutes</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Deep Crawl:</span>
                  <span className="text-sm font-medium text-gray-900">15-30 minutes</span>
                </div>
              </div>
            </div>

            {/* Selected Standards */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Selected Standards</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">WCAG Level:</span>
                  <span className="text-sm font-medium text-gray-900">{wcagLevel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Standards:</span>
                  <span className="text-sm font-medium text-gray-900">{selectedTags.length}</span>
                </div>
                <div className="mt-3">
                  <p className="text-xs text-gray-500 mb-2">Selected tags:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Professional Practices */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Professional & Safe</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Respects robots.txt</p>
                    <p className="text-xs text-gray-500">Follows site crawling policies</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Rate Limited</p>
                    <p className="text-xs text-gray-500">Safe request speeds (5-20/min)</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Professional Headers</p>
                    <p className="text-xs text-gray-500">Looks like legitimate traffic</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">User Agent Rotation</p>
                    <p className="text-xs text-gray-500">Multiple browser signatures</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detailed Scan Results */}
        {scanResults.length > 0 && (
          <div className="mt-8">
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
              <div className="xl:col-span-3">
                <div className="mb-6">
                  <h2 className="text-2xl font-semibold text-gray-900 mb-2">Detailed Accessibility Report</h2>
                  <p className="text-gray-600">
                    Comprehensive analysis with specific fixes for each accessibility issue found.
                  </p>
                </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <FileText className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Pages Scanned</p>
                    <p className="text-lg font-semibold text-gray-900">{scanResults.length}</p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-red-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Total Issues</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {scanResults.reduce((total, result) => total + result.summary.total, 0)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-orange-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Critical</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {scanResults.reduce((total, result) => total + result.summary.critical, 0)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Serious</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {scanResults.reduce((total, result) => total + result.summary.serious, 0)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Moderate</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {scanResults.reduce((total, result) => total + result.summary.moderate, 0)}
                    </p>
                  </div>
                </div>
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-gray-500">Minor</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {scanResults.reduce((total, result) => total + result.summary.minor, 0)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Next Steps</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link
                  href="/scan-history"
                  className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  View All Scans
                </Link>
                <button
                  onClick={() => {
                    // Reset form for new scan
                    setUrl('')
                    setDiscoveredPages([])
                    setSelectedPages([])
                    setScanResults([])
                    setRemediationReport([])
                    setScanError(null)
                    // Note: Global scan state will be managed by new scans
                    setShowSuccessNotification(false)
                    // Scroll to top
                    window.scrollTo({ top: 0, behavior: 'smooth' })
                  }}
                  className="inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Start New Scan
                </button>
              </div>
            </div>

            {/* Collapsible Issues */}
            <div className="space-y-4">
              {remediationReport.length > 0 ? (
                // Use the real remediation report with Claude API suggestions
                remediationReport.map((report, index) => (
                  <CollapsibleIssue
                    key={index}
                    {...report}
                    scanId={currentScanId}
                    onStatusChange={(issueId: string, status: string) => {
                      // Handle status changes - could save to database
                      console.log('Issue status changed:', issueId, status)
                    }}
                  />
                ))
              ) : (
                // Fallback to scan results if no remediation report
                scanResults.map((result, resultIndex) => (
                  <div key={resultIndex} className="mb-6">
                    <div className="mb-4">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                        {result.url}
                      </h3>
                      <p className="text-sm text-gray-500">
                        Scanned on {new Date(result.timestamp).toLocaleString()}
                      </p>
                    </div>

                    {result.issues.length === 0 ? (
                      <div className="text-center py-8">
                        <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
                        <p className="text-gray-500">No accessibility issues found on this page!</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {result.issues.map((issue, issueIndex) => {
                          // Find matching AI response from remediation report
                          const matchingAIResponse = remediationReport.find((report: any) => 
                            report.issueId === issue.id
                          );

                          // Create a collapsible issue for each issue
                          const collapsibleIssue = {
                            issueId: issue.id,
                            ruleName: issue.description,
                            description: issue.description,
                            impact: issue.impact,
                            wcag22Level: 'A', // Default, could be enhanced
                            help: issue.help,
                            helpUrl: issue.helpUrl,
                            totalOccurrences: issue.nodes.length,
                            affectedUrls: [result.url],
                            offendingElements: issue.nodes.map((node: any) => ({
                              html: node.html,
                              target: node.target,
                              failureSummary: node.failureSummary,
                              impact: node.impact,
                              url: result.url
                            })),
                            suggestions: matchingAIResponse?.suggestions || [
                              {
                                type: 'fix' as const,
                                description: issue.help,
                                priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                              }
                            ],
                            priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                          };

                          return (
                            <CollapsibleIssue
                              key={`${resultIndex}-${issueIndex}`}
                              {...collapsibleIssue}
                              screenshots={result.screenshots}
                              scanId={currentScanId || ''}
                            />
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
              </div>
            </div>
          </div>
        )}

      </div>
      
      {/* User-friendly Modals */}
      <AlertModal
        isOpen={modalState.isOpen && !modalState.onConfirm}
        onClose={closeModal}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
      <ConfirmationModal
        isOpen={modalState.isOpen && !!modalState.onConfirm}
        onClose={closeModal}
        onConfirm={handleConfirm}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        isLoading={modalState.isLoading}
      />
    </Sidebar>
  )
}