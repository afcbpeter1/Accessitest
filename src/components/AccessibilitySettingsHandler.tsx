'use client'

import { useEffect } from 'react'
import {
  setupAccessibilityListener,
  applyHighContrastMode,
  applyFontSizeScale,
  applyLineHeight,
  applyLetterSpacing,
  applyGrayscaleMode
} from '@/lib/accessibility-utils'

/**
 * Client component that sets up accessibility settings listener
 * This component should be included in your layout to handle Chrome extension messages
 */
export default function AccessibilitySettingsHandler() {
  useEffect(() => {
    // Setup listener for Chrome extension messages
    setupAccessibilityListener()
    
    // Also check localStorage on mount (in case extension already set values)
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('accessibility-settings')
        if (stored) {
          const settings = JSON.parse(stored)
          
          // Apply stored settings
          if (settings.highContrast !== undefined) {
            applyHighContrastMode(settings.highContrast)
          }
          if (settings.fontSize !== undefined) {
            applyFontSizeScale(settings.fontSize / 100)
          }
          if (settings.lineHeight !== undefined) {
            applyLineHeight(settings.lineHeight)
          }
          if (settings.letterSpacing !== undefined) {
            applyLetterSpacing(settings.letterSpacing)
          }
          if (settings.grayscale !== undefined) {
            applyGrayscaleMode(settings.grayscale)
          }
        }
      } catch (err) {
        console.error('Error loading accessibility settings:', err)
      }
    }
  }, [])

  return null // This component doesn't render anything
}

