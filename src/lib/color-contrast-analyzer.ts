/**
 * Color Contrast Analyzer for Document Accessibility
 * Calculates contrast ratios according to WCAG 2.1 AA/AAA standards
 */

export interface ContrastResult {
  ratio: number
  passesAA: boolean
  passesAAA: boolean
  level: 'AA' | 'AAA' | 'FAIL'
  foreground: string
  background: string
  suggestion?: string
}

/**
 * Calculate relative luminance of a color
 * Formula from WCAG 2.1: https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(color: string): number {
  // Convert hex to RGB
  const rgb = hexToRgb(color)
  if (!rgb) return 0

  // Normalize RGB values to 0-1
  const normalize = (val: number) => {
    val = val / 255
    return val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  }

  const r = normalize(rgb.r)
  const g = normalize(rgb.g)
  const b = normalize(rgb.b)

  // Calculate relative luminance
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Convert hex color to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  // Remove # if present
  hex = hex.replace('#', '')

  // Handle short hex (e.g., #FFF)
  if (hex.length === 3) {
    hex = hex.split('').map(char => char + char).join('')
  }

  // Validate hex color
  if (!/^[0-9A-Fa-f]{6}$/.test(hex)) {
    return null
  }

  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)

  return { r, g, b }
}

/**
 * Calculate contrast ratio between two colors
 * Formula from WCAG 2.1: (L1 + 0.05) / (L2 + 0.05)
 * where L1 is the lighter color and L2 is the darker color
 */
export function calculateContrastRatio(foreground: string, background: string): ContrastResult {
  const fgLuminance = getRelativeLuminance(foreground)
  const bgLuminance = getRelativeLuminance(background)

  const lighter = Math.max(fgLuminance, bgLuminance)
  const darker = Math.min(fgLuminance, bgLuminance)

  const ratio = (lighter + 0.05) / (darker + 0.05)

  // WCAG 2.1 AA: 4.5:1 for normal text, 3:1 for large text
  // WCAG 2.1 AAA: 7:1 for normal text, 4.5:1 for large text
  const passesAA = ratio >= 4.5
  const passesAAA = ratio >= 7

  let level: 'AA' | 'AAA' | 'FAIL' = 'FAIL'
  if (passesAAA) {
    level = 'AAA'
  } else if (passesAA) {
    level = 'AA'
  }

  let suggestion: string | undefined
  if (!passesAA) {
    suggestion = `Contrast ratio ${ratio.toFixed(2)}:1 is below WCAG AA standard (4.5:1). ` +
      `Increase contrast by using darker text or lighter background.`
  } else if (!passesAAA) {
    suggestion = `Contrast ratio ${ratio.toFixed(2)}:1 meets AA but not AAA standard (7:1). ` +
      `Consider improving contrast for better accessibility.`
  }

  return {
    ratio: parseFloat(ratio.toFixed(2)),
    passesAA,
    passesAAA,
    level,
    foreground,
    background,
    suggestion
  }
}

/**
 * Extract color from PDF text (basic implementation)
 * Note: Full PDF color extraction requires rendering and pixel analysis
 * This is a placeholder for future enhancement
 */
export function extractTextColorsFromPDF(pdfBuffer: Buffer): Array<{
  color: string
  hex: string
  page: number
}> {
  // TODO: Implement actual PDF color extraction using pdfjs-dist or rendering
  // For now, return empty array
  // This would require:
  // 1. Rendering PDF pages
  // 2. Extracting text elements with their color properties
  // 3. Converting color values to hex
  
  return []
}

/**
 * Check if a color is dark or light
 */
export function isDarkColor(color: string): boolean {
  const rgb = hexToRgb(color)
  if (!rgb) return false
  
  // Calculate brightness using standard formula
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
  return brightness < 128
}

/**
 * Suggest accessible color combinations
 */
export function suggestAccessibleColors(baseColor: string, isText: boolean = true): {
  foreground: string
  background: string
  ratio: number
}[] {
  const suggestions: Array<{ foreground: string; background: string; ratio: number }> = []
  
  // Common accessible color combinations
  const combinations = [
    { fg: '#000000', bg: '#FFFFFF' }, // Black on white - highest contrast
    { fg: '#FFFFFF', bg: '#000000' }, // White on black
    { fg: '#000000', bg: '#F0F0F0' }, // Black on light gray
    { fg: '#1F1F1F', bg: '#FFFFFF' }, // Dark gray on white
    { fg: '#FFFFFF', bg: '#0066CC' }, // White on blue
    { fg: '#000000', bg: '#FFEEAA' }, // Black on light yellow
  ]
  
  combinations.forEach(combo => {
    const result = calculateContrastRatio(combo.fg, combo.bg)
    if (result.passesAA) {
      suggestions.push({
        foreground: combo.fg,
        background: combo.bg,
        ratio: result.ratio
      })
    }
  })
  
  // Sort by contrast ratio (highest first)
  suggestions.sort((a, b) => b.ratio - a.ratio)
  
  return suggestions.slice(0, 3) // Return top 3 suggestions
}



