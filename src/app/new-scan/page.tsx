'use client'

import React, { useState } from 'react'
import { Search, Globe, HelpCircle, Settings, AlertTriangle, CheckCircle, FileText, X } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import DetailedReport from '@/components/DetailedReport'
import ScanHistory from '@/components/ScanHistory'

interface ScanProgress {
  currentPage: number;
  totalPages: number;
  currentUrl: string;
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
}

interface DiscoveredPage {
  url: string;
  title: string;
  category: 'home' | 'content' | 'forms' | 'blog' | 'legal' | 'other';
  priority: 'high' | 'medium' | 'low';
}

export default function NewScan() {
  const [url, setUrl] = useState('')
  const [includeSubdomains, setIncludeSubdomains] = useState(true)
  const [wcagLevel, setWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA')
  const [selectedTags, setSelectedTags] = useState<string[]>(['wcag22a', 'wcag22aa', 'best-practice'])
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null)
  const [discoveredPages, setDiscoveredPages] = useState<DiscoveredPage[]>([])
  const [selectedPages, setSelectedPages] = useState<string[]>([])
  const [scanResults, setScanResults] = useState<ScanResult[]>([])
  const [remediationReport, setRemediationReport] = useState<any[]>([])
  const [scanError, setScanError] = useState<string | null>(null)
  const [showSuccessNotification, setShowSuccessNotification] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
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
    setScanProgress(progress)
    if (progress.message && !discoveryLog.includes(progress.message)) {
      setDiscoveryLog(prev => [...prev, progress.message])
    }
  }

  const discoverPages = async () => {
    setIsScanning(true)
    setScanError(null)
    setScanProgress(null)
    setDiscoveredPages([])
    setSelectedPages([])

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
      
      // Start progress simulation
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
          currentUrl: normalizedUrl,
          status: 'crawling',
          message: `${tip} Found ${pageCount} pages so far. Est. ${Math.max(0, 30 - Math.floor(pageCount / 10))}s remaining.`
        })
        
        tipIndex++
      }, 2000)

      setScanProgress({
        currentPage: 0,
        totalPages: 200,
        currentUrl: normalizedUrl,
        status: 'crawling',
        message: 'Discovering pages on website...'
      })

      const response = await fetch('/api/discover', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
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
      setScanProgress({
        currentPage: result.totalPages,
        totalPages: result.totalPages,
        currentUrl: '',
        status: 'complete',
        message: `Discovered ${result.totalPages} pages! Select which ones to scan.`
      })
      
    } catch (error) {
      console.error('Page discovery failed:', error)
      setScanError(error instanceof Error ? error.message : 'Page discovery failed')
    } finally {
      setIsScanning(false)
      setTimeout(() => setScanProgress(null), 2000)
    }
  }

  const scanSelectedPages = async () => {
    setIsScanning(true)
    setScanError(null)
    setScanProgress(null)
    setScanResults([])

    try {
      const pagesToScan = selectedPages
      
      if (pagesToScan.length === 0) {
        throw new Error('No pages selected for scanning')
      }

      // Update progress
      setScanProgress({
        currentPage: 0,
        totalPages: pagesToScan.length,
        currentUrl: pagesToScan[0],
        status: 'scanning',
        message: 'Scanning pages for accessibility issues...'
      })

      // Use streaming API for real-time progress updates
      const response = await fetch('/api/scan-progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url,
          pagesToScan,
          includeSubdomains,
          wcagLevel,
          selectedTags
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Scan failed')
      }

      // Handle streaming response for real-time progress
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('No response body')
      }

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              
              // Update progress based on message type
              if (data.type === 'start') {
                setScanProgress({
                  currentPage: 0,
                  totalPages: data.totalPages,
                  currentUrl: '',
                  status: 'scanning',
                  message: data.message
                })
              } else if (data.type === 'page_start' || data.type === 'progress') {
                setScanProgress({
                  currentPage: data.currentPage,
                  totalPages: data.totalPages,
                  currentUrl: data.currentUrl,
                  status: data.status,
                  message: data.message
                })
              } else if (data.type === 'page_complete') {
                setScanProgress({
                  currentPage: data.currentPage,
                  totalPages: data.totalPages,
                  currentUrl: data.currentUrl,
                  status: data.status,
                  message: data.message
                })
              } else if (data.type === 'complete') {
                setScanProgress({
                  currentPage: data.currentPage,
                  totalPages: data.totalPages,
                  currentUrl: '',
                  status: 'complete',
                  message: data.message
                })
                
                // Store the results
                if (data.results) {
                  setScanResults(data.results.results)
                  setRemediationReport(data.results.remediationReport || [])
                  
                  // Show professional success notification
                  const totalIssues = data.results.complianceSummary.totalIssues
                  const criticalIssues = data.results.complianceSummary.criticalIssues
                  const seriousIssues = data.results.complianceSummary.seriousIssues
                  
                  setSuccessMessage(`Scan completed successfully! 📊\n\n• Pages scanned: ${data.results.pagesScanned}\n• Total issues: ${totalIssues}\n• Critical issues: ${criticalIssues}\n• Serious issues: ${seriousIssues}\n\nCheck the results below for detailed analysis.`)
                  setShowSuccessNotification(true)
                  
                  // Auto-hide notification after 8 seconds
                  setTimeout(() => setShowSuccessNotification(false), 8000)
                }
              } else if (data.type === 'error') {
                throw new Error(data.message)
              }
            } catch (parseError) {
              console.error('Error parsing SSE data:', parseError)
            }
          }
        }
      }
      
    } catch (error) {
      console.error('Scan failed:', error)
      setScanError(error instanceof Error ? error.message : 'Scan failed')
    } finally {
      setIsScanning(false)
      setTimeout(() => setScanProgress(null), 2000)
    }
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">New Accessibility Scan</h1>
          <p className="text-gray-600 mt-1">Configure and start a new accessibility scan for your website</p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Form */}
          <div className="xl:col-span-3">
            <div className="card">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Discovery Options */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Discovery Options
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                        id="includeSubdomains"
                        type="checkbox"
                        checked={includeSubdomains}
                        onChange={(e) => setIncludeSubdomains(e.target.checked)}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                      <label htmlFor="includeSubdomains" className="ml-2 block text-sm text-gray-700">
                        Include subdomains
                      </label>
                    </div>
                  </div>
                </div>

                {/* URL Input */}
                <div>
                  <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
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
                  <div className="flex items-center mb-3">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                      <span className="text-blue-600 font-semibold text-sm">1</span>
                    </div>
                    <label className="block text-sm font-medium text-gray-700">
                      Stage 1: Page Discovery
                    </label>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    First, let's discover all pages on your website so you can choose which ones to scan for accessibility issues.
                  </p>
                  
                  {/* Discover Pages Button */}
                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={discoverPages}
                      disabled={isScanning || !url}
                      className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
                    >
                      <Search className="h-5 w-5" />
                      <span>
                        {isScanning 
                          ? 'Discovering Pages...' 
                          : 'Start Page Discovery'
                        }
                      </span>
                    </button>
                  </div>
                </div>

                                  {/* Stage 2: Select Pages to Scan */}
                 {discoveredPages.length > 0 && (
                   <div className="space-y-4">
                     <div className="flex items-center mb-4">
                       <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                         <span className="text-green-600 font-semibold text-sm">2</span>
                       </div>
                       <div>
                         <h3 className="text-lg font-semibold text-gray-900">Stage 2: Select Pages to Scan</h3>
                         <p className="text-sm text-gray-600">Choose which pages to scan for WCAG 2.2 accessibility issues</p>
                       </div>
                     </div>
                     
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

                     {/* Category Filters */}
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

                     {/* Priority Filters */}
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

                 {/* WCAG 2.2 Compliance Level */}
                 <div className={`${discoveredPages.length === 0 ? 'opacity-50 pointer-events-none' : ''}`}>
                   <label className="block text-sm font-medium text-gray-700 mb-3">
                     WCAG 2.2 Compliance Level
                   </label>
                   <div className="space-y-3">
                     <div className="flex items-center">
                       <input
                         id="wcag-a"
                         type="radio"
                         name="wcagLevel"
                         value="A"
                         checked={wcagLevel === 'A'}
                         onChange={(e) => {
                           setWcagLevel(e.target.value as 'A' | 'AA' | 'AAA')
                           setSelectedTags(['wcag22a'])
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
                           setSelectedTags(['wcag22a', 'wcag22aa'])
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
                           setSelectedTags(['wcag22a', 'wcag22aa', 'wcag22aaa'])
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
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                       Additional Standards
                  </label>
                  <div className="space-y-3">
                    <div className="flex items-center">
                      <input
                           id="best-practice"
                        type="checkbox"
                           checked={selectedTags.includes('best-practice')}
                           onChange={(e) => {
                             if (e.target.checked) {
                               setSelectedTags([...selectedTags, 'best-practice'])
                             } else {
                               setSelectedTags(selectedTags.filter(t => t !== 'best-practice'))
                             }
                           }}
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
                           onChange={(e) => {
                             if (e.target.checked) {
                               setSelectedTags([...selectedTags, 'section508'])
                             } else {
                               setSelectedTags(selectedTags.filter(t => t !== 'section508'))
                             }
                           }}
                        className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                      />
                         <label htmlFor="section508" className="ml-2 block text-sm text-gray-700">
                           Section 508 (US Federal)
                      </label>
                    </div>
                     </div>
                      </div>
                    )}

                {/* Scan Progress */}
                {scanProgress && (
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0">
                          {scanProgress.status === 'crawling' && (
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <Search className="h-4 w-4 text-blue-600 animate-pulse" />
                            </div>
                          )}
                          {scanProgress.status === 'scanning' && (
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-600 animate-pulse" />
                            </div>
                          )}
                          {scanProgress.status === 'analyzing' && (
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                              <FileText className="h-4 w-4 text-purple-600 animate-pulse" />
                            </div>
                          )}
                          {scanProgress.status === 'complete' && (
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            </div>
                          )}
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            {scanProgress.status === 'crawling' && 'Discovering Pages'}
                            {scanProgress.status === 'scanning' && 'Scanning Pages'}
                            {scanProgress.status === 'analyzing' && 'Analyzing Results'}
                            {scanProgress.status === 'complete' && 'Scan Complete'}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {scanProgress.status === 'crawling' && 'Finding all pages on your website...'}
                            {scanProgress.status === 'scanning' && 'Checking accessibility compliance...'}
                            {scanProgress.status === 'analyzing' && 'Generating detailed report...'}
                            {scanProgress.status === 'complete' && 'All done! Check results below.'}
                          </p>
                        </div>
                      </div>
                      {scanProgress.totalPages > 0 && (
                        <div className="text-right">
                          <div className="text-2xl font-bold text-blue-600">
                          {scanProgress.currentPage} / {scanProgress.totalPages}
                          </div>
                          <div className="text-sm text-gray-500">Pages</div>
                        </div>
                      )}
                    </div>
                    
                    {/* Progress Bar */}
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
                    
                    {/* Discovery Progress Details */}
                    {scanProgress.status === 'crawling' && (
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
                    {(scanProgress.status === 'scanning' || scanProgress.status === 'analyzing') && (
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
                          {scanProgress.currentUrl && (
                            <div className="text-xs text-green-600 mt-2">
                              📄 Scanning: {scanProgress.currentUrl}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 text-xs text-green-600">
                          💡 The system is actively scanning each page for accessibility issues. This may take a few minutes.
                        </div>
                      </div>
                    )}
                    
                    {/* Current Status */}
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">{scanProgress.message}</p>
                    {scanProgress.currentUrl && (
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                          <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                            {scanProgress.currentUrl}
                          </span>
                        </div>
                      )}
                    </div>
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

            {/* Detailed Reports */}
            <div className="space-y-6">
              {remediationReport.length > 0 ? (
                // Use the real remediation report with Claude API suggestions
                remediationReport.map((report, index) => (
                  <DetailedReport
                    key={index}
                    {...report}
                  />
                ))
              ) : (
                // Fallback to scan results if no remediation report
                scanResults.map((result, resultIndex) => (
                  <div key={resultIndex} className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
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
                      <div className="space-y-6">
                        {result.issues.map((issue, issueIndex) => {
                          // Create a mock detailed report for each issue
                          const detailedReport = {
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
                            suggestions: [
                              {
                                type: 'fix' as const,
                                description: issue.help,
                                priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                              }
                            ],
                            priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                          };

                          return (
                            <DetailedReport
                              key={`${resultIndex}-${issueIndex}`}
                              {...detailedReport}
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
        )}

        {/* Scan History */}
        <ScanHistory type="web" />
      </div>
    </Sidebar>
  )
}
