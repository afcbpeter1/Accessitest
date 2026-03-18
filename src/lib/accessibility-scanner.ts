import * as axe from 'axe-core';
import { JSDOM } from 'jsdom';
import { axeConfig, wcag22Rules } from './axe-config';
import { ClaudeAPI } from './claude-api';
import { CloudinaryService } from './cloudinary-service';
import { AIAccessibilityChecks } from './ai-accessibility-checks';
import { runExtendedAccessibilityChecks } from './extended-accessibility-checks';

export interface AccessibilityIssue {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
  wcag22Level?: string;
  nodes: Array<{
    html: string;
    target: string[];
    failureSummary: string;
    impact: string;
    any: Array<{
      id: string;
      data: any;
      relatedNodes: any[];
    }>;
    all: Array<{
      id: string;
      data: any;
      relatedNodes: any[];
    }>;
    none: Array<{
      id: string;
      data: any;
      relatedNodes: any[];
    }>;
  }>;
}

export interface RemediationSuggestion {
  type: 'fix' | 'improvement' | 'warning';
  description: string;
  codeExample?: string;
  priority: 'high' | 'medium' | 'low';
}

export interface ScanResult {
  url: string;
  timestamp: Date;
  issues: AccessibilityIssue[];
  summary: {
    total: number;
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
    passes: number;
    incomplete: number;
    inapplicable: number;
  };
  wcag22Compliance: {
    levelA: boolean;
    levelAA: boolean;
    levelAAA: boolean;
  };
  screenshots?: {
    fullPage?: string;
    viewport?: string;
    elements?: Array<{
      selector: string;
      issueId: string;
      severity: string;
      screenshot: string;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
  };
}

export class AccessibilityScanner {
  private config: typeof axeConfig;
  private claudeAPI: ClaudeAPI;
  private aiResponseCache: Map<string, string> = new Map();
  private aiChecks: AIAccessibilityChecks;

  constructor() {
    this.config = { ...axeConfig };
    this.claudeAPI = new ClaudeAPI();
    this.aiChecks = new AIAccessibilityChecks();
  }

  /**
   * Scan a web page for accessibility issues using custom standards
   * This method should be called from within a Puppeteer page context
   */
  async scanPageInBrowser(page: any, selectedTags?: string[], options?: { ciMode?: boolean; skipAiSuggestions?: boolean }): Promise<ScanResult> {

    // Get the current URL from the page
    const currentUrl = await page.url();
    
    // Set a smaller viewport for better performance and smaller screenshots
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });
    
    try {
      // Use selected tags or default to comprehensive WCAG compliance
      // CRITICAL: Include all relevant rule sets for comprehensive testing
      let tagsToCheck = selectedTags || [
        'wcag2a', 'wcag2aa',  // WCAG 2.0 A & AA (complete rule set)
        'wcag21aa',           // WCAG 2.1 AA (additional rules)
        'wcag22aa',           // WCAG 2.2 AA (additional rules)
        'best-practice',      // Best practices
        'section508',         // Section 508 compliance
        'EN-301-549'          // European accessibility standard
      ];
      
      // CRITICAL: Fix the fundamental WCAG tag mapping issue
      // The problem: wcag22aa/wcag22aaa tags don't include all the rules they should!
      // Solution: Include the actual WCAG 2.0/2.1 tags that have the complete rule sets
      if (tagsToCheck.some(tag => tag.includes('aa') || tag.includes('AAA'))) {
        // Add wcag2aa for complete AA rule set (includes color-contrast)
        if (!tagsToCheck.includes('wcag2aa')) {
          tagsToCheck.push('wcag2aa');

        }
        // Add wcag2aaa for complete AAA rule set (includes color-contrast-enhanced)
        if (tagsToCheck.some(tag => tag.includes('AAA')) && !tagsToCheck.includes('wcag2aaa')) {
          tagsToCheck.push('wcag2aaa');

        }
      }
      
      // Get the current URL from the page
      const currentUrl = await page.url();
      
      // Run axe-core analysis directly in the browser context
      const results = await page.evaluate(async (tags: string[]) => {
        // Check if axe is available in the browser context
        if (typeof (window as any).axe === 'undefined') {
          throw new Error('axe-core is not loaded in the browser context');
        }
        
        const axe = (window as any).axe;
        
        // Configure axe with basic settings
        axe.configure({
          reporter: 'v2',
          resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
          performanceTimer: true,
          elementRef: false,
          branding: {
            brand: 'AccessScan',
            application: 'Accessibility Testing Platform'
          }
        });
        
      // Debug: Log the tags being used

      // Debug: Log available rules and their tags
      const allRules = axe.getRules();
      const colorContrastRule = allRules.find((rule: any) => rule.ruleId === 'color-contrast');
      const colorContrastEnhancedRule = allRules.find((rule: any) => rule.ruleId === 'color-contrast-enhanced');
      
      if (colorContrastRule) {


      }
      
      if (colorContrastEnhancedRule) {


      }
      
      // Debug: Show all disabled rules that might be relevant
      const disabledRules = allRules.filter((rule: any) => !rule.enabled);
      
      // Debug: Log best-practice rules
      const bestPracticeRules = allRules.filter((rule: any) => rule.tags.includes('best-practice'));
      
      // Debug: Log Section 508 rules
      const section508Rules = allRules.filter((rule: any) => rule.tags.includes('section508'));
      
      // Debug: Log EN 301 549 rules
      const en301549Rules = allRules.filter((rule: any) => rule.tags.includes('EN-301-549'));
      
      // Run axe-core analysis with comprehensive rule set
      // CRITICAL: Enable all rules that should be active for comprehensive testing
      
      const results = await axe.run({
        runOnly: {
          type: 'tag',
          values: tags
        },
        resultTypes: ['violations', 'passes', 'incomplete', 'inapplicable'],
        // Enable experimental rules for more comprehensive testing
        rules: {
          // Enable experimental rules that provide additional value
          'css-orientation-lock': { enabled: true },
          'focus-order-semantics': { enabled: true },
          'hidden-content': { enabled: true },
          'label-content-name-mismatch': { enabled: true },
          'p-as-heading': { enabled: true },
          'table-fake-caption': { enabled: true },
          'td-has-header': { enabled: true },
          // Enable WCAG 2.2 rules
          'target-size': { enabled: true },
          // Enable best practice rules
          'accesskeys': { enabled: true },
          'aria-allowed-role': { enabled: true },
          'aria-dialog-name': { enabled: true },
          'aria-text': { enabled: true },
          'aria-treeitem-name': { enabled: true },
          'empty-heading': { enabled: true },
          'empty-table-header': { enabled: true },
          'frame-tested': { enabled: true },
          'heading-order': { enabled: true },
          'image-redundant-alt': { enabled: true },
          'label-title-only': { enabled: true },
          'landmark-banner-is-top-level': { enabled: true },
          'landmark-complementary-is-top-level': { enabled: true },
          'landmark-contentinfo-is-top-level': { enabled: true },
          'landmark-main-is-top-level': { enabled: true },
          'landmark-no-duplicate-banner': { enabled: true },
          'landmark-no-duplicate-contentinfo': { enabled: true },
          'landmark-no-duplicate-main': { enabled: true },
          'landmark-one-main': { enabled: true },
          'landmark-unique': { enabled: true },
          'meta-viewport-large': { enabled: true },
          'page-has-heading-one': { enabled: true },
          'presentation-role-conflict': { enabled: true },
          'region': { enabled: true },
          'scope-attr-valid': { enabled: true },
          'skip-link': { enabled: true },
          'tabindex': { enabled: true },
          'table-duplicate-name': { enabled: true }
        }
      });
      
      // Debug: Log the results
      
      // Debug: Show which rules were actually executed
      const executedRules = [...results.violations, ...results.passes].map(r => r.id);
      
      return results;
      }, tagsToCheck);

      // Process axe-core results
      const axeIssues: AccessibilityIssue[] = results.violations.map((violation: any) => ({
        id: violation.id,
        impact: violation.impact as 'minor' | 'moderate' | 'serious' | 'critical',
        tags: violation.tags,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map((node: any) => ({
          html: node.html,
          target: node.target,
          failureSummary: node.failureSummary || this.generateFailureSummary(violation, node),
          impact: node.impact,
          any: node.any,
          all: node.all,
          none: node.none
        }))
      }));

      // AI-powered checks disabled for faster scans (axe + remediation only)
      const aiIssues: AccessibilityIssue[] = [];

      // Extended checks: focus trap, keyboard nav, error message clarity, alt quality, readability (detection only; AI remediates)
      let extendedIssues: AccessibilityIssue[] = [];
      try {
        extendedIssues = await runExtendedAccessibilityChecks(page);
      } catch (error) {
        console.warn('⚠️ Extended accessibility checks failed, continuing with axe results:', error);
      }

      // Combine axe, AI, and extended issues; add WCAG 2.2 level per issue for correct display
      const rawIssues = [...axeIssues, ...aiIssues, ...extendedIssues];
      const issues = rawIssues.map(issue => ({
        ...issue,
        wcag22Level: this.getWCAG22RuleInfo(issue.id).wcag22Level
      })) as AccessibilityIssue[];

      // Calculate summary
      const summary = {
        total: issues.length,
        critical: issues.filter(issue => issue.impact === 'critical').length,
        serious: issues.filter(issue => issue.impact === 'serious').length,
        moderate: issues.filter(issue => issue.impact === 'moderate').length,
        minor: issues.filter(issue => issue.impact === 'minor').length,
        passes: results.passes.length,
        incomplete: results.incomplete.length,
        inapplicable: results.inapplicable.length
      };

      // Check WCAG 2.2 compliance
      const wcag22Compliance = this.checkWCAG22Compliance(issues, results);

      let screenshots: ScanResult['screenshots'] = undefined;
      if (!options?.ciMode) {
        screenshots = await this.captureAndUploadScreenshots(page, issues);
      }

      const useLearnedOrRuleBasedOnly = options?.ciMode === true || options?.skipAiSuggestions === true;
      if (!useLearnedOrRuleBasedOnly) {
        // Generate AI-enhanced suggestions (skipped in CI / learned-suggestions mode to save tokens)
        for (let i = 0; i < issues.length; i++) {
          const issue = issues[i];
          try {
            const suggestions = await this.generateContextualSuggestions(issue);
            if (suggestions.length > 0) {
              (issue as any).suggestions = suggestions;
            }
            if (i < issues.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          } catch (error) {
            console.error(`❌ Failed to generate AI suggestions for issue ${issue.id}:`, error);
            if (i < issues.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 2000));
            }
          }
        }
      } else {
        // CI / learned-suggestions mode: attach rule-based suggestions only (no AI, no tokens)
        for (const issue of issues) {
          const firstNode = issue.nodes?.[0];
          if (!firstNode) continue;
          const html = firstNode.html ?? '';
          const target = firstNode.target?.[0] ?? '';
          const failureSummary = firstNode.failureSummary ?? '';
          const suggestion = this.getBestRuleBasedSuggestion(issue.id, html, target, failureSummary, issue.impact);
          if (suggestion) {
            (issue as any).suggestions = [suggestion];
          }
        }
      }

      const finalResult = {
        url: currentUrl,
        timestamp: new Date(),
        issues,
        summary,
        wcag22Compliance,
        screenshots
      };

      return finalResult as ScanResult;
    } catch (error) {
      console.error('Error scanning page for accessibility issues:', error);
      throw new Error(`Failed to scan ${currentUrl}: ${(error as any).message}`);
    }
  }

  private async captureAndUploadScreenshots(page: any, issues: AccessibilityIssue[]): Promise<ScanResult['screenshots']> {
    try {
      // Wait until the DOM is "quiet" to avoid capturing LOADING placeholders.
      await page.evaluate(({ timeoutMs, quietMs }: { timeoutMs: number; quietMs: number }) => {
        return new Promise<void>((resolve) => {
          let settled = false
          let timeoutHandle: any = null
          let quietHandle: any = null
          let obs: MutationObserver | null = null

          const done = () => {
            if (settled) return
            settled = true
            if (timeoutHandle) clearTimeout(timeoutHandle)
            if (quietHandle) clearTimeout(quietHandle)
            if (obs) obs.disconnect()
            resolve()
          }

          timeoutHandle = setTimeout(done, timeoutMs)
          quietHandle = setTimeout(done, quietMs)

          obs = new MutationObserver(() => {
            if (quietHandle) clearTimeout(quietHandle)
            quietHandle = setTimeout(done, quietMs)
          })

          try {
            obs.observe(document.documentElement || document.body, {
              subtree: true,
              childList: true,
              attributes: true,
              characterData: true
            })
          } catch {
            // If observation fails, we still resolve via timeout/quiet timer.
          }
        })
      }, { timeoutMs: 20000, quietMs: 1500 })

      // Add redaction masks before taking the full/viewport "page reference" screenshots.
      // We mask common sensitive fields (inputs/passwords) so the reference screenshot is safer.
      await page.evaluate(() => {
        const existing = document.getElementById('__accessscan_mask_layer')
        if (existing) existing.remove()

        const layer = document.createElement('div')
        layer.id = '__accessscan_mask_layer'
        layer.setAttribute('aria-hidden', 'true')
        layer.style.position = 'absolute'
        layer.style.left = '0'
        layer.style.top = '0'
        layer.style.width = '100%'
        layer.style.height = '100%'
        layer.style.zIndex = '2147483647'
        layer.style.pointerEvents = 'none'

        const selectors = ['input', 'textarea', 'select', 'input[type="password"]']
        const els = Array.from(document.querySelectorAll(selectors.join(','))).slice(0, 40) as HTMLElement[]

        for (const el of els) {
          const rect = el.getBoundingClientRect()
          const style = window.getComputedStyle(el)
          if (!rect || rect.width <= 0 || rect.height <= 0) continue
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue

          const left = rect.left + window.scrollX
          const top = rect.top + window.scrollY

          const box = document.createElement('div')
          box.style.position = 'absolute'
          box.style.left = `${left}px`
          box.style.top = `${top}px`
          box.style.width = `${rect.width}px`
          box.style.height = `${rect.height}px`
          box.style.background = 'rgba(0,0,0,0.85)'
          box.style.borderRadius = '2px'

          layer.appendChild(box)
        }

        const host = document.body || document.documentElement
        host.appendChild(layer)
      })

      await page.waitForTimeout(150)

      const fullPageScreenshot = await page.screenshot({
        fullPage: true,
        encoding: 'base64',
        quality: 80,
        type: 'jpeg'
      }) as string;
      const viewportScreenshot = await page.screenshot({
        fullPage: false,
        encoding: 'base64',
        quality: 80,
        type: 'jpeg'
      }) as string;

      // Remove masks so affected element screenshots are not overly obscured.
      await page.evaluate(() => {
        const existing = document.getElementById('__accessscan_mask_layer')
        if (existing) existing.remove()
      })

      const elementScreenshots: Array<{ selector: string; issueId: string; severity: string; screenshot: string; boundingBox: any }> = [];
      for (const issue of issues.slice(0, 5)) {
        for (const node of issue.nodes || []) {
          const selector = node.target?.[0];
          if (!selector) continue;
          try {
            const element = await page.$(selector);
            if (!element) continue;
            const boundingBox = await element.boundingBox();
            if (!boundingBox || boundingBox.width === 0 || boundingBox.height === 0) continue;
            const isVisible = await element.evaluate((el: Element) => {
              const rect = el.getBoundingClientRect();
              const style = window.getComputedStyle(el);
              return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
            });
            if (!isVisible) continue;
            const elementScreenshot = await element.screenshot({ encoding: 'base64', quality: 80, type: 'jpeg' }) as string;
            elementScreenshots.push({ selector, issueId: issue.id, severity: issue.impact, screenshot: elementScreenshot, boundingBox });
          } catch {
            // skip element
          }
        }
      }
      const timestamp = Date.now();
      const scanId = `scan_${timestamp}`;
      const uploadPromises: Promise<any>[] = [];
      if (fullPageScreenshot) uploadPromises.push(CloudinaryService.uploadBase64Image(fullPageScreenshot, 'a11ytest/screenshots', { public_id: `${scanId}_fullpage` }));
      if (viewportScreenshot) uploadPromises.push(CloudinaryService.uploadBase64Image(viewportScreenshot, 'a11ytest/screenshots', { public_id: `${scanId}_viewport` }));
      for (let i = 0; i < elementScreenshots.length; i++) {
        uploadPromises.push(CloudinaryService.uploadBase64Image(elementScreenshots[i].screenshot, 'a11ytest/screenshots', { public_id: `${scanId}_element_${i}` }));
      }
      const uploadResults = await Promise.all(uploadPromises);
      const fullPageUrl = uploadResults[0]?.secure_url ?? undefined;
      const viewportUrl = uploadResults[1]?.secure_url ?? undefined;
      const elements = elementScreenshots.map((el, i) => ({
        selector: el.selector,
        issueId: el.issueId,
        severity: el.severity,
        screenshot: (uploadResults[2 + i]?.secure_url ?? '') as string,
        boundingBox: el.boundingBox
      }));
      return { fullPage: fullPageUrl, viewport: viewportUrl, elements };
    } catch (err) {
      console.error('❌ Screenshot capture failed:', err);
      return undefined;
    }
  }

  /**
   * Generate a meaningful failure summary when AXE doesn't provide one
   */
  private generateFailureSummary(violation: any, node: any): string {
    const ruleId = violation.id;
    const elementType = node.html.match(/<(\w+)/)?.[1] || 'element';
    
    switch (ruleId) {
      case 'target-size':
        return `Touch target is too small. ${elementType} must be at least 24px in size for easy interaction.`;
      case 'color-contrast':
        return `Text color contrast is insufficient. ${elementType} text needs higher contrast for readability.`;
      case 'image-alt':
        return `Image missing alt text. ${elementType} needs descriptive alternative text for screen readers.`;
      case 'label':
        return `Form control missing label. ${elementType} needs an associated label for accessibility.`;
      case 'button-name':
        return `Button missing accessible name. ${elementType} needs text content or aria-label for screen readers.`;
      case 'link-name':
        return `Link missing accessible name. ${elementType} needs descriptive text or aria-label for screen readers.`;
      case 'heading-order':
        return `Heading structure is incorrect. ${elementType} heading level doesn't follow logical order.`;
      case 'html-has-lang':
        return `HTML document missing language attribute. Add lang attribute to <html> tag.`;
      case 'landmark-one-main':
        return `Page missing main landmark. Add <main> element or role="main" for primary content.`;
      case 'focus-indicator':
        return `Focus indicator missing or insufficient. ${elementType} needs visible focus styling.`;
      default:
        return `${elementType} violates ${ruleId} rule: ${violation.help}`;
    }
  }

  /**
   * Check WCAG 2.2 compliance levels (including AAA)
   */
  private checkWCAG22Compliance(issues: AccessibilityIssue[], results: any) {



    // Simplified compliance check based on issue severity
    const criticalIssues = issues.filter(issue => issue.impact === 'critical').length;
    const seriousIssues = issues.filter(issue => issue.impact === 'serious').length;
    const moderateIssues = issues.filter(issue => issue.impact === 'moderate').length;

    return {
      levelA: criticalIssues === 0,
      levelAA: criticalIssues === 0 && seriousIssues === 0,
      levelAAA: criticalIssues === 0 && seriousIssues === 0 && moderateIssues === 0
    };
  }

  /**
   * Get WCAG 2.2 specific rule information
   */
  getWCAG22RuleInfo(ruleId: string) {
    const ruleInfo = {
      'target-size': {
        name: 'Target Size (Minimum)',
        description: 'Interactive elements must have a minimum target size of 24x24 CSS pixels',
        wcag22Level: 'A',
        help: 'Ensure interactive elements are large enough to be easily activated by users with motor impairments'
      },
      'focus-indicator': {
        name: 'Focus Indicator',
        description: 'All interactive elements must have a visible focus indicator',
        wcag22Level: 'A',
        help: 'Provide clear visual indication when elements receive keyboard focus'
      },
      'page-title': {
        name: 'Page Title',
        description: 'Each page must have a descriptive title',
        wcag22Level: 'A',
        help: 'Use descriptive page titles that clearly indicate the page content'
      },
      'color-contrast': {
        name: 'Color Contrast',
        description: 'Text must have sufficient contrast ratio with its background',
        wcag22Level: 'AA',
        help: 'Ensure text is readable for users with low vision'
      },
      'image-alt': {
        name: 'Image Alternative Text',
        description: 'Images must have appropriate alternative text',
        wcag22Level: 'A',
        help: 'Provide text alternatives for images'
      },
      'label': {
        name: 'Form Labels',
        description: 'Form controls must have associated labels',
        wcag22Level: 'A',
        help: 'Ensure form controls are properly labeled'
      },
      'heading-order': {
        name: 'Heading Order',
        description: 'Headings must be in a logical order',
        wcag22Level: 'A',
        help: 'Use heading elements in a hierarchical structure'
      },
      'link-name': {
        name: 'Link Names',
        description: 'Links must have descriptive names',
        wcag22Level: 'A',
        help: 'Provide clear and descriptive link text'
      },
      'button-name': {
        name: 'Button Names',
        description: 'Buttons must have accessible names',
        wcag22Level: 'A',
        help: 'Ensure buttons have descriptive text or aria-label'
      },
      'html-has-lang': {
        name: 'HTML Language',
        description: 'HTML element must have a lang attribute',
        wcag22Level: 'A',
        help: 'Specify the language of the document'
      },
      'landmark-one-main': {
        name: 'Main Landmark',
        description: 'Page must have exactly one main landmark',
        wcag22Level: 'A',
        help: 'Use the main element to identify the primary content'
      },
      'list': {
        name: 'List Structure',
        description: 'Lists must be properly structured',
        wcag22Level: 'A',
        help: 'Use appropriate list elements (ul, ol, dl)'
      },
      'listitem': {
        name: 'List Items',
        description: 'List items must be properly contained',
        wcag22Level: 'A',
        help: 'Ensure list items are direct children of list elements'
      },
      'modal-focus-escape': {
        name: 'Modal Focus Trap',
        description: 'Focus should stay inside modal until closed',
        wcag22Level: 'A',
        help: 'Trap focus inside the dialog; allow exit via Escape or Close button (WCAG 2.1.2)'
      },
      'modal-keyboard-trap': {
        name: 'No Keyboard Trap',
        description: 'Users must be able to leave the modal with keyboard',
        wcag22Level: 'A',
        help: 'Ensure Escape closes the modal and returns focus (WCAG 2.1.2)'
      },
      'keyboard-focus-visible': {
        name: 'Focus Visible',
        description: 'Focused elements must have a visible focus indicator',
        wcag22Level: 'AA',
        help: 'Use outline or box-shadow on :focus / :focus-visible (WCAG 2.4.7)'
      },
      'keyboard-tabindex-order': {
        name: 'Tab Order',
        description: 'Avoid positive tabindex; use natural DOM order',
        wcag22Level: 'A',
        help: 'Remove tabindex > 0; use skip links if needed (WCAG 2.4.3)'
      },
      'error-message-clarity': {
        name: 'Error Identification',
        description: 'Form errors must be clear and specific',
        wcag22Level: 'A',
        help: 'Use aria-describedby and specific error text (WCAG 3.3.1)'
      },
      'alt-text-quality': {
        name: 'Alt Text Quality',
        description: 'Alternative text must be descriptive, not generic',
        wcag22Level: 'A',
        help: 'Avoid "image" or "picture of"; describe content or purpose'
      },
      'content-readability': {
        name: 'Content Readability',
        description: 'Content should be readable (grade level)',
        wcag22Level: 'AAA',
        help: 'Use shorter sentences and simpler words where possible'
      },
      'aria-hidden-content': {
        name: 'ARIA Hidden Content',
        description: 'Main content must not be hidden from screen readers',
        wcag22Level: 'A',
        help: 'Do not use aria-hidden="true" on containers that hold headings, paragraphs, or article/section content'
      },
      'aria-role-strips-semantics': {
        name: 'ARIA Role Strips Semantics',
        description: 'Headings and paragraphs must be announced by screen readers',
        wcag22Level: 'A',
        help: 'Do not use role="presentation" or role="none" on article, section, h1–h6, or p'
      },
      'landmark-wrong-role': {
        name: 'Landmark Correctness',
        description: 'Landmark role must match the element (e.g. use <main> for main content)',
        wcag22Level: 'AA',
        help: 'Use semantic elements that match the landmark (main, nav, aside, header, footer)'
      },
      'landmark-multiple-no-name': {
        name: 'Landmark Accessible Name',
        description: 'Multiple landmarks of the same type need accessible names',
        wcag22Level: 'AA',
        help: 'Add aria-label or aria-labelledby to distinguish multiple nav/region landmarks'
      },
      'form-structure': {
        name: 'Form Structure',
        description: 'Use native form elements instead of div/span with roles',
        wcag22Level: 'A',
        help: 'Use <input>, <select>, <textarea>, <button> for keyboard and screen reader support'
      },
      'ad-container-accessibility': {
        name: 'Ad Container Accessibility',
        description: 'Ad or sponsor areas must have alt text and descriptive link text',
        wcag22Level: 'A',
        help: 'Add alt to images and descriptive link text in ad/sponsor containers'
      }
    };

    return (ruleInfo as any)[ruleId] || {
      name: ruleId,
      description: 'WCAG 2.2 accessibility rule',
      wcag22Level: 'A',
      help: 'Check axe-core documentation for specific guidance'
    };
  }

  /**
   * Generate detailed remediation suggestions for an issue with specific AXE guidance
   */
  async generateRemediationSuggestions(issue: AccessibilityIssue): Promise<RemediationSuggestion[]> {
    // Only generate contextual suggestions (AI or rule-based)
    const contextualSuggestions = await this.generateContextualSuggestions(issue);
    
    // Return exactly ONE suggestion per issue
    return contextualSuggestions;
  }

  /**
   * Get rule-based suggestion only (no AI). Used when using learned suggestions + cron (e.g. extension scan).
   */
  getRuleBasedSuggestion(issue: AccessibilityIssue): RemediationSuggestion[] {
    const firstNode = issue.nodes?.[0];
    if (!firstNode) return [];
    const html = firstNode.html ?? '';
    const target = firstNode.target?.[0] ?? '';
    const failureSummary = firstNode.failureSummary ?? '';
    const suggestion = this.getBestRuleBasedSuggestion(issue.id, html, target, failureSummary, issue.impact);
    return suggestion ? [suggestion] : [];
  }

  /**
   * Get priority level based on impact
   */
  private getPriorityForImpact(impact: string): 'high' | 'medium' | 'low' {
    switch (impact) {
      case 'critical':
      case 'serious':
        return 'high';
      case 'moderate':
        return 'medium';
      case 'minor':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Generate AI-powered contextual suggestions based on the actual HTML code
   */
  private async generateContextualSuggestions(issue: AccessibilityIssue): Promise<RemediationSuggestion[]> {
    // Only generate ONE suggestion per issue, not per node
    const firstNode = issue.nodes[0];
    if (!firstNode) {
      return [];
    }

    const html = firstNode.html;
    const target = firstNode.target[0]; // CSS selector
    const failureSummary = firstNode.failureSummary;

    // Rule-specific overrides to avoid "no-op" suggestions.
    // For example, `empty-table-header` issues should produce a meaningful label,
    // not echo back an empty `<th></th>`.
    if (issue.id === 'empty-table-header') {
      const scopeMatch = html.match(/scope=["'](col|row)["']/i)
      const scope = (scopeMatch?.[1] || 'col').toLowerCase()
      const openTag = html.match(/<th[^>]*>/i)?.[0]
      const safeOpenTag = openTag || `<th scope="${scope}">`
      return [{
        type: 'fix',
        description: 'Ensure table headers have discernible text so screen readers can identify the column/row.',
        codeExample: `${safeOpenTag}Header text</th>`,
        priority: 'high'
      }]
    }

    // Try to get AI-powered suggestion first (most valuable)
    try {
      // Create a cache key based on issue type and HTML content
      const cacheKey = `${issue.id}-${html.substring(0, 200)}`;
      
      // Check if we already have a cached response for this issue
      if (this.aiResponseCache.has(cacheKey)) {
        const aiSuggestion = this.aiResponseCache.get(cacheKey)!;
        
        // Extract code example from AI response if it contains markdown code blocks
        const codeBlockMatch = aiSuggestion.match(/```(?:html|css|js|javascript)?\s*\n([\s\S]*?)```/);
        let description = aiSuggestion;
        let codeExample: string | undefined;

        if (codeBlockMatch) {
          // Remove the code block from description and extract it
          description = aiSuggestion.replace(/```(?:html|css|js|javascript)?\s*\n[\s\S]*?```/g, '').trim();
          codeExample = codeBlockMatch[1].trim();
        }

        // Clean up the description by removing markdown headers and extra formatting
        description = description
          .replace(/^#+\s*Accessibility Fix:\s*/i, '') // Remove "# Accessibility Fix:" headers
          .replace(/^#+\s*/g, '') // Remove any other markdown headers
          .trim();

        return [{
          type: 'fix',
          description: description,
          codeExample: codeExample,
          priority: this.getPriorityForImpact(issue.impact)
        }];
      }
      
      const aiSuggestion = await this.claudeAPI.generateAccessibilitySuggestion(
        html,
        issue.id,
        failureSummary,
        target,
        issue.description,
        issue.help
      );

      // Cache the response for future use
      this.aiResponseCache.set(cacheKey, aiSuggestion);

      if (aiSuggestion && !aiSuggestion.includes('Unable to get AI suggestion')) {
        // Extract code example from AI response if it contains markdown code blocks
        const codeBlockMatch = aiSuggestion.match(/```(?:html|css|js|javascript)?\s*\n([\s\S]*?)```/);
        let description = aiSuggestion;
        let codeExample: string | undefined;

        if (codeBlockMatch) {
          // Remove the code block from description and extract it
          description = aiSuggestion.replace(/```(?:html|css|js|javascript)?\s*\n[\s\S]*?```/g, '').trim();
          codeExample = codeBlockMatch[1].trim();
        }

        // Clean up the description by removing markdown headers and extra formatting
        description = description
          .replace(/^#+\s*Accessibility Fix:\s*/i, '') // Remove "# Accessibility Fix:" headers
          .replace(/^#+\s*/g, '') // Remove any other markdown headers
          .trim();

        return [{
          type: 'fix',
          description: description,
          codeExample: codeExample,
          priority: this.getPriorityForImpact(issue.impact)
        }];
      } else {

      }
    } catch (error) {
      console.error('❌ Claude API failed:', error);

    }

    // If no AI suggestion, get the best rule-based suggestion with code example
    const ruleBasedSuggestion = this.getBestRuleBasedSuggestion(issue.id, html, target, failureSummary, issue.impact);
    if (ruleBasedSuggestion) {
      return [ruleBasedSuggestion];
    }

    // Fallback to basic suggestion
    return [{
      type: 'fix',
      description: failureSummary || `Fix the ${issue.id} issue`,
      priority: this.getPriorityForImpact(issue.impact)
    }];
  }

  /**
   * Generate intelligent suggestions for heading order issues
   */
  private generateHeadingOrderSuggestions(html: string, target: string, failureSummary: string): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    
    // Extract heading level and content from HTML
    const headingMatch = html.match(/<h([1-6])/i);
    if (headingMatch) {
      const currentLevel = parseInt(headingMatch[1]);
      const headingText = html.replace(/<[^>]*>/g, '').trim();
      
      // Analyze the heading content and context to make intelligent suggestions
      const headingAnalysis = this.analyzeHeadingContext(headingText, target, currentLevel);
      
      if (headingAnalysis.suggestedLevel !== currentLevel) {
        const levelName = this.getHeadingLevelName(headingAnalysis.suggestedLevel);
        const currentLevelName = this.getHeadingLevelName(currentLevel);
        
        suggestions.push({
          type: 'fix',
          description: headingAnalysis.reason,
          codeExample: html.replace(
            new RegExp(`<h${currentLevel}`, 'i'), 
            `<h${headingAnalysis.suggestedLevel}`
          ).replace(
            new RegExp(`</h${currentLevel}>`, 'i'), 
            `</h${headingAnalysis.suggestedLevel}>`
          ),
          priority: headingAnalysis.priority
        });
      }
    }

    return suggestions;
  }

  /**
   * Analyze heading context to determine appropriate level
   */
  private analyzeHeadingContext(headingText: string, target: string, currentLevel: number): {
    suggestedLevel: number;
    reason: string;
    priority: 'high' | 'medium' | 'low';
  } {
    const text = headingText.toLowerCase();
    const targetLower = target.toLowerCase();
    
    // Analyze heading content patterns
    const isMainSection = this.isMainSectionHeading(text, targetLower);
    const isSubSection = this.isSubSectionHeading(text, targetLower);
    const isPageTitle = this.isPageTitle(text, targetLower);
    
    // Determine appropriate heading level based on content analysis
    if (isPageTitle || isMainSection) {
      if (currentLevel > 2) {
        return {
          suggestedLevel: 2,
          reason: `This ${this.getHeadingLevelName(currentLevel)} heading "${headingText}" appears to be a main page section or title. It should be an h2 to establish proper document structure.`,
          priority: 'high'
        };
      }
    } else if (isSubSection) {
      if (currentLevel > 3) {
        return {
          suggestedLevel: 3,
          reason: `This ${this.getHeadingLevelName(currentLevel)} heading "${headingText}" appears to be a subsection. It should be an h3 to maintain proper heading hierarchy.`,
          priority: 'medium'
        };
      }
    } else if (currentLevel === 4) {
      // Generic h4 analysis
      return {
        suggestedLevel: 2,
        reason: `This h4 heading "${headingText}" is likely a main section heading that should be h2 to follow proper document structure.`,
        priority: 'high'
      };
    }
    
    // Default: no change needed
    return {
      suggestedLevel: currentLevel,
      reason: '',
      priority: 'low'
    };
  }

  /**
   * Check if heading appears to be a main section heading
   */
  private isMainSectionHeading(text: string, target: string): boolean {
    const mainSectionKeywords = [
      'main', 'primary', 'featured', 'hero', 'banner', 'section', 'content',
      'about', 'services', 'products', 'contact', 'news', 'blog', 'article'
    ];
    
    return mainSectionKeywords.some(keyword => 
      text.includes(keyword) || target.includes(keyword)
    );
  }

  /**
   * Check if heading appears to be a subsection heading
   */
  private isSubSectionHeading(text: string, target: string): boolean {
    const subSectionKeywords = [
      'sub', 'secondary', 'related', 'additional', 'more', 'details',
      'info', 'description', 'summary', 'overview'
    ];
    
    return subSectionKeywords.some(keyword => 
      text.includes(keyword) || target.includes(keyword)
    );
  }

  /**
   * Check if heading appears to be a page title
   */
  private isPageTitle(text: string, target: string): boolean {
    const titleKeywords = [
      'title', 'headline', 'main', 'primary', 'hero', 'banner'
    ];
    
    return titleKeywords.some(keyword => 
      text.includes(keyword) || target.includes(keyword)
    );
  }

  /**
   * Get human-readable heading level name
   */
  private getHeadingLevelName(level: number): string {
    switch (level) {
      case 1: return 'h1';
      case 2: return 'h2';
      case 3: return 'h3';
      case 4: return 'h4';
      case 5: return 'h5';
      case 6: return 'h6';
      default: return `h${level}`;
    }
  }

  /**
   * Generate intelligent suggestions for color contrast issues
   */
  private generateColorContrastSuggestions(html: string, target: string, failureSummary: string): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    
    // Extract text content and analyze for contrast issues
    const textContent = html.replace(/<[^>]*>/g, '').trim();
    const elementType = this.getElementType(html);
    const context = this.analyzeTextContext(textContent, target);
    
    // Generate contextual suggestions based on element type and content
    if (elementType === 'heading') {
      suggestions.push({
        type: 'fix',
        description: `This heading "${textContent.substring(0, 30)}..." has insufficient color contrast. Headings need high contrast for readability.`,
        codeExample: `/* Improve heading contrast */
${target} {
  color: #1a1a1a; /* Very dark gray */
  background-color: #ffffff; /* White background */
  /* Alternative: Use a darker background */
  /* background-color: #f8f9fa; */
}`,
        priority: 'high'
      });
    } else if (elementType === 'link') {
      suggestions.push({
        type: 'fix',
        description: `This link "${textContent.substring(0, 30)}..." has insufficient color contrast. Links need clear visual distinction.`,
        codeExample: `/* Improve link contrast */
${target} {
  color: #0066cc; /* Accessible blue */
  text-decoration: underline;
  /* For visited links */
  &:visited {
    color: #660099;
  }
}`,
        priority: 'high'
      });
    } else if (context.isImportant) {
      suggestions.push({
        type: 'fix',
        description: `This important text "${textContent.substring(0, 30)}..." has insufficient color contrast. Important content needs high contrast.`,
        codeExample: `/* Improve contrast for important content */
${target} {
  color: #000000; /* Black text */
  background-color: #ffffff; /* White background */
  font-weight: 600; /* Make it more prominent */
}`,
        priority: 'high'
      });
    } else {
      suggestions.push({
        type: 'fix',
        description: `The text "${textContent.substring(0, 30)}..." has insufficient color contrast. Increase the contrast ratio to meet WCAG 2.2 AA standards (4.5:1 for normal text).`,
        codeExample: `/* Improve text contrast */
${target} {
  color: #333333; /* Dark gray text */
  background-color: #ffffff; /* White background */
  /* Alternative high-contrast combinations: */
  /* color: #000000; background-color: #ffffff; (21:1) */
  /* color: #1a1a1a; background-color: #f8f9fa; (12:1) */
}`,
        priority: 'high'
      });
    }

    return suggestions;
  }

  /**
   * Determine the type of HTML element
   */
  private getElementType(html: string): string {
    if (html.match(/<h[1-6]/i)) return 'heading';
    if (html.match(/<a\s/i)) return 'link';
    if (html.match(/<button/i)) return 'button';
    if (html.match(/<input/i)) return 'input';
    if (html.match(/<label/i)) return 'label';
    return 'text';
  }

  /**
   * Analyze text context to determine importance
   */
  private analyzeTextContext(text: string, target: string): { isImportant: boolean; context: string } {
    const textLower = text.toLowerCase();
    const targetLower = target.toLowerCase();
    
    // Check for important keywords
    const importantKeywords = [
      'error', 'warning', 'alert', 'important', 'critical', 'urgent',
      'required', 'mandatory', 'must', 'should', 'notice'
    ];
    
    const isImportant = importantKeywords.some(keyword => 
      textLower.includes(keyword) || targetLower.includes(keyword)
    );
    
    // Determine context
    let context = 'general';
    if (textLower.includes('error') || textLower.includes('warning')) context = 'error';
    else if (textLower.includes('required') || textLower.includes('mandatory')) context = 'form';
    else if (targetLower.includes('heading') || targetLower.includes('title')) context = 'heading';
    
    return { isImportant, context };
  }

  /**
   * Generate intelligent suggestions for image alt text issues
   */
  private generateImageAltSuggestions(html: string, target: string, failureSummary: string): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    
    // Extract image information
    const srcMatch = html.match(/src=["']([^"']+)["']/i);
    const src = srcMatch ? srcMatch[1] : '';
    const imageType = this.analyzeImageType(src, target);
    
    // Check if image has no alt attribute
    if (!html.includes('alt=')) {
      const suggestedAlt = this.generateSuggestedAltText(src, target, imageType);
      suggestions.push({
        type: 'fix',
        description: `This ${imageType} image is missing alt text. Add descriptive alt text to explain what the image shows.`,
        codeExample: html.replace(/<img/i, `<img alt="${suggestedAlt}"`),
        priority: 'high'
      });
    } else if (html.includes('alt=""')) {
      const suggestedAlt = this.generateSuggestedAltText(src, target, imageType);
      suggestions.push({
        type: 'fix',
        description: `This ${imageType} image has empty alt text. ${imageType === 'decorative' ? 'If it\'s decorative, add role="presentation".' : 'Add descriptive alt text.'}`,
        codeExample: imageType === 'decorative' 
          ? html.replace('alt=""', 'alt="" role="presentation"')
          : html.replace('alt=""', `alt="${suggestedAlt}"`),
        priority: 'medium'
      });
    }

    return suggestions;
  }

  /**
   * Analyze image type based on filename and context
   */
  private analyzeImageType(src: string, target: string): string {
    const srcLower = src.toLowerCase();
    const targetLower = target.toLowerCase();
    
    // Check for decorative images
    const decorativePatterns = [
      'decoration', 'decorative', 'ornament', 'pattern', 'background',
      'icon', 'bullet', 'arrow', 'spacer', 'divider'
    ];
    
    if (decorativePatterns.some(pattern => 
      srcLower.includes(pattern) || targetLower.includes(pattern)
    )) {
      return 'decorative';
    }
    
    // Check for content images
    const contentPatterns = [
      'photo', 'image', 'picture', 'photo', 'img', 'photo',
      'logo', 'banner', 'hero', 'featured', 'main'
    ];
    
    if (contentPatterns.some(pattern => 
      srcLower.includes(pattern) || targetLower.includes(pattern)
    )) {
      return 'content';
    }
    
    // Check for functional images
    const functionalPatterns = [
      'button', 'link', 'action', 'submit', 'search', 'menu',
      'navigation', 'nav', 'tab', 'accordion'
    ];
    
    if (functionalPatterns.some(pattern => 
      srcLower.includes(pattern) || targetLower.includes(pattern)
    )) {
      return 'functional';
    }
    
    return 'content'; // Default to content
  }

  /**
   * Generate suggested alt text based on image context
   */
  private generateSuggestedAltText(src: string, target: string, imageType: string): string {
    const srcLower = src.toLowerCase();
    const targetLower = target.toLowerCase();
    
    if (imageType === 'decorative') {
      return 'Decorative image';
    }
    
    // Extract meaningful information from src or target
    const filename = src.split('/').pop()?.split('.')[0] || '';
    const cleanFilename = filename.replace(/[-_]/g, ' ').replace(/\d+/g, '').trim();
    
    if (cleanFilename) {
      return `${cleanFilename.charAt(0).toUpperCase() + cleanFilename.slice(1)}`;
    }
    
    // Fallback based on context
    if (targetLower.includes('logo')) return 'Company logo';
    if (targetLower.includes('banner')) return 'Banner image';
    if (targetLower.includes('hero')) return 'Hero image';
    if (targetLower.includes('photo')) return 'Photo';
    if (targetLower.includes('icon')) return 'Icon';
    
    return 'Image description';
  }

  /**
   * Generate specific suggestions for target size issues
   */
  private generateTargetSizeSuggestions(html: string, target: string, failureSummary: string): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    
    // Determine element type
    const isButton = html.includes('<button') || html.includes('role="button"');
    const isLink = html.includes('<a');
    const isInput = html.includes('<input');
    
    if (isButton) {
      suggestions.push({
        type: 'fix',
        description: 'This button is too small for easy interaction. Increase its size to at least 24x24 CSS pixels.',
        codeExample: `/* Add this CSS to increase button size */
${target} {
  min-width: 24px;
  min-height: 24px;
  padding: 8px 12px;
}`,
        priority: 'high'
      });
    } else if (isLink) {
      suggestions.push({
        type: 'fix',
        description: 'This link has a small clickable area. Increase padding to make it easier to click.',
        codeExample: `/* Add this CSS to increase link clickable area */
${target} {
  padding: 8px;
  display: inline-block;
}`,
        priority: 'medium'
      });
    }

    return suggestions;
  }

  /**
   * Generate specific suggestions for label issues
   */
  private generateLabelSuggestions(html: string, target: string, failureSummary: string): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    
    // Check if it's an input without label
    if (html.includes('<input')) {
      const inputType = html.match(/type="([^"]*)"/)?.[1] || 'text';
      const placeholder = html.match(/placeholder="([^"]*)"/)?.[1] || '';
      
      suggestions.push({
        type: 'fix',
        description: `This ${inputType} input needs a proper label. Add a descriptive label that explains what information is expected.`,
        codeExample: `<label for="input-id">${placeholder || 'Input Label'}:</label>
${html}`,
        priority: 'high'
      });
    }

    return suggestions;
  }

  /**
   * Generate specific suggestions for link name issues
   */
  private generateLinkNameSuggestions(html: string, target: string, failureSummary: string): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    
    // Extract link text
    const linkText = html.replace(/<[^>]*>/g, '').trim();
    
    if (linkText === '' || linkText === 'Click here' || linkText === 'Read more') {
      suggestions.push({
        type: 'fix',
        description: 'This link has generic text that doesn\'t describe its purpose. Replace with descriptive text that indicates the destination.',
        codeExample: html.replace(/>Click here</, '>View detailed product information<'),
        priority: 'high'
      });
    } else if (linkText.length < 3) {
      suggestions.push({
        type: 'fix',
        description: 'This link text is too short to be meaningful. Add more descriptive text.',
        codeExample: html.replace(/>[^<]{1,2}</, '>View full article<'),
        priority: 'medium'
      });
    }

    return suggestions;
  }

  /**
   * Generate specific suggestions for button name issues
   */
  private generateButtonNameSuggestions(html: string, target: string, failureSummary: string): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    
    // Extract button text
    const buttonText = html.replace(/<[^>]*>/g, '').trim();
    
    if (buttonText === '' || buttonText === 'Submit' || buttonText === 'Click') {
      suggestions.push({
        type: 'fix',
        description: 'This button has generic or missing text. Add descriptive text that explains what the button does.',
        codeExample: html.replace(/>Submit</, '>Save changes<'),
        priority: 'high'
      });
    }

    return suggestions;
  }

  /**
   * Generate specific suggestions for form field issues
   */
  private generateFormFieldSuggestions(html: string, target: string, failureSummary: string): RemediationSuggestion[] {
    const suggestions: RemediationSuggestion[] = [];
    
    suggestions.push({
      type: 'fix',
      description: 'This form field has multiple labels which can confuse screen readers. Remove duplicate labels and keep only one clear, descriptive label.',
      codeExample: `<!-- Remove duplicate labels and keep only one -->
<label for="email">Email Address:</label>
<input id="email" type="email" />`,
      priority: 'medium'
    });

    return suggestions;
  }

  /**
   * Get the best rule-based suggestion with code example
   */
  private getBestRuleBasedSuggestion(issueId: string, html: string, target: string, failureSummary: string, impact: string): RemediationSuggestion | null {
    switch (issueId) {
      case 'empty-table-header': {
        const scopeMatch = html.match(/scope=["'](col|row)["']/i)
        const scope = (scopeMatch?.[1] || 'col').toLowerCase()
        const openTag = html.match(/<th[^>]*>/i)?.[0]
        const safeOpenTag = openTag || `<th scope="${scope}">`
        return {
          type: 'fix',
          description: 'Ensure table headers have discernible text so screen readers can identify the column/row.',
          codeExample: `${safeOpenTag}Header text</th>`,
          priority: 'high'
        }
      }
      case 'heading-order':
        const headingSuggestions = this.generateHeadingOrderSuggestions(html, target, failureSummary);
        return headingSuggestions.length > 0 ? headingSuggestions[0] : null;
      case 'color-contrast':
        const contrastSuggestions = this.generateColorContrastSuggestions(html, target, failureSummary);
        return contrastSuggestions.length > 0 ? contrastSuggestions[0] : null;
      case 'image-alt':
        const imageSuggestions = this.generateImageAltSuggestions(html, target, failureSummary);
        return imageSuggestions.length > 0 ? imageSuggestions[0] : null;
      case 'target-size':
        const targetSuggestions = this.generateTargetSizeSuggestions(html, target, failureSummary);
        return targetSuggestions.length > 0 ? targetSuggestions[0] : null;
      case 'label':
        const labelSuggestions = this.generateLabelSuggestions(html, target, failureSummary);
        return labelSuggestions.length > 0 ? labelSuggestions[0] : null;
      case 'link-name':
        const linkSuggestions = this.generateLinkNameSuggestions(html, target, failureSummary);
        return linkSuggestions.length > 0 ? linkSuggestions[0] : null;
      case 'button-name':
        const buttonSuggestions = this.generateButtonNameSuggestions(html, target, failureSummary);
        return buttonSuggestions.length > 0 ? buttonSuggestions[0] : null;
      case 'form-field-multiple-labels':
        const formSuggestions = this.generateFormFieldSuggestions(html, target, failureSummary);
        return formSuggestions.length > 0 ? formSuggestions[0] : null;
      default:
        return {
          type: 'fix',
          description: failureSummary || `Fix the ${issueId} issue`,
          codeExample: this.generateGenericCodeExample(html, issueId),
          priority: this.getPriorityForImpact(impact)
        };
    }
  }

  /**
   * Generate generic code example for other issues
   */
  private generateGenericCodeExample(html: string, issueId: string): string {
    // Provide a basic template based on the issue type
    switch (issueId) {
      case 'empty-table-header': {
        const scopeMatch = html.match(/scope=["'](col|row)["']/i)
        const scope = (scopeMatch?.[1] || 'col').toLowerCase()
        const openTag = html.match(/<th[^>]*>/i)?.[0]
        const safeOpenTag = openTag || `<th scope="${scope}">`
        return `<!-- Ensure table headers have discernible text -->
${safeOpenTag}Header text</th>`
      }
      case 'aria-allowed-attr':
        return `<!-- Remove invalid ARIA attributes -->
<div role="button" tabindex="0">Click me</div>`;
      case 'aria-required-attr':
        return `<!-- Add required ARIA attributes -->
<div role="combobox" aria-expanded="false" aria-haspopup="listbox">
  <input type="text" />
</div>`;
      case 'modal-focus-escape':
      case 'modal-keyboard-trap':
        return `<!-- Trap focus in modal and close on Escape (WCAG 2.1.2) -->
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title"
     onKeyDown={(e) => e.key === 'Escape' && closeModal()}>
  <h2 id="dialog-title">Title</h2>
  <button onClick={closeModal} aria-label="Close">Close</button>
  <!-- Focus first focusable on open; restore focus to trigger on close -->
</div>`;
      case 'keyboard-focus-visible':
        return `/* Visible focus ring */
:focus-visible {
  outline: 2px solid #0066cc;
  outline-offset: 2px;
}
/* Or for elements that need custom focus */
.my-button:focus {
  box-shadow: 0 0 0 2px #fff, 0 0 0 4px #0066cc;
}`;
      case 'keyboard-tabindex-order':
        return `<!-- Remove positive tabindex; use DOM order or skip links -->
<a href="#main">Skip to content</a>
<nav>...</nav>
<main id="main">...</main>`;
      case 'error-message-clarity':
        return `<!-- Clear, specific error (WCAG 3.3.1) -->
<label for="email">Email</label>
<input id="email" type="email" aria-describedby="email-error" aria-invalid="true" />
<span id="email-error" role="alert">Enter a valid email address (e.g. name@example.com).</span>`;
      case 'alt-text-quality':
        return `<!-- Descriptive alt text -->
<img src="chart.png" alt="Bar chart showing Q3 sales: Product A 45%, B 30%, C 25%." />`;
      case 'content-readability':
        return `<!-- Shorter sentences and simpler words -->
<p>Use short sentences. Avoid jargon. One idea per paragraph.</p>`;
      case 'aria-hidden-content':
        return `<!-- Remove aria-hidden from main content containers -->
<div>  <!-- do not use aria-hidden="true" here if it contains article/headings/paragraphs -->
  <article><h2>Title</h2><p>Content...</p></article>
</div>`;
      case 'aria-role-strips-semantics':
        return `<!-- Do not strip semantics from headings/paragraphs/article -->
<article>  <!-- remove role="presentation" or role="none" -->
  <h2>Section</h2>
  <p>Paragraph text.</p>
</article>`;
      case 'landmark-wrong-role':
        return `<!-- Use semantic elements that match the landmark -->
<main>
  <h1>Page title</h1>
  <p>Content...</p>
</main>
<nav aria-label="Main navigation">...</nav>`;
      case 'landmark-multiple-no-name':
        return `<!-- Name multiple landmarks -->
<nav aria-label="Main navigation">...</nav>
<nav aria-label="Footer links">...</nav>`;
      case 'form-structure':
        return `<!-- Use native form elements -->
<form>
  <label for="email">Email</label>
  <input type="email" id="email" />
  <button type="submit">Submit</button>
</form>`;
      case 'ad-container-accessibility':
        return `<!-- Ad container: descriptive alt and link text -->
<div class="ad-slot" aria-label="Advertisement">
  <img src="ad.png" alt="Promotion: 20% off until Friday" />
  <a href="...">View offer details</a>
</div>`;
      default:
        return `<!-- Fix the accessibility issue in this element -->
${html}`;
    }
  }

  /**
   * Generate a detailed report for an issue with offending elements and fixes
   */
  async generateDetailedReport(issue: AccessibilityIssue) {
    const ruleInfo = this.getWCAG22RuleInfo(issue.id);
    const suggestions = await this.generateRemediationSuggestions(issue);

    return {
      issueId: issue.id,
      ruleName: ruleInfo.name,
      description: issue.description,
      impact: issue.impact,
      wcag22Level: ruleInfo.wcag22Level,
      help: issue.help,
      helpUrl: issue.helpUrl,
      offendingElements: issue.nodes.map(node => ({
        html: node.html,
        target: node.target,
        failureSummary: node.failureSummary,
        impact: node.impact
      })),
      suggestions,
      totalOccurrences: issue.nodes.length
    };
  }
}