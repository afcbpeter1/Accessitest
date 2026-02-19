import { ClaudeAPI } from './claude-api';
import { AccessibilityIssue } from './accessibility-scanner';

interface PageData {
  html: string;
  url: string;
  tabOrder: Array<{
    selector: string;
    html: string;
    position: { x: number; y: number; width: number; height: number };
    tagName: string;
    accessibleName: string;
  }>;
  semanticElements: Array<{
    selector: string;
    html: string;
    tagName: string;
    ariaAttributes: Record<string, string>;
    accessibleName: string;
    role: string | null;
  }>;
  forms: Array<{
    selector: string;
    html: string;
    fields: Array<{
      selector: string;
      label: string;
      errorMessages: string[];
      ariaDescribedBy: string[];
    }>;
  }>;
  modals: Array<{
    selector: string;
    html: string;
    focusableElements: string[];
  }>;
  skipLinks: Array<{
    selector: string;
    html: string;
    target: string;
  }>;
  landmarks: Array<{
    selector: string;
    html: string;
    tagName: string;
    role: string;
    ariaLabel: string;
    ariaLabelledBy: string;
  }>;
  headings: Array<{
    selector: string;
    html: string;
    level: number;
    text: string;
  }>;
  links: Array<{
    selector: string;
    html: string;
    text: string;
    href: string;
    ariaLabel: string;
    title: string;
  }>;
  liveRegions: Array<{
    selector: string;
    html: string;
    ariaLive: string;
    ariaAtomic: string;
    ariaRelevant: string;
  }>;
}

interface AICheckResult {
  checkType: string;
  description: string;
  severity: 'critical' | 'serious' | 'moderate' | 'minor';
  wcagLevel: string;
  selector: string;
  html: string;
  explanation: string;
  recommendation: string;
  occurrences: number;
}

export class AIAccessibilityChecks {
  private claudeAPI: ClaudeAPI;

  constructor() {
    this.claudeAPI = new ClaudeAPI();
  }

  /**
   * Extract comprehensive page data for AI analysis
   */
  async extractPageData(page: any): Promise<PageData> {
    const url = await page.url();
    
    const pageData = await page.evaluate(() => {
      // Get full HTML
      const html = document.documentElement.outerHTML;

      // Get tab order (all focusable elements in DOM order)
      const focusableSelectors = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
      ].join(', ');

      const focusableElements = Array.from(document.querySelectorAll(focusableSelectors));
      const tabOrder = focusableElements.map((el: Element, index: number) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        return {
          selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className ? `.${Array.from(el.classList).join('.')}` : ''}`,
          html: (el as HTMLElement).outerHTML.substring(0, 500),
          position: {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height
          },
          tagName: el.tagName.toLowerCase(),
          accessibleName: (el as HTMLElement).textContent?.trim().substring(0, 100) || ''
        };
      });

      // Get semantic elements (headings, paragraphs, lists)
      const semanticSelectors = 'h1, h2, h3, h4, h5, h6, p, ul, ol, li, article, section, nav, main, aside, header, footer';
      const semanticElements = Array.from(document.querySelectorAll(semanticSelectors));
      const semanticData = semanticElements.map((el: Element) => {
        const ariaAttrs: Record<string, string> = {};
        Array.from(el.attributes).forEach(attr => {
          if (attr.name.startsWith('aria-')) {
            ariaAttrs[attr.name] = attr.value;
          }
        });

        // Get computed accessible name and role
        let accessibleName = '';
        let role = el.getAttribute('role');
        
        try {
          // Try to get accessible name from various sources
          const label = el.getAttribute('aria-label') || 
                       el.getAttribute('aria-labelledby') ||
                       (el as HTMLElement).textContent?.trim().substring(0, 100) || '';
          accessibleName = label;
        } catch (e) {
          accessibleName = '';
        }

        return {
          selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className ? `.${Array.from(el.classList).join('.')}` : ''}`,
          html: (el as HTMLElement).outerHTML.substring(0, 500),
          tagName: el.tagName.toLowerCase(),
          ariaAttributes: ariaAttrs,
          accessibleName: accessibleName,
          role: role
        };
      });

      // Get forms and their error associations
      const forms = Array.from(document.querySelectorAll('form')).map((form: HTMLFormElement) => {
        const fields = Array.from(form.querySelectorAll('input, select, textarea')).map((field: Element) => {
          const fieldEl = field as HTMLElement;
          const id = fieldEl.id;
          const ariaDescribedBy = fieldEl.getAttribute('aria-describedby')?.split(/\s+/) || [];
          const errorMessages: string[] = [];
          
          // Find associated error messages
          ariaDescribedBy.forEach(descId => {
            const descEl = document.getElementById(descId);
            if (descEl && (descEl.getAttribute('role') === 'alert' || descEl.className.toLowerCase().includes('error'))) {
              errorMessages.push(descEl.textContent?.trim() || '');
            }
          });

          // Find label
          let label = '';
          if (id) {
            const labelEl = document.querySelector(`label[for="${id}"]`);
            label = labelEl?.textContent?.trim() || '';
          }
          const labelEl = fieldEl.closest('label');
          if (labelEl && !label) {
            label = labelEl.textContent?.trim() || '';
          }

          return {
            selector: `${field.tagName.toLowerCase()}${id ? `#${id}` : ''}`,
            label: label,
            errorMessages: errorMessages,
            ariaDescribedBy: ariaDescribedBy
          };
        });

        return {
          selector: `form${form.id ? `#${form.id}` : ''}`,
          html: form.outerHTML.substring(0, 1000),
          fields: fields
        };
      });

      // Get modals/dialogs
      const modals = Array.from(document.querySelectorAll('[role="dialog"], [role="alertdialog"], dialog')).map((modal: Element) => {
        const modalEl = modal as HTMLElement;
        const focusableSelectors = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
        const focusableElements = Array.from(modalEl.querySelectorAll(focusableSelectors));
        
        return {
          selector: `${modal.tagName.toLowerCase()}${modal.id ? `#${modal.id}` : ''}`,
          html: modalEl.outerHTML.substring(0, 1000),
          focusableElements: focusableElements.map((el: Element) => {
            return `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`;
          })
        };
      });

      // Get skip links
      const skipLinks = Array.from(document.querySelectorAll('a[href^="#"]')).filter((link: Element) => {
        const href = link.getAttribute('href');
        const text = link.textContent?.toLowerCase().trim() || '';
        return href && (text.includes('skip') || text.includes('jump') || link.className.toLowerCase().includes('skip'));
      }).map((link: Element) => {
        return {
          selector: `a${link.id ? `#${link.id}` : ''}`,
          html: (link as HTMLElement).outerHTML,
          target: link.getAttribute('href') || ''
        };
      });

      // Get landmarks
      const landmarks = Array.from(document.querySelectorAll('nav, main, aside, header, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="search"], [role="form"]')).map((el: Element) => {
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        return {
          selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}${el.className ? `.${Array.from(el.classList).join('.')}` : ''}`,
          html: (el as HTMLElement).outerHTML.substring(0, 500),
          tagName: el.tagName.toLowerCase(),
          role: role,
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaLabelledBy: el.getAttribute('aria-labelledby') || ''
        };
      });

      // Get headings for hierarchy check
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((el: Element) => {
        const level = parseInt(el.tagName.charAt(1));
        return {
          selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
          html: (el as HTMLElement).outerHTML.substring(0, 200),
          level: level,
          text: (el as HTMLElement).textContent?.trim().substring(0, 100) || ''
        };
      });

      // Get links for context check
      const links = Array.from(document.querySelectorAll('a[href]')).map((link: Element) => {
        const linkEl = link as HTMLAnchorElement;
        return {
          selector: `a${link.id ? `#${link.id}` : ''}`,
          html: linkEl.outerHTML.substring(0, 300),
          text: linkEl.textContent?.trim() || '',
          href: linkEl.getAttribute('href') || '',
          ariaLabel: linkEl.getAttribute('aria-label') || '',
          title: linkEl.getAttribute('title') || ''
        };
      });

      // Get ARIA live regions
      const liveRegions = Array.from(document.querySelectorAll('[aria-live], [aria-atomic], [aria-relevant]')).map((el: Element) => {
        return {
          selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
          html: (el as HTMLElement).outerHTML.substring(0, 500),
          ariaLive: el.getAttribute('aria-live') || '',
          ariaAtomic: el.getAttribute('aria-atomic') || '',
          ariaRelevant: el.getAttribute('aria-relevant') || ''
        };
      });

      return {
        html: html.substring(0, 500000), // Limit HTML size
        tabOrder,
        semanticElements: semanticData,
        forms,
        modals,
        skipLinks,
        landmarks,
        headings,
        links,
        liveRegions
      };
    });

    return {
      ...pageData,
      url
    };
  }

  /**
   * Run all AI-powered accessibility checks
   */
  async runAIChecks(page: any): Promise<AccessibilityIssue[]> {
    try {
      console.log('🤖 Starting AI-powered accessibility checks...');
      
      // Extract page data
      const pageData = await this.extractPageData(page);
      console.log(`📊 Extracted page data: ${pageData.tabOrder.length} focusable elements, ${pageData.semanticElements.length} semantic elements`);

      // Run checks in parallel where possible
      const checkPromises = [
        this.checkSemanticHTMLHidden(pageData),
        this.checkTabOrderVsVisual(pageData),
        this.checkFormErrorAssociations(pageData),
        this.checkModalFocusManagement(pageData),
        this.checkSkipLinkFunctionality(pageData),
        this.checkKeyboardTraps(pageData),
        this.checkColorOnlyInformation(pageData),
        this.checkLandmarkUsage(pageData),
        this.checkHeadingHierarchy(pageData),
        this.checkLinkContext(pageData),
        this.checkAriaLiveRegions(pageData),
        this.checkContentStructure(pageData)
      ];

      const results = await Promise.all(checkPromises);
      const allIssues = results.flat().filter(Boolean) as AccessibilityIssue[];

      console.log(`✅ AI checks complete: ${allIssues.length} issues found`);
      return allIssues;
    } catch (error) {
      console.error('❌ AI accessibility checks failed:', error);
      // Don't fail the entire scan if AI checks fail
      return [];
    }
  }

  /**
   * Check for semantic HTML being hidden by ARIA (Clare's issue)
   */
  private async checkSemanticHTMLHidden(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Analyze HTML and identify instances where semantic HTML elements (headings, paragraphs, lists) are being hidden from screen readers due to incorrect ARIA usage.

Return findings as a JSON array. Each finding should have:
- checkType: "semantic-html-hidden-by-aria"
- description: Brief description of the issue
- severity: "critical" | "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA" | "AAA"
- selector: CSS selector for the element
- html: The HTML of the offending element
- explanation: Why this is a problem (2-3 sentences)
- recommendation: How to fix it (1-2 sentences)
- occurrences: Number of similar issues found

Look for:
1. Semantic elements (h1-h6, p, ul, ol, li) with aria-hidden="true"
2. Semantic elements with role="presentation" or role="none"
3. Semantic elements with incorrect role attributes that override semantics
4. Elements that should be in accessibility tree but aren't

Return ONLY valid JSON array, no markdown, no code blocks.`;

      const userPrompt = `Analyze these semantic HTML elements for ARIA issues:

Semantic Elements:
${JSON.stringify(pageData.semanticElements.slice(0, 100), null, 2)}

Find all instances where semantic HTML is being hidden from screen readers.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);

      const issues = this.parseAIResponse(response, 'semantic-html-hidden-by-aria');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in semantic HTML check:', error);
      return [];
    }
  }

  /**
   * Check tab order vs visual/logical order
   */
  private async checkTabOrderVsVisual(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Compare tab order to visual layout order and identify issues.

Return findings as a JSON array. Each finding should have:
- checkType: "tab-order-vs-visual-order"
- description: Brief description
- severity: "critical" | "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector
- html: HTML of the element
- explanation: Why tab order doesn't match visual order
- recommendation: How to fix
- occurrences: Number

Look for:
1. Tab order that doesn't match top-to-bottom, left-to-right visual flow
2. Focus jumping around illogically
3. Important elements being skipped in tab order`;

      const userPrompt = `Compare tab order to visual positions:

Tab Order (sequence of focusable elements):
${JSON.stringify(pageData.tabOrder, null, 2)}

Identify where tab order doesn't match visual/logical order.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);

      const issues = this.parseAIResponse(response, 'tab-order-vs-visual-order');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in tab order check:', error);
      return [];
    }
  }

  /**
   * Check form error associations
   */
  private async checkFormErrorAssociations(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Analyze forms for proper error message associations.

Return findings as a JSON array. Each finding should have:
- checkType: "form-error-associations"
- description: Brief description
- severity: "critical" | "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector
- html: HTML of the form/field
- explanation: Why error association is missing/incorrect
- recommendation: How to fix
- occurrences: Number

Look for:
1. Form fields without associated error messages (aria-describedby, aria-errormessage)
2. Error messages not in aria-live regions
3. Errors not programmatically linked to fields`;

      const userPrompt = `Analyze these forms for error message associations:

Forms:
${JSON.stringify(pageData.forms, null, 2)}

Find all form fields that lack proper error message associations.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);

      const issues = this.parseAIResponse(response, 'form-error-associations');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in form error check:', error);
      return [];
    }
  }

  /**
   * Check modal focus management
   */
  private async checkModalFocusManagement(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      if (pageData.modals.length === 0) return [];

      const systemPrompt = `You are an expert accessibility auditor. Analyze modals for proper focus management.

Return findings as a JSON array. Each finding should have:
- checkType: "modal-focus-management"
- description: Brief description
- severity: "critical" | "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector
- html: HTML of the modal
- explanation: Why focus management is incorrect
- recommendation: How to fix
- occurrences: Number

Look for:
1. Modals without focusable elements (can't trap focus)
2. Modals that don't return focus on close
3. Modals without initial focus`;

      const userPrompt = `Analyze these modals for focus management:

Modals:
${JSON.stringify(pageData.modals, null, 2)}

Find all modals with focus management issues.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);

      const issues = this.parseAIResponse(response, 'modal-focus-management');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in modal focus check:', error);
      return [];
    }
  }

  /**
   * Check skip link functionality
   */
  private async checkSkipLinkFunctionality(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      if (pageData.skipLinks.length === 0) return [];

      const systemPrompt = `You are an expert accessibility auditor. Analyze skip links for proper functionality.

Return findings as a JSON array. Each finding should have:
- checkType: "skip-link-functionality"
- description: Brief description
- severity: "serious" | "moderate" | "minor"
- wcagLevel: "A"
- selector: CSS selector
- html: HTML of the skip link
- explanation: Why skip link doesn't work properly
- recommendation: How to fix
- occurrences: Number

Look for:
1. Skip links without valid targets
2. Skip links that aren't visible on focus
3. Skip links that don't move focus to target`;

      const userPrompt = `Analyze these skip links:

Skip Links:
${JSON.stringify(pageData.skipLinks, null, 2)}

Find all skip links with functionality issues.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);

      const issues = this.parseAIResponse(response, 'skip-link-functionality');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in skip link check:', error);
      return [];
    }
  }

  /**
   * Check for keyboard traps
   */
  private async checkKeyboardTraps(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Analyze page for potential keyboard traps.

Return findings as a JSON array. Each finding should have:
- checkType: "keyboard-traps"
- description: Brief description
- severity: "critical" | "serious" | "moderate" | "minor"
- wcagLevel: "A"
- selector: CSS selector
- html: HTML of the problematic area
- explanation: Why this might be a keyboard trap
- recommendation: How to fix
- occurrences: Number

Look for:
1. Areas where focus might get stuck
2. Infinite focus loops
3. Elements that can't be escaped with keyboard`;

      const userPrompt = `Analyze this page for potential keyboard traps:

Tab Order:
${JSON.stringify(pageData.tabOrder, null, 2)}

HTML Structure:
${pageData.html.substring(0, 10000)}

Find potential keyboard traps.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);

      const issues = this.parseAIResponse(response, 'keyboard-traps');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in keyboard trap check:', error);
      return [];
    }
  }

  /**
   * Check for color-only information
   */
  private async checkColorOnlyInformation(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Analyze page for information conveyed only by color.

Return findings as a JSON array. Each finding should have:
- checkType: "color-only-information"
- description: Brief description
- severity: "serious" | "moderate" | "minor"
- wcagLevel: "AA"
- selector: CSS selector
- html: HTML of the element
- explanation: Why color-only information is a problem
- recommendation: How to fix (add icons, text, patterns)
- occurrences: Number

Look for:
1. Error states indicated only by color
2. Required fields indicated only by color
3. Links distinguished only by color
4. Status indicators using only color`;

      const userPrompt = `Analyze this page for color-only information:

HTML:
${pageData.html.substring(0, 50000)}

Find all instances where information is conveyed only by color without additional indicators.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);

      const issues = this.parseAIResponse(response, 'color-only-information');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in color-only check:', error);
      return [];
    }
  }

  /**
   * Parse AI response and extract issues
   */
  private parseAIResponse(response: string, checkType: string): AICheckResult[] {
    try {
      // Try to extract JSON from response (might be wrapped in markdown)
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      
      // Try to find JSON array
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const issues = JSON.parse(jsonStr) as AICheckResult[];
      
      // Ensure all issues have the checkType
      return issues.map(issue => ({
        ...issue,
        checkType: issue.checkType || checkType
      }));
    } catch (error) {
      console.error(`Error parsing AI response for ${checkType}:`, error);
      console.error('Response:', response.substring(0, 500));
      return [];
    }
  }

  /**
   * Check landmark usage and correctness
   */
  private async checkLandmarkUsage(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Analyze landmarks (ARIA landmarks and semantic HTML) for proper usage and correctness.

Return findings as a JSON array. Each finding should have:
- checkType: "landmark-usage"
- description: Brief description of the issue
- severity: "critical" | "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector
- html: HTML of the landmark
- explanation: Why the landmark usage is incorrect (2-3 sentences)
- recommendation: How to fix it (1-2 sentences)
- occurrences: Number

Look for:
1. Missing main landmark
2. Multiple main landmarks (should only be one)
3. Landmarks without accessible names (when needed)
4. Incorrect landmark roles (e.g., using role="main" on nav)
5. Landmarks nested incorrectly
6. Missing navigation landmarks
7. Duplicate landmarks without distinguishing labels
8. Landmarks that should be top-level but aren't`;

      const userPrompt = `Analyze these landmarks for proper usage:

Landmarks:
${JSON.stringify(pageData.landmarks, null, 2)}

Find all landmark usage issues.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);
      const issues = this.parseAIResponse(response, 'landmark-usage');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in landmark usage check:', error);
      return [];
    }
  }

  /**
   * Check heading hierarchy
   */
  private async checkHeadingHierarchy(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      if (pageData.headings.length === 0) return [];

      const systemPrompt = `You are an expert accessibility auditor. Analyze heading hierarchy for proper structure.

Return findings as a JSON array. Each finding should have:
- checkType: "heading-hierarchy"
- description: Brief description
- severity: "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector
- html: HTML of the heading
- explanation: Why the hierarchy is incorrect
- recommendation: How to fix (correct heading level)
- occurrences: Number

Look for:
1. Missing h1 (should have exactly one)
2. Heading level gaps (e.g., h1 → h3, skipping h2)
3. Headings that skip levels going down
4. Headings that increase by more than one level
5. Multiple h1 elements (should typically be one)
6. Headings used for styling instead of structure`;

      const userPrompt = `Analyze this heading hierarchy:

Headings (in document order):
${JSON.stringify(pageData.headings, null, 2)}

Find all heading hierarchy issues. Check for gaps, skips, and structural problems.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);
      const issues = this.parseAIResponse(response, 'heading-hierarchy');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in heading hierarchy check:', error);
      return [];
    }
  }

  /**
   * Check link context (whether links make sense out of context)
   */
  private async checkLinkContext(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      if (pageData.links.length === 0) return [];

      const systemPrompt = `You are an expert accessibility auditor. Analyze links to ensure they make sense when read out of context.

Return findings as a JSON array. Each finding should have:
- checkType: "link-context"
- description: Brief description
- severity: "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector
- html: HTML of the link
- explanation: Why the link text lacks context
- recommendation: How to improve link text
- occurrences: Number

Look for:
1. Links with generic text like "click here", "read more", "link"
2. Links that only contain images without alt text
3. Links that rely on surrounding context to be understood
4. Multiple links with identical text pointing to different destinations
5. Links with only URLs as text
6. Links that don't describe their purpose`;

      const userPrompt = `Analyze these links for context issues:

Links:
${JSON.stringify(pageData.links.slice(0, 100), null, 2)}

Find all links that don't make sense out of context or have poor descriptive text.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);
      const issues = this.parseAIResponse(response, 'link-context');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in link context check:', error);
      return [];
    }
  }

  /**
   * Check ARIA live region usage
   */
  private async checkAriaLiveRegions(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      if (pageData.liveRegions.length === 0) return [];

      const systemPrompt = `You are an expert accessibility auditor. Analyze ARIA live regions for proper configuration and usage.

Return findings as a JSON array. Each finding should have:
- checkType: "aria-live-regions"
- description: Brief description
- severity: "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector
- html: HTML of the live region
- explanation: Why the live region is misconfigured
- recommendation: How to fix it
- occurrences: Number

Look for:
1. Live regions with incorrect aria-live values (should be "polite" or "assertive")
2. Live regions that should be used but aren't (for dynamic content)
3. Live regions with aria-atomic="true" when it should be "false"
4. Live regions that are too aggressive (assertive when polite would work)
5. Missing live regions for important dynamic updates
6. Live regions that aren't properly associated with dynamic content`;

      const userPrompt = `Analyze these ARIA live regions:

Live Regions:
${JSON.stringify(pageData.liveRegions, null, 2)}

Find all live region configuration issues.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);
      const issues = this.parseAIResponse(response, 'aria-live-regions');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in ARIA live region check:', error);
      return [];
    }
  }

  /**
   * Check overall content structure and semantics
   */
  private async checkContentStructure(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Analyze overall page structure and semantic HTML usage.

Return findings as a JSON array. Each finding should have:
- checkType: "content-structure"
- description: Brief description
- severity: "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector or "page-level"
- html: HTML of the element or "N/A"
- explanation: Why the structure is problematic
- recommendation: How to improve structure
- occurrences: Number

Look for:
1. Missing document language attribute
2. Poor semantic structure (div soup instead of semantic elements)
3. Lists not using proper list elements (ul/ol)
4. Tables without proper headers
5. Missing page title or poor title structure
6. Content that should be in landmarks but isn't
7. Incorrect use of semantic elements (e.g., using p for headings)
8. Missing skip links for main content
9. Poor content organization`;

      const userPrompt = `Analyze this page's overall structure:

Page HTML (first 20000 chars):
${pageData.html.substring(0, 20000)}

Semantic Elements:
${JSON.stringify(pageData.semanticElements.slice(0, 50), null, 2)}

Find structural and semantic HTML issues that could impact accessibility.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);
      const issues = this.parseAIResponse(response, 'content-structure');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in content structure check:', error);
      return [];
    }
  }

  /**
   * Convert AI check results to AccessibilityIssue format
   */
  private convertToAccessibilityIssues(issues: AICheckResult[], url: string): AccessibilityIssue[] {
    return issues.map(issue => {
      // Map severity to impact
      const impactMap: Record<string, 'minor' | 'moderate' | 'serious' | 'critical'> = {
        'minor': 'minor',
        'moderate': 'moderate',
        'serious': 'serious',
        'critical': 'critical'
      };

      const impact = impactMap[issue.severity] || 'moderate';

      // Create tags based on WCAG level
      const tags = [];
      if (issue.wcagLevel === 'A') tags.push('wcag2a');
      if (issue.wcagLevel === 'AA') tags.push('wcag2aa');
      if (issue.wcagLevel === 'AAA') tags.push('wcag2aaa');
      tags.push('best-practice');

      return {
        id: issue.checkType,
        impact: impact,
        tags: tags,
        description: issue.description,
        help: issue.explanation,
        helpUrl: `https://www.w3.org/WAI/WCAG21/Understanding/`,
        nodes: [{
          html: issue.html,
          target: [issue.selector],
          failureSummary: issue.explanation,
          impact: issue.severity,
          any: [],
          all: [],
          none: []
        }]
      };
    });
  }
}

