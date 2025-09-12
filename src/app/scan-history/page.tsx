'use client'

import { useState, useEffect } from 'react'
import { 
  History, 
  Globe, 
  FileText, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Clock,
  Trash2,
  Eye,
  ExternalLink
} from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'

interface ScanHistoryItem {
  id: string
  scanType: 'web' | 'document'
  scanTitle: string
  url?: string
  fileName?: string
  fileType?: string
  totalIssues: number
  criticalIssues: number
  seriousIssues: number
  moderateIssues: number
  minorIssues: number
  pagesScanned?: number
  pagesAnalyzed?: number
  overallScore?: number
  is508Compliant?: boolean
  scanDurationSeconds?: number
  createdAt: string
  updatedAt: string
}

export default function ScanHistory() {
  return (
    <ProtectedRoute>
      <ScanHistoryContent />
    </ProtectedRoute>
  )
}

function ScanHistoryContent() {
  const [scans, setScans] = useState<ScanHistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  useEffect(() => {
    loadScanHistory()
  }, [])

  const loadScanHistory = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setError('Authentication required')
        setLoading(false)
        return
      }

      const response = await fetch('/api/scan-history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Your session has expired. Please log in again.')
          // Redirect to login after a short delay
          setTimeout(() => {
            localStorage.removeItem('accessToken')
            localStorage.removeItem('user')
            window.location.href = '/login'
          }, 2000)
          return
        } else if (response.status === 503) {
          setError('Service temporarily unavailable. Please try again in a moment.')
          return
        }
      }
      
      const data = await response.json()
      
      if (data.success) {
        setScans(data.scans)
      } else {
        // Show user-friendly error message
        let errorMessage = data.error || 'Failed to load scan history'
        
        if (data.error?.includes('table not found')) {
          errorMessage = 'Scan history feature is being set up. Please try again in a moment.'
        } else if (data.error?.includes('connection')) {
          errorMessage = 'Unable to connect to the server. Please check your internet connection and try again.'
        }
        
        setError(errorMessage)
      }
    } catch (error) {
      console.error('Error loading scan history:', error)
      setError('Failed to load scan history')
    } finally {
      setLoading(false)
    }
  }

  const deleteScan = async (scanId: string) => {
    if (!confirm('Are you sure you want to delete this scan? This action cannot be undone.')) {
      return
    }

    setDeletingId(scanId)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        alert('Authentication required')
        return
      }

      const response = await fetch('/api/scan-history', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scanId })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setScans(scans.filter(scan => scan.id !== scanId))
      } else {
        alert(data.error || 'Failed to delete scan')
      }
    } catch (error) {
      console.error('Error deleting scan:', error)
      alert('Failed to delete scan')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-100'
      case 'serious': return 'text-orange-600 bg-orange-100'
      case 'moderate': return 'text-yellow-600 bg-yellow-100'
      case 'minor': return 'text-blue-600 bg-blue-100'
      default: return 'text-gray-600 bg-gray-100'
    }
  }

  const getScanIcon = (scanType: string) => {
    return scanType === 'web' ? Globe : FileText
  }

  const getComplianceStatus = (scan: ScanHistoryItem) => {
    if (scan.scanType === 'document' && scan.is508Compliant !== undefined) {
      return scan.is508Compliant ? (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="h-3 w-3 mr-1" />
          508 Compliant
        </span>
      ) : (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Non-Compliant
        </span>
      )
    }
    return null
  }

  if (loading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading scan history...</p>
          </div>
        </div>
      </Sidebar>
    )
  }

  if (error) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center h-64">
          <div className="text-center max-w-md">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Unable to Load Scan History</h3>
            <p className="text-red-600 mb-4">{error}</p>
            <div className="space-x-4">
              <button
                onClick={loadScanHistory}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Try Again
              </button>
              <Link
                href="/new-scan"
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                Start New Scan
              </Link>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              If this problem persists, please contact support.
            </p>
          </div>
        </div>
      </Sidebar>
    )
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <History className="h-6 w-6 mr-3" />
              Scan History
            </h1>
            <p className="text-gray-600 mt-1">
              View and manage your completed accessibility scans
            </p>
          </div>
          <div className="text-sm text-gray-500">
            {scans.length} scan{scans.length !== 1 ? 's' : ''} total
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <Globe className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Web Scans</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scans.filter(s => s.scanType === 'web').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Document Scans</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scans.filter(s => s.scanType === 'document').length}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Issues</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scans.reduce((sum, s) => sum + s.totalIssues, 0)}
                </p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Compliant Scans</p>
                <p className="text-2xl font-bold text-gray-900">
                  {scans.filter(s => s.scanType === 'document' && s.is508Compliant === true).length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scan List */}
        {scans.length === 0 ? (
          <div className="text-center py-12">
            <History className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No scans yet</h3>
            <p className="text-gray-500 mb-6">
              Start your first accessibility scan to see results here
            </p>
            <div className="space-x-4">
              <Link
                href="/new-scan"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <Globe className="h-4 w-4 mr-2" />
                Web Scan
              </Link>
              <Link
                href="/document-scan"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                Document Scan
              </Link>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-medium text-gray-900">Recent Scans</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {scans.map((scan) => {
                const IconComponent = getScanIcon(scan.scanType)
                return (
                  <div key={scan.id} className="p-6 hover:bg-gray-50">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="flex-shrink-0">
                          <div className={`p-2 rounded-lg ${
                            scan.scanType === 'web' ? 'bg-blue-100' : 'bg-green-100'
                          }`}>
                            <IconComponent className={`h-5 w-5 ${
                              scan.scanType === 'web' ? 'text-blue-600' : 'text-green-600'
                            }`} />
                          </div>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="text-lg font-medium text-gray-900 truncate">
                              {scan.scanTitle}
                            </h3>
                            {getComplianceStatus(scan)}
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-gray-500 mb-3">
                            <div className="flex items-center">
                              <Calendar className="h-4 w-4 mr-1" />
                              {formatDate(scan.createdAt)}
                            </div>
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1" />
                              {formatDuration(scan.scanDurationSeconds)}
                            </div>
                            {scan.scanType === 'web' && scan.pagesScanned && (
                              <div className="flex items-center">
                                <Globe className="h-4 w-4 mr-1" />
                                {scan.pagesScanned} page{scan.pagesScanned !== 1 ? 's' : ''}
                              </div>
                            )}
                            {scan.scanType === 'document' && scan.pagesAnalyzed && (
                              <div className="flex items-center">
                                <FileText className="h-4 w-4 mr-1" />
                                {scan.pagesAnalyzed} page{scan.pagesAnalyzed !== 1 ? 's' : ''}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              <span className="text-sm font-medium text-gray-700">Issues:</span>
                              <span className="text-sm text-gray-600">{scan.totalIssues}</span>
                            </div>
                            
                            {scan.criticalIssues > 0 && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor('critical')}`}>
                                {scan.criticalIssues} Critical
                              </span>
                            )}
                            {scan.seriousIssues > 0 && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor('serious')}`}>
                                {scan.seriousIssues} Serious
                              </span>
                            )}
                            {scan.moderateIssues > 0 && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor('moderate')}`}>
                                {scan.moderateIssues} Moderate
                              </span>
                            )}
                            {scan.minorIssues > 0 && (
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getSeverityColor('minor')}`}>
                                {scan.minorIssues} Minor
                              </span>
                            )}
                          </div>
                          
                          {scan.overallScore && (
                            <div className="mt-2">
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                Score: {scan.overallScore}/100
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/scan-history/${scan.id}`}
                          className="inline-flex items-center px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Link>
                        <button
                          onClick={() => deleteScan(scan.id)}
                          disabled={deletingId === scan.id}
                          className="inline-flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-800 disabled:opacity-50"
                        >
                          {deletingId === scan.id ? (
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                          ) : (
                            <Trash2 className="h-4 w-4 mr-1" />
                          )}
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Sidebar>
  )
}
