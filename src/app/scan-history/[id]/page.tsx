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
  Code,
  Eye
} from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import ProtectedRoute from '@/components/ProtectedRoute'
import DetailedReport from '@/components/DetailedReport'

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
  const [activeTab, setActiveTab] = useState<'overview' | 'issues' | 'remediation'>('overview')

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
      <div className="space-y-6">
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

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-6" aria-label="Tabs">
              {[
                { id: 'overview', name: 'Overview', icon: Eye },
                { id: 'issues', name: 'Issues', icon: AlertTriangle },
                { id: 'remediation', name: 'Remediation', icon: Code }
              ].map((tab) => {
                const IconComponent = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
                  >
                    <IconComponent className="h-4 w-4 mr-2" />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Scan Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Scan Details</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Scan Type:</dt>
                          <dd className="text-sm text-gray-900 capitalize">{scan.scanType}</dd>
                        </div>
                        {scan.url && (
                          <div className="flex justify-between">
                            <dt className="text-sm text-gray-500">URL:</dt>
                            <dd className="text-sm text-gray-900 truncate max-w-xs">{scan.url}</dd>
                          </div>
                        )}
                        {scan.fileName && (
                          <div className="flex justify-between">
                            <dt className="text-sm text-gray-500">File:</dt>
                            <dd className="text-sm text-gray-900">{scan.fileName}</dd>
                          </div>
                        )}
                        {scan.fileType && (
                          <div className="flex justify-between">
                            <dt className="text-sm text-gray-500">Type:</dt>
                            <dd className="text-sm text-gray-900 uppercase">{scan.fileType}</dd>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Duration:</dt>
                          <dd className="text-sm text-gray-900">{formatDuration(scan.scanDurationSeconds)}</dd>
                        </div>
                      </dl>
                    </div>
                    
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Issue Summary</h4>
                      <dl className="space-y-2">
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Total Issues:</dt>
                          <dd className="text-sm text-gray-900">{scan.totalIssues}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Critical:</dt>
                          <dd className="text-sm text-red-600">{scan.criticalIssues}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Serious:</dt>
                          <dd className="text-sm text-orange-600">{scan.seriousIssues}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Moderate:</dt>
                          <dd className="text-sm text-yellow-600">{scan.moderateIssues}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-sm text-gray-500">Minor:</dt>
                          <dd className="text-sm text-blue-600">{scan.minorIssues}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </div>
                
                {/* Screenshots Section */}
                {scan.scanResults?.screenshots && (
                  <div className="mt-6">
                    <h4 className="font-medium text-gray-900 mb-4">Screenshots</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(scan.scanResults.screenshots).map(([key, screenshot]: [string, any]) => (
                        <div key={key} className="border border-gray-200 rounded-lg p-4">
                          <h5 className="font-medium text-gray-900 mb-2 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</h5>
                          {screenshot && (
                            <img 
                              src={`data:image/png;base64,${screenshot}`} 
                              alt={`Screenshot: ${key}`}
                              className="w-full h-auto rounded border"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'issues' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Accessibility Issues</h3>
                {(() => {
                  // Handle different data structures for scan results - same as web scan
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
                    <div className="space-y-6">
                      {scanResults.map((result: any, resultIndex: number) => (
                        <div key={resultIndex} className="bg-white border border-gray-200 rounded-lg p-4 sm:p-6">
                          <div className="mb-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                              {result.url || scan.url || 'Scan Result'}
                            </h3>
                            <p className="text-sm text-gray-500">
                              Scanned on {new Date(scan.createdAt).toLocaleString()}
                            </p>
                          </div>

                          {result.issues && result.issues.length === 0 ? (
                            <div className="text-center py-8">
                              <CheckCircle className="mx-auto h-12 w-12 text-green-600 mb-4" />
                              <p className="text-gray-500">No accessibility issues found on this page!</p>
                            </div>
                          ) : (
                            <div className="space-y-6">
                              {result.issues && result.issues.map((issue: any, issueIndex: number) => {
                                // Create a detailed report for each issue - same format as web scan
                                const detailedReport = {
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
                                  suggestions: [
                                    {
                                      type: 'fix' as const,
                                      description: issue.help || issue.description || 'Fix this accessibility issue',
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
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}

            {activeTab === 'remediation' && (
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Remediation Recommendations</h3>
                {(() => {
                  console.log('🔍 Remediation report:', scan.remediationReport)
                  
                  if (!scan.remediationReport || (Array.isArray(scan.remediationReport) && scan.remediationReport.length === 0)) {
                    return (
                      <div className="text-center py-8">
                        <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 mb-2">No Remediation Report</h3>
                        <p className="text-gray-500">
                          No AI-generated remediation recommendations are available for this scan.
                        </p>
                      </div>
                    )
                  }
                  
                  // Use the same format as web scan - display DetailedReport components
                  const remediationReports = Array.isArray(scan.remediationReport) ? scan.remediationReport : [scan.remediationReport]
                  
                  return (
                    <div className="space-y-6">
                      {remediationReports.map((report: any, index: number) => (
                        <DetailedReport
                          key={index}
                          {...report}
                        />
                      ))}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </Sidebar>
  )
}
