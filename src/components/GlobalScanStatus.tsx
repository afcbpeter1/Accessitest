'use client'

import React from 'react'
import { useScan } from '@/contexts/ScanContext'
import { 
  Loader2, 
  CheckCircle, 
  AlertTriangle, 
  FileText, 
  Globe, 
  Clock,
  X
} from 'lucide-react'
import Link from 'next/link'

export default function GlobalScanStatus() {
  const { activeScans, removeScan, isAnyScanActive } = useScan()

  if (!isAnyScanActive) {
    return null
  }

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {activeScans.map((scan) => {
        const getStatusIcon = () => {
          switch (scan.status) {
            case 'crawling':
            case 'scanning':
            case 'analyzing':
              return <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            case 'complete':
              return <CheckCircle className="h-4 w-4 text-green-600" />
            case 'error':
              return <AlertTriangle className="h-4 w-4 text-red-600" />
            default:
              return <Clock className="h-4 w-4 text-gray-600" />
          }
        }

        const getStatusText = () => {
          switch (scan.status) {
            case 'crawling':
              return 'Discovering Pages'
            case 'scanning':
              return 'Scanning Pages'
            case 'analyzing':
              return 'Analyzing Results'
            case 'complete':
              return 'Scan Complete'
            case 'error':
              return 'Scan Failed'
            default:
              return 'Preparing Scan'
          }
        }

        const getProgressText = () => {
          if (scan.status === 'complete' || scan.status === 'error') {
            return scan.message || 'All done!'
          }
          
          if (scan.totalPages > 0) {
            return `${scan.currentPage} / ${scan.totalPages} pages`
          }
          
          return scan.message || 'Processing...'
        }

        const getScanTitle = () => {
          if (scan.type === 'document' && scan.fileName) {
            return `Document: ${scan.fileName}`
          }
          if (scan.type === 'web' && scan.url) {
            return `Website: ${new URL(scan.url).hostname}`
          }
          return `${scan.type === 'document' ? 'Document' : 'Web'} Scan`
        }

        const getScanIcon = () => {
          return scan.type === 'document' ? 
            <FileText className="h-4 w-4" /> : 
            <Globe className="h-4 w-4" />
        }

        const getProgressPercentage = () => {
          if (scan.status === 'complete' || scan.status === 'error') {
            return 100
          }
          if (scan.totalPages > 0) {
            return Math.round((scan.currentPage / scan.totalPages) * 100)
          }
          return 0
        }

        return (
          <div 
            key={scan.scanId}
            className="bg-white rounded-lg shadow-lg border border-gray-200 p-4 animate-in slide-in-from-right-2"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center space-x-2">
                {getScanIcon()}
                <div>
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {getScanTitle()}
                  </h4>
                  <div className="flex items-center space-x-2 mt-1">
                    {getStatusIcon()}
                    <span className="text-xs text-gray-600">
                      {getStatusText()}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => removeScan(scan.scanId)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  scan.status === 'complete' ? 'bg-green-500' :
                  scan.status === 'error' ? 'bg-red-500' :
                  'bg-blue-500'
                }`}
                style={{ width: `${getProgressPercentage()}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{getProgressText()}</span>
              {scan.status === 'complete' && (
                <Link 
                  href="/scan-history"
                  className="text-blue-600 hover:text-blue-800 font-medium"
                >
                  View Results
                </Link>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
