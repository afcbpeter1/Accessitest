import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

interface ContrastResult {
  ratio: number
  level: 'AAA' | 'AA' | 'AA Large' | 'Fail'
  color1: string
  color2: string
  description: string
  recommendation: string
}

// WCAG contrast ratio requirements
const CONTRAST_REQUIREMENTS = {
  AAA: 7.0,
  AA: 4.5,
  'AA Large': 3.0
}

// Convert RGB to relative luminance
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
}

// Calculate contrast ratio between two colors
function getContrastRatio(color1: [number, number, number], color2: [number, number, number]): number {
  const lum1 = getLuminance(color1[0], color1[1], color1[2])
  const lum2 = getLuminance(color2[0], color2[1], color2[2])
  const brightest = Math.max(lum1, lum2)
  const darkest = Math.min(lum1, lum2)
  return (brightest + 0.05) / (darkest + 0.05)
}

// Convert RGB to hex
function rgbToHex(r: number, g: number, b: number): string {
  // Ensure values are within valid range
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
  
  const hexR = clamp(r).toString(16).padStart(2, '0')
  const hexG = clamp(g).toString(16).padStart(2, '0')
  const hexB = clamp(b).toString(16).padStart(2, '0')
  
  return `#${hexR}${hexG}${hexB}`
}

// Get actual colors from image using proper analysis
async function getDominantColors(imageBuffer: Buffer): Promise<[number, number, number][]> {
  try {
    // Get image metadata first
    const metadata = await sharp(imageBuffer).metadata()
    if (!metadata.width || !metadata.height) {
      throw new Error('Invalid image dimensions')
    }
    
    // Use multiple sampling strategies to catch all colors
    const allColors: [number, number, number][] = []
    
    // Strategy 1: Full resolution sampling (for small images)
    if (metadata.width <= 500 && metadata.height <= 500) {
      const { data, info } = await sharp(imageBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true })
      
      const { channels } = info
      for (let i = 0; i < data.length; i += channels) {
        if (i + 2 < data.length) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          allColors.push([r, g, b])
        }
      }
    } else {
      // Strategy 2: Resize and sample for larger images
      const resizedBuffer = await sharp(imageBuffer)
        .resize(400, 400, { fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer()
      
      const { data, info } = await sharp(resizedBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true })
      
      const { channels } = info
      for (let i = 0; i < data.length; i += channels) {
        if (i + 2 < data.length) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          allColors.push([r, g, b])
        }
      }
    }
    
    if (allColors.length === 0) {
      throw new Error('No colors could be extracted from the image')
    }
    
    // Strategy 3: Smart color grouping to find distinct colors (including green dot)
    const colorGroups: { [key: string]: { count: number; color: [number, number, number]; hsv: [number, number, number] } } = {}
    
    // Group similar colors intelligently
    allColors.forEach(color => {
      const [h, s, v] = rgbToHsv(color[0], color[1], color[2])
      
      // Find existing similar color group
      let foundGroup = false
      for (const [key, group] of Object.entries(colorGroups)) {
        const existingColor = group.color
        const [eh, es, ev] = group.hsv
        
        // Group colors that are visually similar
        const rDiff = Math.abs(color[0] - existingColor[0])
        const gDiff = Math.abs(color[1] - existingColor[1])
        const bDiff = Math.abs(color[2] - existingColor[2])
        
        // More lenient grouping for similar colors, stricter for distinct ones
        const threshold = (s > 20 && es > 20) ? 15 : 8 // More lenient for saturated colors
        
        if (rDiff <= threshold && gDiff <= threshold && bDiff <= threshold) {
          colorGroups[key].count++
          // Keep the most saturated version
          if (s > es) {
            colorGroups[key].color = color
            colorGroups[key].hsv = [h, s, v]
          }
          foundGroup = true
          break
        }
      }
      
      if (!foundGroup) {
        const key = color.join(',')
        colorGroups[key] = { count: 1, color, hsv: [h, s, v] }
      }
    })
    
    // Get the most frequent colors, but also include less frequent but distinct colors
    const sortedColors = Object.values(colorGroups)
      .sort((a, b) => {
        // Prioritize by frequency, but also by saturation (more vibrant colors)
        const aScore = a.count + (a.hsv[1] / 100) * 10 // Add bonus for high saturation
        const bScore = b.count + (b.hsv[1] / 100) * 10
        return bScore - aScore
      })
    
    // Take the most distinct colors (limit to reasonable number)
    const dominantColors: [number, number, number][] = []
    
    // Include top colors, but ensure we get diverse colors
    const usedHues = new Set<number>()
    
    for (const group of sortedColors) {
      const hue = Math.round(group.hsv[0] / 30) * 30 // Group into 30-degree hue ranges
      
      // If we haven't seen this hue range, or if it's a very frequent color, include it
      if (!usedHues.has(hue) || group.count > allColors.length * 0.01) {
        dominantColors.push(group.color)
        usedHues.add(hue)
        
        if (dominantColors.length >= 15) break // Limit to 15 distinct colors
      }
    }
    
    // If we still don't have enough colors, add more from frequency
    if (dominantColors.length < 8) {
      for (const group of sortedColors) {
        if (!dominantColors.some(existing => 
          Math.abs(existing[0] - group.color[0]) < 10 &&
          Math.abs(existing[1] - group.color[1]) < 10 &&
          Math.abs(existing[2] - group.color[2]) < 10
        )) {
          dominantColors.push(group.color)
          if (dominantColors.length >= 15) break
        }
      }
    }
    
    return dominantColors
    
  } catch (error: any) {
    console.error('Error processing image:', error)
    if (error?.message?.includes('Unsupported image format')) {
      throw error
    }
    throw new Error('Failed to process image. Please ensure you\'re uploading a valid image file.')
  }
}

// Convert RGB to HSV for better color analysis
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255
  g /= 255
  b /= 255
  
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const diff = max - min
  
  let h = 0
  if (diff !== 0) {
    if (max === r) {
      h = ((g - b) / diff) % 6
    } else if (max === g) {
      h = (b - r) / diff + 2
    } else {
      h = (r - g) / diff + 4
    }
  }
  
  h = Math.round(h * 60)
  if (h < 0) h += 360
  
  const s = max === 0 ? 0 : Math.round((diff / max) * 100)
  const v = Math.round(max * 100)
  
  return [h, s, v]
}

// Determine contrast level
function getContrastLevel(ratio: number): 'AAA' | 'AA' | 'AA Large' | 'Fail' {
  if (ratio >= CONTRAST_REQUIREMENTS.AAA) return 'AAA'
  if (ratio >= CONTRAST_REQUIREMENTS.AA) return 'AA'
  if (ratio >= CONTRAST_REQUIREMENTS['AA Large']) return 'AA Large'
  return 'Fail'
}

// Generate description and recommendation
function getContrastDescription(ratio: number, level: string): { description: string; recommendation: string } {
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
  
  return {
    description: descriptions[level as keyof typeof descriptions],
    recommendation: recommendations[level as keyof typeof recommendations]
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('image') as File
    
    if (!file) {
      return NextResponse.json({ 
        success: false, 
        error: 'No image file provided' 
      }, { status: 400 })
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid file type. Please upload a valid image file.' 
      }, { status: 400 })
    }
    
    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ 
        success: false, 
        error: 'File size too large. Please upload a file smaller than 5MB.' 
      }, { status: 400 })
    }
    
    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Get dominant colors from the image
    let dominantColors
    try {
      dominantColors = await getDominantColors(buffer)
    } catch (error) {
      console.error('Color extraction error:', error)
      return NextResponse.json({ 
        success: false, 
        error: (error as any)?.message || 'Failed to process image. Please try a different image file.' 
      }, { status: 400 })
    }
    
    // Test internal contrast within the logo (text on background)
    let results: ContrastResult[] = []
    
    // Find the most contrasting color pairs within the logo itself
    for (let i = 0; i < dominantColors.length; i++) {
      for (let j = i + 1; j < dominantColors.length; j++) {
        const color1 = dominantColors[i]
        const color2 = dominantColors[j]
        
        const ratio = getContrastRatio(color1, color2)
        const level = getContrastLevel(ratio)
        const { description, recommendation } = getContrastDescription(ratio, level)
        
        // Only include results with meaningful contrast (ratio > 2.0)
        if (ratio > 2.0) {
          results.push({
            ratio,
            level,
            color1: rgbToHex(color1[0], color1[1], color1[2]),
            color2: rgbToHex(color2[0], color2[1], color2[2]),
            description,
            recommendation
          })
        }
      }
    }
    
    // Sort results by contrast ratio (highest first)
    results.sort((a, b) => b.ratio - a.ratio)
    
    // Return top 5 results (more focused)
    const topResults = results.slice(0, 5)
    
    // Calculate overall compliance
    const hasFailures = topResults.some(result => result.level === 'Fail')
    const hasAALarge = topResults.some(result => result.level === 'AA Large')
    const allAA = topResults.every(result => result.level === 'AA' || result.level === 'AAA')
    
    let complianceStatus = 'Non-compliant'
    if (allAA) {
      complianceStatus = 'Fully compliant (AA/AAA)'
    } else if (!hasFailures) {
      complianceStatus = 'Mostly compliant (some AA Large)'
    }
    
    // Create color palette with frequency data
    const colorGroups: { [key: string]: { count: number; color: [number, number, number] } } = {}
    
    // Re-analyze colors to get frequency data
    const allColors = await getDominantColors(buffer)
    allColors.forEach(color => {
      const key = color.join(',')
      if (colorGroups[key]) {
        colorGroups[key].count++
      } else {
        colorGroups[key] = { count: 1, color }
      }
    })
    
    const logoColors = Object.values(colorGroups)
      .sort((a, b) => b.count - a.count)
      .map(group => ({
        hex: rgbToHex(group.color[0], group.color[1], group.color[2]),
        rgb: group.color,
        frequency: group.count
      }))
    
    // Enhanced debugging
    const debugInfo = {
      totalColorsFound: dominantColors.length,
      colorsFound: dominantColors.map(color => rgbToHex(color[0], color[1], color[2])),
      colorGroups: Object.keys(colorGroups).length,
      totalPixels: allColors.length,
      colorFrequencies: (Object.values(colorGroups) as Array<{ count: number; color: [number, number, number]; hsv: [number, number, number] }>)
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)
        .map(group => ({
          color: rgbToHex(group.color[0], group.color[1], group.color[2]),
          count: group.count,
          hsv: group.hsv
        }))
    }

    return NextResponse.json({
      success: true,
      results: topResults,
      logoColors,
      compliance: {
        status: complianceStatus,
        hasFailures,
        hasAALarge,
        allAA
      },
      debug: debugInfo
    })
    
  } catch (error) {
    console.error('Logo contrast check error:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to analyze image. Please try again.' 
    }, { status: 500 })
  }
}
