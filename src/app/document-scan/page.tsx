'use client'

import React, { useState } from 'react'
import { FileText, Shield, CheckCircle, AlertTriangle, Info, Sparkles } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import DocumentUpload from '@/components/DocumentUpload'
import AutoFixCapabilities from '@/components/AutoFixCapabilities'

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
          <h1 className="text-2xl font-semibold text-gray-900">AI Document Repairer</h1>
          <p className="text-gray-600 mt-1">
            Upload documents to automatically fix accessibility issues using AI. Get repaired documents ready to download.
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
            {/* Auto-Fix Capabilities */}
            <AutoFixCapabilities />

            {/* Supported Formats */}
            <div className="card">
              <h2 className="text-lg font-medium text-gray-900 mb-3">Supported Formats</h2>
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
          </div>
        </div>
      </div>
    </Sidebar>
  )
}
