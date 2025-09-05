'use client'

import { useState, useEffect } from 'react'
import { FileText, Globe, AlertTriangle, CheckCircle, Clock, RefreshCw } from 'lucide-react'

interface ScanHistoryProps {
  type?: 'all' | 'web' | 'document'
  className?: string
}

interface ScanRecord {
  id: string
  type: 'web' | 'document'
  fileName?: string
  url?: string
  fileType?: string
  fileSize?: number
  scanDate: string
  status: 'completed' | 'scanning' | 'cancelled' | 'error'
  is508Compliant?: boolean
  wcag22Compliance?: {
    levelA: boolean
    levelAA: boolean
    levelAAA: boolean
  }
  scanResults?: {
    summary?: {
      total: number
      critical: number
      serious: number
      moderate: number
      minor: number
    }
  }
  scanDuration?: number
  pagesAnalyzed?: number
  overallScore?: number
  scanId: string
}

export default function ScanHistory({ type = 'all', className = '' }: ScanHistoryProps) {
  const [scanHistory, setScanHistory] = useState<ScanRecord[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  // Load scan history from database
  const loadScanHistory = async () => {
    setIsLoadingHistory(true)
    try {
      // Load document scans
      const docResponse = await fetch('/api/document-scan')
      const docHistory = await docResponse.json()
      const docScans = (docHistory.scans || []).map((scan: any) => ({
        ...scan,
        type: 'document' as const
      }))

      // Load web scans (when API is available)
      const webResponse = await fetch('/api/web-scan')
      let webScans: ScanRecord[] = []
      if (webResponse.ok) {
        const webHistory = await webResponse.json()
        webScans = (webHistory.scans || []).map((scan: any) => ({
          ...scan,
          type: 'web' as const
        }))
      }

      // Combine and filter based on type
      let allScans = [...docScans, ...webScans]
      if (type !== 'all') {
        allScans = allScans.filter(scan => scan.type === type)
      }

      // Sort by date (newest first)
      allScans.sort((a, b) => new Date(b.scanDate).getTime() - new Date(a.scanDate).getTime())
      
      setScanHistory(allScans)
    } catch (error) {
      console.error('Failed to load scan history:', error)
      setScanHistory([])
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Load history on component mount
  useEffect(() => {
    loadScanHistory()
  }, [type])

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const getScanIcon = (scan: ScanRecord) => {
    if (scan.type === 'web') {
      return <Globe className="h-5 w-5 text-blue-600" />
    }
    return <FileText className="h-5 w-5 text-gray-400" />
  }

  const getComplianceStatus = (scan: ScanRecord) => {
    if (scan.type === 'web' && scan.wcag22Compliance) {
      if (scan.wcag22Compliance.levelAAA) return { text: 'WCAG 2.2 AAA', color: 'bg-green-100 text-green-800' }
      if (scan.wcag22Compliance.levelAA) return { text: 'WCAG 2.2 AA', color: 'bg-blue-100 text-blue-800' }
      if (scan.wcag22Compliance.levelA) return { text: 'WCAG 2.2 A', color: 'bg-yellow-100 text-yellow-800' }
      return { text: 'Non-Compliant', color: 'bg-red-100 text-red-800' }
    }
    
    if (scan.type === 'document' && scan.is508Compliant !== undefined) {
      return scan.is508Compliant 
        ? { text: '508 Compliant', color: 'bg-green-100 text-green-800' }
        : { text: 'Non-Compliant', color: 'bg-red-100 text-red-800' }
    }
    
    return null
  }

  return (
    <div id="scan-history-section" className={`card ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">
          {type === 'all' ? 'All Scan History' : 
           type === 'web' ? 'Web Scan History' : 'Document Scan History'}
        </h3>
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
              <p className="text-sm">
                {type === 'all' ? 'Start a web or document scan to see history here' :
                 type === 'web' ? 'Start a web scan to see history here' :
                 'Upload a document to see scan history here'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {scanHistory.map((scan) => (
                <div key={scan.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {getScanIcon(scan)}
                      <div>
                        <p className="font-medium text-gray-900">
                          {scan.type === 'web' ? scan.url : scan.fileName}
                        </p>
                        <p className="text-sm text-gray-500">
                          {new Date(scan.scanDate).toLocaleDateString()} • {scan.type === 'web' ? 'Web Scan' : `${scan.fileType} • ${formatFileSize(scan.fileSize || 0)}`}
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
                      {getComplianceStatus(scan) && (
                        <div className={`px-2 py-1 text-xs rounded-full ${getComplianceStatus(scan)?.color}`}>
                          {getComplianceStatus(scan)?.text}
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
  )
}
