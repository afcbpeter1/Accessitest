'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface ScanProgress {
  scanId: string
  type: 'web' | 'document'
  status: 'crawling' | 'scanning' | 'analyzing' | 'complete' | 'error'
  currentPage: number
  totalPages: number
  startTime: number
  fileName?: string
  url?: string
  message?: string
}

interface ScanContextType {
  activeScans: ScanProgress[]
  addScan: (scan: ScanProgress) => void
  updateScan: (scanId: string, updates: Partial<ScanProgress>) => void
  removeScan: (scanId: string) => void
  getActiveScan: (scanId: string) => ScanProgress | undefined
  isAnyScanActive: boolean
}

const ScanContext = createContext<ScanContextType | undefined>(undefined)

export function ScanProvider({ children }: { children: React.ReactNode }) {
  const [activeScans, setActiveScans] = useState<ScanProgress[]>([])

  const addScan = (scan: ScanProgress) => {
    setActiveScans(prev => {
      // Remove any existing scan with the same ID
      const filtered = prev.filter(s => s.scanId !== scan.scanId)
      return [...filtered, scan]
    })
  }

  const updateScan = (scanId: string, updates: Partial<ScanProgress>) => {
    setActiveScans(prev => 
      prev.map(scan => 
        scan.scanId === scanId 
          ? { ...scan, ...updates }
          : scan
      )
    )
  }

  const removeScan = (scanId: string) => {
    setActiveScans(prev => prev.filter(scan => scan.scanId !== scanId))
  }

  const getActiveScan = (scanId: string) => {
    return activeScans.find(scan => scan.scanId === scanId)
  }

  const isAnyScanActive = activeScans.some(scan => 
    scan.status !== 'complete' && scan.status !== 'error'
  )

  // Clean up completed scans after 2 minutes (longer for better UX)
  useEffect(() => {
    const cleanup = setInterval(() => {
      setActiveScans(prev => 
        prev.filter(scan => {
          const isCompleted = scan.status === 'complete' || scan.status === 'error'
          const isOld = Date.now() - scan.startTime > 120000 // 2 minutes
          return !isCompleted || !isOld
        })
      )
    }, 10000) // Check every 10 seconds

    return () => clearInterval(cleanup)
  }, [])

  return (
    <ScanContext.Provider value={{
      activeScans,
      addScan,
      updateScan,
      removeScan,
      getActiveScan,
      isAnyScanActive
    }}>
      {children}
    </ScanContext.Provider>
  )
}

export function useScan() {
  const context = useContext(ScanContext)
  if (context === undefined) {
    throw new Error('useScan must be used within a ScanProvider')
  }
  return context
}
