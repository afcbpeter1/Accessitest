'use client'

import { useState, useEffect, useRef } from 'react'
import { Globe, AlertTriangle, ChevronDown, ChevronRight, ExternalLink, Sparkles, Code } from 'lucide-react'
import Link from 'next/link'

const WCAG_LEVELS = [
  { value: 'A' as const, label: 'Level A', tags: ['wcag2a'] },
  { value: 'AA' as const, label: 'Level AA', tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
  { value: 'AAA' as const, label: 'Level AAA', tags: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'wcag2aaa', 'wcag21aaa', 'wcag22aaa'] }
]

function getImpactColor(impact: string) {
  switch (impact) {
    case 'critical': return 'bg-red-100 text-red-800 border-red-200'
    case 'serious': return 'bg-orange-100 text-orange-800 border-orange-200'
    case 'moderate': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
    case 'minor': return 'bg-blue-100 text-blue-800 border-blue-200'
    default: return 'bg-gray-100 text-gray-800 border-gray-200'
  }
}

function getPriorityColor(priority: string) {
  switch (priority) {
    case 'high': return 'text-red-600 bg-red-50 border-red-200'
    case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200'
    case 'low': return 'text-blue-600 bg-blue-50 border-blue-200'
    default: return 'text-gray-600 bg-gray-50 border-gray-200'
  }
}

/**
 * Chrome extension only: shown in the extension side panel iframe.
 * User logs in inside the iframe (app handles session/cookie). No tokens or secrets in extension code.
 * Lets users scan the current browser tab and save issues to the product backlog.
 */
export default function ExtensionPage() {
  const [wcagLevel, setWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA')
  const [includeBestPractice, setIncludeBestPractice] = useState(true)
  const [includeSection508, setIncludeSection508] = useState(true)
  const [includeEN301549, setIncludeEN301549] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  type PageResult = {
    url: string
    issues: any[]
    summary: any
    reportUrl?: string | null
    remediationReport?: Array<{
      issueId?: string
      ruleName?: string
      description?: string
      impact?: string
      help?: string
      helpUrl?: string
      offendingElements?: Array<{ url?: string; target?: string[]; failureSummary?: string; impact?: string; html?: string }>
      suggestions?: Array<{ type?: string; description?: string; codeExample?: string; priority?: string }>
    }>
  }
  const [scanResult, setScanResult] = useState<{
    url: string
    issues: any[]
    summary: any
    backlogAdded?: number
    backlogAddedDetail?: { added?: number; reopened?: number; skipped?: number }
    reportUrl?: string | null
    scanHistoryId?: string | null
    backlogError?: string | null
    remediationReport?: Array<{
      issueId?: string
      ruleName?: string
      description?: string
      impact?: string
      help?: string
      helpUrl?: string
      offendingElements?: Array<{ url?: string; target?: string[]; failureSummary?: string; impact?: string; html?: string }>
      suggestions?: Array<{ type?: string; description?: string; codeExample?: string; priority?: string }>
    }>
    pages?: PageResult[]
  } | null>(null)
  const [multiScanPageResults, setMultiScanPageResults] = useState<PageResult[]>([])
  const isMultiScanningRef = useRef(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null)
  const [availableLinks, setAvailableLinks] = useState<Array<{ url: string; text: string }>>([])
  const [selectedLinkUrls, setSelectedLinkUrls] = useState<Set<string>>(new Set())
  const [loadingLinks, setLoadingLinks] = useState(false)
  const [isMultiScanning, setIsMultiScanning] = useState(false)
  const [multiScanPage, setMultiScanPage] = useState<{ current: number; total: number; url: string } | null>(null)
  const [issuesPageTab, setIssuesPageTab] = useState(0)

  useEffect(() => {
    isMultiScanningRef.current = isMultiScanning
  }, [isMultiScanning])

  // Request current tab URL on load, when page becomes visible, and on an interval so it stays in sync when user switches tabs
  useEffect(() => {
    if (window.parent === window) return
    function requestTabUrl() {
      window.parent.postMessage({ type: 'ACCESSSCAN_GET_CURRENT_TAB' }, '*')
    }
    requestTabUrl()
    const interval = setInterval(requestTabUrl, 2000)
    const onVisibility = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') requestTabUrl()
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'ACCESSSCAN_CURRENT_TAB_URL') {
        setCurrentTabUrl(event.data.url ?? null)
      }
      if (event.data?.type === 'ACCESSSCAN_SHOW_RESULTS') {
        setScanError(null)
        const pageData: PageResult = {
          url: event.data.url || '',
          issues: event.data.issues || [],
          summary: event.data.summary || {},
          reportUrl: event.data.reportUrl,
          remediationReport: event.data.remediationReport
        }
        if (isMultiScanningRef.current) {
          setMultiScanPageResults((prev) => [...prev, pageData])
        } else {
          setScanResult({
            url: pageData.url,
            issues: pageData.issues,
            summary: pageData.summary,
            backlogAdded: event.data.backlogAdded,
            backlogAddedDetail: event.data.backlogAddedDetail,
            reportUrl: event.data.reportUrl,
            scanHistoryId: event.data.scanHistoryId,
            backlogError: event.data.backlogError,
            remediationReport: event.data.remediationReport
          })
        }
        setIsScanning(false)
      }
      if (event.data?.type === 'ACCESSSCAN_SCAN_ERROR') {
        setScanError(event.data.error || 'Scan failed')
        setIsScanning(false)
      }
      if (event.data?.type === 'ACCESSSCAN_LINKS') {
        const links = Array.isArray(event.data.links) ? event.data.links : []
        setAvailableLinks(links)
        setSelectedLinkUrls(new Set(links.map((l: any) => l.url)))
        setLoadingLinks(false)
      }
      if (event.data?.type === 'ACCESSSCAN_LINKS_ERROR') {
        setLoadingLinks(false)
        setScanError(event.data.error || 'Failed to get links from this page')
      }
      if (event.data?.type === 'ACCESSSCAN_MULTI_SCAN_PAGE_START') {
        const current = Number(event.data.currentPage) || 1
        const total = Number(event.data.totalPages) || 1
        const url = typeof event.data.url === 'string' ? event.data.url : ''
        setMultiScanPage({ current, total, url })
      }
      if (event.data?.type === 'ACCESSSCAN_MULTI_SCAN_COMPLETE') {
        setMultiScanPageResults((prev) => {
          if (prev.length > 0) {
            const combinedSummary = prev.reduce(
              (acc, p) => {
                const s = p.summary || {}
                ;(['critical', 'serious', 'moderate', 'minor'] as const).forEach((k) => {
                  acc[k] = (acc[k] || 0) + (s[k] ?? 0)
                })
                return acc
              },
              {} as Record<string, number>
            )
            setScanResult({
              url: prev[0].url,
              issues: prev.flatMap((p) => p.issues),
              summary: combinedSummary,
              pages: prev
            })
          }
          return []
        })
        setIsMultiScanning(false)
        setMultiScanPage(null)
        setIssuesPageTab(0)
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  const getTags = () => {
    const level = WCAG_LEVELS.find((l) => l.value === wcagLevel)
    const tags = level ? [...level.tags] : ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']
    if (includeBestPractice && !tags.includes('best-practice')) tags.push('best-practice')
    if (includeSection508 && !tags.includes('section508')) tags.push('section508')
    if (includeEN301549 && !tags.includes('EN-301-549')) tags.push('EN-301-549')
    return tags
  }

  const runScan = () => {
    setScanError(null)
    setScanResult(null)
    setMultiScanPageResults([])
    setIsScanning(true)
    try {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'ACCESSSCAN_RUN_SCAN', tags: getTags(), wcagLevel }, '*')
      } else {
        setScanError('Open this page in the AccessScan extension to scan.')
        setIsScanning(false)
      }
    } catch {
      setScanError('Failed to start scan')
      setIsScanning(false)
    }
  }

  const fetchLinks = () => {
    setScanError(null)
    setLoadingLinks(true)
    setAvailableLinks([])
    setSelectedLinkUrls(new Set())
    try {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'ACCESSSCAN_GET_LINKS' }, '*')
      } else {
        setScanError('Open this page in the AccessScan extension to fetch links.')
        setLoadingLinks(false)
      }
    } catch {
      setScanError('Failed to request links from this page')
      setLoadingLinks(false)
    }
  }

  const toggleLinkSelected = (url: string) => {
    setSelectedLinkUrls((prev) => {
      const next = new Set(prev)
      if (next.has(url)) {
        next.delete(url)
      } else {
        next.add(url)
      }
      return next
    })
  }

  const runMultiScan = () => {
    const urls = Array.from(selectedLinkUrls)
    if (!urls.length) {
      setScanError('Select at least one page to scan.')
      return
    }
    setScanError(null)
    setScanResult(null)
    setMultiScanPageResults([])
    setIsMultiScanning(true)
    setMultiScanPage({ current: 1, total: urls.length, url: urls[0] || '' })
    try {
      if (window.parent !== window) {
        window.parent.postMessage(
          { type: 'ACCESSSCAN_RUN_MULTI_SCAN', urls, tags: getTags(), wcagLevel },
          '*'
        )
      } else {
        setScanError('Open this page in the AccessScan extension to run a multi-page scan.')
        setIsMultiScanning(false)
        setMultiScanPage(null)
      }
    } catch {
      setScanError('Failed to start multi-page scan')
      setIsMultiScanning(false)
      setMultiScanPage(null)
    }
  }

  const summary = scanResult?.summary || {}

  const inExtension = typeof window !== 'undefined' && window.self !== window.top

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Chrome extension – scan page</h1>
            <p className="text-sm text-gray-600 mt-1">Scan the current browser tab and save issues to your product backlog.</p>
          </div>
          {inExtension && (
            <a
              href="/product-backlog"
              className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              View product backlog <ExternalLink className="h-4 w-4 ml-1" />
            </a>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">URL being tested</h2>
          <p className="text-sm text-gray-600 break-all" title={currentTabUrl ?? undefined}>
            {currentTabUrl ? currentTabUrl : 'Open a webpage in another tab to see its URL here. That tab will be scanned when you click Scan page.'}
          </p>
        </div>

        {/* Multi-page scan (no manual URL pasting; use links from current page) */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 space-y-3">
          {isMultiScanning && multiScanPage && (
            <div className="rounded-lg border-2 border-primary-500 bg-primary-50 p-4">
              <p className="text-sm font-semibold text-primary-900">
                Scanning page {multiScanPage.current} of {multiScanPage.total}
              </p>
              <div className="mt-2 h-2 w-full rounded-full bg-primary-200 overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary-600 transition-all duration-300"
                  style={{ width: `${(multiScanPage.current / multiScanPage.total) * 100}%` }}
                />
              </div>
              <p className="mt-2 truncate text-xs text-primary-700" title={multiScanPage.url}>
                {multiScanPage.url || 'Loading…'}
              </p>
              <p className="mt-1 text-xs text-gray-600">
                The tab opens each page in turn. We wait for the scan and AI suggestions to finish before moving to the next.
              </p>
            </div>
          )}
          <h2 className="text-sm font-semibold text-gray-900">Scan multiple pages (same site)</h2>
          <p className="text-xs text-gray-600">
            Click <strong>Find links on this page</strong>, tick the pages to scan, then <strong>Scan selected</strong>. The extension will open each page in the tab, run the scan (like &quot;Scan page&quot;), and save issues to your product backlog.
          </p>
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-gray-700">Pages you can scan:</span>
            <button
              type="button"
              onClick={fetchLinks}
              disabled={loadingLinks || isMultiScanning || isScanning}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-md bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loadingLinks ? 'Finding links…' : 'Find links on this page'}
            </button>
          </div>
          {availableLinks.length === 0 && !loadingLinks && (
            <p className="text-xs text-gray-500 italic">
              No links loaded yet. Make sure the tab you want to scan is the active tab, then click &quot;Find links on this page&quot;.
            </p>
          )}
          {availableLinks.length > 0 && (
            <>
              <p className="text-xs font-medium text-gray-700">
                Scraped pages ({availableLinks.length}) — tick the ones to scan:
              </p>
              <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-md divide-y divide-gray-100 bg-gray-50/50">
                {availableLinks.map((link) => (
                  <label
                    key={link.url}
                    className="flex items-start gap-2 px-3 py-2 text-xs cursor-pointer hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 shrink-0 text-primary-600 border-gray-300 rounded"
                      checked={selectedLinkUrls.has(link.url)}
                      onChange={() => toggleLinkSelected(link.url)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-800 truncate" title={link.text}>
                        {link.text}
                      </div>
                      <div className="text-[11px] text-gray-500 truncate" title={link.url}>
                        {link.url}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <div className="flex flex-col items-end gap-1">
                <button
                  type="button"
                  onClick={runMultiScan}
                  disabled={isMultiScanning || isScanning || selectedLinkUrls.size === 0}
                  className="inline-flex items-center px-4 py-2.5 bg-primary-600 text-white text-xs font-medium rounded-md hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isMultiScanning ? 'Scanning selected pages…' : `Scan selected (${selectedLinkUrls.size})`}
                </button>
              </div>
            </>
          )}
        </div>

        {/* Options */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Standards</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs font-medium text-gray-600 mb-2">WCAG level</p>
              <div className="flex flex-wrap gap-4">
                {WCAG_LEVELS.map((opt) => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="wcagLevel"
                      value={opt.value}
                      checked={wcagLevel === opt.value}
                      onChange={() => setWcagLevel(opt.value)}
                      className="h-4 w-4 text-primary-600 border-gray-300"
                    />
                    <span className="text-sm text-gray-900">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBestPractice}
                  onChange={(e) => setIncludeBestPractice(e.target.checked)}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Best practices</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSection508}
                  onChange={(e) => setIncludeSection508(e.target.checked)}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">Section 508</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeEN301549}
                  onChange={(e) => setIncludeEN301549(e.target.checked)}
                  className="h-4 w-4 text-primary-600 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">EN 301 549 (EU Standard)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Scan button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={runScan}
            disabled={isScanning || isMultiScanning}
            className="inline-flex items-center px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Globe className="h-4 w-4 mr-2" />
            {isScanning ? 'Scanning…' : 'Scan page'}
          </button>
          {(isScanning || isMultiScanning) && (
            <span className="text-sm text-gray-500">
              {isMultiScanning ? 'Multi-scan in progress. Wait for it to finish.' : 'Make sure the tab you want to scan is the active tab.'}
            </span>
          )}
        </div>

        {scanError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-800">{scanError}</p>
          </div>
        )}

        {scanResult && (
          <>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <p className="text-sm text-gray-700 mb-3">
                Scan complete. {scanResult.issues.length} issue{scanResult.issues.length !== 1 ? 's' : ''} found.
                {scanResult.backlogAddedDetail && (
                  <span className="block mt-1 text-gray-600">
                    Backlog: {scanResult.backlogAddedDetail.added ?? 0} added, {scanResult.backlogAddedDetail.reopened ?? 0} reopened, {scanResult.backlogAddedDetail.skipped ?? 0} already in backlog.
                  </span>
                )}
                {scanResult.backlogError && (
                  <span className="block mt-1 text-amber-700 text-xs">Backlog warning: {scanResult.backlogError}</span>
                )}
                {scanResult.backlogAdded != null && scanResult.backlogAdded > 0 && !scanResult.backlogAddedDetail && (
                  <span className="text-green-700 font-medium"> {scanResult.backlogAdded} added to your backlog.</span>
                )}
              </p>
              <div className="flex flex-wrap gap-3">
                {scanResult.reportUrl && (
                  <Link
                    href={scanResult.reportUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
                  >
                    View full report (suggestions &amp; same as app) <ExternalLink className="h-4 w-4 ml-1" />
                  </Link>
                )}
                <Link
                  href="/product-backlog"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700"
                >
                  Open product backlog <ExternalLink className="h-4 w-4 ml-1" />
                </Link>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {(['critical', 'serious', 'moderate', 'minor'] as const).map((impact) => (
                  <div key={impact} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                    <span className="text-sm text-gray-600 capitalize">{impact}</span>
                    <span className="text-sm font-semibold text-gray-900">{summary[impact] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              {(() => {
                // Build list of pages for tabs; multi-scan gets an "All pages" tab first with combined issues
                const rawPages =
                  scanResult.pages && scanResult.pages.length > 0
                    ? scanResult.pages
                    : [{ url: scanResult.url, issues: scanResult.issues, remediationReport: scanResult.remediationReport }]
                const isMultiPage = (scanResult.pages?.length ?? 0) > 1
                const allPagesCombined =
                  isMultiPage && rawPages.length > 0
                    ? {
                        url: '__all__',
                        issues: rawPages.flatMap((p) => p.issues || []),
                        remediationReport: rawPages.flatMap((p) =>
                          (p.remediationReport || []).map((r: any) => ({ ...r, _pageUrl: p.url }))
                        )
                      }
                    : null
                const pagesForTabs = allPagesCombined ? [allPagesCombined, ...rawPages] : rawPages
                const currentPage = pagesForTabs[Math.min(issuesPageTab, pagesForTabs.length - 1)]
                const pageIssues = currentPage?.issues || []
                const pageReport = currentPage?.remediationReport
                const reportUrl = currentPage?.url ?? ''
                const isAllPagesView = reportUrl === '__all__'
                const pageLabel = (() => {
                  try {
                    const u = new URL(reportUrl || '')
                    return u.pathname === '/' || !u.pathname ? 'Home' : u.pathname
                  } catch {
                    return reportUrl || 'This page'
                  }
                })()
                return (
                  <>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">
                {isMultiPage ? 'Issues by page' : 'Issues'}
              </h3>
              <p className="text-xs text-gray-500 mb-2">Page tabs — issues below are for the selected page:</p>
              <div className="flex flex-wrap gap-1 rounded-t-lg border border-gray-300 border-b-0 bg-gray-100 p-2 pb-0 min-h-[40px]">
                {pagesForTabs.map((p, idx) => {
                  const label =
                    p.url === '__all__'
                      ? 'All pages'
                      : (() => {
                          try {
                            const u = new URL(p.url)
                            const path = u.pathname || '/'
                            if (path === '/') return 'Home'
                            const short = path.length > 28 ? path.slice(0, 28) + '…' : path
                            return short
                          } catch {
                            return `Page ${idx + (allPagesCombined ? 0 : 1)}`
                          }
                        })()
                  const count = p.issues?.length ?? 0
                  const isActive = issuesPageTab === idx
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setIssuesPageTab(idx)}
                      className={`px-3 py-2 text-xs font-medium rounded-t-md border border-b-0 -mb-px transition-colors ${
                        isActive
                          ? 'bg-white border-gray-400 text-primary-700 border-b-white shadow-sm'
                          : 'bg-gray-200 border-gray-300 text-gray-600 hover:bg-gray-50 border-b-gray-100'
                      }`}
                      title={p.url}
                    >
                      {label} ({count})
                    </button>
                  )
                })}
              </div>
              {isMultiPage && !isAllPagesView && (
                <p className="text-xs text-gray-500 mb-2" title={reportUrl}>
                  Page: <span className="font-medium text-gray-700">{pageLabel}</span>
                </p>
              )}
              {isAllPagesView && (
                <p className="text-xs text-gray-500 mb-2">
                  All issues from all {rawPages.length} page{rawPages.length !== 1 ? 's' : ''} — each issue shows which page it came from.
                </p>
              )}
              {pageIssues.length === 0 ? (
                  <p className="text-sm text-gray-500 py-4">No violations found for this page.</p>
                ) : (pageReport && pageReport.length > 0 ? (
                <ul className="space-y-4">
                  {pageReport.map((report: any, index: number) => {
                    const id = `report-${issuesPageTab}-${index}-${report.issueId || index}`
                    const isExpanded = expandedId === id
                    const offendingElements = report.offendingElements || []
                    const suggestions = report.suggestions || []
                    const issuePageUrl = report._pageUrl ?? reportUrl
                    const issuePageLabel = (() => {
                      if (!issuePageUrl || issuePageUrl === '__all__') return null
                      try {
                        const u = new URL(issuePageUrl)
                        return u.pathname === '/' || !u.pathname ? 'Home' : u.pathname
                      } catch {
                        return issuePageUrl
                      }
                    })()
                    return (
                      <li key={id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : id)}
                          className="w-full flex items-center gap-2 text-left px-3 py-2.5 hover:bg-gray-50"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border shrink-0 ${getImpactColor(report.impact || 'moderate')}`}>
                            {(report.impact || 'moderate').toUpperCase()}
                          </span>
                          {isAllPagesView && issuePageLabel && (
                            <span className="text-xs text-gray-500 shrink-0" title={issuePageUrl}>
                              {issuePageLabel}
                            </span>
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate flex-1">{report.ruleName || report.issueId || 'Issue'}</span>
                          <span className="text-xs text-gray-500 shrink-0">{offendingElements.length} item{offendingElements.length !== 1 ? 's' : ''}</span>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t border-gray-100 bg-gray-50/50 space-y-4">
                            <p className="text-sm text-gray-700 mt-2">{report.description}</p>

                            {offendingElements.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2">Offending Items ({offendingElements.length})</h4>
                                <div className="space-y-3">
                                  {offendingElements.map((el: any, ei: number) => (
                                    <div key={ei} className="bg-gray-50 rounded-lg p-3">
                                      <div className="flex items-start justify-between gap-2 mb-2">
                                        <div className="min-w-0 flex-1 space-y-1">
                                          {isAllPagesView && issuePageLabel && (
                                            <div className="text-xs text-gray-600">Page: {issuePageLabel}</div>
                                          )}
                                          {!isAllPagesView && reportUrl && (
                                            <div className="text-xs text-gray-600">Page: {reportUrl}</div>
                                          )}
                                          {el.target && el.target.length > 0 && (
                                            <div className="text-xs font-medium text-gray-800 font-mono break-all">Element: {el.target.join(' ')}</div>
                                          )}
                                        </div>
                                        <span className={`px-2 py-1 text-xs font-medium rounded-full border shrink-0 ${getImpactColor(el.impact || report.impact || 'moderate')}`}>
                                          {(el.impact || report.impact || 'moderate').toUpperCase()}
                                        </span>
                                      </div>
                                      {el.failureSummary && (
                                        <div className="mt-2 text-sm text-gray-700 p-3 bg-blue-50 border border-blue-200 rounded-lg">{el.failureSummary}</div>
                                      )}
                                      {el.html && (
                                        <div className="mt-2">
                                          <div className="text-xs font-medium text-gray-700 mb-1">Code / snippet</div>
                                          <pre className="text-xs bg-gray-800 text-gray-100 p-3 rounded-lg overflow-x-auto max-h-40 overflow-y-auto border border-gray-700">
                                            <code className="whitespace-pre-wrap break-all">{String(el.html)}</code>
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {suggestions.length > 0 && (
                              <div>
                                <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center gap-2">
                                  <Sparkles className="h-4 w-4 text-purple-600" />
                                  AI-Generated Fixes
                                </h4>
                                <div className="space-y-3">
                                  {suggestions.map((sug: any, si: number) => (
                                    <div key={si} className="border border-purple-300 bg-purple-50 rounded-lg p-3">
                                      <div className="flex items-start gap-3">
                                        <div className="flex-shrink-0 w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center">
                                          <Sparkles className="h-3 w-3 text-purple-800" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <div className="flex flex-wrap items-center gap-2 mb-2">
                                            <span className="px-2 py-1 text-xs font-medium bg-purple-200 text-purple-900 rounded-full border border-purple-300">AI SUGGESTION</span>
                                            <span className="text-sm font-medium text-gray-700 capitalize">{sug.type || 'Fix'}</span>
                                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(sug.priority || 'medium')}`}>
                                              {(sug.priority || 'medium').toUpperCase()} PRIORITY
                                            </span>
                                          </div>
                                          <div className="text-sm text-purple-900 font-medium mb-2">{sug.description}</div>
                                          {sug.codeExample && (
                                            <div>
                                              <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                                                <Code className="h-4 w-4" />
                                                Specific Code Fix:
                                              </p>
                                              <pre className="rounded p-3 text-xs break-words max-w-full bg-gray-900 text-white overflow-x-auto">
                                                <code>{sug.codeExample}</code>
                                              </pre>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <ul className="space-y-2">
                  {pageIssues.map((issue: any, index: number) => {
                    const id = `issue-${issuesPageTab}-${index}-${issue.id}`
                    const isExpanded = expandedId === id
                    const nodes = issue.nodes || []
                    return (
                      <li key={id} className="border border-gray-200 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : id)}
                          className="w-full flex items-center gap-2 text-left px-3 py-2.5 hover:bg-gray-50"
                        >
                          {isExpanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getImpactColor(issue.impact)}`}>{issue.impact}</span>
                          <span className="text-sm font-medium text-gray-900 truncate flex-1">{issue.id || issue.ruleId || 'Issue'}</span>
                          <span className="text-xs text-gray-500">{nodes.length} element{nodes.length !== 1 ? 's' : ''}</span>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-sm text-gray-700 mt-2">{issue.description || issue.help}</p>
                            {issue.helpUrl && (
                              <a href={issue.helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline mt-1 inline-block">Learn more</a>
                            )}
                            {nodes.length > 0 && (
                              <div className="mt-3">
                                <p className="text-xs font-medium text-gray-600 mb-1">Affected elements</p>
                                <ul className="space-y-1">
                                  {nodes.slice(0, 5).map((node: any, i: number) => (
                                    <li key={i} className="text-xs text-gray-600 font-mono bg-white border border-gray-200 rounded px-2 py-1 truncate" title={node.html}>
                                      {node.html?.replace(/<[^>]+>/g, '').slice(0, 80) || node.target?.join(' ') || 'Element'}
                                    </li>
                                  ))}
                                  {nodes.length > 5 && <li className="text-xs text-gray-500">+{nodes.length - 5} more</li>}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )
              )
              }
            </>
              );
              })()}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
