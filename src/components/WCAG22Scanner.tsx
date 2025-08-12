'use client'

import React, { useState } from 'react'
import { AlertTriangle, CheckCircle, Info, Loader2 } from 'lucide-react'

interface AccessibilityIssue {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
  }>;
}

interface ScanResult {
  url: string;
  timestamp: string;
  issues: AccessibilityIssue[];
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
  wcag22Compliance: {
    levelA: boolean;
    levelAA: boolean;
    levelAAA: boolean;
  };
}

export default function WCAG22Scanner() {
  const [url, setUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<ScanResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScan = async () => {
    if (!url) return

    setIsScanning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Scan failed')
      }

      const scanResult = await response.json()
      setResult(scanResult)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scan failed')
    } finally {
      setIsScanning(false)
    }
  }

  const getImpactIcon = (impact: string) => {
    switch (impact) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'serious':
        return <AlertTriangle className="h-4 w-4 text-orange-600" />
      case 'moderate':
        return <Info className="h-4 w-4 text-yellow-600" />
      default:
        return <Info className="h-4 w-4 text-blue-600" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical':
        return 'bg-red-50 border-red-200'
      case 'serious':
        return 'bg-orange-50 border-orange-200'
      case 'moderate':
        return 'bg-yellow-50 border-yellow-200'
      default:
        return 'bg-blue-50 border-blue-200'
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">WCAG 2.2 Accessibility Scanner</h1>
        <p className="text-gray-600">Test your website for WCAG 2.2 compliance using axe-core</p>
      </div>

      {/* Scan Form */}
      <div className="card">
        <div className="flex gap-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="input-field flex-1"
            disabled={isScanning}
          />
          <button
            onClick={handleScan}
            disabled={isScanning || !url}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50"
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <span className="text-sm font-medium text-red-900">Scan Error</span>
          </div>
          <p className="text-sm text-red-700 mt-1">{error}</p>
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Summary */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Scan Results</h2>
            
            {/* WCAG 2.2 Compliance */}
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">WCAG 2.2 Compliance</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className={`border rounded-lg p-4 ${result.wcag22Compliance.levelA ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${result.wcag22Compliance.levelA ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Level A</p>
                      <p className={`text-lg font-bold ${result.wcag22Compliance.levelA ? 'text-green-900' : 'text-red-900'}`}>
                        {result.wcag22Compliance.levelA ? 'Compliant' : 'Non-Compliant'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`border rounded-lg p-4 ${result.wcag22Compliance.levelAA ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${result.wcag22Compliance.levelAA ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Level AA</p>
                      <p className={`text-lg font-bold ${result.wcag22Compliance.levelAA ? 'text-green-900' : 'text-red-900'}`}>
                        {result.wcag22Compliance.levelAA ? 'Compliant' : 'Non-Compliant'}
                      </p>
                    </div>
                  </div>
                </div>
                <div className={`border rounded-lg p-4 ${result.wcag22Compliance.levelAAA ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                  <div className="flex items-center">
                    <div className={`w-3 h-3 rounded-full mr-3 ${result.wcag22Compliance.levelAAA ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Level AAA</p>
                      <p className={`text-lg font-bold ${result.wcag22Compliance.levelAAA ? 'text-green-900' : 'text-gray-900'}`}>
                        {result.wcag22Compliance.levelAAA ? 'Compliant' : 'Not Tested'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Issue Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">{result.summary.total}</p>
                <p className="text-sm text-gray-600">Total Issues</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{result.summary.critical}</p>
                <p className="text-sm text-gray-600">Critical</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{result.summary.serious}</p>
                <p className="text-sm text-gray-600">Serious</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{result.summary.moderate}</p>
                <p className="text-sm text-gray-600">Moderate</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{result.summary.minor}</p>
                <p className="text-sm text-gray-600">Minor</p>
              </div>
            </div>
          </div>

          {/* Issues List */}
          {result.issues.length > 0 && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Accessibility Issues</h3>
              <div className="space-y-4">
                {result.issues.map((issue, index) => (
                  <div key={index} className={`border rounded-lg p-4 ${getImpactColor(issue.impact)}`}>
                    <div className="flex items-start space-x-3">
                      {getImpactIcon(issue.impact)}
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-gray-900">{issue.description}</h4>
                        <p className="text-sm text-gray-600 mt-1">{issue.help}</p>
                        <div className="mt-2">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-gray-800">
                            {issue.impact}
                          </span>
                          <span className="ml-2 text-xs text-gray-500">WCAG 2.2</span>
                        </div>
                        {issue.nodes.length > 0 && (
                          <div className="mt-3">
                            <p className="text-sm font-medium text-gray-900">Affected Elements:</p>
                            <div className="mt-1 space-y-1">
                              {issue.nodes.slice(0, 3).map((node, nodeIndex) => (
                                <div key={nodeIndex} className="text-xs bg-white p-2 rounded border">
                                  <p className="font-medium">{node.failureSummary}</p>
                                  <p className="text-gray-600 mt-1 truncate">{node.html}</p>
                                </div>
                              ))}
                              {issue.nodes.length > 3 && (
                                <p className="text-xs text-gray-500">
                                  +{issue.nodes.length - 3} more elements
                                </p>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* No Issues */}
          {result.issues.length === 0 && (
            <div className="card">
              <div className="text-center py-8">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Accessibility Issues Found!</h3>
                <p className="text-gray-600">Great job! Your website appears to be compliant with WCAG 2.2 standards.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}


