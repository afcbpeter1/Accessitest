'use client'

import { useState, useEffect } from 'react'
import { Globe, AlertTriangle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react'
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

export default function ExtensionScanPage() {
  const [wcagLevel, setWcagLevel] = useState<'A' | 'AA' | 'AAA'>('AA')
  const [includeBestPractice, setIncludeBestPractice] = useState(true)
  const [includeSection508, setIncludeSection508] = useState(true)
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<{ url: string; issues: any[]; summary: any; backlogAdded?: number } | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
    if (!token) {
      window.location.href = '/login?redirect=' + encodeURIComponent('/extension-scan')
    }
  }, [])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'ACCESSSCAN_SHOW_RESULTS') {
        setScanError(null)
        setScanResult({
          url: event.data.url || '',
          issues: event.data.issues || [],
          summary: event.data.summary || {},
          backlogAdded: event.data.backlogAdded
        })
        setIsScanning(false)
      }
      if (event.data?.type === 'ACCESSSCAN_SCAN_ERROR') {
        setScanError(event.data.error || 'Scan failed')
        setIsScanning(false)
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
    return tags
  }

  const runScan = () => {
    setScanError(null)
    setScanResult(null)
    setIsScanning(true)
    try {
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'ACCESSSCAN_RUN_SCAN', tags: getTags() }, '*')
      } else {
        setScanError('Open this page in the AccessScan extension to scan.')
        setIsScanning(false)
      }
    } catch {
      setScanError('Failed to start scan')
      setIsScanning(false)
    }
  }

  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null
  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <p className="text-gray-600">Redirecting to login…</p>
      </div>
    )
  }

  const summary = scanResult?.summary || {}

  return (
    <div className="min-h-screen bg-gray-50 p-4 pb-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Extension scan</h1>
          <p className="text-sm text-gray-600 mt-1">Scan the current browser tab and save issues to your product backlog.</p>
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
            </div>
          </div>
        </div>

        {/* Scan button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={runScan}
            disabled={isScanning}
            className="inline-flex items-center px-4 py-2.5 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <Globe className="h-4 w-4 mr-2" />
            {isScanning ? 'Scanning…' : 'Scan this page'}
          </button>
          {isScanning && (
            <span className="text-sm text-gray-500">Make sure the tab you want to scan is active.</span>
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
            {/* Success + backlog */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-700">
                  Scan complete. {scanResult.issues.length} issue{scanResult.issues.length !== 1 ? 's' : ''} found.
                  {scanResult.backlogAdded != null && scanResult.backlogAdded > 0 && (
                    <span className="text-green-700 font-medium"> {scanResult.backlogAdded} added to your backlog.</span>
                  )}
                </p>
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

            {/* Summary */}
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

            {/* Issues list */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Issues</h3>
              {scanResult.issues.length === 0 ? (
                <p className="text-sm text-gray-500 py-4">No violations found for the selected standards.</p>
              ) : (
                <ul className="space-y-2">
                  {scanResult.issues.map((issue: any, index: number) => {
                    const id = `issue-${index}-${issue.id}`
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
                          <span className={`text-xs font-medium px-2 py-0.5 rounded border ${getImpactColor(issue.impact)}`}>
                            {issue.impact}
                          </span>
                          <span className="text-sm font-medium text-gray-900 truncate flex-1">{issue.id || issue.ruleId || 'Issue'}</span>
                          <span className="text-xs text-gray-500">{nodes.length} element{nodes.length !== 1 ? 's' : ''}</span>
                        </button>
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 border-t border-gray-100 bg-gray-50/50">
                            <p className="text-sm text-gray-700 mt-2">{issue.description || issue.help}</p>
                            {issue.helpUrl && (
                              <a href={issue.helpUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline mt-1 inline-block">
                                Learn more
                              </a>
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
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
