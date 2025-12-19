import { decryptTokenFromStorage } from './jira-encryption-service'

export interface JiraCredentials {
  jiraUrl: string
  email: string
  encryptedApiToken: string
}

export interface JiraProject {
  id: string
  key: string
  name: string
}

export interface JiraIssueType {
  id: string
  name: string
  description?: string
  iconUrl?: string
}

export interface JiraIssue {
  key: string
  id: string
  self: string
  fields: {
    summary: string
    description?: string
    status: {
      name: string
    }
    priority?: {
      name: string
    }
  }
}

export interface CreateIssueRequest {
  fields: {
    project: {
      key: string
    }
    summary: string
    description?: string | any // Can be plain string or ADF document
    issuetype: {
      name: string
    }
    priority?: {
      name: string
    }
    labels?: string[]
  }
}

export interface CreateIssueResponse {
  id: string
  key: string
  self: string
}

export class JiraClient {
  private baseUrl: string
  private email: string
  private apiToken: string
  private authHeader: string

  constructor(credentials: JiraCredentials) {
    this.baseUrl = credentials.jiraUrl.replace(/\/$/, '') // Remove trailing slash
    this.email = credentials.email
    this.apiToken = decryptTokenFromStorage(credentials.encryptedApiToken)
    
    // Create Basic Auth header
    const auth = Buffer.from(`${this.email}:${this.apiToken}`).toString('base64')
    this.authHeader = `Basic ${auth}`
  }

  /**
   * Make authenticated request to Jira API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}/rest/api/3${endpoint}`
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Jira API error: ${response.status} ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorText)
        // Log full error details for debugging
        console.error('❌ Jira API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorJson,
          url: url
        })
        
        // Extract detailed error messages
        if (errorJson.errorMessages && errorJson.errorMessages.length > 0) {
          errorMessage = errorJson.errorMessages.join(', ')
        } else if (errorJson.errors && Object.keys(errorJson.errors).length > 0) {
          // Jira often returns field-specific errors in the 'errors' object
          const fieldErrors = Object.entries(errorJson.errors)
            .map(([field, message]) => `${field}: ${message}`)
            .join(', ')
          errorMessage = `Validation errors: ${fieldErrors}`
        } else if (errorJson.message) {
          errorMessage = errorJson.message
        }
      } catch {
        errorMessage = errorText || errorMessage
        console.error('❌ Jira API Error (non-JSON):', errorText)
      }

      throw new Error(errorMessage)
    }

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T
    }

    return response.json()
  }

  /**
   * Test connection to Jira
   */
  async testConnection(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      const user = await this.request<any>('/myself')
      return { success: true, user }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  /**
   * Get all projects the user can access
   */
  async getProjects(): Promise<JiraProject[]> {
    const response = await this.request<JiraProject[]>('/project')
    return response.map(project => ({
      id: project.id,
      key: project.key,
      name: project.name
    }))
  }

  /**
   * Get issue types for a specific project
   */
  async getIssueTypes(projectKey: string): Promise<JiraIssueType[]> {
    try {
      // Get project details which includes issue types
      const project = await this.request<any>(`/project/${projectKey}`)
      
      if (!project.issueTypes || !Array.isArray(project.issueTypes)) {
        // Try alternative endpoint
        try {
          const createmeta = await this.request<any>(`/issue/createmeta?projectKeys=${projectKey}&expand=projects.issuetypes`)
          if (createmeta.projects && createmeta.projects.length > 0) {
            const projectMeta = createmeta.projects[0]
            if (projectMeta.issuetypes && Array.isArray(projectMeta.issuetypes)) {
              return projectMeta.issuetypes.map((type: any) => ({
                id: type.id,
                name: type.name,
                description: type.description,
                iconUrl: type.iconUrl
              }))
            }
          }
        } catch (metaError) {
          console.error('Error fetching issue types from createmeta:', metaError)
        }
        
        // Return common default issue types as fallback
        return [
          { id: '1', name: 'Bug' },
          { id: '2', name: 'Task' },
          { id: '3', name: 'Story' }
        ]
      }

      return project.issueTypes.map((type: any) => ({
        id: type.id,
        name: type.name,
        description: type.description,
        iconUrl: type.iconUrl
      }))
    } catch (error) {
      console.error(`Error fetching issue types for project ${projectKey}:`, error)
      // Return common default issue types if project fetch fails
      return [
        { id: '1', name: 'Bug' },
        { id: '2', name: 'Task' },
        { id: '3', name: 'Story' }
      ]
    }
  }

  /**
   * Create a new Jira issue
   */
  async createIssue(issueData: CreateIssueRequest): Promise<CreateIssueResponse> {
    // Log the request for debugging
    console.log('🔵 Creating Jira issue with data:', JSON.stringify(issueData, null, 2))
    
    try {
      const result = await this.request<CreateIssueResponse>('/issue', {
        method: 'POST',
        body: JSON.stringify(issueData)
      })
      console.log('✅ Jira issue created successfully:', result)
      return result
    } catch (error) {
      console.error('❌ Error creating Jira issue:', error)
      console.error('Request data was:', JSON.stringify(issueData, null, 2))
      throw error
    }
  }

  /**
   * Get issue details by key
   */
  async getIssue(ticketKey: string): Promise<JiraIssue> {
    return this.request<JiraIssue>(`/issue/${ticketKey}`)
  }

  /**
   * Update an existing issue
   */
  async updateIssue(ticketKey: string, updates: Partial<CreateIssueRequest['fields']>): Promise<void> {
    await this.request(`/issue/${ticketKey}`, {
      method: 'PUT',
      body: JSON.stringify({
        fields: updates
      })
    })
  }

  /**
   * Search issues using JQL
   */
  async searchIssues(jql: string, maxResults: number = 50): Promise<JiraIssue[]> {
    const response = await this.request<{
      issues: JiraIssue[]
    }>(`/search?jql=${encodeURIComponent(jql)}&maxResults=${maxResults}`)
    
    return response.issues || []
  }

  /**
   * Build full Jira URL for a ticket
   */
  getTicketUrl(ticketKey: string): string {
    return `${this.baseUrl}/browse/${ticketKey}`
  }
}

