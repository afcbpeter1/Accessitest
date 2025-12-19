'use client'

import React from 'react'
import { Info } from 'lucide-react'
import Sidebar from '@/components/Sidebar'
import DocumentUpload from '@/components/DocumentUpload'
import AutoFixCapabilities from '@/components/AutoFixCapabilities'

export default function DocumentScan() {

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">AI Document Accessibility Scanner</h1>
          <p className="text-gray-600 mt-1">
            Upload documents to scan for accessibility issues. AI will analyze each issue and provide detailed step-by-step suggestions for fixing them.
          </p>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="xl:col-span-3">
            <DocumentUpload />
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
