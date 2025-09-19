'use client'

import { useState, useEffect } from 'react'
import { 
  Search, 
  Globe, 
  HelpCircle, 
  CheckCircle, 
  AlertTriangle,
  Eye,
  Upload,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import StatsCard from '@/components/StatsCard'
import ProtectedRoute from '@/components/ProtectedRoute'
import { authenticatedFetch } from '@/lib/auth-utils'
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
  const [websites, setWebsites] = useState<string[]>([])
  const [selectedWebsite, setSelectedWebsite] = useState<string>('all')
  const [timeRange, setTimeRange] = useState<string>('30d')
  const [isLoading, setIsLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)

  // Load scan history and analytics
  useEffect(() => {
    loadDashboardData()
  }, [selectedWebsite, timeRange])

  const loadDashboardData = async () => {
    try {
      // Load scan history
      const historyResponse = await authenticatedFetch('/api/scan-history')
      
      if (historyResponse.ok) {
        const historyData = await historyResponse.json()
        console.log('🔍 Debug: All scans from API:', historyData.scans)
        console.log('🔍 Debug: Scan types found:', historyData.scans.map((s: any) => s.scanType))
        
        const webScans = historyData.scans.filter((scan: any) => scan.scanType === 'web')
        console.log('🔍 Debug: Web scans after filtering:', webScans)
        setScans(webScans)
        
        // Extract unique websites with URL validation
        console.log('🔍 Debug: Total web scans found:', webScans.length)
        console.log('🔍 Debug: Web scans data:', webScans)
        
        const allUrls = webScans.map((scan: any) => scan.url)
        console.log('🔍 Debug: All URLs from scans:', allUrls)
        
        const validUrls = allUrls.filter(Boolean).filter((url: string) => {
          try {
            // Try to create URL as-is first
            new URL(url)
            return true
          } catch (error) {
            try {
              // If that fails, try adding https:// protocol
              new URL(`https://${url}`)
              return true
            } catch (secondError) {
              console.warn('Invalid URL found in scan data:', url)
              return false
            }
          }
        })
        console.log('🔍 Debug: Valid URLs:', validUrls)
        
        const uniqueWebsites = [...new Set(validUrls)]
        console.log('🔍 Debug: Unique websites:', uniqueWebsites)
        setWebsites(uniqueWebsites)
        
        // Calculate analytics
        const analyticsData = calculateAnalytics(webScans, selectedWebsite, timeRange)
        setAnalytics(analyticsData)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const calculateAnalytics = (scans: any[], website: string, range: string) => {
    // Filter scans by website and time range
    let filteredScans = scans
    
    if (website !== 'all') {
      filteredScans = scans.filter(scan => {
        // Handle URLs with or without protocols
        const scanUrl = scan.url
        const selectedUrl = website
        
        // Direct match
        if (scanUrl === selectedUrl) return true
        
        // Try to normalize both URLs for comparison
        try {
          const scanUrlObj = new URL(scanUrl)
          const selectedUrlObj = new URL(selectedUrl)
          return scanUrlObj.hostname === selectedUrlObj.hostname
        } catch (error) {
          try {
            const scanUrlObj = new URL(`https://${scanUrl}`)
            const selectedUrlObj = new URL(`https://${selectedUrl}`)
            return scanUrlObj.hostname === selectedUrlObj.hostname
          } catch (secondError) {
            return false
          }
        }
      })
    }
    
    // Filter by time range
    const now = new Date()
    const daysBack = range === '7d' ? 7 : range === '30d' ? 30 : 90
    const cutoffDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000))
    filteredScans = filteredScans.filter(scan => new Date(scan.createdAt) >= cutoffDate)
    
    // Sort by date
    filteredScans.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    
    // Calculate trends - use individual severity counts for accuracy
    const criticalIssues = filteredScans.reduce((sum, scan) => sum + (scan.criticalIssues || 0), 0)
    const seriousIssues = filteredScans.reduce((sum, scan) => sum + (scan.seriousIssues || 0), 0)
    const moderateIssues = filteredScans.reduce((sum, scan) => sum + (scan.moderateIssues || 0), 0)
    const minorIssues = filteredScans.reduce((sum, scan) => sum + (scan.minorIssues || 0), 0)
    const totalIssues = criticalIssues + seriousIssues + moderateIssues + minorIssues
    
    // Calculate exact issue changes (comparing most recent scan vs previous scan for the same website)
    let issuesFixed = 0
    let issuesAdded = 0
    let previousTotalIssues = 0
    let currentTotalIssues = 0
    
    if (filteredScans.length >= 2) {
      const mostRecent = filteredScans[filteredScans.length - 1]
      const previous = filteredScans[filteredScans.length - 2]
      
      currentTotalIssues = (mostRecent.criticalIssues || 0) + (mostRecent.seriousIssues || 0) + 
                          (mostRecent.moderateIssues || 0) + (mostRecent.minorIssues || 0)
      previousTotalIssues = (previous.criticalIssues || 0) + (previous.seriousIssues || 0) + 
                           (previous.moderateIssues || 0) + (previous.minorIssues || 0)
      
      const difference = currentTotalIssues - previousTotalIssues
      if (difference > 0) {
        issuesAdded = difference
      } else if (difference < 0) {
        issuesFixed = Math.abs(difference)
      }
    }
    
    // Create chart data
    const chartData = filteredScans.map(scan => ({
      date: new Date(scan.createdAt).toLocaleDateString(),
      total: (scan.criticalIssues || 0) + (scan.seriousIssues || 0) + (scan.moderateIssues || 0) + (scan.minorIssues || 0),
      critical: scan.criticalIssues || 0,
      serious: scan.seriousIssues || 0,
      moderate: scan.moderateIssues || 0,
      minor: scan.minorIssues || 0
    }))
    
    return {
      totalScans: filteredScans.length,
      totalIssues,
      criticalIssues,
      seriousIssues,
      moderateIssues,
      minorIssues,
      issuesFixed,
      issuesAdded,
      previousTotalIssues,
      currentTotalIssues,
      chartData,
      recentScans: filteredScans.slice(-5).reverse()
    }
  }

  const stats = analytics ? [
    {
      title: 'Total Scans',
      value: analytics.totalScans.toString(),
      icon: Search,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'Total Issues',
      value: analytics.totalIssues.toString(),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    {
      title: 'Critical Issues',
      value: analytics.criticalIssues.toString(),
      icon: AlertTriangle,
      color: 'text-red-600',
      bgColor: 'bg-red-50'
    },
    // Show progress for individual websites (not "All Websites")
    ...(selectedWebsite !== 'all' ? [{
      title: 'Issues vs Last Scan',
      value: analytics.totalScans < 2 ? 'No previous scan to compare' :
             analytics.issuesFixed > 0 ? `${analytics.issuesFixed} issues fixed` :
             analytics.issuesAdded > 0 ? `${analytics.issuesAdded} new issues` :
             'No change',
      icon: analytics.totalScans < 2 ? BarChart3 : 
            analytics.issuesFixed > 0 ? TrendingDown : 
            analytics.issuesAdded > 0 ? TrendingUp : BarChart3,
      color: analytics.totalScans < 2 ? 'text-gray-600' :
             analytics.issuesFixed > 0 ? 'text-green-600' : 
             analytics.issuesAdded > 0 ? 'text-red-600' : 'text-gray-600',
      bgColor: analytics.totalScans < 2 ? 'bg-gray-50' :
               analytics.issuesFixed > 0 ? 'bg-green-50' : 
               analytics.issuesAdded > 0 ? 'bg-red-50' : 'bg-gray-50'
    }] : [])
  ] : []

  return (
    <Sidebar>
      <div className="space-y-6">
        {/* Header with Controls */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Accessibility Dashboard</h1>
            <p className="text-gray-600">Track and analyze your website accessibility over time</p>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={loadDashboardData}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </button>
            <Link
              href="/new-scan"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700"
            >
              <Globe className="h-4 w-4 mr-2" />
              New Scan
            </Link>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Website:</label>
              <select
                value={selectedWebsite}
                onChange={(e) => setSelectedWebsite(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value="all">All Websites</option>
                {websites.length === 0 ? (
                  <option value="none" disabled>
                    No websites found - run a web scan first
                  </option>
                ) : (
                  websites.map((website) => {
                    try {
                      // Try to create URL as-is first
                      const url = new URL(website)
                      return (
                        <option key={website} value={website}>
                          {url.hostname}
                        </option>
                      )
                    } catch (error) {
                      try {
                        // If that fails, try adding https:// protocol
                        const url = new URL(`https://${website}`)
                        return (
                          <option key={website} value={website}>
                            {url.hostname}
                          </option>
                        )
                      } catch (secondError) {
                        // If both fail, just show the website string as-is
                        return (
                          <option key={website} value={website}>
                            {website}
                          </option>
                        )
                      }
                    }
                  })
                )}
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-600">Time Range:</label>
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
              </select>
            </div>
          </div>
        </div>

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

        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <StatsCard key={index} {...stat} />
            ))}
          </div>
        )}

        {/* Charts and Analytics */}
        {analytics && analytics.chartData.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Issues Over Time Chart */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <BarChart3 className="h-5 w-5 mr-2" />
                  Issues Over Time
                </h3>
              </div>
              <div className="space-y-3">
                {analytics.chartData.map((data: any, index: number) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="text-sm font-medium text-gray-900">{data.date}</div>
                    </div>
                    <div className="flex items-center space-x-4">
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">{data.total} total</div>
                        <div className="text-xs text-gray-500">
                          {data.critical}C {data.serious}S {data.moderate}M {data.minor}m
                        </div>
                      </div>
                      <div className="w-20 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-red-500 h-2 rounded-full" 
                          style={{ width: `${Math.min((data.total / Math.max(...analytics.chartData.map((d: any) => d.total))) * 100, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Issue Breakdown */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Issue Breakdown</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Critical</span>
                  </div>
                  <span className="text-sm font-bold text-red-600">{analytics.criticalIssues}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Serious</span>
                  </div>
                  <span className="text-sm font-bold text-orange-600">{analytics.seriousIssues}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Moderate</span>
                  </div>
                  <span className="text-sm font-bold text-yellow-600">{analytics.moderateIssues}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                    <span className="text-sm font-medium text-gray-700">Minor</span>
                  </div>
                  <span className="text-sm font-bold text-blue-600">{analytics.minorIssues}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Scans */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Recent Scans</h3>
            <Link href="/scan-history" className="text-primary-600 hover:text-primary-700 text-sm font-medium">
              View All
            </Link>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading recent scans...</p>
            </div>
          ) : analytics && analytics.recentScans.length === 0 ? (
            <div className="text-center py-8">
              <Eye className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500">
                No scans found for the selected filters. Start a new scan to see results here.
              </p>
            </div>
          ) : analytics ? (
            <div className="space-y-4">
              {analytics.recentScans.map((scan: any, index: number) => (
                <div key={index} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <Globe className="h-4 w-4 text-blue-600" />
                <h4 className="font-medium text-gray-900">
                  {(() => {
                    try {
                      // Try to create URL as-is first
                      return new URL(scan.url).hostname
                    } catch (error) {
                      try {
                        // If that fails, try adding https:// protocol
                        return new URL(`https://${scan.url}`).hostname
                      } catch (secondError) {
                        // If both fail, just show the URL as-is
                        return scan.url
                      }
                    }
                  })()}
                </h4>
                        <span className="text-xs text-gray-500">
                          {new Date(scan.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{scan.url}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {(scan.criticalIssues || 0) + (scan.seriousIssues || 0) + (scan.moderateIssues || 0) + (scan.minorIssues || 0)} issues
                        </span>
                        {scan.criticalIssues > 0 && (
                          <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                            {scan.criticalIssues} Critical
                          </span>
                        )}
                        {scan.seriousIssues > 0 && (
                          <span className="px-2 py-1 text-xs bg-orange-100 text-orange-800 rounded-full">
                            {scan.seriousIssues} Serious
                          </span>
                        )}
                      </div>
                      <Link 
                        href={`/scan-history/${scan.id}`}
                        className="text-xs text-primary-600 hover:text-primary-700"
                      >
                        View Details
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Website Scans</h3>
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

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Document Scans</h3>
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
      </div>
    </Sidebar>
  )
}
