import { decryptTokenFromStorage } from './jira-encryption-service'
import FormData from 'form-data'

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
    
    console.log(`🌐 Jira API Request: ${url}`)
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.authHeader,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    console.log(`📡 Jira API Response Status: ${response.status} ${response.statusText}`)

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

    const data = await response.json()
    
    // Log response for debugging project endpoint
    if (endpoint.includes('/project')) {
      const dataStr = JSON.stringify(data)
      console.log(`📦 Jira API Raw Response (first 2000 chars):`, dataStr.substring(0, 2000))
      if (Array.isArray(data)) {
        console.log(`📦 Response is array with ${data.length} items`)
        if (data.length > 0) {
          console.log(`📦 First item:`, JSON.stringify(data[0], null, 2))
        }
      } else if (data && typeof data === 'object') {
        console.log(`📦 Response is object with keys:`, Object.keys(data))
        if ('values' in data) {
          console.log(`📦 Found 'values' key with ${Array.isArray(data.values) ? data.values.length : 'non-array'} items`)
        }
      }
    }
    
    return data as T
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
   * Check if user has Browse Projects permission
   */
  async checkBrowseProjectsPermission(): Promise<{ hasPermission: boolean; error?: string }> {
    try {
      const permissions = await this.request<{
        permissions: Record<string, { havePermission: boolean }>
      }>('/mypermissions?permissions=BROWSE_PROJECTS')
      
      const hasPermission = permissions?.permissions?.BROWSE_PROJECTS?.havePermission ?? false
      return { hasPermission }
    } catch (error) {
      console.warn('⚠️ Could not check Browse Projects permission:', error)
      return { hasPermission: false, error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  /**
   * Get all projects the user can access
   * Jira API v3 /project endpoint returns all accessible projects in a single array
   * We handle pagination for instances with many projects
   */
  async getProjects(): Promise<JiraProject[]> {
    const allProjects: JiraProject[] = []
    let startAt = 0
    const maxResults = 50 // Fetch 50 at a time
    
    console.log(`🔍 Fetching Jira projects from: ${this.baseUrl}/rest/api/3/project`)
    
    while (true) {
      try {
        const endpoint = `/project?startAt=${startAt}&maxResults=${maxResults}`
        console.log(`🔍 Requesting: ${endpoint}`)
        
        // Jira API v3 /project endpoint returns an array directly
        const response = await this.request<JiraProject[]>(endpoint)
        
        console.log(`📥 Raw API response type:`, typeof response)
        console.log(`📥 Raw API response is array:`, Array.isArray(response))
        if (Array.isArray(response)) {
          console.log(`📥 Response length:`, response.length)
          if (response.length > 0) {
            console.log(`📥 First project sample:`, JSON.stringify(response[0], null, 2))
          }
        } else {
          console.log(`📥 Response structure:`, JSON.stringify(response, null, 2).substring(0, 500))
        }
        
        if (!Array.isArray(response)) {
          console.warn('⚠️ Unexpected Jira API response format:', typeof response, response)
          // Try to extract projects from response if it's an object
          if (response && typeof response === 'object') {
            const responseObj = response as any
            if (responseObj.values && Array.isArray(responseObj.values)) {
              console.log('📋 Found projects in response.values')
              const mappedProjects = responseObj.values.map((project: any) => ({
                id: project.id,
                key: project.key,
                name: project.name
              })).filter((p: any) => p.id && p.key && p.name)
              allProjects.push(...mappedProjects)
              break
            }
          }
          break
        }
        
        // Map projects to our format
        const mappedProjects = response.map(project => ({
          id: project.id,
          key: project.key,
          name: project.name
        })).filter(p => p.id && p.key && p.name) // Filter out invalid projects
        
        allProjects.push(...mappedProjects)
        
        console.log(`📋 Fetched ${mappedProjects.length} projects (total so far: ${allProjects.length})`)
        
        // If we got fewer than maxResults, we've fetched all projects
        if (response.length < maxResults) {
          break
        }
        
        // Continue to next page
        startAt += maxResults
      } catch (error) {
        console.error('❌ Error fetching Jira projects:', error)
        // If we have some projects, return them; otherwise throw
        if (allProjects.length > 0) {
          console.log(`⚠️ Returning ${allProjects.length} projects despite error`)
          break
        }
        throw error
      }
    }
    
    // Remove duplicates by key (just in case)
    const uniqueProjects = Array.from(
      new Map(allProjects.map(p => [p.key, p])).values()
    )
    
    console.log(`✅ Total unique projects fetched: ${uniqueProjects.length}`)
    if (uniqueProjects.length === 0) {
      console.warn('⚠️ WARNING: No projects found. Checking permissions...')
      const permissionCheck = await this.checkBrowseProjectsPermission()
      if (!permissionCheck.hasPermission) {
        console.error('❌ User does not have BROWSE_PROJECTS permission!')
        console.error('   This is required to list projects via the Jira API.')
        console.error('   Please ensure the API user has "Browse Projects" permission.')
        throw new Error('No projects found. The API user does not have "Browse Projects" permission. Please check your Jira user permissions or contact your Jira administrator.')
      } else {
        console.warn('⚠️ User has BROWSE_PROJECTS permission but no projects returned.')
        console.warn('   This could mean:')
        console.warn('   1. Jira instance has no projects')
        console.warn('   2. User has permission but no project access')
        console.warn('   3. API response format is different than expected')
      }
    }
    return uniqueProjects
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
    
    try {
      const result = await this.request<CreateIssueResponse>('/issue', {
        method: 'POST',
        body: JSON.stringify(issueData)
      })

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

  /**
   * Upload an attachment to a Jira issue
   * @param issueKey The Jira issue key (e.g., "PROJ-123")
   * @param fileBuffer The file buffer to upload
   * @param filename The filename for the attachment
   * @returns The attachment ID and metadata
   */
  async addAttachment(
    issueKey: string,
    fileBuffer: Buffer,
    filename: string
  ): Promise<{ id: string; filename: string; size: number; mimeType: string }> {
    const url = `${this.baseUrl}/rest/api/3/issue/${issueKey}/attachments`
    
    // Create form data using form-data package (Node.js compatible)
    const formData = new FormData()
    const contentType = filename.endsWith('.png') ? 'image/png' :
                       filename.endsWith('.jpg') || filename.endsWith('.jpeg') ? 'image/jpeg' :
                       filename.endsWith('.gif') ? 'image/gif' :
                       filename.endsWith('.webp') ? 'image/webp' :
                       'image/png'
    
    formData.append('file', fileBuffer, {
      filename: filename,
      contentType: contentType
    })

    // Get headers from form-data (includes Content-Type with boundary)
    const formHeaders = formData.getHeaders()

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'X-Atlassian-Token': 'nocheck', // Required for attachment uploads
        ...formHeaders, // This sets Content-Type with boundary
      },
      body: formData as any, // form-data package works with fetch in Node.js 18+
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Failed to upload attachment: ${response.status} ${response.statusText}`
      
      try {
        const errorJson = JSON.parse(errorText)
        if (errorJson.errorMessages && errorJson.errorMessages.length > 0) {
          errorMessage = errorJson.errorMessages.join(', ')
        } else if (errorJson.message) {
          errorMessage = errorJson.message
        }
      } catch {
        errorMessage = errorText || errorMessage
      }

      throw new Error(errorMessage)
    }

    const attachments = await response.json()
    if (attachments && attachments.length > 0) {
      const attachment = attachments[0]
      return {
        id: attachment.id,
        filename: attachment.filename,
        size: attachment.size,
        mimeType: attachment.mimeType
      }
    }

    throw new Error('No attachment returned from Jira')
  }
}

