'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileCode,
  Target,
  Calendar,
  Layout
} from 'lucide-react'

const BRAND = {
  cyan: '#06B6D4',
  dark: '#0B1220',
  cyanLight: '#ecfeff',
  darkMuted: '#1e293b',
}

const TAB_LABEL_MAX_LEN = 10

function tabLabelFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname || '/'
    const label = pathname === '/' ? '/home' : pathname
    if (label.length <= TAB_LABEL_MAX_LEN) return label
    return label.slice(0, TAB_LABEL_MAX_LEN) + '…'
  } catch {
    return url
  }
}

// Logo from CDN so it loads when report is viewed from any origin (e.g. shared link)
const LOGO_SRC = 'https://res.cloudinary.com/dyzzpsxov/image/upload/v1764106136/allytest_vmuws6.png'

interface ReportIssue {
  id: string
  impact: string
  description: string
  help: string
  helpUrl: string
  nodes: Array<{ target: string[]; html: string; failureSummary: string }>
  suggestions?: Array<{ type: string; description: string; codeExample?: string; priority: string }>
}

interface ReportPageResult {
  url: string
  passed: boolean
  summary: { total: number; critical: number; serious: number; moderate: number; minor: number }
  issues: ReportIssue[]
}

interface ReportData {
  passed: boolean
  url?: string
  summary?: { total: number; critical: number; serious: number; moderate: number; minor: number }
  issues?: ReportIssue[]
  results?: ReportPageResult[]
  createdAt?: string
}

export default function ReportPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [report, setReport] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const pageIndex = Math.max(0, parseInt(searchParams.get('page') ?? '0', 10) || 0)
  const isMultiPage = Boolean(report?.results && report.results.length > 1)
  const pages: ReportPageResult[] = report?.results ?? (report?.url ? [{ url: report.url, passed: report.passed, summary: report.summary ?? { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 }, issues: report.issues ?? [] }] : [])
  const currentPage = useMemo(() => {
    const i = Math.min(pageIndex, pages.length - 1)
    return { index: i, data: pages[i] }
  }, [pageIndex, pages])

  const setPage = (index: number) => {
    setExpanded({})
    if (index === 0) {
      router.push(`/reports/${params.id}`, { scroll: false })
    } else {
      router.push(`/reports/${params.id}?page=${index}`, { scroll: false })
    }
  }

  useEffect(() => {
    const id = params.id as string
    if (!id) {
      setError('Invalid report ID')
      setLoading(false)
      return
    }
    fetch(`/api/reports/${id}`)
      .then((res) => {
        if (!res.ok) {
          if (res.status === 404) throw new Error('Report not found')
          throw new Error('Failed to load report')
        }
        return res.json()
      })
      .then((data) => {
        setReport(data)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [params.id])

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: `linear-gradient(to bottom right, ${BRAND.cyanLight}, #f8fafc)` }}>
        <div className="flex flex-col items-center gap-4">
          <img src={LOGO_SRC} alt="A11ytest.ai" className="h-10 w-auto opacity-90" />
          <p className="text-gray-600 font-medium">Loading report…</p>
        </div>
      </div>
    )
  }

  if (error || !report) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: `linear-gradient(to bottom right, ${BRAND.cyanLight}, #f8fafc)` }}>
        <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8 max-w-md text-center">
          <img src={LOGO_SRC} alt="A11ytest.ai" className="h-10 w-auto mx-auto mb-4 opacity-90" />
          <p className="text-red-600 font-medium mb-4">{error ?? 'Report not found'}</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 font-medium text-white px-4 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: BRAND.dark }}
          >
            Go to A11ytest.ai
          </Link>
        </div>
      </div>
    )
  }

  const { passed: overallPassed, createdAt } = report
  const { data: pageData } = currentPage
  const passed = pageData?.passed ?? overallPassed
  const url = pageData?.url ?? ''
  const summary = pageData?.summary ?? { total: 0, critical: 0, serious: 0, moderate: 0, minor: 0 }
  const issues = pageData?.issues ?? []

  const impactColors: Record<string, string> = {
    critical: 'bg-red-100 text-red-800',
    serious: 'bg-orange-100 text-orange-800',
    moderate: 'bg-amber-100 text-amber-800',
    minor: 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="min-h-screen" style={{ background: `linear-gradient(to bottom, ${BRAND.cyanLight} 0%, #f8fafc 180px, #f1f5f9 100%)` }}>
      {/* Header with logo */}
      <header
        className="shadow-sm"
        style={{ backgroundColor: BRAND.dark }}
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="flex items-center gap-3 text-white/90 hover:text-white transition-colors"
          >
            <span className="flex items-center justify-center rounded-lg bg-white/95 p-1.5 shadow-sm">
              <img
                src={LOGO_SRC}
                alt=""
                className="h-7 w-auto object-contain"
                width={112}
                height={28}
              />
            </span>
            <span className="font-semibold text-white">A11ytest.ai</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-white/70 text-sm flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {createdAt ? new Date(createdAt).toLocaleString() : 'CI scan report'}
            </span>
            <Link
              href="/"
              className="text-sm font-medium text-white/90 hover:text-white underline underline-offset-2"
            >
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-8 px-4 sm:px-6">
        {/* Tabs for multi-page reports */}
        {isMultiPage ? (
          <div className="mb-6 flex flex-wrap gap-1 p-1 bg-white/80 rounded-xl border border-gray-200/80 shadow-sm">
            {pages.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPage(i)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  i === currentPage.index
                    ? 'text-white shadow'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
                style={i === currentPage.index ? { backgroundColor: BRAND.cyan } : undefined}
              >
                <Layout className="h-4 w-4 flex-shrink-0" />
                <span className="truncate max-w-[120px] sm:max-w-[160px]" title={p.url}>
                  {tabLabelFromUrl(p.url)}
                </span>
                {!p.passed && (
                  <XCircle className="h-3.5 w-3.5 text-red-200 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-gray-500 bg-white/80 rounded-lg border border-gray-200/80 px-4 py-2">
            This report shows 1 page. To get multiple URLs in one report with tabs, call the API with <code className="bg-gray-100 px-1 rounded text-xs">{`"urls": ["https://...", "https://..."]`}</code> (not multiple <code className="bg-gray-100 px-1 rounded text-xs">"url"</code> keys).
          </p>
        )}

        {/* Pass/fail + URL strip */}
        {pageData && (
        <>
        <div
          className="rounded-xl shadow-lg p-5 sm:p-6 mb-6 text-white"
          style={{ background: `linear-gradient(135deg, ${BRAND.cyan} 0%, ${BRAND.dark} 100%)` }}
        >
          <div className="flex flex-wrap items-center gap-4 mb-3">
            {passed ? (
              <span className="inline-flex items-center gap-2 font-semibold text-white">
                <CheckCircle className="h-6 w-6 text-emerald-300" />
                Passed
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 font-semibold text-white">
                <XCircle className="h-6 w-6 text-red-200" />
                Failed
              </span>
            )}
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-white/90 hover:text-white text-sm truncate max-w-full"
          >
            {url}
            <ExternalLink className="h-4 w-4 flex-shrink-0" />
          </a>
        </div>

        {/* Summary */}
        <section className="bg-white rounded-xl shadow border border-gray-200/80 p-5 sm:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: BRAND.dark }}>
            Summary
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <div
              className="rounded-lg px-4 py-3 border"
              style={{ backgroundColor: BRAND.cyanLight, borderColor: `${BRAND.cyan}40`, color: BRAND.darkMuted }}
            >
              <span className="block text-gray-500 text-xs font-medium uppercase tracking-wide">Total</span>
              <span className="font-bold text-lg" style={{ color: BRAND.cyan }}>{summary.total}</span>
            </div>
            <div className="bg-red-50 rounded-lg px-4 py-3 border border-red-100">
              <span className="block text-gray-500 text-xs font-medium uppercase tracking-wide">Critical</span>
              <span className="font-bold text-lg text-red-700">{summary.critical}</span>
            </div>
            <div className="bg-orange-50 rounded-lg px-4 py-3 border border-orange-100">
              <span className="block text-gray-500 text-xs font-medium uppercase tracking-wide">Serious</span>
              <span className="font-bold text-lg text-orange-700">{summary.serious}</span>
            </div>
            <div className="bg-amber-50 rounded-lg px-4 py-3 border border-amber-100">
              <span className="block text-gray-500 text-xs font-medium uppercase tracking-wide">Moderate</span>
              <span className="font-bold text-lg text-amber-700">{summary.moderate}</span>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
              <span className="block text-gray-500 text-xs font-medium uppercase tracking-wide">Minor</span>
              <span className="font-bold text-lg text-gray-700">{summary.minor}</span>
            </div>
          </div>
        </section>

        {/* Issues */}
        <section className="space-y-4">
          <h2 className="text-lg font-semibold" style={{ color: BRAND.dark }}>
            Issues
          </h2>
          {issues.length === 0 ? (
            <p className="text-gray-500 text-sm bg-white rounded-xl p-4 border border-gray-200">No issues found.</p>
          ) : (
            issues.map((issue, idx) => {
              const key = `issue-${idx}`
              const isOpen = expanded[key] ?? false
              const badgeClass = impactColors[issue.impact] ?? 'bg-gray-100 text-gray-800'
              return (
                <div
                  key={key}
                  className="bg-white rounded-xl shadow border border-gray-200/80 overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50/80 transition-colors"
                  >
                    {isOpen ? (
                      <ChevronDown className="h-5 w-5 flex-shrink-0" style={{ color: BRAND.cyan }} />
                    ) : (
                      <ChevronRight className="h-5 w-5 flex-shrink-0" style={{ color: BRAND.cyan }} />
                    )}
                    <span className="font-mono text-sm font-semibold text-gray-900">{issue.id}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeClass}`}>
                      {issue.impact}
                    </span>
                    <span className="text-gray-500 text-sm flex-1 truncate">
                      {issue.nodes?.length ?? 0} occurrence(s)
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t border-gray-200 px-4 pb-4 pt-3 space-y-4 bg-gray-50/50">
                      <p className="text-sm text-gray-700">{issue.description}</p>
                      <a
                        href={issue.helpUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm font-medium hover:underline"
                        style={{ color: BRAND.cyan }}
                      >
                        Learn more
                        <ExternalLink className="h-3 w-3" />
                      </a>

                      {issue.nodes && issue.nodes.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <Target className="h-4 w-4" style={{ color: BRAND.cyan }} />
                            Affected elements
                          </h3>
                          <ul className="space-y-2">
                            {issue.nodes.map((node, ni) => (
                              <li key={ni} className="text-sm bg-white rounded-lg p-3 font-mono border border-gray-200">
                                {node.target?.[0] && (
                                  <div className="text-gray-600 mb-1 break-all">{node.target[0]}</div>
                                )}
                                {node.failureSummary && (
                                  <div className="text-amber-800 text-xs mb-1">{node.failureSummary}</div>
                                )}
                                {node.html && (
                                  <pre className="text-xs overflow-x-auto p-2 rounded bg-gray-900 text-gray-100 mt-1">
                                    {node.html}
                                  </pre>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {issue.suggestions && issue.suggestions.length > 0 && (
                        <div>
                          <h3 className="text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                            <FileCode className="h-4 w-4" style={{ color: BRAND.cyan }} />
                            Suggestions
                          </h3>
                          <ul className="space-y-3">
                            {issue.suggestions.map((s, si) => (
                              <li key={si} className="text-sm">
                                <p className="text-gray-700 mb-1">{s.description}</p>
                                {s.codeExample && (
                                  <pre
                                    className="text-xs p-3 rounded-lg overflow-x-auto mt-1 border"
                                    style={{ backgroundColor: BRAND.dark, color: '#e2e8f0', borderColor: BRAND.darkMuted }}
                                  >
                                    {s.codeExample}
                                  </pre>
                                )}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </section>
        </>
        )}

        {/* Footer */}
        <footer className="mt-10 py-6 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-medium"
            style={{ color: BRAND.cyan }}
          >
            <img src={LOGO_SRC} alt="" className="h-5 w-auto opacity-90" />
            A11ytest.ai – Accessibility testing that fits your pipeline
          </Link>
        </footer>
      </main>
    </div>
  )
}
