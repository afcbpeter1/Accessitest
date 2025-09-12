'use client'

import { useState, useEffect } from 'react'
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
import ProtectedRoute from '@/components/ProtectedRoute'
import CreditDisplay from '@/components/CreditDisplay'


export default function Dashboard() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  )
}

function DashboardContent() {
  const [scans, setScans] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Load recent scans from database
  useEffect(() => {
    const loadRecentScans = async () => {
      try {
        const response = await fetch('/api/document-scan')
        if (response.ok) {
          const history = await response.json()
          // Show only the 3 most recent scans
          setScans((history.scans || []).slice(0, 3))
        }
      } catch (error) {
        console.error('Failed to load recent scans:', error)
      } finally {
        setIsLoading(false)
      }
    }

    loadRecentScans()
  }, [])

  const stats = [
    {
      title: 'Total Scans',
      value: scans.length.toString(),
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
        {/* Credit Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-2">Your Credits</h2>
              <p className="text-gray-600">Manage your scanning credits and subscription</p>
            </div>
            <CreditDisplay showBuyButton={true} />
          </div>
        </div>

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
           </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading recent scans...</p>
            </div>
          ) : scans.length === 0 ? (
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
                      <h3 className="font-medium text-gray-900">{scan.fileName}</h3>
                      <p className="text-sm text-gray-500">
                        Scanned on {new Date(scan.scanDate).toLocaleDateString()} • {scan.fileType}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {scan.scanResults?.summary?.total || 0} issues found
                      </p>
                      <p className="text-xs text-gray-500">
                        {scan.pagesAnalyzed || 0} pages analyzed
                      </p>
                    </div>
                  </div>
                  {scan.is508Compliant !== undefined && (
                    <div className="mt-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        scan.is508Compliant ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {scan.is508Compliant ? '508 Compliant' : 'Non-Compliant'}
                      </span>
                      {scan.overallScore && (
                        <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded-full">
                          Score: {scan.overallScore}/100
                        </span>
                      )}
                    </div>
                  )}
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
