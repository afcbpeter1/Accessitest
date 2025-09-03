'use client'

import React, { useState } from 'react'
import { FileText, Shield, CheckCircle, AlertTriangle, Info, Sparkles } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import DocumentUpload from '@/components/DocumentUpload'

interface DocumentScanStats {
  totalDocuments: number
  compliantDocuments: number
  nonCompliantDocuments: number
  totalIssues: number
  criticalIssues: number
  seriousIssues: number
}

export default function DocumentScan() {
  const [scanStats, setScanStats] = useState<DocumentScanStats>({
    totalDocuments: 0,
    compliantDocuments: 0,
    nonCompliantDocuments: 0,
    totalIssues: 0,
    criticalIssues: 0,
    seriousIssues: 0
  })

  const handleScanComplete = (document: any) => {
    if (document.scanResults) {
      setScanStats(prev => ({
        totalDocuments: prev.totalDocuments + 1,
        compliantDocuments: prev.compliantDocuments + (document.scanResults.is508Compliant ? 1 : 0),
        nonCompliantDocuments: prev.nonCompliantDocuments + (document.scanResults.is508Compliant ? 0 : 1),
        totalIssues: prev.totalIssues + document.scanResults.summary.total,
        criticalIssues: prev.criticalIssues + document.scanResults.summary.critical,
        seriousIssues: prev.seriousIssues + document.scanResults.summary.serious
      }))
    }
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Document 508 Compliance Scanner</h1>
          <p className="text-gray-600 mt-1">
            Upload documents to check for Section 508 compliance and accessibility issues
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Documents</p>
                <p className="text-lg font-semibold text-gray-900">{scanStats.totalDocuments}</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Compliant</p>
                <p className="text-lg font-semibold text-gray-900">{scanStats.compliantDocuments}</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Non-Compliant</p>
                <p className="text-lg font-semibold text-gray-900">{scanStats.nonCompliantDocuments}</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Shield className="h-6 w-6 text-orange-600" />
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-500">Total Issues</p>
                <p className="text-lg font-semibold text-gray-900">{scanStats.totalIssues}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="xl:col-span-3">
            <DocumentUpload onScanComplete={handleScanComplete} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
                         {/* Pa11y + AI Enhancement Info */}
             <div className="card">
               <h3 className="text-lg font-medium text-gray-900 mb-3">Pa11y + AI Analysis</h3>
               <div className="space-y-3">
                 <div className="flex items-start space-x-3">
                   <div className="p-2 bg-blue-100 rounded-lg">
                     <Shield className="h-5 w-5 text-blue-600" />
                   </div>
                   <div>
                     <p className="text-sm font-medium text-gray-900">Pa11y Engine</p>
                     <p className="text-xs text-gray-500">Professional accessibility testing</p>
                   </div>
                 </div>
                 <div className="flex items-start space-x-3">
                   <div className="p-2 bg-purple-100 rounded-lg">
                     <Sparkles className="h-5 w-5 text-purple-600" />
                   </div>
                   <div>
                     <p className="text-sm font-medium text-gray-900">AI-Powered Fixes</p>
                     <p className="text-xs text-gray-500">Intelligent remediation suggestions</p>
                   </div>
                 </div>
                 <div className="flex items-start space-x-3">
                   <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                   <div>
                     <p className="text-sm font-medium text-gray-900">Section 508 Compliant</p>
                     <p className="text-xs text-gray-500">Built-in federal standards</p>
                   </div>
                 </div>
                 <div className="flex items-start space-x-3">
                   <FileText className="h-5 w-5 text-orange-600 mt-0.5" />
                   <div>
                     <p className="text-sm font-medium text-gray-900">Multi-Format Support</p>
                     <p className="text-xs text-gray-500">PDF, Word, PowerPoint, HTML</p>
                   </div>
                 </div>
               </div>
             </div>

             {/* Section 508 Info */}
             <div className="card">
               <h3 className="text-lg font-medium text-gray-900 mb-3">Section 508 Compliance</h3>
               <div className="space-y-3">
                 <div className="flex items-start space-x-3">
                   <Shield className="h-5 w-5 text-blue-600 mt-0.5" />
                   <div>
                     <p className="text-sm font-medium text-gray-900">Federal Requirements</p>
                     <p className="text-xs text-gray-500">Mandatory for federal agencies</p>
                   </div>
                 </div>
                 <div className="flex items-start space-x-3">
                   <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                   <div>
                     <p className="text-sm font-medium text-gray-900">Accessibility Standards</p>
                     <p className="text-xs text-gray-500">WCAG 2.1 Level AA equivalent</p>
                   </div>
                 </div>
                 <div className="flex items-start space-x-3">
                   <FileText className="h-5 w-5 text-purple-600 mt-0.5" />
                   <div>
                     <p className="text-sm font-medium text-gray-900">Document Types</p>
                     <p className="text-xs text-gray-500">PDFs, Word docs, presentations</p>
                   </div>
                 </div>
               </div>
             </div>

            {/* What We Check */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-3">What We Check</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Document Structure</p>
                    <p className="text-xs text-gray-500">Headings, lists, tables</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Alternative Text</p>
                    <p className="text-xs text-gray-500">Images and graphics</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Color Contrast</p>
                    <p className="text-xs text-gray-500">Text readability</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Navigation</p>
                    <p className="text-xs text-gray-500">Links and bookmarks</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Forms</p>
                    <p className="text-xs text-gray-500">Labels and validation</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Supported Formats */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Supported Formats</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">PDF Documents</span>
                  <span className="text-sm font-medium text-gray-900">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Word Documents</span>
                  <span className="text-sm font-medium text-gray-900">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">PowerPoint</span>
                  <span className="text-sm font-medium text-gray-900">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">HTML Files</span>
                  <span className="text-sm font-medium text-gray-900">✓</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Text Files</span>
                  <span className="text-sm font-medium text-gray-900">✓</span>
                </div>
              </div>
              <div className="mt-3 p-2 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <Info className="h-3 w-3 inline mr-1" />
                  Maximum file size: 50MB per document
                </p>
              </div>
            </div>

            {/* Compliance Levels */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Compliance Levels</h3>
              <div className="space-y-3">
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-green-800">Compliant</span>
                  </div>
                  <p className="text-xs text-green-700">
                    No critical or serious issues found. Document meets Section 508 requirements.
                  </p>
                </div>
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center space-x-2 mb-1">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-red-800">Non-Compliant</span>
                  </div>
                  <p className="text-xs text-red-700">
                    Critical or serious issues found. Document requires remediation to meet Section 508 standards.
                  </p>
                </div>
              </div>
            </div>

            {/* Best Practices */}
            <div className="card">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Best Practices</h3>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">Use proper heading structure (H1, H2, H3)</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">Add descriptive alt text to images</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">Ensure sufficient color contrast (4.5:1)</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">Use descriptive link text</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <p className="text-sm text-gray-700">Provide table headers and captions</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Sidebar>
  )
}
