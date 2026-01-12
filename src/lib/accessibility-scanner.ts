import * as axe from 'axe-core';
import { JSDOM } from 'jsdom';
import { axeConfig, wcag22Rules } from './axe-config';
import { ClaudeAPI } from './claude-api';
import { CloudinaryService } from './cloudinary-service';

export interface AccessibilityIssue {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  tags: string[];
  description: string;
  help: string;
  helpUrl: string;
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

  constructor() {
    this.config = { ...axeConfig };
    this.claudeAPI = new ClaudeAPI();
  }

  /**
   * Scan a web page for accessibility issues using custom standards
   * This method should be called from within a Puppeteer page context
   */
  async scanPageInBrowser(page: any, selectedTags?: string[]): Promise<ScanResult> {

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
      
      }`)
      
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
        if (typeof window.axe === 'undefined') {
          throw new Error('axe-core is not loaded in the browser context');
        }
        
        const axe = window.axe;
        
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
      const colorContrastRule = allRules.find(rule => rule.ruleId === 'color-contrast');
      const colorContrastEnhancedRule = allRules.find(rule => rule.ruleId === 'color-contrast-enhanced');
      
      if (colorContrastRule) {


      }
      
      if (colorContrastEnhancedRule) {


      }
      
      // Debug: Show all disabled rules that might be relevant
      const disabledRules = allRules.filter(rule => !rule.enabled);
      ));
      
      // Debug: Log best-practice rules
      const bestPracticeRules = allRules.filter(rule => rule.tags.includes('best-practice'));
      ));
      
      // Debug: Log Section 508 rules
      const section508Rules = allRules.filter(rule => rule.tags.includes('section508'));
      ));
      
      // Debug: Log EN 301 549 rules
      const en301549Rules = allRules.filter(rule => rule.tags.includes('EN-301-549'));
      ));
      
      // Run axe-core analysis with comprehensive rule set
      // CRITICAL: Enable all rules that should be active for comprehensive testing
      }`)
      
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
      ,
        colorContrastViolations: results.violations.filter(v => v.id === 'color-contrast').length,
        colorContrastEnhancedViolations: results.violations.filter(v => v.id === 'color-contrast-enhanced').length,
        section508Violations: results.violations.filter(v => v.tags.includes('section508')).length,
        en301549Violations: results.violations.filter(v => v.tags.includes('EN-301-549')).length,
        bestPracticeViolations: results.violations.filter(v => v.tags.includes('best-practice')).length
      });
      
      // Debug: Show which rules were actually executed
      const executedRules = [...results.violations, ...results.passes].map(r => r.id);

      ));
      
      return results;
      }, tagsToCheck);

      // Process results
      const issues: AccessibilityIssue[] = results.violations.map(violation => ({
        id: violation.id,
        impact: violation.impact as 'minor' | 'moderate' | 'serious' | 'critical',
        tags: violation.tags,
        description: violation.description,
        help: violation.help,
        helpUrl: violation.helpUrl,
        nodes: violation.nodes.map(node => ({
          html: node.html,
          target: node.target,
          failureSummary: node.failureSummary || this.generateFailureSummary(violation, node),
          impact: node.impact,
          any: node.any,
          all: node.all,
          none: node.none
        }))
      }));

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

      // Capture screenshots and upload to Cloudinary
      let screenshots = null;
      try {


        // Take a full page screenshot (optimized for smaller file size)

        const fullPageScreenshot = await page.screenshot({
          fullPage: true,
          encoding: 'base64',
          quality: 80,
          type: 'jpeg'
        }) as string;

        // Take a viewport screenshot (optimized for smaller file size)

        const viewportScreenshot = await page.screenshot({
          fullPage: false,
          encoding: 'base64',
          quality: 80,
          type: 'jpeg'
        }) as string;

        // Capture screenshots of elements with issues

        const elementScreenshots = [];
        for (const issue of issues.slice(0, 5)) { // Limit to first 5 issues
          `);
          for (const node of issue.nodes || []) {
            const selector = node.target?.[0];
            if (selector) {

              try {
                // Try to find and screenshot the element
                const element = await page.$(selector);
                if (element) {

                  const elementScreenshot = await element.screenshot({
                    encoding: 'base64',
                    quality: 80,
                    type: 'jpeg'
                  }) as string;
                  
                  elementScreenshots.push({
                    selector,
                    issueId: issue.id,
                    severity: issue.impact,
                    screenshot: elementScreenshot,
                    boundingBox: await element.boundingBox()
                  });

                } else {

                }
              } catch (elementError) {
                console.warn(`❌ Failed to screenshot element ${selector}:`, elementError);
              }
            }
          }
        }

        // Upload screenshots to Cloudinary

        const timestamp = Date.now();
        const scanId = `scan_${timestamp}`;
        
        const uploadPromises = [];
        
        // Upload full page screenshot
        if (fullPageScreenshot) {
          uploadPromises.push(
            CloudinaryService.uploadBase64Image(
              fullPageScreenshot,
              'a11ytest/screenshots',
              { public_id: `${scanId}_fullpage` }
            )
          );
        }
        
        // Upload viewport screenshot
        if (viewportScreenshot) {
          uploadPromises.push(
            CloudinaryService.uploadBase64Image(
              viewportScreenshot,
              'a11ytest/screenshots',
              { public_id: `${scanId}_viewport` }
            )
          );
        }
        
        // Upload element screenshots
        for (let i = 0; i < elementScreenshots.length; i++) {
          const element = elementScreenshots[i];
          uploadPromises.push(
            CloudinaryService.uploadBase64Image(
              element.screenshot,
              'a11ytest/screenshots',
              { public_id: `${scanId}_element_${i}` }
            )
          );
        }
        
        // Wait for all uploads to complete
        const uploadResults = await Promise.all(uploadPromises);
        
        // Replace base64 data with Cloudinary URLs
        screenshots = {
          fullPage: uploadResults[0]?.secure_url || null,
          viewport: uploadResults[1]?.secure_url || null,
          elements: elementScreenshots.map((element, index) => ({
            ...element,
            screenshot: uploadResults[2 + index]?.secure_url || null,
            cloudinaryId: uploadResults[2 + index]?.public_id || null
          }))
        };

      } catch (screenshotError) {
        console.error('❌ Screenshot capture failed:', screenshotError);
        console.error('Screenshot error details:', {
          message: screenshotError.message,
          stack: screenshotError.stack
        });
        // Continue without screenshots
      }

      // Generate AI-enhanced suggestions for each issue with rate limiting

      // Process issues sequentially to avoid overwhelming the API
      for (let i = 0; i < issues.length; i++) {
        const issue = issues[i];
        try {

          const suggestions = await this.generateContextualSuggestions(issue);
          if (suggestions.length > 0) {
            // Add suggestions to the issue object
            (issue as any).suggestions = suggestions;

          }
          
          // Add delay between issues to prevent rate limiting (2 seconds)
          if (i < issues.length - 1) {

            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
        } catch (error) {
          console.error(`❌ Failed to generate AI suggestions for issue ${issue.id}:`, error);
          
          // Even on error, wait before continuing to prevent rate limiting
          if (i < issues.length - 1) {

            await new Promise(resolve => setTimeout(resolve, 2000));
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

      return finalResult;
    } catch (error) {
      console.error('Error scanning page for accessibility issues:', error);
      throw new Error(`Failed to scan ${currentUrl}: ${error.message}`);
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
      }
    };

    return ruleInfo[ruleId] || {
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

    // Try to get AI-powered suggestion first (most valuable)
    try {
      // Create a cache key based on issue type and HTML content
      const cacheKey = `${issue.id}-${html.substring(0, 200)}`;
      
      // Check if we already have a cached response for this issue
      if (this.aiResponseCache.has(cacheKey)) {

        const aiSuggestion = this.aiResponseCache.get(cacheKey)!;
        + '...');
        
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

      + '...');
      
      const aiSuggestion = await this.claudeAPI.generateAccessibilitySuggestion(
        html,
        issue.id,
        failureSummary,
        target
      );

      // Cache the response for future use
      this.aiResponseCache.set(cacheKey, aiSuggestion);

      + '...');

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
    const ruleBasedSuggestion = this.getBestRuleBasedSuggestion(issue.id, html, target, failureSummary);
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
  private getBestRuleBasedSuggestion(issueId: string, html: string, target: string, failureSummary: string): RemediationSuggestion | null {
    switch (issueId) {
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
          priority: this.getPriorityForImpact(issue.impact)
        };
    }
  }

  /**
   * Generate generic code example for other issues
   */
  private generateGenericCodeExample(html: string, issueId: string): string {
    // Provide a basic template based on the issue type
    switch (issueId) {
      case 'aria-allowed-attr':
        return `<!-- Remove invalid ARIA attributes -->
<div role="button" tabindex="0">Click me</div>`;
      case 'aria-required-attr':
        return `<!-- Add required ARIA attributes -->
<div role="combobox" aria-expanded="false" aria-haspopup="listbox">
  <input type="text" />
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