'use client'

import React, { useState, useRef } from 'react'
import Link from 'next/link'
import { 
  Upload, 
  FileImage, 
  X, 
  AlertTriangle, 
  Shield, 
  Contrast,
  CheckCircle,
  Download,
  Home,
  ArrowLeft,
  Search,
  FileText,
  BarChart3,
  Clock,
  Kanban,
  Trello,
  List,
  Repeat,
  DollarSign
} from 'lucide-react'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useScreenReaderAnnounce } from '../../hooks/useScreenReaderAnnounce'
import Footer from '../../components/Footer'

interface LogoColor {
  hex: string
  rgb: [number, number, number]
  frequency: number
}

export default function LogoContrastChecker() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [logoColors, setLogoColors] = useState<LogoColor[]>([])
  const [selectedForeground, setSelectedForeground] = useState<string>('')
  const [selectedBackground, setSelectedBackground] = useState<string>('')
  const [contrastRatio, setContrastRatio] = useState<number | null>(null)
  const [contrastLevel, setContrastLevel] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Screen reader announcements
  useScreenReaderAnnounce(error, 'assertive')
  useScreenReaderAnnounce(isAnalyzing ? 'Analyzing logo contrast...' : '', 'polite')

  // Helper functions for contrast calculation
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0]
  }

  const getLuminance = (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  const getContrastRatio = (color1: [number, number, number], color2: [number, number, number]): number => {
    const lum1 = getLuminance(color1[0], color1[1], color1[2])
    const lum2 = getLuminance(color2[0], color2[1], color2[2])
    const brightest = Math.max(lum1, lum2)
    const darkest = Math.min(lum1, lum2)
    return (brightest + 0.05) / (darkest + 0.05)
  }

  const getContrastLevel = (ratio: number): string => {
    if (ratio >= 7.0) return 'AAA'
    if (ratio >= 4.5) return 'AA'
    if (ratio >= 3.0) return 'AA Large'
    return 'Fail'
  }

  const getContrastDescription = (ratio: number, level: string): { description: string; recommendation: string; axeReasoning: string } => {
    const descriptions = {
      AAA: 'Excellent contrast ratio that meets the highest accessibility standards.',
      AA: 'Good contrast ratio that meets standard accessibility requirements.',
      'AA Large': 'Acceptable contrast ratio for large text (18pt+ or 14pt+ bold).',
      Fail: 'Poor contrast ratio that does not meet accessibility standards.'
    }
    
    const recommendations = {
      AAA: 'This color combination provides excellent accessibility for all users.',
      AA: 'This color combination meets standard accessibility requirements.',
      'AA Large': 'Consider using this combination only for large text or increase contrast for smaller text.',
      Fail: 'Consider using colors with higher contrast or use this combination only for decorative elements.'
    }
    
    const axeReasoning = {
      AAA: `This element has a contrast ratio of ${ratio.toFixed(2)}, which meets the WCAG 2.2 AAA standard for normal text (7.0:1). This ensures excellent readability for users with visual impairments.`,
      AA: `This element has a contrast ratio of ${ratio.toFixed(2)}, which meets the WCAG 2.2 AA standard for normal text (4.5:1). This provides good accessibility for most users.`,
      'AA Large': `This element has a contrast ratio of ${ratio.toFixed(2)}, which meets the WCAG 2.2 AA standard for large text (3.0:1). This is acceptable for text that is 18pt or larger, or 14pt bold.`,
      Fail: `This element has a contrast ratio of ${ratio.toFixed(2)}, which does not meet the WCAG 2.2 AA standard (4.5:1 for normal text, 3.0:1 for large text). This may cause readability issues for users with visual impairments.`
    }
    
    return {
      description: descriptions[level as keyof typeof descriptions],
      recommendation: recommendations[level as keyof typeof recommendations],
      axeReasoning: axeReasoning[level as keyof typeof axeReasoning]
    }
  }

  // Calculate contrast when colors change
  const calculateContrast = () => {
    if (selectedForeground && selectedBackground) {
      const ratio = getContrastRatio(
        hexToRgb(selectedForeground),
        hexToRgb(selectedBackground)
      )
      setContrastRatio(ratio)
      setContrastLevel(getContrastLevel(ratio))
    }
  }

  // Allowed file types for security
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
  const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

  const validateFile = (file: File): string | null => {
    // Check file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return 'Please upload a PNG, JPEG, GIF, or WebP image.'
    }
    
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 5MB.'
    }
    
    // Check for double extensions (security)
    const fileName = file.name.toLowerCase()
    const hasDoubleExtension = /\.(png|jpg|jpeg|gif|webp)\.(png|jpg|jpeg|gif|webp)$/.test(fileName)
    if (hasDoubleExtension) {
      return 'Invalid file format. Please upload a valid image file.'
    }
    
    return null
  }

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      
      setSelectedFile(file)
      setError(null)
      
      // Create preview URL
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      
      // Analyze the image
      analyzeImage(file)
    }
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
    
    const file = event.dataTransfer.files[0]
    if (file) {
      const validationError = validateFile(file)
      if (validationError) {
        setError(validationError)
        return
      }
      
      setSelectedFile(file)
      setError(null)
      
      // Create preview URL
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
      
      // Analyze the image
      analyzeImage(file)
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragActive(false)
  }

  const removeFile = () => {
    setSelectedFile(null)
    setPreviewUrl(null)
    setLogoColors([])
    setSelectedForeground('')
    setSelectedBackground('')
    setContrastRatio(null)
    setContrastLevel('')
    setError(null)
    
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
    }
  }

  const analyzeImage = async (file: File) => {
    setIsAnalyzing(true)
    setError(null)
    
    try {
      const formData = new FormData()
      formData.append('image', file)
      
      const response = await fetch('/api/logo-contrast-check', {
        method: 'POST',
        body: formData,
      })
      
      const data = await response.json()
      
      if (data.success) {
        setLogoColors(data.logoColors || [])
        // Log debug info to console
        if (data.debug) {


          )
        }
      } else {
        setError(data.error || 'Failed to analyze image')
      }
    } catch (error) {
      console.error('Image analysis error:', error)
      setError('Network error. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  // Calculate contrast when colors change
  React.useEffect(() => {
    calculateContrast()
  }, [selectedForeground, selectedBackground])

  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Home</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <img src="/allytest.png" alt="AccessScan" className="h-8 w-auto" />
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="text-gray-600 hover:text-gray-900">Sign In</Link>
              <Link href="/signup" className="bg-[#0B1220] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800">Get Started</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2 text-gray-900">CONTRAST CHECKER</h1>
            <p className="text-gray-600">Professional accessibility testing for your logo</p>
          </div>

        {/* Main Interface - Like the contrast checker */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - Color Selection */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">COLOR SELECTION</h2>
            
            {/* Upload Section */}
            {!selectedFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragActive 
                    ? 'border-blue-500 bg-blue-50' 
                    : 'border-gray-300 hover:border-gray-400'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="flex flex-col items-center space-y-4">
                  <Upload className="h-12 w-12 text-gray-500" />
                  <div>
                    <p className="text-lg font-medium mb-2 text-gray-900">
                      Upload your logo
                    </p>
                    <p className="text-gray-600 mb-4">
                      Drag and drop or click to browse
                    </p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-[#0B1220] text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-800 transition-colors"
                    >
                      Choose File
                    </button>
                  </div>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleFileInput}
                  className="hidden"
                  aria-label="Upload logo file"
                />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Logo Preview */}
                {previewUrl && (
                  <div className="mb-4 p-4 bg-white border border-gray-200 rounded-lg">
                    <h3 className="font-medium mb-2 text-gray-900">Your Logo:</h3>
                    <div className="flex items-center justify-center">
                      <img
                        src={previewUrl}
                        alt="Your logo"
                        className="max-h-32 max-w-full object-contain"
                      />
                    </div>
                  </div>
                )}
                
                {/* Color Palette */}
                {logoColors.length > 0 && (
                  <div className="mb-4">
                    <h3 className="font-medium mb-3 text-gray-900">Colors found in your logo:</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Click on colors to select them as foreground (F) or background (B) for contrast testing.
                    </p>
                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {logoColors.map((color, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            if (selectedForeground === color.hex) {
                              setSelectedForeground('')
                            } else if (selectedBackground === color.hex) {
                              setSelectedBackground('')
                            } else if (!selectedForeground) {
                              setSelectedForeground(color.hex)
                            } else if (!selectedBackground) {
                              setSelectedBackground(color.hex)
                            }
                          }}
                          className={`relative p-2 rounded border-2 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            selectedForeground === color.hex
                              ? 'border-blue-600 bg-blue-50'
                              : selectedBackground === color.hex
                              ? 'border-green-600 bg-green-50'
                              : 'border-gray-300 hover:border-gray-400'
                          }`}
                          title={`${color.hex} (appears ${color.frequency} times). Click to select as foreground or background color.`}
                          aria-label={`Color ${color.hex}. ${selectedForeground === color.hex ? 'Selected as foreground' : selectedBackground === color.hex ? 'Selected as background' : 'Click to select'}`}
                        >
                          <div 
                            className="w-6 h-6 rounded border border-gray-300"
                            style={{ backgroundColor: color.hex }}
                          ></div>
                          <div className="text-xs text-gray-600 mt-1 font-mono">
                            {color.hex}
                          </div>
                          {selectedForeground === color.hex && (
                            <div 
                              className="absolute -top-1 -right-1 bg-blue-700 text-white text-sm rounded-full w-6 h-6 flex items-center justify-center font-bold border-2 border-white shadow-lg"
                              role="img"
                              aria-label="Selected as foreground color"
                              title="Foreground color selected"
                            >
                              F
                            </div>
                          )}
                          {selectedBackground === color.hex && (
                            <div 
                              className="absolute -top-1 -right-1 bg-green-700 text-white text-sm rounded-full w-6 h-6 flex items-center justify-center font-bold border-2 border-white shadow-lg"
                              role="img"
                              aria-label="Selected as background color"
                              title="Background color selected"
                            >
                              B
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                    
                  </div>
                )}
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => {
                      // Clear current selections when trying different image
                      setSelectedForeground('')
                      setSelectedBackground('')
                      setContrastRatio(null)
                      setContrastLevel('')
                      fileInputRef.current?.click()
                    }}
                    className="text-gray-600 hover:text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                  >
                    Try different image
                  </button>
                  <button
                    onClick={removeFile}
                    className="text-gray-600 hover:text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                  >
                    Remove image
                  </button>
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp"
                  onChange={handleFileInput}
                  className="hidden"
                  aria-label="Upload logo file"
                />
              </div>
            )}
          </div>
          
          {/* Right Column - Contrast Results */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-6 text-gray-900">CONTRAST ANALYSIS</h2>
            
            {/* Color Inputs */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">FOREGROUND</label>
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: selectedForeground || '#000000' }}
                  ></div>
                  <input
                    type="text"
                    value={selectedForeground}
                    onChange={(e) => setSelectedForeground(e.target.value)}
                    className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#000000"
                    aria-label="Foreground color hex code"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-900">BACKGROUND</label>
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-8 h-8 rounded border border-gray-300"
                    style={{ backgroundColor: selectedBackground || '#ffffff' }}
                  ></div>
                  <input
                    type="text"
                    value={selectedBackground}
                    onChange={(e) => setSelectedBackground(e.target.value)}
                    className="bg-white border border-gray-300 rounded px-3 py-2 text-gray-900 font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="#ffffff"
                    aria-label="Background color hex code"
                  />
                </div>
              </div>
            </div>
            
            {/* Contrast Ratio Display */}
            {selectedForeground && selectedBackground && (
              <div className="mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-600 mb-2">
                    RATIO: {contrastRatio ? contrastRatio.toFixed(2) : 'Calculating...'}
                  </div>
                  <div className="text-lg text-gray-700 font-medium">
                    {contrastLevel}
                  </div>
                </div>
              </div>
            )}
            
            {/* Sample Text */}
            {selectedForeground && selectedBackground && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-900">Sample 12px (Normal Text)</h3>
                  <div 
                    className="p-4 rounded border border-gray-300"
                    style={{ 
                      backgroundColor: selectedBackground,
                      color: selectedForeground,
                      fontSize: '12px',
                      lineHeight: '1.4'
                    }}
                  >
                    The quick brown fox jumps over the lazy dog. This text demonstrates how your logo colors will appear in normal body text at 12px font size.
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium mb-2 text-gray-900">Sample 18px (Large Text)</h3>
                  <div 
                    className="p-4 rounded border border-gray-300"
                    style={{ 
                      backgroundColor: selectedBackground,
                      color: selectedForeground,
                      fontSize: '18px',
                      lineHeight: '1.3'
                    }}
                  >
                    The quick brown fox jumps over the lazy dog. This demonstrates large text readability.
                  </div>
                </div>
                
                {/* Axe-Style Reasoning */}
                {contrastRatio && (
                  <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded border-l-4 border-blue-500">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Axe Accessibility Analysis</h4>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {getContrastDescription(contrastRatio, contrastLevel).axeReasoning}
                    </p>
                    <div className="mt-3 text-sm text-gray-600">
                      <strong>Recommendation:</strong> {getContrastDescription(contrastRatio, contrastLevel).recommendation}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        
        {/* Compliance Badges */}
        {selectedForeground && selectedBackground && contrastRatio && (
          <div className="mt-8 flex justify-center space-x-4">
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              contrastRatio >= 4.5 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              AA {contrastRatio >= 4.5 ? '✓' : '✗'}
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              contrastRatio >= 7.0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              AAA {contrastRatio >= 7.0 ? '✓' : '✗'}
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              contrastRatio >= 3.0 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              AA18pt {contrastRatio >= 3.0 ? '✓' : '✗'}
            </div>
            <div className={`px-4 py-2 rounded-full text-sm font-medium ${
              contrastRatio >= 4.5 ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}>
              AAA18pt {contrastRatio >= 4.5 ? '✓' : '✗'}
            </div>
          </div>
        )}
        
        {/* Error Message */}
        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center space-x-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              <span className="font-medium">Error:</span>
              <span>{error}</span>
            </div>
          </div>
        )}
        </div>
        <Footer />
      </div>
    </div>
  )
}