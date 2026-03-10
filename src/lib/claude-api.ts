

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  system?: string;
  max_tokens?: number;
  temperature?: number;
}

interface ClaudeResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

// Global rate limiting state (shared across all ClaudeAPI instances)
// This ensures all users share the same rate limit pool
const globalRateLimitState = {
  tokenUsageWindow: [] as Array<{ tokens: number; timestamp: number }>,
  lastRequestTime: 0,
  activeRequests: 0,
  requestQueue: [] as Array<() => Promise<any>>,
  isProcessingQueue: false,
  MAX_TOKENS_PER_MINUTE: 35000, // Use 35k to leave buffer (37k limit)
  TOKEN_WINDOW_MS: 60 * 1000, // 1 minute window
  MIN_REQUEST_INTERVAL: 5000, // 5 seconds between requests
  MAX_CONCURRENT_REQUESTS: 1 // Only one request at a time globally
};

export class ClaudeAPI {
  private apiUrl: string;
  private apiKey: string;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;

  constructor() {
    // Use Anthropic's official API instead of RapidAPI
    this.apiUrl = 'https://api.anthropic.com/v1/messages';
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';
    
    if (!this.apiKey) {
      console.warn('⚠️ ANTHROPIC_API_KEY not found in environment variables');
    }
    
    console.log('🔧 Claude API Config:', {
      apiUrl: this.apiUrl,
      apiKey: this.apiKey ? '***' + this.apiKey.slice(-4) : 'MISSING',
      provider: 'Anthropic Official API',
      rateLimit: `${globalRateLimitState.MIN_REQUEST_INTERVAL}ms between requests`,
      maxConcurrent: globalRateLimitState.MAX_CONCURRENT_REQUESTS
    });
  }

  /**
   * Estimate token count from text (rough approximation: ~4 chars per token)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Check if we can make a request without exceeding token limits (GLOBAL check)
   */
  private canMakeRequest(estimatedTokens: number): { canMake: boolean; waitTime: number } {
    const now = Date.now();
    
    // Clean up old entries outside the window (GLOBAL state)
    globalRateLimitState.tokenUsageWindow = globalRateLimitState.tokenUsageWindow.filter(
      entry => now - entry.timestamp < globalRateLimitState.TOKEN_WINDOW_MS
    );
    
    // Calculate current token usage in the window (GLOBAL across all users)
    const currentTokens = globalRateLimitState.tokenUsageWindow.reduce((sum, entry) => sum + entry.tokens, 0);
    
    // Check if adding this request would exceed the limit
    if (currentTokens + estimatedTokens > globalRateLimitState.MAX_TOKENS_PER_MINUTE) {
      // Calculate how long to wait until we can make the request
      if (globalRateLimitState.tokenUsageWindow.length > 0) {
        const oldestEntry = globalRateLimitState.tokenUsageWindow[0];
        const timeUntilOldestExpires = globalRateLimitState.TOKEN_WINDOW_MS - (now - oldestEntry.timestamp);
        return { canMake: false, waitTime: Math.max(timeUntilOldestExpires, 1000) };
      }
      return { canMake: false, waitTime: 60000 }; // Wait 1 minute if no history
    }
    
    return { canMake: true, waitTime: 0 };
  }

  /**
   * Record token usage for rate limiting (GLOBAL state)
   */
  private recordTokenUsage(tokens: number) {
    const now = Date.now();
    globalRateLimitState.tokenUsageWindow.push({ tokens, timestamp: now });
    
    // Clean up old entries
    globalRateLimitState.tokenUsageWindow = globalRateLimitState.tokenUsageWindow.filter(
      entry => now - entry.timestamp < globalRateLimitState.TOKEN_WINDOW_MS
    );
  }

  /**
   * Rate-limited request method with strict controls (time + token based)
   */
  private async makeRateLimitedRequest<T>(requestFn: () => Promise<T>, estimatedTokens?: number): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          // Wait for any active requests to complete (GLOBAL check)
          while (globalRateLimitState.activeRequests >= globalRateLimitState.MAX_CONCURRENT_REQUESTS) {
            console.log('⏳ Waiting for active request to complete (global queue)...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Check token-based rate limiting (GLOBAL across all users)
          if (estimatedTokens) {
            const tokenCheck = this.canMakeRequest(estimatedTokens);
            if (!tokenCheck.canMake) {
              console.log(`⏳ Global token rate limit: waiting ${Math.ceil(tokenCheck.waitTime / 1000)}s (${estimatedTokens} tokens would exceed ${globalRateLimitState.MAX_TOKENS_PER_MINUTE}/min limit shared across all users)`);
              await new Promise(resolve => setTimeout(resolve, tokenCheck.waitTime));
            }
          }
          
          // Ensure minimum interval between requests (GLOBAL)
          const now = Date.now();
          const timeSinceLastRequest = now - globalRateLimitState.lastRequestTime;
          if (timeSinceLastRequest < globalRateLimitState.MIN_REQUEST_INTERVAL) {
            const waitTime = globalRateLimitState.MIN_REQUEST_INTERVAL - timeSinceLastRequest;
            console.log(`⏳ Global rate limiting: waiting ${waitTime}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          globalRateLimitState.activeRequests++;
          globalRateLimitState.lastRequestTime = Date.now();
          
          try {
            const result = await requestFn();
            
            // Record token usage if we have an estimate (GLOBAL)
            if (estimatedTokens) {
              this.recordTokenUsage(estimatedTokens);
            }
            
            resolve(result);
          } finally {
            globalRateLimitState.activeRequests--;
          }
        } catch (error: any) {
          // If we hit a rate limit, wait longer before retrying
          if (error?.message?.includes('rate_limit') || error?.message?.includes('429')) {
            console.log('⏳ Rate limit hit, waiting 60s before retry...');
            await new Promise(resolve => setTimeout(resolve, 60000));
            // Record a large token usage to prevent immediate retry (GLOBAL)
            this.recordTokenUsage(globalRateLimitState.MAX_TOKENS_PER_MINUTE * 0.8);
          }
          globalRateLimitState.activeRequests--;
          reject(error);
        }
      });
      
      this.processQueue();
    });
  }

  /**
   * Process the request queue with strict rate limiting
   */
  private async processQueue() {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }
    
    this.isProcessingQueue = true;
    
    while (this.requestQueue.length > 0) {
      const request = this.requestQueue.shift();
      if (request) {
        try {
          await request();
        } catch (error) {
          console.error('❌ Request in queue failed:', error);
        }
      }
      
      // Always wait between requests to prevent any rate limiting
      if (this.requestQueue.length > 0) {
        console.log(`⏳ Queue processing: waiting ${globalRateLimitState.MIN_REQUEST_INTERVAL}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, globalRateLimitState.MIN_REQUEST_INTERVAL));
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Generate AI-powered accessibility suggestions for an offending element.
   * Works for both axe-core rule IDs and extended-check IDs (e.g. alt-text-quality, landmark-multiple-no-name).
   */
  async generateAccessibilitySuggestion(
    html: string,
    issueType: string,
    failureSummary: string,
    cssSelector: string,
    issueDescription?: string,
    help?: string
  ): Promise<string> {
    try {
      console.log('🚀 Claude API: Starting request for', issueType);
      console.log('📝 Claude API: HTML length:', html.length);
      console.log('🎯 Claude API: CSS Selector:', cssSelector);

      const systemPrompt = `You are an expert web accessibility consultant. Provide concise, actionable fixes for accessibility issues.

CRITICAL:
- You MUST include a concrete code fix. Wrap the fixed HTML or CSS in a markdown code block exactly like this:
  \`\`\`html
  <your fixed code here>
  \`\`\`
  Use \`\`\`css for CSS-only fixes.
- The code block must be the actual fix for the element provided, not a generic example.
- Keep total response under 200 words: brief explanation, then the code block, then one sentence on why it helps.`;

      const descPart = issueDescription ? `\nIssue (what was found): ${issueDescription}` : '';
      const helpPart = help ? `\nWCAG / fix guidance: ${help}` : '';
      const userPrompt = `Fix this accessibility issue.

Rule/check: ${issueType}
Element (current code): ${html}
Selector: ${cssSelector}
Problem with this element: ${failureSummary}${descPart}${helpPart}

Provide a brief explanation, then your fixed code in a \`\`\`html or \`\`\`css code block, then one sentence on why it improves accessibility.`;

      console.log('📤 Claude API: Sending request...');
      const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt);
      const response = await this.makeRateLimitedRequest(() => 
        this.callClaudeAPI([
          { role: 'user', content: userPrompt }
        ], systemPrompt),
        estimatedTokens
      );

      console.log('📥 Claude API: Received response, length:', response.length);
      return response;
    } catch (error) {
      console.error('❌ Claude API error:', error);
      return this.getFallbackSuggestion(issueType, html);
    }
  }

  /**
   * Generate AI-powered accessibility suggestions for document issues with Section 508 focus
   */
  async generateDocumentAccessibilitySuggestion(
    issueDescription: string,
    section: string,
    fileName: string,
    fileType: string,
    elementContent?: string,
    pageNumber?: number
  ): Promise<string> {
    try {
      console.log('🚀 Claude API: Starting document analysis for', fileName);
      console.log('📝 Claude API: Issue:', issueDescription);
      console.log('📄 Claude API: Section:', section);
      console.log('📍 Claude API: Page:', pageNumber);
      console.log('📄 Claude API: Element:', elementContent || 'Not provided');
      
      const systemPrompt = `You are an expert document accessibility consultant specializing in Section 508 compliance and WCAG 2.1 standards. Provide detailed, step-by-step remediation instructions for fixing document accessibility issues.

CRITICAL GUIDELINES:
- Provide DETAILED step-by-step instructions that can be followed immediately
- Include specific menu paths, button names, and tool locations
- Mention the exact document editing software (Adobe Acrobat, Microsoft Word, etc.)
- Break down complex fixes into numbered steps (Step 1, Step 2, etc.)
- Include keyboard shortcuts when applicable
- Provide specific values or settings when relevant
- Explain WHY each step is important for accessibility
- Reference the exact Section 508 requirement (e.g., 36 CFR § 1194.22(a))
- Consider the user may not be an accessibility expert

REQUIRED FORMAT:
1. ISSUE EXPLANATION (2-3 sentences)
   - What the issue is
   - Why it violates Section 508/WCAG
   - The specific requirement being violated

2. STEP-BY-STEP SOLUTION
   - Number each step clearly (Step 1:, Step 2:, etc.)
   - Include exact menu paths: "Go to File > Properties > Advanced"
   - Mention specific tools or panels to open
   - Provide exact values or settings to change
   - Include keyboard shortcuts in parentheses: (Ctrl+D)

3. VERIFICATION STEPS
   - How to verify the fix worked
   - What to check to ensure compliance

4. ADDITIONAL NOTES (if applicable)
   - Alternative methods if available
   - Best practices for preventing this issue
   - Related accessibility considerations

Keep total response between 200-400 words, prioritizing clarity and actionability.`;

      const userPrompt = `Analyze this document accessibility issue and provide detailed step-by-step remediation instructions:

DOCUMENT INFORMATION:
- File Name: ${fileName}
- File Type: ${fileType}
- Issue: ${issueDescription}
- Section: ${section}
${pageNumber ? `- Page Number: ${pageNumber}` : ''}
${elementContent ? `- Problematic Element: ${elementContent.substring(0, 200)}` : ''}

Please provide:
1. A clear explanation of why this violates Section 508/WCAG
2. Detailed step-by-step instructions specific to ${fileType} files
3. Exact menu paths, tool locations, and settings to change
4. How to verify the fix was successful

Focus on practical, actionable steps that someone can follow immediately in their document editor.`;

      console.log('📤 Claude API: Sending document analysis request...');
      const response = await this.makeRateLimitedRequest(() => 
        this.callClaudeAPI([
          { role: 'user', content: userPrompt }
        ], systemPrompt)
      );

      console.log('📥 Claude API: Received document analysis response, length:', response.length);
      return response;
    } catch (error) {
      console.error('❌ Claude API document analysis error:', error);
      return this.getDocumentFallbackSuggestion(issueDescription, fileType);
    }
  }

  /**
   * Generate AI-powered repair analysis - determines what can be auto-fixed
   */
  async generateRepairAnalysis(
    issue: any,
    fileName: string,
    fileType: string
  ): Promise<{
    canAutoFix: boolean
    whatWillBeFixed: string
    suggestion?: string
    confidence: 'high' | 'medium' | 'low'
  }> {
    try {
      const systemPrompt = `You are an expert document accessibility repair AI. Analyze each issue and determine:
1. Can this be automatically fixed? (yes/no)
2. What exactly will be fixed? (be specific)
3. Your confidence level (high/medium/low)

For automatic fixes, provide clear description of what will be changed.
For suggestions, provide what the user should do manually.

RESPONSE FORMAT (JSON):
{
  "canAutoFix": true/false,
  "whatWillBeFixed": "Specific description of what will be automatically fixed",
  "suggestion": "If canAutoFix is false, what user should do manually",
  "confidence": "high/medium/low"
}`;

      const userPrompt = `Analyze this accessibility issue and determine if it can be automatically fixed:

Issue: ${issue.description}
Category: ${issue.category}
Location: ${issue.elementLocation || `Page ${issue.pageNumber || 'Unknown'}`}
Context: ${issue.context || 'No additional context'}
File Type: ${fileType}
File Name: ${fileName}

Can this be automatically fixed? What will be changed?`;

      const response = await this.makeRateLimitedRequest(() =>
        this.callClaudeAPI([
          { role: 'user', content: userPrompt }
        ], systemPrompt)
      );

      // Try to parse JSON response
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return {
            canAutoFix: parsed.canAutoFix || false,
            whatWillBeFixed: parsed.whatWillBeFixed || response,
            suggestion: parsed.suggestion,
            confidence: parsed.confidence || 'medium'
          };
        }
      } catch (parseError) {
        // If JSON parse fails, extract from text
      }

      // Fallback: extract from text response
      const canAutoFix = response.toLowerCase().includes('yes') || 
                        response.toLowerCase().includes('can be automatically fixed') ||
                        response.toLowerCase().includes('automatic fix')
      
      return {
        canAutoFix,
        whatWillBeFixed: response.substring(0, 200),
        confidence: canAutoFix ? 'high' : 'medium'
      };
    } catch (error) {
      console.error('❌ AI repair analysis error:', error);
      // Default fallback
      const simpleFixes = ['alt text', 'title', 'language', 'heading'];
      const issueLower = issue.description.toLowerCase();
      const canAutoFix = simpleFixes.some(fix => issueLower.includes(fix));
      
      return {
        canAutoFix,
        whatWillBeFixed: canAutoFix ? `Will automatically fix: ${issue.description}` : issue.remediation || 'Manual fix required',
        confidence: canAutoFix ? 'high' : 'low'
      };
    }
  }

  /**
   * Call the Claude API using Anthropic's official endpoint with conservative retry logic
   */
  private async callClaudeAPI(messages: ClaudeMessage[], systemPrompt?: string): Promise<string> {
    const requestBody: ClaudeRequest = {
      model: 'claude-sonnet-4-20250514', // Use Claude Sonnet 4.6 (upgraded from deprecated 3.7)
      messages,
      max_tokens: 1000, // Limit response length to control costs
      temperature: 0.3 // Lower temperature for more consistent, focused responses
    };

    // Add system prompt if provided
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    console.log('🌐 Claude API: Making request to:', this.apiUrl);
    console.log('🔑 Claude API: Using key:', this.apiKey ? '***' + this.apiKey.slice(-4) : 'MISSING');
    console.log('📊 Claude API: Request body size:', JSON.stringify(requestBody).length);

    const maxRetries = 2; // Reduced retries to be more conservative
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📡 Claude API: Making request (attempt ${attempt}/${maxRetries})...`)
        
        // Create a timeout promise (60 seconds)
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Request timeout after 60 seconds')), 60000)
        })
        
        // Create the fetch request
        const fetchPromise = fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(requestBody)
        })
        
        // Race between fetch and timeout
        const response = await Promise.race([fetchPromise, timeoutPromise])

        console.log('📡 Claude API: Response status:', response.status, response.statusText);

        if (response.status === 529) {
          // Overloaded error - wait much longer and retry
          const waitTime = Math.pow(2, attempt) * 5000; // 10s, 20s backoff
          console.log(`⚠️ Claude API overloaded (529), waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          lastError = new Error(`Claude API overloaded (attempt ${attempt}/${maxRetries})`);
          continue;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ Claude API: Error response:', errorText);
          throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data: ClaudeResponse = await response.json();
        console.log('✅ Claude API: Success, response data:', JSON.stringify(data, null, 2));
        console.log('📝 Claude API: Content blocks found:', data.content?.length || 0);
        
        // Extract text content from the response
        const textContent = data.content
          ?.filter(block => block.type === 'text')
          ?.map(block => block.text)
          ?.join('') || 'No response from Claude API';
        
        console.log('📄 Claude API: Extracted text length:', textContent.length);
        return textContent;
        
      } catch (error) {
        console.error(`❌ Claude API: Request failed (attempt ${attempt}/${maxRetries}):`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 3000; // 6s, 12s backoff
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }
    }

    // All retries failed
    console.error('❌ Claude API: All retries failed');
    throw lastError || new Error('Claude API request failed after all retries');
  }

  /**
   * Fallback suggestion when Claude API fails
   */
  private getFallbackSuggestion(issueType: string, html: string): string {
    return `Unable to get AI suggestion for ${issueType}. Please manually review the HTML element: ${html}`;
  }

  /**
   * Fallback suggestion for document issues when Claude API fails
   */
  private getDocumentFallbackSuggestion(issueDescription: string, fileType: string): string {
    return `Unable to get AI suggestion for this document issue. Please manually review: ${issueDescription} in your ${fileType} document. Consider consulting Section 508 guidelines for proper remediation.`;
  }

  /**
   * Test the Claude API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.makeRateLimitedRequest(() => 
        this.callClaudeAPI([
          { role: 'user', content: 'Hello, please respond with "API working" if you can see this message.' }
        ])
      );
      return response.includes('API working') || response.length > 0;
    } catch (error) {
      console.error('Claude API test failed:', error);
      return false;
    }
  }

  /**
   * Identify headings in document text using AI
   */
  async identifyHeadings(documentText: string): Promise<{ headings: Array<{ text: string; level: number; page?: number }> }> {
    try {
      const prompt = `Analyze the following document text and identify what should be headings. Return a JSON object with an array of headings, each with:
- "text": the heading text
- "level": heading level (1-6, where 1 is main title, 2 is major section, etc.)
- "page": page number if available (default to 1)

Document text:
${documentText.substring(0, 4000)}

Return ONLY valid JSON in this format:
{
  "headings": [
    {"text": "Main Title", "level": 1, "page": 1},
    {"text": "Section Name", "level": 2, "page": 1}
  ]
}`;

      const response = await this.makeRateLimitedRequest(() => 
        this.callClaudeAPI([{ role: 'user', content: prompt }])
      );

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }

      return { headings: [] };
    } catch (error) {
      console.error('Error identifying headings:', error);
      return { headings: [] };
    }
  }

  /**
   * Identify language of text content using AI
   */
  async identifyLanguage(text: string): Promise<{ language: string; confidence?: string }> {
    try {
      const prompt = `Identify the language of the following text and return ONLY a JSON object with the ISO 639-1 language code (e.g., "en", "fr", "es", "de"):

Text: "${text.substring(0, 500)}"

Return ONLY valid JSON:
{"language": "fr", "confidence": "high"}`;

      const response = await this.makeRateLimitedRequest(() => 
        this.callClaudeAPI([{ role: 'user', content: prompt }])
      );

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed;
      }

      return { language: 'en', confidence: 'low' };
    } catch (error) {
      console.error('Error identifying language:', error);
      return { language: 'en', confidence: 'low' };
    }
  }

  /**
   * Analyze reading order of document content using AI
   */
  async analyzeReadingOrder(content: string): Promise<{ orderedLines: string[] }> {
    try {
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      const prompt = `Analyze the following document content and return the lines in the correct logical reading order (top-to-bottom, left-to-right). Return ONLY a JSON object with an array of ordered lines:

Content:
${content.substring(0, 4000)}

Return ONLY valid JSON:
{"orderedLines": ["First line", "Second line", "Third line"]}`;

      const response = await this.makeRateLimitedRequest(() => 
        this.callClaudeAPI([{ role: 'user', content: prompt }])
      );

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed.orderedLines && Array.isArray(parsed.orderedLines)) {
          return parsed;
        }
      }

      // Fallback: return original order
      return { orderedLines: lines };
    } catch (error) {
      console.error('Error analyzing reading order:', error);
      // Fallback: return original order
      const lines = content.split('\n').filter(line => line.trim().length > 0);
      return { orderedLines: lines };
    }
  }

  /**
   * Generate text response from a prompt (simple text generation)
   */
  async generateText(prompt: string): Promise<string> {
    try {
      const response = await this.makeRateLimitedRequest(() =>
        this.callClaudeAPI([{ role: 'user', content: prompt }])
      );
      return response;
    } catch (error) {
      console.error('Error generating text:', error);
      return '';
    }
  }

  /**
   * Generate text response with vision (image analysis)
   */
  async generateTextWithVision(
    prompt: string,
    imageBase64: string,
    mediaType: string
  ): Promise<string> {
    try {
      // Anthropic API format for vision: content array with text and image
      const response = await this.makeRateLimitedRequest(async () => {
        const requestBody: any = {
          model: 'claude-sonnet-4-20250514', // Claude Sonnet 4.6 - verify exact model ID in Anthropic docs
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: imageBase64
                }
              }
            ]
          }],
          max_tokens: 1000,
          temperature: 0.3
        };

        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Claude API error: ${response.status} ${errorText}`);
        }

        const data: ClaudeResponse = await response.json();
        return data.content[0]?.text || '';
      });

      return response;
    } catch (error) {
      console.error('Error generating text with vision:', error);
      return '';
    }
  }

  /**
   * Public method for AI-powered accessibility checks
   * Allows external services to call Claude with custom prompts
   */
  async analyzeAccessibilityCheck(userPrompt: string, systemPrompt: string): Promise<string> {
    try {
      const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt);
      const response = await this.makeRateLimitedRequest(() =>
        this.callClaudeAPI([{ role: 'user', content: userPrompt }], systemPrompt),
        estimatedTokens
      );
      return response;
    } catch (error) {
      console.error('Error in accessibility check analysis:', error);
      throw error;
    }
  }

  /**
   * Operational/background only: generate improved suggestion text for a pipeline rule.
   * Used by the suggestion-learning job only. No user context; not counted against any
   * per-user suggestion allowance. Billed to your Anthropic account as a flat operational cost.
   */
  async generateImprovedSuggestionForRule(
    ruleId: string,
    currentDescription: string,
    currentCodeExample?: string | null
  ): Promise<{ description: string; codeExample: string | null }> {
    const systemPrompt = `You are an expert web accessibility consultant. You must output a suggestion for ONE accessibility rule only. Do not include suggestions or code examples for any other rule. Output: (1) a brief description (1-3 sentences) for this rule only, then (2) exactly one markdown code block (\`\`\`html or \`\`\`css) that shows ONLY a good, correct code example—something developers should follow. Do not include bad examples, "before", "avoid", or "incorrect" code. Only show correct, accessible code. Operational use only.`;
    const current = currentDescription
      ? `Current suggestion: ${currentDescription}${currentCodeExample ? `\nCurrent code:\n${currentCodeExample}` : ''}`
      : 'No existing suggestion.'
    const userPrompt = `Accessibility rule ID: "${ruleId}". ${current}\n\nPropose a clearer, more actionable suggestion for this rule ONLY. Reply with (1) a short description for "${ruleId}" only, then (2) exactly one \`\`\`html or \`\`\`css code block containing ONLY a good, correct example—no bad/avoid/before examples. Do not add examples for any other rule—only for "${ruleId}".`;
    try {
      const estimatedTokens = this.estimateTokens(systemPrompt + userPrompt);
      const response = await this.makeRateLimitedRequest(
        () => this.callClaudeAPI([{ role: 'user', content: userPrompt }], systemPrompt),
        estimatedTokens
      );
      const codeBlockMatch = response.match(/```(?:html|css|js|javascript)?\s*\n([\s\S]*?)```/);
      let description = response.replace(/```[\s\S]*?```/g, '').trim();
      description = description.replace(/^#+\s*/gm, '').trim();
      // Keep only the first paragraph so we don't store multi-rule blobs
      const firstParagraph = description.split(/\n\s*\n/)[0]?.trim() || description;
      description = firstParagraph.slice(0, 600);
      const codeExample = codeBlockMatch ? codeBlockMatch[1].trim().slice(0, 2000) : null;
      return { description: description || response.slice(0, 500), codeExample };
    } catch (error) {
      console.error('generateImprovedSuggestionForRule error:', error);
      return { description: currentDescription || `Fix the ${ruleId} issue.`, codeExample: currentCodeExample ?? null };
    }
  }
}
