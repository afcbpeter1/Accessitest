interface ClaudeMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
}

interface ClaudeResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export class ClaudeAPI {
  private apiUrl: string;
  private apiKey: string;
  private apiHost: string;

  constructor() {
    this.apiUrl = process.env.CLAUDE_API_URL || 'https://claude-3-7-sonnet.p.rapidapi.com/';
    this.apiKey = process.env.CLAUDE_API_KEY || '1cc1c331famsh565c420deb7c453p1b96d5jsnfdaa7a8c833d';
    this.apiHost = process.env.CLAUDE_API_HOST || 'claude-3-7-sonnet.p.rapidapi.com';
    
    console.log('🔧 Claude API Config:', {
      apiUrl: this.apiUrl,
      apiKey: this.apiKey ? '***' + this.apiKey.slice(-4) : 'MISSING',
      apiHost: this.apiHost
    });
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
      const response = await this.callClaudeAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ]);

      console.log('📥 Claude API: Received response, length:', response.length);
      return response;
    } catch (error) {
      console.error('❌ Claude API error:', error);
      return this.getFallbackSuggestion(issueType, html);
    }
  }

  /**
   * Call the Claude API
   */
  private async callClaudeAPI(messages: ClaudeMessage[]): Promise<string> {
    const requestBody: ClaudeRequest = {
      model: 'claude-3-7-sonnet',
      messages
    };

    console.log('🌐 Claude API: Making request to:', this.apiUrl);
    console.log('🔑 Claude API: Using host:', this.apiHost);
    console.log('📊 Claude API: Request body size:', JSON.stringify(requestBody).length);

    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-rapidapi-host': this.apiHost,
        'x-rapidapi-key': this.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    console.log('📡 Claude API: Response status:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Claude API: Error response:', errorText);
      throw new Error(`Claude API error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data: ClaudeResponse = await response.json();
    console.log('✅ Claude API: Success, choices:', data.choices?.length || 0);
    return data.choices[0]?.message?.content || 'No response from Claude API';
  }

  /**
   * Fallback suggestion when Claude API fails
   */
  private getFallbackSuggestion(issueType: string, html: string): string {
    return `Unable to get AI suggestion for ${issueType}. Please manually review the HTML element: ${html}`;
  }

  /**
   * Test the Claude API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.callClaudeAPI([
        { role: 'user', content: 'Hello, please respond with "API working" if you can see this message.' }
      ]);
      return response.includes('API working') || response.length > 0;
    } catch (error) {
      console.error('Claude API test failed:', error);
      return false;
    }
  }
}
