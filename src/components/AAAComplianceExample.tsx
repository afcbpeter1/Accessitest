'use client'

import React, { useState } from 'react'
import { AlertTriangle, CheckCircle, Info, Loader2, Award } from 'lucide-react'

interface AAAComplianceResult {
  levelA: boolean;
  levelAA: boolean;
  levelAAA: boolean;
  issues: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

export default function AAAComplianceExample() {
  const [url, setUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [result, setResult] = useState<AAAComplianceResult | null>(null)

  const handleAAAScan = async () => {
    if (!url) return

    setIsScanning(true)
    setResult(null)

    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })

      if (!response.ok) {
        throw new Error('Scan failed')
      }

      const scanResult = await response.json()
      setResult({
        levelA: scanResult.wcag22Compliance.levelA,
        levelAA: scanResult.wcag22Compliance.levelAA,
        levelAAA: scanResult.wcag22Compliance.levelAAA,
        issues: {
          critical: scanResult.summary.critical,
          serious: scanResult.summary.serious,
          moderate: scanResult.summary.moderate,
          minor: scanResult.summary.minor
        }
      })
    } catch (error) {
      console.error('AAA scan failed:', error)
    } finally {
      setIsScanning(false)
    }
  }

  const getComplianceBadge = (level: string, isCompliant: boolean) => {
    if (level === 'AAA' && isCompliant) {
      return (
        <div className="flex items-center space-x-2">
          <Award className="h-5 w-5 text-purple-600" />
          <span className="text-sm font-bold text-purple-900">AAA Certified</span>
        </div>
      )
    }
    
    return (
      <span className={`text-sm font-medium ${isCompliant ? 'text-green-700' : 'text-red-700'}`}>
        {isCompliant ? 'Compliant' : 'Non-Compliant'}
      </span>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">WCAG 2.2 AAA Compliance Testing</h1>
        <p className="text-gray-600">Test your website for the highest level of accessibility standards</p>
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
            onClick={handleAAAScan}
            disabled={isScanning || !url}
            className="btn-primary flex items-center space-x-2 disabled:opacity-50"
          >
            {isScanning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            <span>{isScanning ? 'Testing AAA...' : 'Test AAA Compliance'}</span>
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* Compliance Levels */}
          <div className="card">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">WCAG 2.2 Compliance Results</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Level A */}
              <div className={`border rounded-lg p-4 ${result.levelA ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-900">Level A</h3>
                  {getComplianceBadge('A', result.levelA)}
                </div>
                <p className="text-sm text-gray-600">Basic accessibility requirements</p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• Target size (24x24px minimum)</li>
                  <li>• Focus indicators</li>
                  <li>• Page titles</li>
                </ul>
              </div>

              {/* Level AA */}
              <div className={`border rounded-lg p-4 ${result.levelAA ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-900">Level AA</h3>
                  {getComplianceBadge('AA', result.levelAA)}
                </div>
                <p className="text-sm text-gray-600">Enhanced accessibility standards</p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• Color contrast (4.5:1)</li>
                  <li>• Alt text for images</li>
                  <li>• Form labels</li>
                </ul>
              </div>

              {/* Level AAA */}
              <div className={`border rounded-lg p-4 ${result.levelAAA ? 'bg-purple-50 border-purple-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-medium text-gray-900">Level AAA</h3>
                  {getComplianceBadge('AAA', result.levelAAA)}
                </div>
                <p className="text-sm text-gray-600">Maximum accessibility standards</p>
                <ul className="text-xs text-gray-500 mt-2 space-y-1">
                  <li>• Enhanced contrast (7:1)</li>
                  <li>• Enhanced focus indicators</li>
                  <li>• Comprehensive keyboard support</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Issue Summary */}
          <div className="card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Accessibility Issues Found</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-red-600">{result.issues.critical}</p>
                <p className="text-sm text-gray-600">Critical (Level A)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-orange-600">{result.issues.serious}</p>
                <p className="text-sm text-gray-600">Serious (Level AA)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-yellow-600">{result.issues.moderate}</p>
                <p className="text-sm text-gray-600">Moderate (Level AAA)</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">{result.issues.minor}</p>
                <p className="text-sm text-gray-600">Minor (Level AAA)</p>
              </div>
            </div>
          </div>

          {/* AAA Certification */}
          {result.levelAAA && (
            <div className="card bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200">
              <div className="text-center py-8">
                <Award className="h-16 w-16 text-purple-600 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-purple-900 mb-2">AAA Compliance Achieved!</h3>
                <p className="text-purple-700 mb-4">
                  Congratulations! Your website meets the highest accessibility standards.
                </p>
                <div className="bg-white rounded-lg p-4 inline-block">
                  <p className="text-sm text-gray-600">
                    Your site is accessible to users with the most severe disabilities
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Recommendations */}
          {!result.levelAAA && (
            <div className="card">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommendations for AAA Compliance</h3>
              <div className="space-y-3">
                {!result.levelA && (
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Fix Level A Issues First</p>
                      <p className="text-sm text-gray-600">Address critical accessibility issues before targeting AAA compliance.</p>
                    </div>
                  </div>
                )}
                {!result.levelAA && result.levelA && (
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Achieve Level AA Compliance</p>
                      <p className="text-sm text-gray-600">Focus on serious issues to meet AA standards before targeting AAA.</p>
                    </div>
                  </div>
                )}
                {result.levelAA && !result.levelAAA && (
                  <div className="flex items-start space-x-3">
                    <Info className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Enhance for AAA Compliance</p>
                      <p className="text-sm text-gray-600">Improve color contrast, focus indicators, and keyboard navigation for AAA standards.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}



