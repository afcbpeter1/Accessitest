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
import AccessibleModal, { AlertModal } from '@/components/AccessibleModal'
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
  const [rerunning, setRerunning] = useState(false)
  const [showExtensionRerunModal, setShowExtensionRerunModal] = useState(false)
  
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

  const isExtensionScan = scan?.scanTitle?.startsWith('Extension:') ?? false

  const handleRerunScan = async () => {
    if (!scan) return

    if (isExtensionScan) {
      setShowExtensionRerunModal(true)
      return
    }
    
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
              className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900"
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
      <div className="space-y-4 min-w-0 overflow-hidden">
        {/* Header: stacks on small screens so URL and buttons don't overlap */}
        <div className="flex flex-col gap-4 sm:gap-6">
          <div className="flex flex-col gap-3 min-w-0">
            <Link
              href="/scan-history"
              className="inline-flex items-center text-gray-800 hover:text-gray-950 w-fit"
            >
              <ArrowLeft className="h-5 w-5 mr-2 flex-shrink-0" />
              Back to History
            </Link>
            <div className="min-w-0 flex-1">
              <h1
                className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-3 min-w-0"
                title={scan.scanTitle}
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${
                  scan.scanType === 'web' ? 'bg-blue-100' : 'bg-green-100'
                }`}>
                  <IconComponent className={`h-6 w-6 ${
                    scan.scanType === 'web' ? 'text-blue-600' : 'text-green-600'
                  }`} />
                </div>
                <span className="truncate block min-w-0" title={scan.scanTitle}>
                  {scan.scanTitle}
                </span>
              </h1>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700 mt-1">
                <div className="flex items-center flex-shrink-0">
                  <Calendar className="h-4 w-4 mr-1 flex-shrink-0" />
                  {formatDate(scan.createdAt)}
                </div>
                <div className="flex items-center flex-shrink-0">
                  <Clock className="h-4 w-4 mr-1 flex-shrink-0" />
                  {formatDuration(scan.scanDurationSeconds)}
                </div>
                {scan.scanType === 'web' && scan.pagesScanned != null && (
                  <div className="flex items-center flex-shrink-0">
                    <Globe className="h-4 w-4 mr-1 flex-shrink-0" />
                    {scan.pagesScanned} page{scan.pagesScanned !== 1 ? 's' : ''} scanned
                  </div>
                )}
                {scan.scanType === 'document' && scan.pagesAnalyzed != null && (
                  <div className="flex items-center flex-shrink-0">
                    <FileText className="h-4 w-4 mr-1 flex-shrink-0" />
                    {scan.pagesAnalyzed} page{scan.pagesAnalyzed !== 1 ? 's' : ''} analyzed
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action buttons: wrap and stay below title so they never overlap the URL */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={handleRerunScan}
              disabled={rerunning}
              className="inline-flex items-center px-4 py-2 bg-green-800 text-white rounded-lg hover:bg-green-900 disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
            >
              {rerunning ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2 flex-shrink-0" />
              ) : (
                <RotateCcw className="h-4 w-4 mr-2 flex-shrink-0" />
              )}
              {rerunning ? 'Rerunning...' : 'Rerun Scan'}
            </button>
            {scan.url && (
              <a
                href={scan.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-800 text-white rounded-lg hover:bg-blue-900 flex-shrink-0"
              >
                <ExternalLink className="h-4 w-4 mr-2 flex-shrink-0" />
                Visit Site
              </a>
            )}
          </div>
        </div>

        {/* Compliance Status */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-6 min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                
              </div>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-900">{scan.totalIssues}</div>
              <div className="text-sm text-gray-700">Total Issues</div>
            </div>
          </div>
        </div>

        {/* Issue Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Critical</p>
                <p className="text-2xl font-bold text-red-600">{scan.criticalIssues}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-orange-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Serious</p>
                <p className="text-2xl font-bold text-orange-600">{scan.seriousIssues}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-yellow-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Moderate</p>
                <p className="text-2xl font-bold text-yellow-600">{scan.moderateIssues}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-blue-600" />
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">Minor</p>
                <p className="text-2xl font-bold text-blue-600">{scan.minorIssues}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Container */}
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-4 min-w-0">
          <div className="xl:col-span-3 min-w-0">
            {/* Scan Results */}
            <div className="bg-white rounded-lg border border-gray-200 min-w-0 overflow-hidden">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-6">Accessibility Issues</h3>
                {(() => {
                  // Handle different data structures and deduplicate so we show each unique issue once (like product backlog)
                  let rawIssues: any[] = []
                  const pageEvidenceScreenshots =
                    scan.remediationReport?.[0]?.screenshots ||
                    scan.scanResults?.results?.[0]?.screenshots ||
                    scan.scanResults?.screenshots

                  const pageEvidenceImage =
                    pageEvidenceScreenshots?.viewport ||
                    pageEvidenceScreenshots?.fullPage

                  if (scan.scanResults) {
                    if (scan.scanType === 'document') {
                      if (scan.scanResults.issues && Array.isArray(scan.scanResults.issues)) {
                        rawIssues = scan.scanResults.issues
                      }
                    } else {
                      let scanResults: any[] = []
                      if (Array.isArray(scan.scanResults)) {
                        scanResults = scan.scanResults
                      } else if (scan.scanResults.results && Array.isArray(scan.scanResults.results)) {
                        scanResults = scan.scanResults.results
                      }
                      // Deduplicate: merge by issue.id so same issue from multiple pages appears once with all nodes
                      const byId = new Map<string, { issue: any; resultUrl?: string }>()
                      scanResults.forEach((result: any) => {
                        if (!result.issues || !Array.isArray(result.issues)) return
                        result.issues.forEach((issue: any) => {
                          const id = issue.id || issue.rule_id || 'unknown'
                          if (byId.has(id)) {
                            const existing = byId.get(id)!
                            existing.issue.nodes = [...(existing.issue.nodes || []), ...(issue.nodes || [])]
                            existing.issue.occurrences = existing.issue.nodes.length
                          } else {
                            byId.set(id, { issue: { ...issue }, resultUrl: result.url })
                          }
                        })
                      })
                      rawIssues = Array.from(byId.values()).map(({ issue }) => issue)
                    }
                  }

                  if (rawIssues.length === 0) {
                    return (
                      <>
                        {pageEvidenceImage && (
                          <div className="mb-6">
                            <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                              <FileText className="h-4 w-4 text-blue-600" />
                              Page Evidence (redacted)
                            </h4>
                            <div className="border border-gray-200 rounded overflow-hidden max-w-full">
                              <img
                                src={pageEvidenceImage}
                                alt="Redacted screenshot of the scanned page"
                                className="w-full h-auto max-h-56 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(pageEvidenceImage, '_blank')}
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Click to view full size</div>
                          </div>
                        )}
                        <div className="text-center py-8">
                          <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                          <h3 className="text-lg font-medium text-gray-900 mb-2">No Issues Found</h3>
                          <p className="text-gray-500">
                            Great! No accessibility issues were detected in this scan.
                          </p>
                        </div>
                      </>
                    )
                  }

                  return (
                    <div className="space-y-6">
                      {pageEvidenceImage && (
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            Page Evidence (redacted)
                          </h4>
                          <div className="border border-gray-200 rounded overflow-hidden max-w-full">
                            <img
                              src={pageEvidenceImage}
                              alt="Redacted screenshot of the scanned page"
                              className="w-full h-auto max-h-56 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(pageEvidenceImage, '_blank')}
                            />
                          </div>
                          <div className="text-xs text-gray-500 mt-1">Click to view full size</div>
                        </div>
                      )}
                      {rawIssues.map((issue: any, issueIndex: number) => {
                        const issueId = issue.id || issue.rule_id || `issue-${issueIndex}`
                        const matchingReport = scan.remediationReport?.find((r: any) => r.issueId === issueId)

                        // Use remediation report (same as product backlog): offending elements with HTML/selector, AI fix with code, screenshots
                        const offendingElements = matchingReport?.offendingElements?.length
                          ? matchingReport.offendingElements.map((el: any) => ({
                              html: el.html,
                              target: el.target || [],
                              failureSummary: el.failureSummary || issue.description,
                              impact: el.impact || issue.impact || 'minor',
                              url: el.url || scan.url || ''
                            }))
                          : (issue.nodes?.length
                              ? issue.nodes.map((node: any) => ({
                                  html: node.html,
                                  target: node.target || [],
                                  failureSummary: node.failureSummary || issue.description,
                                  impact: node.impact || issue.impact || 'minor',
                                  url: scan.url || ''
                                }))
                              : [{
                                  html: issue.elementContent || '',
                                  target: issue.elementSelector ? [issue.elementSelector] : [],
                                  failureSummary: issue.description || issue.remediation || '',
                                  impact: issue.impact || 'minor',
                                  url: scan.url || ''
                                }])

                        const suggestions = matchingReport?.suggestions?.length
                          ? matchingReport.suggestions.map((s: any) => ({
                              type: (s.type || 'fix') as 'fix' | 'improvement' | 'warning',
                              description: s.description || s.text || '',
                              codeExample: s.codeExample || s.code,
                              priority: (s.priority || 'medium') as 'high' | 'medium' | 'low'
                            }))
                          : (issue.suggestions?.length
                              ? issue.suggestions.map((s: any) => ({
                                  type: (s.type || 'fix') as 'fix' | 'improvement' | 'warning',
                                  description: s.description || s.text || '',
                                  codeExample: s.codeExample || s.code,
                                  priority: (s.priority || 'medium') as 'high' | 'medium' | 'low'
                                }))
                              : [{
                                  type: 'fix' as const,
                                  description: issue.help || issue.description || 'Fix this accessibility issue',
                                  priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                                }])

                        const collapsibleIssue = {
                          issueId,
                          ruleName: issue.description || matchingReport?.ruleName || 'Accessibility Issue',
                          description: issue.description || 'No description available',
                          impact: issue.impact || issue.type || 'minor',
                          wcag22Level: issue.wcag22Level || issue.wcagCriterion || matchingReport?.wcag22Level || 'A',
                          help: issue.help || matchingReport?.help || issue.description || '',
                          helpUrl: issue.helpUrl || (issue.wcagCriterion ? `https://www.w3.org/WAI/WCAG22/Understanding/${issue.wcagCriterion}` : ''),
                          totalOccurrences: issue.occurrences ?? issue.nodes?.length ?? 1,
                          affectedUrls: matchingReport?.affectedUrls?.length ? matchingReport.affectedUrls : [scan.url || scan.fileName || ''].filter(Boolean),
                          offendingElements,
                          suggestions,
                          priority: (issue.impact === 'critical' || issue.impact === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                        }

                        return (
                          <CollapsibleIssue
                            key={`issue-${issueId}-${issueIndex}`}
                            {...collapsibleIssue}
                            scanType={scan.scanType}
                            scanId={params.id as string}
                            screenshots={matchingReport?.screenshots || (scan.scanResults?.results?.[0]?.screenshots ?? scan.scanResults?.screenshots)}
                          />
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Extension scans: rerun not allowed in app */}
      <AccessibleModal
        isOpen={showExtensionRerunModal}
        onClose={() => setShowExtensionRerunModal(false)}
        title="Extension scan"
        type="info"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 leading-relaxed">
            Please rerun this scan using the Chrome extension. Extension scans cannot be rerun from the app.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => setShowExtensionRerunModal(false)}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-800 hover:bg-primary-900 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            >
              OK
            </button>
          </div>
        </div>
      </AccessibleModal>

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
