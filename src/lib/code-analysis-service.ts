interface CodeFix {
  issueId: string
  selector: string
  originalCode: string
  fixedCode: string
  explanation: string
  wcagGuideline: string
  severity: 'critical' | 'serious' | 'moderate' | 'minor'
}

interface CodeAnalysisResult {
  fixes: CodeFix[]
  summary: {
    totalFixes: number
    criticalFixes: number
    seriousFixes: number
    moderateFixes: number
    minorFixes: number
  }
}

export class CodeAnalysisService {
  private htmlSource: string

  constructor(htmlSource: string) {
    this.htmlSource = htmlSource
  }

  /**
   * Generate code fixes for accessibility violations
   */
  generateFixes(violations: any[]): CodeAnalysisResult {
    const fixes: CodeFix[] = []

    for (const violation of violations) {
      const violationFixes = this.generateFixesForViolation(violation)
      fixes.push(...violationFixes)
    }

    return {
      fixes,
      summary: {
        totalFixes: fixes.length,
        criticalFixes: fixes.filter(f => f.severity === 'critical').length,
        seriousFixes: fixes.filter(f => f.severity === 'serious').length,
        moderateFixes: fixes.filter(f => f.severity === 'moderate').length,
        minorFixes: fixes.filter(f => f.severity === 'minor').length
      }
    }
  }

  /**
   * Generate fixes for a specific violation
   */
  private generateFixesForViolation(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    // Handle different types of violations
    switch (violation.id) {
      case 'color-contrast':
        fixes.push(...this.fixColorContrast(violation))
        break
      case 'image-alt':
        fixes.push(...this.fixImageAlt(violation))
        break
      case 'button-name':
        fixes.push(...this.fixButtonName(violation))
        break
      case 'link-name':
        fixes.push(...this.fixLinkName(violation))
        break
      case 'heading-order':
        fixes.push(...this.fixHeadingOrder(violation))
        break
      case 'landmark-one-main':
        fixes.push(...this.fixLandmarkMain(violation))
        break
      case 'page-has-heading-one':
        fixes.push(...this.fixPageHeading(violation))
        break
      case 'html-has-lang':
        fixes.push(...this.fixHtmlLang(violation))
        break
      case 'form-field-multiple-labels':
        fixes.push(...this.fixFormLabels(violation))
        break
      case 'label':
        fixes.push(...this.fixLabel(violation))
        break
      default:
        fixes.push(...this.fixGeneric(violation))
    }

    return fixes
  }

  /**
   * Fix color contrast issues
   */
  private fixColorContrast(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    for (const node of violation.nodes || []) {
      const selector = node.target?.[0]
      if (!selector) continue

      const originalCode = this.extractElementCode(selector)
      if (!originalCode) continue

      // Generate CSS fix for color contrast
      const fixedCode = this.generateColorContrastFix(originalCode, node)

      fixes.push({
        issueId: violation.id,
        selector,
        originalCode,
        fixedCode,
        explanation: `Improve color contrast ratio to meet WCAG AA standards (4.5:1) or AAA standards (7:1). The current contrast ratio is insufficient for accessibility.`,
        wcagGuideline: 'WCAG 2.1 AA - 1.4.3 Contrast (Minimum)',
        severity: violation.impact as any
      })
    }

    return fixes
  }

  /**
   * Fix missing image alt text
   */
  private fixImageAlt(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    for (const node of violation.nodes || []) {
      const selector = node.target?.[0]
      if (!selector) continue

      const originalCode = this.extractElementCode(selector)
      if (!originalCode) continue

      const fixedCode = originalCode.replace(
        /<img([^>]*?)(?:\s+alt\s*=\s*["'][^"']*["'])?([^>]*?)>/gi,
        (match, before, after) => {
          if (match.includes('alt=')) {
            return match // Already has alt, just ensure it's not empty
          }
          return `<img${before} alt="Descriptive text for image"${after}>`
        }
      )

      fixes.push({
        issueId: violation.id,
        selector,
        originalCode,
        fixedCode,
        explanation: `Add descriptive alt text to images. Alt text should describe the image content or purpose for screen reader users.`,
        wcagGuideline: 'WCAG 2.1 AA - 1.1.1 Non-text Content',
        severity: violation.impact as any
      })
    }

    return fixes
  }

  /**
   * Fix button accessibility
   */
  private fixButtonName(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    for (const node of violation.nodes || []) {
      const selector = node.target?.[0]
      if (!selector) continue

      const originalCode = this.extractElementCode(selector)
      if (!originalCode) continue

      let fixedCode = originalCode

      // If it's a button without text, add aria-label
      if (originalCode.includes('<button') && !originalCode.match(/>[^<]+</)) {
        fixedCode = originalCode.replace(
          /<button([^>]*?)>/gi,
          '<button$1 aria-label="Button action">'
        )
      }

      // If it's a div acting as button, convert to actual button
      if (originalCode.includes('<div') && originalCode.includes('onclick')) {
        fixedCode = originalCode.replace(/<div([^>]*?)>/gi, '<button$1>')
        fixedCode = fixedCode.replace(/<\/div>/gi, '</button>')
      }

      fixes.push({
        issueId: violation.id,
        selector,
        originalCode,
        fixedCode,
        explanation: `Ensure buttons have accessible names. Use proper button elements with descriptive text or aria-label attributes.`,
        wcagGuideline: 'WCAG 2.1 AA - 4.1.2 Name, Role, Value',
        severity: violation.impact as any
      })
    }

    return fixes
  }

  /**
   * Fix link accessibility
   */
  private fixLinkName(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    for (const node of violation.nodes || []) {
      const selector = node.target?.[0]
      if (!selector) continue

      const originalCode = this.extractElementCode(selector)
      if (!originalCode) continue

      let fixedCode = originalCode

      // If link has no text, add aria-label
      if (originalCode.includes('<a') && !originalCode.match(/>[^<]+</)) {
        fixedCode = originalCode.replace(
          /<a([^>]*?)>/gi,
          '<a$1 aria-label="Link description">'
        )
      }

      fixes.push({
        issueId: violation.id,
        selector,
        originalCode,
        fixedCode,
        explanation: `Ensure links have descriptive text or aria-label attributes. Screen reader users need to understand the link purpose.`,
        wcagGuideline: 'WCAG 2.1 AA - 2.4.4 Link Purpose (In Context)',
        severity: violation.impact as any
      })
    }

    return fixes
  }

  /**
   * Fix heading order issues
   */
  private fixHeadingOrder(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    for (const node of violation.nodes || []) {
      const selector = node.target?.[0]
      if (!selector) continue

      const originalCode = this.extractElementCode(selector)
      if (!originalCode) continue

      // Suggest proper heading level
      const fixedCode = originalCode.replace(
        /<h([1-6])([^>]*?)>/gi,
        (match, level, attrs) => {
          // This would need more context to determine correct level
          return `<h2${attrs}>` // Default to h2 for now
        }
      )

      fixes.push({
        issueId: violation.id,
        selector,
        originalCode,
        fixedCode,
        explanation: `Fix heading hierarchy. Headings should follow a logical order (h1, h2, h3, etc.) without skipping levels.`,
        wcagGuideline: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
        severity: violation.impact as any
      })
    }

    return fixes
  }

  /**
   * Fix missing main landmark
   */
  private fixLandmarkMain(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    // Add main landmark to body
    const bodyMatch = this.htmlSource.match(/<body([^>]*?)>/i)
    if (bodyMatch) {
      const originalCode = bodyMatch[0]
      const fixedCode = originalCode + '\n  <main>'
      
      // Also need to close main before </body>
      const bodyCloseMatch = this.htmlSource.match(/<\/body>/i)
      if (bodyCloseMatch) {
        const bodyCloseIndex = this.htmlSource.indexOf('</body>')
        const beforeBodyClose = this.htmlSource.substring(0, bodyCloseIndex)
        const afterBodyClose = this.htmlSource.substring(bodyCloseIndex)
        
        fixes.push({
          issueId: violation.id,
          selector: 'body',
          originalCode: bodyMatch[0] + '...' + bodyCloseMatch[0],
          fixedCode: originalCode + '\n  <main>\n    <!-- Your main content here -->\n  </main>\n' + bodyCloseMatch[0],
          explanation: `Add a main landmark to identify the primary content area. This helps screen reader users navigate the page structure.`,
          wcagGuideline: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
          severity: violation.impact as any
        })
      }
    }

    return fixes
  }

  /**
   * Fix missing page heading
   */
  private fixPageHeading(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    // Check if there's already an h1
    if (!this.htmlSource.includes('<h1')) {
      const bodyMatch = this.htmlSource.match(/<body([^>]*?)>/i)
      if (bodyMatch) {
        const originalCode = bodyMatch[0]
        const fixedCode = originalCode + '\n  <h1>Page Title</h1>'

        fixes.push({
          issueId: violation.id,
          selector: 'body',
          originalCode,
          fixedCode,
          explanation: `Add a main heading (h1) to identify the page content. Every page should have exactly one h1 element.`,
          wcagGuideline: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
          severity: violation.impact as any
        })
      }
    }

    return fixes
  }

  /**
   * Fix missing HTML lang attribute
   */
  private fixHtmlLang(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    const htmlMatch = this.htmlSource.match(/<html([^>]*?)>/i)
    if (htmlMatch) {
      const originalCode = htmlMatch[0]
      let fixedCode = originalCode

      if (!originalCode.includes('lang=')) {
        fixedCode = originalCode.replace('<html', '<html lang="en"')
      }

      fixes.push({
        issueId: violation.id,
        selector: 'html',
        originalCode,
        fixedCode,
        explanation: `Add language attribute to the html element. This helps screen readers pronounce content correctly.`,
        wcagGuideline: 'WCAG 2.1 AA - 3.1.1 Language of Page',
        severity: violation.impact as any
      })
    }

    return fixes
  }

  /**
   * Fix form label issues
   */
  private fixFormLabels(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    for (const node of violation.nodes || []) {
      const selector = node.target?.[0]
      if (!selector) continue

      const originalCode = this.extractElementCode(selector)
      if (!originalCode) continue

      let fixedCode = originalCode

      // Add proper label association
      if (originalCode.includes('<input') && !originalCode.includes('aria-label')) {
        fixedCode = originalCode.replace(
          /<input([^>]*?)>/gi,
          '<label for="input-id">Input Label</label>\n<input$1 id="input-id">'
        )
      }

      fixes.push({
        issueId: violation.id,
        selector,
        originalCode,
        fixedCode,
        explanation: `Associate form inputs with descriptive labels. Use label elements or aria-label attributes to identify form controls.`,
        wcagGuideline: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
        severity: violation.impact as any
      })
    }

    return fixes
  }

  /**
   * Fix label issues
   */
  private fixLabel(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    for (const node of violation.nodes || []) {
      const selector = node.target?.[0]
      if (!selector) continue

      const originalCode = this.extractElementCode(selector)
      if (!originalCode) continue

      let fixedCode = originalCode

      // Ensure label has proper association
      if (originalCode.includes('<label')) {
        fixedCode = originalCode.replace(
          /<label([^>]*?)>/gi,
          '<label$1 for="associated-input">'
        )
      }

      fixes.push({
        issueId: violation.id,
        selector,
        originalCode,
        fixedCode,
        explanation: `Ensure labels are properly associated with form controls using the for attribute or by wrapping the input.`,
        wcagGuideline: 'WCAG 2.1 AA - 1.3.1 Info and Relationships',
        severity: violation.impact as any
      })
    }

    return fixes
  }

  /**
   * Generic fix for unknown violations
   */
  private fixGeneric(violation: any): CodeFix[] {
    const fixes: CodeFix[] = []

    for (const node of violation.nodes || []) {
      const selector = node.target?.[0]
      if (!selector) continue

      const originalCode = this.extractElementCode(selector)
      if (!originalCode) continue

      fixes.push({
        issueId: violation.id,
        selector,
        originalCode,
        fixedCode: originalCode + ' <!-- Fix needed: ' + violation.description + ' -->',
        explanation: violation.help || 'Accessibility issue detected. Please review and fix according to WCAG guidelines.',
        wcagGuideline: 'WCAG 2.1 AA',
        severity: violation.impact as any
      })
    }

    return fixes
  }

  /**
   * Extract element code from HTML source
   */
  private extractElementCode(selector: string): string | null {
    try {
      // Simple selector to element extraction
      // This is a basic implementation - in production you'd want a proper HTML parser
      const cleanSelector = selector.replace(/^#/, '').replace(/^\./, '')
      
      // Look for common patterns
      if (selector.startsWith('#')) {
        const idMatch = this.htmlSource.match(new RegExp(`<[^>]*id=["']${cleanSelector}["'][^>]*>`, 'i'))
        return idMatch ? idMatch[0] : null
      }
      
      if (selector.startsWith('.')) {
        const classMatch = this.htmlSource.match(new RegExp(`<[^>]*class=["'][^"']*${cleanSelector}[^"']*["'][^>]*>`, 'i'))
        return classMatch ? classMatch[0] : null
      }
      
      // Try to find by tag name
      const tagMatch = this.htmlSource.match(new RegExp(`<${cleanSelector}[^>]*>`, 'i'))
      return tagMatch ? tagMatch[0] : null
      
    } catch (error) {
      console.warn('Error extracting element code:', error)
      return null
    }
  }

  /**
   * Generate color contrast fix
   */
  private generateColorContrastFix(originalCode: string, node: any): string {
    // This would need more sophisticated analysis in production
    // For now, provide a CSS-based solution
    const styleMatch = originalCode.match(/style=["']([^"']*)["']/i)
    
    if (styleMatch) {
      const existingStyles = styleMatch[1]
      const fixedStyles = existingStyles + '; color: #000000; background-color: #ffffff;'
      return originalCode.replace(/style=["'][^"']*["']/i, `style="${fixedStyles}"`)
    } else {
      return originalCode.replace(/>/, ' style="color: #000000; background-color: #ffffff;">')
    }
  }
}

export type { CodeFix, CodeAnalysisResult }
