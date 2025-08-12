'use client'

import { useState } from 'react'
import { FileText, Download, AlertTriangle, CheckCircle, Info, BarChart3 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

// Mock report data
const mockReport = {
  id: 1,
  url: 'https://example.com',
  date: '2024-01-15T10:30:00Z',
  pagesScanned: 25,
  totalIssues: 12,
  criticalIssues: 3,
  seriousIssues: 5,
  moderateIssues: 4,
  wcag22Compliance: {
    levelA: true,
    levelAA: false,
    levelAAA: false
  },
  issues: [
    {
      id: 1,
      type: 'critical',
      title: 'Missing alt text on images',
      description: 'Images without alt text are not accessible to screen readers',
      impact: 'Critical',
      pages: ['/home', '/about', '/contact'],
      recommendation: 'Add descriptive alt text to all images. Use empty alt="" for decorative images.',
      wcag: 'WCAG 2.2 AA - 1.1.1'
    },
    {
      id: 2,
      type: 'serious',
      title: 'Insufficient color contrast',
      description: 'Text color does not provide sufficient contrast with background',
      impact: 'Serious',
      pages: ['/home', '/products'],
      recommendation: 'Increase color contrast ratio to at least 4.5:1 for normal text and 3:1 for large text.',
      wcag: 'WCAG 2.2 AA - 1.4.3'
    },
    {
      id: 3,
      type: 'moderate',
      title: 'Missing form labels',
      description: 'Form inputs lack proper labels',
      impact: 'Moderate',
      pages: ['/contact'],
      recommendation: 'Add proper labels to all form inputs using the label element or aria-label attribute.',
      wcag: 'WCAG 2.2 AA - 3.3.2'
    },
    {
      id: 4,
      type: 'serious',
      title: 'Insufficient target size',
      description: 'Interactive elements are too small to be easily activated',
      impact: 'Serious',
      pages: ['/home', '/products', '/contact'],
      recommendation: 'Ensure interactive elements have a minimum target size of 24x24 CSS pixels.',
      wcag: 'WCAG 2.2 A - 2.5.5'
    },
    {
      id: 5,
      type: 'moderate',
      title: 'Missing focus indicators',
      description: 'Interactive elements lack visible focus indicators',
      impact: 'Moderate',
      pages: ['/home', '/about'],
      recommendation: 'Provide clear visual focus indicators for all interactive elements.',
      wcag: 'WCAG 2.2 A - 2.4.12'
    }
  ]
}

export default function Reports() {
  const [report] = useState(mockReport)

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <AlertTriangle className="h-5 w-5 text-red-600" />
      case 'serious':
        return <AlertTriangle className="h-5 w-5 text-orange-600" />
      case 'moderate':
        return <Info className="h-5 w-5 text-yellow-600" />
      default:
        return <Info className="h-5 w-5 text-blue-600" />
    }
  }

  const getIssueColor = (type: string) => {
    switch (type) {
      case 'critical':
        return 'border-red-200 bg-red-50'
      case 'serious':
        return 'border-orange-200 bg-orange-50'
      case 'moderate':
        return 'border-yellow-200 bg-yellow-50'
      default:
        return 'border-blue-200 bg-blue-50'
    }
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Accessibility Reports</h1>
          <button className="btn-primary flex items-center space-x-2">
            <Download className="h-4 w-4" />
            <span>Download PDF</span>
          </button>
        </div>

        {/* WCAG 2.2 Compliance Status */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">WCAG 2.2 Compliance Status</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className={`border rounded-lg p-4 ${report.wcag22Compliance.levelA ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${report.wcag22Compliance.levelA ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Level A</p>
                  <p className={`text-lg font-bold ${report.wcag22Compliance.levelA ? 'text-green-900' : 'text-red-900'}`}>
                    {report.wcag22Compliance.levelA ? 'Compliant' : 'Non-Compliant'}
                  </p>
                </div>
              </div>
            </div>
            <div className={`border rounded-lg p-4 ${report.wcag22Compliance.levelAA ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${report.wcag22Compliance.levelAA ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Level AA</p>
                  <p className={`text-lg font-bold ${report.wcag22Compliance.levelAA ? 'text-green-900' : 'text-red-900'}`}>
                    {report.wcag22Compliance.levelAA ? 'Compliant' : 'Non-Compliant'}
                  </p>
                </div>
              </div>
            </div>
            <div className={`border rounded-lg p-4 ${report.wcag22Compliance.levelAAA ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${report.wcag22Compliance.levelAAA ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Level AAA</p>
                  <p className={`text-lg font-bold ${report.wcag22Compliance.levelAAA ? 'text-green-900' : 'text-gray-900'}`}>
                    {report.wcag22Compliance.levelAAA ? 'Compliant' : 'Not Tested'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Report Summary */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-blue-50">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Pages Scanned</p>
                <p className="text-2xl font-semibold text-gray-900">{report.pagesScanned}</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-red-50">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Critical Issues</p>
                <p className="text-2xl font-semibold text-gray-900">{report.criticalIssues}</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-orange-50">
                <AlertTriangle className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Serious Issues</p>
                <p className="text-2xl font-semibold text-gray-900">{report.seriousIssues}</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <div className="p-3 rounded-lg bg-yellow-50">
                <Info className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Moderate Issues</p>
                <p className="text-2xl font-semibold text-gray-900">{report.moderateIssues}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Issues List */}
        <div className="card">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Issues Found</h2>
          <div className="space-y-4">
            {report.issues.map((issue) => (
              <div key={issue.id} className={`border rounded-lg p-4 ${getIssueColor(issue.type)}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    {getIssueIcon(issue.type)}
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900">{issue.title}</h3>
                      <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
                      <div className="mt-2">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white text-gray-800">
                          {issue.impact}
                        </span>
                        <span className="ml-2 text-xs text-gray-500">{issue.wcag}</span>
                      </div>
                      <div className="mt-3">
                        <h4 className="text-sm font-medium text-gray-900">Recommendation:</h4>
                        <p className="text-sm text-gray-600 mt-1">{issue.recommendation}</p>
                      </div>
                      <div className="mt-2">
                        <h4 className="text-sm font-medium text-gray-900">Affected Pages:</h4>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {issue.pages.map((page, index) => (
                            <span key={index} className="inline-flex items-center px-2 py-1 rounded text-xs bg-white text-gray-700">
                              {page}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Sidebar>
  )
}
