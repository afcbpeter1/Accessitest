'use client'

import { useState } from 'react'
import { 
  Search, 
  Globe, 
  HelpCircle, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Upload
} from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import StatsCard from '@/components/StatsCard'

export default function Dashboard() {
  const [scans, setScans] = useState<any[]>([])

  const stats = [
    {
      title: 'Total Scans',
      value: '0',
      icon: Search,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Issues Resolved',
      value: '0',
      icon: CheckCircle,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'Active Issues',
      value: '0',
      icon: AlertTriangle,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-50'
    }
  ]

  return (
    <Sidebar>
      <div className="space-y-6">


        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Website Scans
              </h2>
              <Link href="/new-scan" className="text-primary-600 hover:text-primary-700 font-medium">
                New scan
              </Link>
            </div>
            <p className="text-gray-600 mb-4">
              Scan websites for WCAG 2.2 accessibility compliance and get detailed reports.
            </p>
            <Link 
              href="/new-scan"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Globe className="h-4 w-4 mr-2" />
              Start Website Scan
            </Link>
          </div>

          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                Document Scans
              </h2>
              <Link href="/document-scan" className="text-primary-600 hover:text-primary-700 font-medium">
                New scan
              </Link>
            </div>
            <p className="text-gray-600 mb-4">
              Upload documents to check for Section 508 compliance and accessibility issues.
            </p>
            <Link 
              href="/document-scan"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Upload className="h-4 w-4 mr-2" />
              Start Document Scan
            </Link>
          </div>
        </div>

        {/* Recent Scan Results */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">
              Recent Scan Results
            </h2>
            <Link href="/history" className="text-primary-600 hover:text-primary-700 font-medium">
              View all scans
            </Link>
          </div>

          {scans.length === 0 ? (
            <div className="text-center py-8">
              <Eye className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">
                No completed scans yet. Use the "New Scan" button in the navigation to start your first accessibility scan.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {scans.map((scan, index) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900">{scan.url}</h3>
                      <p className="text-sm text-gray-500">
                        Scanned on {new Date(scan.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {scan.issuesFound} issues found
                      </p>
                      <p className="text-xs text-gray-500">
                        {scan.pagesScanned} pages scanned
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {stats.map((stat, index) => (
            <StatsCard key={index} {...stat} />
          ))}
        </div>
      </div>
    </Sidebar>
  )
}
