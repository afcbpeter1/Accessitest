'use client'

import { useEffect, useState, useMemo } from 'react'
import { FileText, Sparkles, CheckCircle } from 'lucide-react'

interface ScanningAnimationProps {
  fileName?: string
  isScanning: boolean
  progress?: number // 0-100
  documentPreview?: string // Base64 image of document preview
}

export default function ScanningAnimation({ fileName, isScanning, progress = 0, documentPreview }: ScanningAnimationProps) {
  const [scanPosition, setScanPosition] = useState(0)
  const [fadeProgress, setFadeProgress] = useState(0)
  const [scanDirection, setScanDirection] = useState(1) // 1 = down, -1 = up

  // Generate stable particle positions
  const particlePositions = useMemo(() => {
    return Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      delay: Math.random() * 2,
      duration: 2 + Math.random() * 2
    }))
  }, [])

  useEffect(() => {
    // Keep animation running even after scan completes - just slow it down
    // Only reset if explicitly stopped
    if (!isScanning && progress < 100) {
      setScanPosition(0)
      setFadeProgress(0)
      setScanDirection(1)
      return
    }

    let animationFrameId: number
    let lastTime = Date.now()

    // Animate scanning line moving up and down smoothly using requestAnimationFrame
    const animateScanLine = () => {
      const now = Date.now()
      const deltaTime = (now - lastTime) / 16 // Normalize to ~60fps
      lastTime = now

      setScanPosition(prev => {
        // Move from 0 to 100, then back to 0 in a smooth loop
        const speed = 0.8 * deltaTime // Adjust speed (percentage per frame)
        let newPos = prev + (speed * scanDirection)
        
        // Reverse direction at boundaries
        if (newPos >= 100) {
          setScanDirection(-1)
          return 100
        } else if (newPos <= 0) {
          setScanDirection(1)
          return 0
        }
        
        return newPos
      })

      animationFrameId = requestAnimationFrame(animateScanLine)
    }

    // Start animation
    animationFrameId = requestAnimationFrame(animateScanLine)

    // Sync fade-in progress with actual scan progress
    // Document should fully fade in as scan progresses
    let fadeInterval: NodeJS.Timeout | null = null
    
    if (progress > 0) {
      setFadeProgress(Math.min(100, progress))
    } else {
      // Animate fade-in progress (document preview appearing) if no progress provided
      fadeInterval = setInterval(() => {
        setFadeProgress(prev => {
          if (prev >= 100) return 100
          // Faster fade-in at start, slower near end
          const increment = prev < 50 ? 1.2 : 0.6
          return Math.min(100, prev + increment)
        })
      }, 16)
    }

    return () => {
      cancelAnimationFrame(animationFrameId)
      if (fadeInterval) {
        clearInterval(fadeInterval)
      }
    }
  }, [isScanning, progress])

  // Keep animation visible even after scan completes (when progress is 100%)
  // Only hide if explicitly not scanning and progress is 0
  if (!isScanning && progress === 0) return null

  // Calculate progress bar width (use actual progress if available, otherwise fade progress)
  const progressBarWidth = progress > 0 ? progress : Math.max(10, (fadeProgress / 100) * 90)

  return (
    <div className="relative w-full bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden border border-gray-200 shadow-lg">
      {/* Document Preview Area */}
      <div className="relative h-96 bg-white overflow-hidden">
        {/* Actual Document Preview or Placeholder */}
        {documentPreview ? (
          <>
            {/* Full document preview - blurred background that fades in */}
            <img
              src={documentPreview}
              alt="Document preview"
              className="absolute inset-0 w-full h-full object-cover"
              style={{
                opacity: Math.min(1, 0.2 + (fadeProgress / 100) * 0.8), // Fade in from 20% to 100%
                filter: `blur(${Math.max(0, 10 - (fadeProgress / 100) * 10)}px)`, // Reduce blur as it fades in
                transform: `scale(${0.98 + (fadeProgress / 100) * 0.02})`, // Slight zoom in effect
                transition: 'opacity 0.3s ease-out, filter 0.3s ease-out, transform 0.3s ease-out'
              }}
              onError={(e) => {
                console.error('❌ Failed to load document preview image')
                console.error('Preview data:', documentPreview.substring(0, 100))
              }}
              onLoad={() => {
                console.log('✅ Document preview image loaded successfully')
              }}
            />
            
            {/* Partial scan reveal effect - shows scanned portion clearly (sharp, no blur) */}
            <img
              src={documentPreview}
              alt="Document preview - scanned portion"
              className="absolute inset-0 w-full h-full object-contain"
              style={{
                opacity: 1,
                filter: 'blur(0px)',
                clipPath: `inset(0% ${100 - progressBarWidth}% 0% 0%)`, // Reveal from left to right based on progress
                transition: 'clip-path 0.3s ease-out',
                zIndex: 1
              }}
              onError={(e) => {
                console.error('❌ Failed to load document preview image (reveal layer)')
              }}
            />
          </>
        ) : (
          // Placeholder document preview with fade-in
          <div 
            className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-gray-50"
            style={{
              opacity: 0.2 + (fadeProgress / 100) * 0.8, // Fade in from 20% to 100%
              filter: `blur(${Math.max(0, 15 - (fadeProgress / 100) * 15)}px)`, // Reduce blur as it fades in
              transition: 'opacity 0.5s ease-out, filter 0.5s ease-out'
            }}
          >
            {/* Simulated document content */}
            <div className="p-8 space-y-4">
              {/* Header */}
              <div className="h-12 bg-gray-300 rounded" style={{ opacity: 0.6 }}></div>
              
              {/* Content blocks */}
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4" style={{ opacity: 0.5 }}></div>
                <div className="h-4 bg-gray-200 rounded w-full" style={{ opacity: 0.5 }}></div>
                <div className="h-4 bg-gray-200 rounded w-5/6" style={{ opacity: 0.5 }}></div>
              </div>
              
              {/* Image placeholder */}
              <div className="h-32 bg-gray-200 rounded" style={{ opacity: 0.4 }}></div>
              
              {/* More content */}
              <div className="space-y-3">
                <div className="h-4 bg-gray-200 rounded w-full" style={{ opacity: 0.5 }}></div>
                <div className="h-4 bg-gray-200 rounded w-4/5" style={{ opacity: 0.5 }}></div>
              </div>
            </div>
          </div>
        )}

        {/* Scanning Line - Moves up and down smoothly */}
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{
            top: `${scanPosition}%`,
            transform: 'translateY(-50%)',
            willChange: 'top', // Optimize for animation
            transition: 'none', // Remove transition for smooth animation
          }}
        >
          {/* Main scanning line with glow effect */}
          <div className="relative h-2 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-2xl">
            {/* Glow effect - multiple layers for better visibility */}
            <div className="absolute inset-0 bg-blue-400 blur-md opacity-80"></div>
            <div className="absolute inset-0 bg-blue-300 blur-sm opacity-60"></div>
            <div className="relative h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
          </div>
          
          {/* Scanning indicator dots */}
          <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-lg"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-lg" style={{ animationDelay: '0.2s' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-lg" style={{ animationDelay: '0.4s' }}></div>
          </div>
        </div>

        {/* Corner Scanning Indicators */}
        <div className="absolute top-0 left-0 w-16 h-16 border-t-2 border-l-2 border-blue-500 opacity-60 animate-pulse"></div>
        <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-blue-500 opacity-60 animate-pulse"></div>
        <div className="absolute bottom-0 left-0 w-16 h-16 border-b-2 border-l-2 border-blue-500 opacity-60 animate-pulse"></div>
        <div className="absolute bottom-0 right-0 w-16 h-16 border-b-2 border-r-2 border-blue-500 opacity-60 animate-pulse"></div>

        {/* Scanning particles effect */}
        <div className="absolute inset-0 pointer-events-none z-10">
          {particlePositions.map((particle) => (
            <div
              key={particle.id}
              className="absolute w-1 h-1 bg-blue-400 rounded-full opacity-30 animate-pulse"
              style={{
                left: `${particle.left}%`,
                top: `${particle.top}%`,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`
              }}
            ></div>
          ))}
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-gray-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            {progress >= 100 ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-gray-900">Scan Complete</span>
              </>
            ) : (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium text-gray-900">Scanning your document...</span>
              </>
            )}
          </div>
          {fileName && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <FileText className="h-3 w-3" />
              <span className="truncate max-w-xs">{fileName}</span>
            </div>
          )}
        </div>
        
        {/* Progress bar - moves across as scan progresses */}
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden shadow-inner">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-blue-600 to-blue-500 rounded-full transition-all duration-500 ease-out shadow-lg relative overflow-hidden"
            style={{
              width: `${progressBarWidth}%`,
            }}
          >
            {/* Animated shimmer effect on progress bar */}
            <div 
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
              style={{
                width: '50%',
                transform: 'translateX(-100%)',
                animation: 'shimmer 2s infinite'
              }}
            ></div>
          </div>
        </div>
        
        {/* Progress percentage */}
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-gray-500 flex items-center space-x-1">
            <Sparkles className="h-3 w-3" />
            <span>Evaluating accessibility requirements...</span>
          </p>
          <span className="text-xs font-medium text-blue-600">
            {Math.round(progressBarWidth)}%
          </span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(200%);
          }
        }
      `}} />
    </div>
  )
}
