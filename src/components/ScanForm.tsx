'use client'

import { useState } from 'react'
import { Search, Globe, HelpCircle } from 'lucide-react'

interface ScanFormProps {
  onScanComplete: (scan: any) => void
}

export default function ScanForm({ onScanComplete }: ScanFormProps) {
  const [url, setUrl] = useState('')
  const [includeSubdomains, setIncludeSubdomains] = useState(true)
  const [deepCrawl, setDeepCrawl] = useState(false)
  const [isScanning, setIsScanning] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!url) return

    setIsScanning(true)
    
    try {
      // Simulate scan process
      await new Promise(resolve => setTimeout(resolve, 3000))
      
      // Mock scan result
      const scanResult = {
        id: Date.now(),
        url: url,
        date: new Date().toISOString(),
        pagesScanned: Math.floor(Math.random() * 50) + 10,
        issuesFound: Math.floor(Math.random() * 20) + 5,
        status: 'completed',
        includeSubdomains,
        deepCrawl
      }
      
      onScanComplete(scanResult)
      setUrl('')
    } catch (error) {
      console.error('Scan failed:', error)
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* URL Input */}
      <div>
        <label htmlFor="url" className="block text-sm font-medium text-gray-700 mb-2">
          Website URL
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Globe className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="input-field pl-10"
            required
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600"
              title="Help"
            >
              <HelpCircle className="h-5 w-5" />
            </button>
          </div>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Enter the domain you want to scan for accessibility issues
        </p>
      </div>

      {/* Scan Options */}
      <div className="space-y-3">
        <div className="flex items-center">
          <input
            id="includeSubdomains"
            type="checkbox"
            checked={includeSubdomains}
            onChange={(e) => setIncludeSubdomains(e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="includeSubdomains" className="ml-2 block text-sm text-gray-700">
            Include subdomains
          </label>
        </div>
        
        <div className="flex items-center">
          <input
            id="deepCrawl"
            type="checkbox"
            checked={deepCrawl}
            onChange={(e) => setDeepCrawl(e.target.checked)}
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <label htmlFor="deepCrawl" className="ml-2 block text-sm text-gray-700">
            Deep crawl (up to 100 pages)
          </label>
        </div>
      </div>

      {/* Start Scan Button */}
      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isScanning || !url}
          className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Search className="h-4 w-4" />
          <span>{isScanning ? 'Scanning...' : 'Start Scan'}</span>
        </button>
      </div>
    </form>
  )
}

