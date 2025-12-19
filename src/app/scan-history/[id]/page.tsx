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
  const [rerunning, setRerunning] = useState(false)
  const [syncingToJira, setSyncingToJira] = useState(false)
  const [jiraSyncResult, setJiraSyncResult] = useState<{ created: number; skipped: number; errors: number } | null>(null)
  
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
          console.log('🔍 Scan type from API:', data.scan.scanType)
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

  const handleSyncToJira = async () => {
    if (!scan?.id) return
    
    setSyncingToJira(true)
    setJiraSyncResult(null)
    
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setError('Authentication required')
        return
      }

      // Get all issue IDs from this scan
      const issuesResponse = await fetch(`/api/issues-board?scanId=${scan.id}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      if (!issuesResponse.ok) {
        throw new Error('Failed to fetch issues')
      }
      
      const issuesData = await issuesResponse.json()
      const issueIds = issuesData.issues?.map((i: any) => i.id) || []
      
      if (issueIds.length === 0) {
        showAlert('No issues found in this scan to sync')
        return
      }

      // Sync each issue to Jira
      let created = 0
      let skipped = 0
      let errors = 0

      for (const issueId of issueIds) {
        try {
          const syncResponse = await fetch('/api/jira/tickets', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ issueId })
          })
          
          const syncData = await syncResponse.json()
          if (syncData.success) {
            if (syncData.existing) {
              skipped++
            } else {
              created++
            }
          } else {
            errors++
          }
        } catch (err) {
          errors++
        }
      }

      setJiraSyncResult({ created, skipped, errors })
      showAlert(`Jira sync complete: ${created} created, ${skipped} skipped, ${errors} errors`)
    } catch (error) {
      console.error('Error syncing to Jira:', error)
      showAlert('Failed to sync issues to Jira')
    } finally {
      setSyncingToJira(false)
    }
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
              onClick={handleSyncToJira}
              disabled={syncingToJira || !scan.totalIssues}
              className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncingToJira ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              {syncingToJira ? 'Syncing...' : 'Sync to Jira'}
            </button>
            {jiraSyncResult && (
              <span className="text-sm text-gray-600">
                {jiraSyncResult.created} created, {jiraSyncResult.skipped} skipped
              </span>
            )}
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
                  let issues = []
                  
                  if (scan.scanResults) {
                    if (scan.scanType === 'document') {
                      // For document scans, get issues directly from scanResults.issues
                      if (scan.scanResults.issues && Array.isArray(scan.scanResults.issues)) {
                        issues = scan.scanResults.issues
                      }
                    } else {
                      // For web scans, process results as before
                      let scanResults = []
                      if (Array.isArray(scan.scanResults)) {
                        scanResults = scan.scanResults
                      } else if (scan.scanResults.results && Array.isArray(scan.scanResults.results)) {
                        scanResults = scan.scanResults.results
                      }
                      
                      // Extract issues from web scan results
                      scanResults.forEach((result: any) => {
                        if (result.issues && Array.isArray(result.issues)) {
                          issues.push(...result.issues)
                        }
                      })
                    }
                  }
                  
                  console.log('🔍 Processed issues:', issues)
                  
                  if (issues.length === 0) {
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
                      {issues.map((issue: any, issueIndex: number) => {
                        // Find matching AI response from remediation report
                        const matchingAIResponse = scan.remediationReport?.find((report: any) => 
                          report.issueId === (issue.id || `issue-${issueIndex}`)
                        );

                        // Create a collapsible issue for each issue
                        const collapsibleIssue = {
                          issueId: issue.id || `issue-${issueIndex}`,
                          ruleName: issue.description || 'Accessibility Issue',
                          description: issue.description || 'No description available',
                          impact: issue.type || issue.impact || 'minor',
                          wcag22Level: issue.wcagCriterion || 'A',
                          help: issue.description || '',
                          helpUrl: issue.wcagCriterion ? `https://www.w3.org/WAI/WCAG22/Understanding/${issue.wcagCriterion}` : '',
                          totalOccurrences: issue.occurrences || 1,
                          affectedUrls: [scan.url || scan.fileName || ''],
                          offendingElements: [{
                            html: scan.scanType === 'document' ? 
                              `Document Content (Page ${issue.pageNumber || 'Unknown'})` : 
                              (issue.elementContent || ''),
                            target: scan.scanType === 'document' ? 
                              [`Document Section: ${issue.section || 'Unknown'}`] : 
                              (issue.elementSelector ? [issue.elementSelector] : []),
                            failureSummary: scan.scanType === 'document' ? 
                              (issue.remediation || issue.recommendation || '') : 
                              (issue.remediation || issue.recommendation || issue.description || ''),
                            impact: issue.type || issue.impact || 'minor',
                            url: scan.scanType === 'document' ? 
                              `Document: ${scan.fileName || 'Unknown'}` : 
                              (scan.url || '')
                          }],
                          suggestions: [
                            {
                              type: 'fix' as const,
                              description: issue.recommendation || issue.remediation || issue.description || 'Fix this accessibility issue',
                              priority: (issue.type === 'critical' || issue.type === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                            }
                          ],
                          priority: (issue.type === 'critical' || issue.type === 'serious' ? 'high' : 'medium') as 'high' | 'medium' | 'low'
                        };

          console.log('🔍 Page scanType:', scan.scanType, 'for issue:', issueIndex);

          return (
            <CollapsibleIssue
              key={`issue-${issueIndex}`}
              {...collapsibleIssue}
              scanType={scan.scanType}
            />
          );
                      })}
                    </div>
                  )
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>


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
