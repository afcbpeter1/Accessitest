'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { 
  ArrowLeft, 
  Globe, 
  FileText, 
  Calendar, 
  Clock,
  AlertTriangle, 
  CheckCircle,
  Download,
  ExternalLink,
  RotateCcw,
  Repeat,
  Settings
} from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'
import { AlertModal } from '@/components/AccessibleModal'
import { useModal } from '@/hooks/useModal'
import DetailedReport from '@/components/DetailedReport'
import CollapsibleIssue from '@/components/CollapsibleIssue'

interface ScanHistoryDetails {
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
  scanResults: any
  complianceSummary: any
  remediationReport: any
}

export default function ScanDetails() {
  return (
    <ProtectedRoute>
      <ScanDetailsContent />
    </ProtectedRoute>
  )
}

function ScanDetailsContent() {
  const params = useParams()
  const router = useRouter()
  const [scan, setScan] = useState<ScanHistoryDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPeriodicModal, setShowPeriodicModal] = useState(false)
  const [rerunning, setRerunning] = useState(false)
  
  // Modal management
  const { modalState, showAlert, closeModal } = useModal()

  useEffect(() => {
    if (params.id) {
      loadScanDetails(params.id as string)
    }
  }, [params.id])

  const loadScanDetails = async (scanId: string) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setError('Authentication required')
        setLoading(false)
        return
      }

      const response = await fetch(`/api/scan-history?scanId=${scanId}`, {
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
        } else if (response.status === 404) {
          setError('Scan not found')
          return
        }
      }
      
      const data = await response.json()
      
      if (data.success) {
        console.log('🔍 Scan data received:', data.scan)
        console.log('🔍 Scan results structure:', JSON.stringify(data.scan.scanResults, null, 2))
        console.log('🔍 Compliance summary structure:', JSON.stringify(data.scan.complianceSummary, null, 2))
        console.log('🔍 Remediation report structure:', JSON.stringify(data.scan.remediationReport, null, 2))
        setScan(data.scan)
      } else {
        setError(data.error || 'Scan not found')
      }
    } catch (error) {
      console.error('Error loading scan details:', error)
      setError('Failed to load scan details')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A'
    if (seconds < 60) return `${seconds} seconds`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes} minute${minutes !== 1 ? 's' : ''} ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`
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

  const handleRerunScan = async () => {
    if (!scan) return
    
    setRerunning(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setError('Authentication required')
        return
      }

      const response = await fetch('/api/rerun-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ scanId: scan.id })
      })

      const data = await response.json()
      
      if (response.status === 402) {
        // Insufficient credits - show popup with payment page redirect
        showAlert(
          'Insufficient Credits',
          'You don\'t have enough credits to run this scan. Please purchase more credits to continue.',
          'warning'
        )
        setTimeout(() => {
          router.push('/pricing')
        }, 2000)
        return
      }
      
      if (data.success) {
        if (data.scanType === 'web') {
          // Navigate to new scan page with pre-filled settings
          const settings = new URLSearchParams({
            url: data.settings.url,
            pagesToScan: JSON.stringify(data.settings.pagesToScan),
            includeSubdomains: data.settings.includeSubdomains.toString(),
            wcagLevel: data.settings.wcagLevel,
            selectedTags: JSON.stringify(data.settings.selectedTags)
          })
          router.push(`/new-scan?${settings.toString()}`)
        } else {
          // For document scans, navigate to document scan page
          router.push('/document-scan')
        }
      } else {
        setError(data.error || 'Failed to rerun scan')
      }
    } catch (error) {
      console.error('Error rerunning scan:', error)
      setError('Failed to rerun scan')
    } finally {
      setRerunning(false)
    }
  }

  const handleCreatePeriodicScan = async (frequency: string, scanTitle: string) => {
    if (!scan) return
    
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setError('Authentication required')
        return
      }

      // Calculate next run time based on frequency
      const now = new Date()
      let nextRunAt: Date
      
      switch (frequency) {
        case 'daily':
          nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          break
        case 'weekly':
          nextRunAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          break
        case 'monthly':
          nextRunAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          break
        default:
          nextRunAt = new Date(now.getTime() + 24 * 60 * 60 * 1000)
      }

      // Extract scan settings from the current scan
      const scanSettings = {
        wcagLevel: 'AA', // Default, could be enhanced to store actual settings
        selectedTags: ['wcag22a', 'wcag22aa'],
        pagesToScan: scan.url ? [scan.url] : [],
        includeSubdomains: true
      }

      const response = await fetch('/api/periodic-scans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          scanType: scan.scanType,
          scanTitle: scanTitle || scan.scanTitle,
          url: scan.url,
          fileName: scan.fileName,
          fileType: scan.fileType,
          scanSettings,
          frequency,
          nextRunAt: nextRunAt.toISOString()
        })
      })

      const data = await response.json()
      
      if (data.success) {
        setShowPeriodicModal(false)
        showAlert('Periodic Scan Scheduled', 'Your periodic scan has been successfully scheduled!', 'success')
      } else {
        setError(data.error || 'Failed to create periodic scan')
      }
    } catch (error) {
      console.error('Error creating periodic scan:', error)
      setError('Failed to create periodic scan')
    }
  }

  if (loading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading scan details...</p>
          </div>
        </div>
      </Sidebar>
    )
  }

  if (error || !scan) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <p className="text-red-600 mb-4">{error || 'Scan not found'}</p>
            <Link
              href="/scan-history"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to History
            </Link>
          </div>
        </div>
      </Sidebar>
    )
  }

  const IconComponent = getScanIcon(scan.scanType)

  return (
    <Sidebar>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/scan-history"
              className="inline-flex items-center text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back to History
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <div className={`p-2 rounded-lg mr-3 ${
                  scan.scanType === 'web' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  <IconComponent className={`h-6 w-6 ${
                    scan.scanType === 'web' ? 'text-blue-600' : 'text-green-600'
                  }`} />
                </div>
                {scan.scanTitle}
              </h1>
              <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
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
                    {scan.pagesScanned} page{scan.pagesScanned !== 1 ? 's' : ''} scanned
                  </div>
                )}
                {scan.scanType === 'document' && scan.pagesAnalyzed && (
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    {scan.pagesAnalyzed} page{scan.pagesAnalyzed !== 1 ? 's' : ''} analyzed
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRerunScan}
              disabled={rerunning}
              className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {rerunning ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <RotateCcw className="h-4 w-4 mr-2" />
              )}
              {rerunning ? 'Rerunning...' : 'Rerun Scan'}
            </button>
            
            <button
              onClick={() => setShowPeriodicModal(true)}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
            >
              <Repeat className="h-4 w-4 mr-2" />
              Schedule Recurring
            </button>
            
            {scan.url && (
              <a
                href={scan.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Visit Site
              </a>
            )}
          </div>
        </div>

        {/* Compliance Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-2">Compliance Status</h2>
              <div className="flex items-center space-x-4">
                {scan.scanType === 'document' && scan.is508Compliant !== undefined ? (
                  scan.is508Compliant ? (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Section 508 Compliant
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                      <AlertTriangle className="h-4 w-4 mr-2" />
                      Section 508 Non-Compliant
                    </span>
                  )
                ) : (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    <Globe className="h-4 w-4 mr-2" />
                    WCAG 2.2 Analysis
                  </span>
                )}
                
                {scan.overallScore && (
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    Score: {scan.overallScore}/100
                  </span>
                )}
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{scan.totalIssues}</div>
              <div className="text-sm text-gray-500">Total Issues</div>
            </div>
          </div>
        </div>

        {/* Issue Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Critical</p>
                <p className="text-2xl font-bold text-red-600">{scan.criticalIssues}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Serious</p>
                <p className="text-2xl font-bold text-orange-600">{scan.seriousIssues}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Moderate</p>
                <p className="text-2xl font-bold text-yellow-600">{scan.moderateIssues}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Minor</p>
                <p className="text-2xl font-bold text-blue-600">{scan.minorIssues}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Container */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
          <div className="xl:col-span-3">
            {/* Scan Results */}
            <div className="bg-white rounded-lg border border-gray-200">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">Accessibility Issues</h3>
                {(() => {
                  // Handle different data structures for scan results
                  let scanResults = []
                  
                  if (scan.scanResults) {
                    if (Array.isArray(scan.scanResults)) {
                      scanResults = scan.scanResults
                    } else if (scan.scanResults.results && Array.isArray(scan.scanResults.results)) {
                      scanResults = scan.scanResults.results
                    }
                  }
                  
                  console.log('🔍 Processed scan results:', scanResults)
                  
                  if (scanResults.length === 0) {
                    return (
                      <div className="text-center py-8">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Issues Found</h3>
                        <p className="text-gray-500">
                          Great! No accessibility issues were detected in this scan.
                        </p>
                      </div>
                    )
                  }
                  
                  return (
                    <div className="space-y-8">
                      {scanResults.map((result: any, resultIndex: number) => (
                        <div key={resultIndex} className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                          <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h4 className="text-lg font-semibold text-gray-900 mb-1">
                                  {result.url || scan.url || 'Scan Result'}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  Scanned on {new Date(scan.createdAt).toLocaleString()}
                                </p>
                              </div>
                              {result.issues && result.issues.length > 0 && (
                                <div className="text-right">
                                  <div className="text-2xl font-bold text-gray-900">{result.issues.length}</div>
                                  <div className="text-sm text-gray-500">Issues Found</div>
                                </div>
                              )}
                            </div>
                          </div>

                          {result.issues && result.issues.length === 0 ? (
                            <div className="text-center py-8">
                              <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
                              <p className="text-gray-500">No accessibility issues found on this page!</p>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {result.issues && result.issues.map((issue: any, issueIndex: number) => {
                                // Find matching AI response from remediation report
                                const matchingAIResponse = scan.remediationReport?.find((report: any) => 
                                  report.issueId === (issue.id || `issue-${resultIndex}-${issueIndex}`)
                                );

                                // Create a collapsible issue for each issue
                                const collapsibleIssue = {
                                  issueId: issue.id || `issue-${resultIndex}-${issueIndex}`,
                                  ruleName: issue.description || issue.help || 'Accessibility Issue',
                                  description: issue.description || issue.help || 'No description available',
                                  impact: issue.impact || 'minor',
                                  wcag22Level: 'A', // Default, could be enhanced
                                  help: issue.help || issue.description || '',
                                  helpUrl: issue.helpUrl || '',
                                  totalOccurrences: issue.nodes?.length || 1,
                                  affectedUrls: [result.url || scan.url || ''],
                                  offendingElements: (issue.nodes || []).map((node: any) => ({
                                    html: node.html || '',
                                    target: node.target || [],
                                    failureSummary: node.failureSummary || '',
                                    impact: node.impact || issue.impact || 'minor',
                                    url: result.url || scan.url || ''
                                  })),
                                  suggestions: matchingAIResponse?.suggestions || [
                                    {
                                      type: 'fix' as const,
                                      description: issue.help || issue.description || 'Fix this accessibility issue',
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
                                    scanId={scan.id}
                                    onStatusChange={(issueId, status) => {
                                      // Handle status changes - could save to database
                                      console.log('Issue status changed:', issueId, status)
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Periodic Scan Modal */}
      {showPeriodicModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Schedule Recurring Scan
            </h3>
            
            {scan && (
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600">
                  <strong>Scan:</strong> {scan.scanTitle}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Type:</strong> {scan.scanType}
                </p>
                {scan.url && (
                  <p className="text-sm text-gray-600">
                    <strong>URL:</strong> {scan.url}
                  </p>
                )}
                {scan.fileName && (
                  <p className="text-sm text-gray-600">
                    <strong>File:</strong> {scan.fileName}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequency
                </label>
                <select 
                  id="frequency"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Scan Title
                </label>
                <input
                  type="text"
                  id="scanTitle"
                  defaultValue={scan?.scanTitle || ''}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter scan title"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowPeriodicModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const frequency = (document.getElementById('frequency') as HTMLSelectElement)?.value || 'daily'
                  const scanTitle = (document.getElementById('scanTitle') as HTMLInputElement)?.value || scan?.scanTitle || ''
                  handleCreatePeriodicScan(frequency, scanTitle)
                }}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
              >
                Schedule Scan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User-friendly Modal */}
      <AlertModal
        isOpen={modalState.isOpen}
        onClose={closeModal}
        title={modalState.title}
        message={modalState.message}
        type={modalState.type}
      />
    </Sidebar>
  )
}
