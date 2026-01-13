/**
 * Accessibility utilities for handling high contrast mode and font scaling
 * These utilities work with Chrome extension accessibility settings
 */

/**
 * Apply high contrast mode to the document
 * Call this when your Chrome extension detects high contrast is enabled
 */
export function applyHighContrastMode(enabled: boolean) {
  if (enabled) {
    document.documentElement.classList.add('high-contrast-mode')
    // Also set a data attribute for CSS targeting
    document.documentElement.setAttribute('data-high-contrast', 'true')
  } else {
    document.documentElement.classList.remove('high-contrast-mode')
    document.documentElement.removeAttribute('data-high-contrast')
  }
}

/**
 * Apply font size scaling
 * Call this when your Chrome extension detects font size changes
 * @param scaleFactor - Font size multiplier (e.g., 1.5 for 150%)
 */
export function applyFontSizeScale(scaleFactor: number) {
  // Clamp between 0.5x and 3x for safety
  const clampedScale = Math.max(0.5, Math.min(3, scaleFactor))
  
  // Apply as CSS custom property
  document.documentElement.style.setProperty('--font-scale', clampedScale.toString())
  document.documentElement.style.fontSize = `${16 * clampedScale}px`
  
  // Set data attribute for CSS targeting
  document.documentElement.setAttribute('data-font-scale', clampedScale.toString())
}

/**
 * Apply line height adjustment
 * @param lineHeight - Line height value (e.g., 1.5, 2.0)
 */
export function applyLineHeight(lineHeight: number) {
  const clamped = Math.max(1, Math.min(3, lineHeight))
  document.documentElement.style.setProperty('--line-height', clamped.toString())
  document.documentElement.setAttribute('data-line-height', clamped.toString())
}

/**
 * Apply letter spacing adjustment
 * @param spacing - Letter spacing in pixels (e.g., 0, 0.12, 0.5)
 */
export function applyLetterSpacing(spacing: number) {
  document.documentElement.style.setProperty('--letter-spacing', `${spacing}px`)
  document.documentElement.setAttribute('data-letter-spacing', spacing.toString())
}

/**
 * Apply grayscale mode
 */
export function applyGrayscaleMode(enabled: boolean) {
  if (enabled) {
    document.documentElement.classList.add('grayscale-mode')
    document.documentElement.setAttribute('data-grayscale', 'true')
  } else {
    document.documentElement.classList.remove('grayscale-mode')
    document.documentElement.removeAttribute('data-grayscale')
  }
}

/**
 * Reset all accessibility settings
 */
export function resetAccessibilitySettings() {
  document.documentElement.classList.remove('high-contrast-mode', 'grayscale-mode')
  document.documentElement.removeAttribute('data-high-contrast')
  document.documentElement.removeAttribute('data-grayscale')
  document.documentElement.removeAttribute('data-font-scale')
  document.documentElement.removeAttribute('data-line-height')
  document.documentElement.removeAttribute('data-letter-spacing')
  document.documentElement.style.removeProperty('--font-scale')
  document.documentElement.style.removeProperty('--line-height')
  document.documentElement.style.removeProperty('--letter-spacing')
  document.documentElement.style.fontSize = ''
}

/**
 * Listen for Chrome extension messages
 * Use this in your main layout or app component
 */
export function setupAccessibilityListener() {
  // Listen for messages from Chrome extension
  if (typeof window !== 'undefined' && (window as any).chrome?.runtime) {
    (window as any).chrome.runtime.onMessage?.addListener((message: any, sender: any, sendResponse: any) => {
      if (message.type === 'accessibility-settings') {
        const settings = message.settings
        
        if (settings.highContrast !== undefined) {
          applyHighContrastMode(settings.highContrast)
        }
        
        if (settings.fontSize !== undefined) {
          applyFontSizeScale(settings.fontSize / 100) // Convert percentage to decimal
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
        
        if (settings.reset) {
          resetAccessibilitySettings()
        }
        
        sendResponse({ success: true })
      }
    })
  }
  
  // Also listen for localStorage changes (if extension uses localStorage)
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (e) => {
      if (e.key === 'accessibility-settings') {
        try {
          const settings = JSON.parse(e.newValue || '{}')
          if (settings.highContrast !== undefined) applyHighContrastMode(settings.highContrast)
          if (settings.fontSize !== undefined) applyFontSizeScale(settings.fontSize / 100)
          if (settings.lineHeight !== undefined) applyLineHeight(settings.lineHeight)
          if (settings.letterSpacing !== undefined) applyLetterSpacing(settings.letterSpacing)
          if (settings.grayscale !== undefined) applyGrayscaleMode(settings.grayscale)
        } catch (err) {
          console.error('Error parsing accessibility settings:', err)
        }
      }
    })
  }
}









