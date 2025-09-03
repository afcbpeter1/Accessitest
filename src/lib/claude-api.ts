

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

export class ClaudeAPI {
  private apiUrl: string;
  private apiKey: string;
  private requestQueue: Array<() => Promise<any>> = [];
  private isProcessingQueue = false;
  private lastRequestTime = 0;
  private minRequestInterval = 3000; // 3 seconds between requests (very conservative)
  private maxConcurrentRequests = 1; // Only one request at a time
  private activeRequests = 0;

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
      rateLimit: `${this.minRequestInterval}ms between requests`,
      maxConcurrent: this.maxConcurrentRequests
    });
  }

  /**
   * Rate-limited request method with strict controls
   */
  private async makeRateLimitedRequest<T>(requestFn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue.push(async () => {
        try {
          // Wait for any active requests to complete
          while (this.activeRequests >= this.maxConcurrentRequests) {
            console.log('⏳ Waiting for active request to complete...');
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Ensure minimum interval between requests
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;
            console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next request`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
          
          this.activeRequests++;
          this.lastRequestTime = Date.now();
          
          try {
            const result = await requestFn();
            resolve(result);
          } finally {
            this.activeRequests--;
          }
        } catch (error) {
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
        console.log(`⏳ Queue processing: waiting ${this.minRequestInterval}ms before next request`);
        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval));
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Generate AI-powered accessibility suggestions for an offending element
   */
  async generateAccessibilitySuggestion(
    html: string, 
    issueType: string, 
    failureSummary: string, 
    cssSelector: string
  ): Promise<string> {
    try {
      console.log('🚀 Claude API: Starting request for', issueType);
      console.log('📝 Claude API: HTML length:', html.length);
      console.log('🎯 Claude API: CSS Selector:', cssSelector);
      
      const systemPrompt = `You are an expert web accessibility consultant. Provide concise, actionable fixes for accessibility issues.

Guidelines:
- Keep responses under 200 words
- Provide ONE specific code example that fixes the exact issue
- Focus on the most practical solution
- Be direct and clear
- No lengthy explanations or multiple alternatives

Format your response as:
1. Brief issue explanation (1-2 sentences)
2. Specific code fix with exact HTML/CSS
3. Why this improves accessibility (1 sentence)`;

      const userPrompt = `Analyze this accessibility issue and provide a specific fix:

Issue Type: ${issueType}
HTML Element: ${html}
CSS Selector: ${cssSelector}
Problem: ${failureSummary}

Provide a specific, actionable fix for this exact element.`;

      console.log('📤 Claude API: Sending request...');
      const response = await this.makeRateLimitedRequest(() => 
        this.callClaudeAPI([
          { role: 'user', content: userPrompt }
        ], systemPrompt)
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
      
      const systemPrompt = `You are an expert document accessibility consultant specializing in Section 508 compliance. Provide detailed, actionable recommendations for fixing document accessibility issues.

Guidelines:
- Keep responses under 300 words
- Provide specific, step-by-step instructions
- Include relevant tools or software features when applicable
- Focus on practical, implementable solutions
- Consider the document type (PDF, Word, PowerPoint, etc.)
- Reference Section 508 standards when relevant
- Include specific Section 508 requirements (36 CFR § 1194.22)
- Provide actionable steps that can be implemented immediately

Format your response as:
1. Brief explanation of the issue and Section 508 requirement (2-3 sentences)
2. Step-by-step solution with specific instructions
3. Tools or software features to use (if applicable)
4. Why this fix improves accessibility and ensures Section 508 compliance (1-2 sentences)`;

      const userPrompt = `Analyze this document accessibility issue and provide a detailed fix:

Document: ${fileName}
File Type: ${fileType}
Issue: ${issueDescription}
Section: ${section}
${pageNumber ? `Page: ${pageNumber}` : ''}
${elementContent ? `Offending Element: ${elementContent}` : ''}

Provide a comprehensive, actionable solution for this document accessibility issue that ensures Section 508 compliance.`;

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
   * Call the Claude API using Anthropic's official endpoint with conservative retry logic
   */
  private async callClaudeAPI(messages: ClaudeMessage[], systemPrompt?: string): Promise<string> {
    const requestBody: ClaudeRequest = {
      model: 'claude-3-7-sonnet-20250219', // Use Claude 3.7 Sonnet (available in your account)
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
        const response = await fetch(this.apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(requestBody)
        });

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
}
