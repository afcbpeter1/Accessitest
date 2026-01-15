

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | Array<{
    type: 'text' | 'image';
    text?: string;
    source?: {
      type: 'base64';
      media_type: string;
      data: string;
    };
  }>;
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
      console.warn('ANTHROPIC_API_KEY not found in environment variables');
    }
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

            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Ensure minimum interval between requests
          const now = Date.now();
          const timeSinceLastRequest = now - this.lastRequestTime;
          if (timeSinceLastRequest < this.minRequestInterval) {
            const waitTime = this.minRequestInterval - timeSinceLastRequest;

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

        await new Promise(resolve => setTimeout(resolve, this.minRequestInterval));
      }
    }
    
    this.isProcessingQueue = false;
  }

  /**
   * Generate simple text using Claude API
   */
  async generateText(prompt: string, systemPrompt?: string): Promise<string> {
    try {
      // Use the same API call method as other functions for consistency
      return await this.makeRateLimitedRequest(() =>
        this.callClaudeAPI(
          [{ role: 'user', content: prompt }],
          systemPrompt || 'You are a helpful assistant.'
        )
      )
    } catch (error) {
      console.error('❌ Claude API generateText error:', error)
      throw error
    }
  }

  /**
   * Generate text with vision (image analysis) using Claude API
   */
  async generateTextWithVision(
    prompt: string,
    imageBase64: string,
    mediaType: string = 'image/png',
    systemPrompt?: string
  ): Promise<string> {
    try {
      const messageContent: Array<{
        type: 'text' | 'image';
        text?: string;
        source?: {
          type: 'base64';
          media_type: string;
          data: string;
        };
      }> = [
        {
          type: 'text',
          text: prompt
        },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: mediaType,
            data: imageBase64
          }
        }
      ]

      return await this.makeRateLimitedRequest(() =>
        this.callClaudeAPI(
          [{ role: 'user', content: messageContent }],
          systemPrompt || 'You are a helpful assistant that analyzes images and generates descriptive text.'
        )
      )
    } catch (error) {
      console.error('❌ Claude API generateTextWithVision error:', error)
      throw error
    }
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

      const response = await this.makeRateLimitedRequest(() => 
        this.callClaudeAPI([
          { role: 'user', content: userPrompt }
        ], systemPrompt)
      );

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
    elementLocation?: string,
    pageNumber?: number,
    elementContent?: string,
    elementId?: string,
    elementType?: string,
    documentType?: string // 'PDF document' or 'Word document'
  ): Promise<string> {
    try {





      const isWordDoc = documentType?.toLowerCase().includes('word') || fileType?.toLowerCase().includes('word') || fileName?.toLowerCase().endsWith('.docx') || fileName?.toLowerCase().endsWith('.doc')
      const docType = isWordDoc ? 'Word document' : 'PDF document'
      const toolName = isWordDoc ? 'Microsoft Word' : 'Adobe Acrobat Pro'
      
      const systemPrompt = `You are an expert ${docType} accessibility consultant. Provide precise, actionable instructions for fixing ${docType} accessibility issues.

CRITICAL RULES:
1. The user has ALREADY scanned this ${docType} - NEVER tell them to run the accessibility checker
2. You MUST provide helpful instructions even if location is "Unknown" - use the issue description and rule name
3. The issue description and rule name contain ALL the information needed to provide useful instructions
4. "Unknown location" just means you need to search for ALL instances of this issue type - that's still actionable!
5. IMPORTANT: This is a ${docType} - provide instructions specific to ${toolName}, NOT the other document type

INFORMATION PROVIDED:
- Document Type: ${docType}
- Tool to Use: ${toolName}
${pageNumber ? `- Page: ${pageNumber}` : '- Page: Not specified (search entire document)'}
${elementLocation ? `- Location: ${elementLocation}` : '- Location: Not specified (check all pages)'}
${elementId ? `- Element ID: ${elementId}` : '- Element ID: Not provided'}
${elementType ? `- Element Type: ${elementType}` : '- Element Type: Not provided'}
${elementContent ? `- Element Content: ${elementContent.substring(0, 200)}` : '- Element Content: Not provided'}
- Issue Description: ${issueDescription}
- Rule Name: ${section}

YOUR RESPONSE MUST:
1. NEVER say "I don't have enough information" - you ALWAYS have enough (the description and rule name)
2. Use the rule name (e.g., "Figures alternate text" = images need alt text, "Summary" = tables need summaries)
3. If location is "Unknown", provide instructions to find and fix ALL instances of this issue type
4. Give step-by-step instructions that are specific to THIS issue type (not generic)
5. ${isWordDoc ? 'Use correct Word terminology: "Right-click image > Format Picture > Alt Text", "Review > Check Accessibility", etc.' : 'Use correct Acrobat panel names: "Tags panel", "Reading Order tool"'}
6. NEVER mention running the accessibility checker - we've already done that
7. NEVER mention PDF tools if this is a Word document, and NEVER mention Word tools if this is a PDF

FORMAT:
1. Element Location: State what you know (e.g., "All figures/images in the document" or "All tables" if location unknown, or specific page if known)
2. Issue Explanation: Brief explanation of THIS specific issue based on the rule name and description
3. Step-by-Step Fix: Clear instructions to find and fix THIS specific issue type using ${toolName} (if location unknown, tell them how to find all instances)
4. Verification: How to verify the fix worked

EXAMPLE FOR ${docType.toUpperCase()}: If rule is "Figures alternate text" and location is "Unknown", say:
"Element Location: All figures/images throughout the document that are missing alternate text"
Then provide instructions specific to ${toolName}: ${isWordDoc ? '1) Right-click each image, 2) Select "Format Picture", 3) Go to "Alt Text" tab, 4) Enter descriptive alt text' : '1) Open Tags panel, 2) Find all Figure tags, 3) Add alt text to each one'}

Keep instructions clear, practical, and specific. Work with the information provided - it's always enough!`;

      const userPrompt = `Fix this ${docType} accessibility issue. We've already scanned and identified the problem:

File: ${fileName}
Document Type: ${docType}
Tool to Use: ${toolName}
Rule: ${section}
Issue Description: ${issueDescription}
${pageNumber ? `Page: ${pageNumber}` : 'Page: Not specified - check entire document'}
${elementLocation && elementLocation !== 'Unknown location' ? `Location: ${elementLocation}` : 'Location: Not specified - find all instances in document'}
${elementId ? `Element ID: ${elementId}` : ''}
${elementType ? `Element Type: ${elementType}` : ''}
${elementContent ? `Content: ${elementContent.substring(0, 200)}` : ''}

Provide step-by-step instructions to fix THIS specific issue using ${toolName}. Use the rule name and description to understand what needs fixing:
- If the rule is "Figures alternate text" or "Figures require alternate text", provide instructions to add alt text to images in ${toolName}
- If the rule is "Summary" or "Tables must have a summary", provide instructions to add summaries to tables in ${toolName}
- If the rule mentions "Title", provide instructions to set document title in ${toolName}
- If the rule mentions "Language", provide instructions to set document language in ${toolName}
- If location is "Unknown" or "Not specified", provide instructions to find and fix ALL instances of this issue type in the document

IMPORTANT: Provide instructions specific to ${toolName} for ${docType}s. Do NOT mention tools for the other document type.
Do NOT say you need more information - use what's provided. Do NOT tell them to run the accessibility checker - we've already done that.`;

      const response = await this.makeRateLimitedRequest(() => 
        this.callClaudeAPI([
          { role: 'user', content: userPrompt }
        ], systemPrompt)
      );

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
      model: 'claude-3-7-sonnet-20250219', // Use Claude 3.7 Sonnet (available in your account)
      messages,
      max_tokens: 1000, // Limit response length to control costs
      temperature: 0.3 // Lower temperature for more consistent, focused responses
    };

    // Add system prompt if provided
    if (systemPrompt) {
      requestBody.system = systemPrompt;
    }

    const maxRetries = 2; // Reduced retries to be more conservative
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
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

        if (response.status === 529) {
          // Overloaded error - wait much longer and retry
          const waitTime = Math.pow(2, attempt) * 5000; // 10s, 20s backoff
          console.log(`Claude API overloaded, waiting ${waitTime}ms before retry ${attempt}/${maxRetries}`);
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

        // Extract text content from the response
        const textContent = data.content
          ?.filter(block => block.type === 'text')
          ?.map(block => block.text)
          ?.join('') || 'No response from Claude API';

        return textContent;
        
      } catch (error) {
        console.error(`❌ Claude API: Request failed (attempt ${attempt}/${maxRetries}):`, error);
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt < maxRetries) {
          const waitTime = Math.pow(2, attempt) * 3000; // 6s, 12s backoff

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
}
