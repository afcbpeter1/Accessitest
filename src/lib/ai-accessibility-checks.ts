import { ClaudeAPI } from './claude-api';
import { AccessibilityIssue } from './accessibility-scanner';

interface PageData {
  html: string;
  url: string;
  landmarks: Array<{
    selector: string;
    html: string;
    tagName: string;
    role: string;
    ariaLabel: string;
    ariaLabelledBy: string;
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
  images: Array<{
    selector: string;
    html: string;
    alt: string;
    src: string;
    title: string;
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
   * Extract page data needed for the 4 focused AI checks
   */
  async extractPageData(page: any): Promise<PageData> {
    const url = await page.url();
    
    const pageData = await page.evaluate(() => {
      const html = document.documentElement.outerHTML;

      // Get landmarks
      const landmarks = Array.from(document.querySelectorAll('nav, main, aside, header, footer, [role="banner"], [role="navigation"], [role="main"], [role="complementary"], [role="contentinfo"], [role="search"], [role="form"]')).map((el: Element) => {
        const role = el.getAttribute('role') || el.tagName.toLowerCase();
        return {
          selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
          html: (el as HTMLElement).outerHTML.substring(0, 150),
          tagName: el.tagName.toLowerCase(),
          role: role,
          ariaLabel: el.getAttribute('aria-label') || '',
          ariaLabelledBy: el.getAttribute('aria-labelledby') || ''
        };
      });

      // Get forms and their fields
      const forms = Array.from(document.querySelectorAll('form')).map((form: HTMLFormElement) => {
        const fields = Array.from(form.querySelectorAll('input, select, textarea, button')).map((field: Element) => {
          const fieldEl = field as HTMLElement;
          const id = fieldEl.id;
          const ariaDescribedBy = fieldEl.getAttribute('aria-describedby')?.split(/\s+/) || [];
          const errorMessages: string[] = [];
          
          ariaDescribedBy.forEach(descId => {
            const descEl = document.getElementById(descId);
            if (descEl && (descEl.getAttribute('role') === 'alert' || descEl.className.toLowerCase().includes('error'))) {
              errorMessages.push(descEl.textContent?.trim() || '');
            }
          });

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
          html: form.outerHTML.substring(0, 300), // Reduced to 300 chars
          fields: fields.slice(0, 2) // Limit to 2 fields per form
        };
      });

      // Get headings
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6')).map((el: Element) => {
        const level = parseInt(el.tagName.charAt(1));
        return {
          selector: `${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''}`,
          html: (el as HTMLElement).outerHTML.substring(0, 150),
          level: level,
          text: (el as HTMLElement).textContent?.trim().substring(0, 100) || ''
        };
      });

      // Get links
      const links = Array.from(document.querySelectorAll('a[href]')).map((link: Element) => {
        const linkEl = link as HTMLAnchorElement;
        return {
          selector: `a${link.id ? `#${link.id}` : ''}`,
          html: linkEl.outerHTML.substring(0, 100),
          text: linkEl.textContent?.trim() || '',
          href: linkEl.getAttribute('href') || '',
          ariaLabel: linkEl.getAttribute('aria-label') || '',
          title: linkEl.getAttribute('title') || ''
        };
      });

      // Get images (for advertisement detection)
      const images = Array.from(document.querySelectorAll('img')).map((img: Element) => {
        const imgEl = img as HTMLImageElement;
        return {
          selector: `img${img.id ? `#${img.id}` : ''}`,
          html: imgEl.outerHTML.substring(0, 150),
          alt: imgEl.getAttribute('alt') || '',
          src: imgEl.getAttribute('src') || '',
          title: imgEl.getAttribute('title') || ''
        };
      });

      // Don't include full HTML - we'll only send structured data
      return {
        html: '', // Not needed - we send structured data only
        landmarks: landmarks.slice(0, 8), // Reduced to 8
        forms: forms.slice(0, 2), // Reduced to 2 forms max
        headings: headings.slice(0, 12), // Reduced to 12
        links: links.slice(0, 15), // Reduced to 15
        images: images.slice(0, 15) // Reduced to 15
      };
    });

    return {
      ...pageData,
      url
    };
  }

  /**
   * Run the 4 focused AI-powered accessibility checks
   */
  async runAIChecks(page: any): Promise<AccessibilityIssue[]> {
    try {
      console.log('🤖 Starting focused AI-powered accessibility checks...');
      
      // Extract page data
      const pageData = await this.extractPageData(page);
      console.log(`📊 Extracted page data: ${pageData.landmarks.length} landmarks, ${pageData.forms.length} forms, ${pageData.images.length} images`);

      // Run the 4 focused checks sequentially to better manage rate limits
      // This also allows us to skip checks if no relevant content exists
      const results: AccessibilityIssue[][] = [];
      
      // Check 1: Landmarks (always run if landmarks exist)
      if (pageData.landmarks.length > 0) {
        results.push(await this.checkLandmarkCorrectness(pageData));
      }
      
      // Check 2: Forms (only if forms exist)
      if (pageData.forms.length > 0) {
        results.push(await this.checkFormStructure(pageData));
      }
      
      // Check 3: Advertisements (always run - can identify from images/links)
      results.push(await this.checkAdvertisementAccessibility(pageData));
      
      // Check 4: Contextual validation (only if we have landmarks/headings/forms)
      if (pageData.landmarks.length > 0 || pageData.headings.length > 0 || pageData.forms.length > 0) {
        results.push(await this.checkContextualValidation(pageData));
      }
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
   * Check 1: Landmark correctness - verify landmarks are semantically appropriate and used correctly
   */
  private async checkLandmarkCorrectness(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Analyze landmarks (ARIA landmarks and semantic HTML) for semantic correctness and proper usage.

Return findings as a JSON array. Each finding should have:
- checkType: "landmark-correctness"
- description: Brief description of the issue
- severity: "critical" | "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector for the landmark
- html: The HTML of the landmark (truncated to 500 chars)
- explanation: Why the landmark usage is incorrect or semantically inappropriate (2-3 sentences)
- recommendation: How to fix it with specific code example (1-2 sentences)
- occurrences: Number of similar issues found

Look for:
1. Landmarks used incorrectly (e.g., role="main" on navigation, role="navigation" on main content)
2. Missing semantic landmarks where they should exist (e.g., no <nav> for navigation, no <main> for main content)
3. Landmarks without accessible names when they should have them (e.g., multiple navs without labels)
4. Landmarks nested incorrectly (e.g., main inside another main)
5. Using divs with roles instead of semantic HTML when semantic HTML would be better
6. Landmarks that don't match their content (e.g., complementary used for main content)
7. Missing landmarks for major page sections

Return ONLY valid JSON array, no markdown, no code blocks.`;

      const userPrompt = `Analyze these landmarks for semantic correctness and proper usage:

Landmarks:
${JSON.stringify(pageData.landmarks, null, 2)}

Find all instances where landmarks are not semantically appropriate or used incorrectly.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);
      const issues = this.parseAIResponse(response, 'landmark-correctness');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in landmark correctness check:', error);
      return [];
    }
  }

  /**
   * Check 2: Form structure - check that proper form elements are used, not divs styled as inputs
   */
  private async checkFormStructure(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      if (pageData.forms.length === 0) return [];

      const systemPrompt = `You are an expert accessibility auditor. Analyze forms to ensure proper semantic form elements are used, not divs styled as inputs.

Return findings as a JSON array. Each finding should have:
- checkType: "form-structure"
- description: Brief description of the issue
- severity: "critical" | "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector for the problematic element
- html: The HTML of the element (truncated to 500 chars)
- explanation: Why using divs instead of proper form elements is a problem (2-3 sentences)
- recommendation: How to fix it with specific code example showing proper form element (1-2 sentences)
- occurrences: Number of similar issues found

Look for:
1. Form fields created with <div> or <span> instead of <input>, <select>, <textarea>
2. Buttons created with <div> or <span> instead of <button> or <input type="button">
3. Form controls without proper form structure (not inside <form> element)
4. Custom form controls that don't properly implement ARIA form control patterns
5. Form fields that should use native HTML5 input types but use generic inputs
6. Missing form labels or improper label associations
7. Form structure that breaks keyboard navigation

Return ONLY valid JSON array, no markdown, no code blocks.`;

      const userPrompt = `Analyze these forms for proper form element usage:

Forms:
${JSON.stringify(pageData.forms, null, 2)}

Find all instances where divs or other non-semantic elements are used instead of proper form elements (input, select, textarea, button).`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);
      const issues = this.parseAIResponse(response, 'form-structure');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in form structure check:', error);
      return [];
    }
  }

  /**
   * Check 3: Advertisement identification - identify ads and ensure they have appropriate titles, alt text, and link text
   */
  private async checkAdvertisementAccessibility(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Identify advertisements on the page and check if they have appropriate accessibility attributes.

Return findings as a JSON array. Each finding should have:
- checkType: "advertisement-accessibility"
- description: Brief description of the issue (e.g., "Advertisement image missing alt text")
- severity: "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector for the advertisement element
- html: The HTML of the advertisement (truncated to 500 chars)
- explanation: Why the advertisement needs better accessibility attributes (2-3 sentences)
- recommendation: How to fix it with specific code example (1-2 sentences)
- occurrences: Number of similar issues found

Look for:
1. Advertisement images without alt text or with empty alt text
2. Advertisement links without descriptive link text (e.g., "click here", "ad", just URLs)
3. Advertisement images without title attributes when they should have them
4. Advertisement containers without proper ARIA labels
5. Advertisements that are not properly marked (should use role="complementary" or similar)
6. Advertisement links that don't indicate they're external/sponsored
7. Advertisements that break keyboard navigation

Identify advertisements by looking for:
- Common ad class names (ad, advertisement, sponsor, sponsored, etc.)
- Common ad container patterns
- Images/links in likely ad positions (sidebars, headers, between content)
- External links that appear to be advertisements

Return ONLY valid JSON array, no markdown, no code blocks.`;

      const userPrompt = `Identify advertisements on this page and check their accessibility. Look for common ad patterns (class names like "ad", "advertisement", "sponsor", sidebar/header positions, external links).

Images:
${JSON.stringify(pageData.images, null, 2)}

Links:
${JSON.stringify(pageData.links, null, 2)}

Find all advertisements and check if they have appropriate titles, alt text, and link text.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);
      const issues = this.parseAIResponse(response, 'advertisement-accessibility');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in advertisement accessibility check:', error);
      return [];
    }
  }

  /**
   * Check 4: Contextual validation - check that landmarks, headings, and forms make sense in context
   */
  private async checkContextualValidation(pageData: PageData): Promise<AccessibilityIssue[]> {
    try {
      const systemPrompt = `You are an expert accessibility auditor. Analyze the page structure to ensure landmarks, headings, and forms make semantic sense in context.

Return findings as a JSON array. Each finding should have:
- checkType: "contextual-validation"
- description: Brief description of the issue
- severity: "serious" | "moderate" | "minor"
- wcagLevel: "A" | "AA"
- selector: CSS selector for the problematic element
- html: The HTML of the element (truncated to 500 chars)
- explanation: Why the element doesn't make sense in context (2-3 sentences)
- recommendation: How to fix it to make it contextually appropriate (1-2 sentences)
- occurrences: Number of similar issues found

Look for:
1. Headings that don't match their content or context (e.g., h1 for a sidebar widget)
2. Landmarks that contain inappropriate content (e.g., main containing navigation)
3. Forms that are in wrong landmarks (e.g., search form not in search landmark)
4. Heading hierarchy that doesn't match content structure
5. Missing landmarks for major content sections
6. Landmarks that should be nested but aren't, or vice versa
7. Forms that should be in specific contexts but aren't properly placed
8. Content structure that doesn't follow logical semantic flow

Return ONLY valid JSON array, no markdown, no code blocks.`;

      const userPrompt = `Analyze this page structure for contextual validation:

Landmarks:
${JSON.stringify(pageData.landmarks, null, 2)}

Headings:
${JSON.stringify(pageData.headings, null, 2)}

Forms:
${JSON.stringify(pageData.forms, null, 2)}

Find all instances where landmarks, headings, or forms don't make semantic sense in their context.`;

      const response = await this.claudeAPI.analyzeAccessibilityCheck(userPrompt, systemPrompt);
      const issues = this.parseAIResponse(response, 'contextual-validation');
      return this.convertToAccessibilityIssues(issues, pageData.url);
    } catch (error) {
      console.error('Error in contextual validation check:', error);
      return [];
    }
  }

  /**
   * Parse AI response and extract issues.
   * Handles empty/truncated/invalid responses without throwing.
   */
  private parseAIResponse(response: string, checkType: string): AICheckResult[] {
    try {
      if (!response || typeof response !== 'string') return [];
      let jsonStr = response.trim();
      if (!jsonStr) return [];

      // Remove markdown code blocks if present
      jsonStr = jsonStr.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      // Extract JSON array only (avoids parsing truncated or non-JSON text)
      const jsonMatch = jsonStr.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      jsonStr = jsonMatch[0];
      const parsed = JSON.parse(jsonStr);

      if (!Array.isArray(parsed)) return [];

      // Ensure all issues have the checkType
      return parsed.map((issue: AICheckResult) => ({
        ...issue,
        checkType: issue.checkType || checkType
      }));
    } catch (error) {
      console.warn(`AI response parse failed for ${checkType} (returning no issues):`, error instanceof Error ? error.message : error);
      return [];
    }
  }

  /**
   * Convert AI check results to AccessibilityIssue format (same format as axe issues)
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
