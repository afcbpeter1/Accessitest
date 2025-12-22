import { decryptTokenFromStorage } from './jira-encryption-service'

export interface AzureDevOpsCredentials {
  organization: string
  encryptedPat: string
}

export interface AzureDevOpsProject {
  id: string
  name: string
  description?: string
  url?: string
}

export interface AzureDevOpsWorkItemType {
  name: string
  referenceName: string
  description?: string
}

export interface AzureDevOpsWorkItem {
  id: number
  rev: number
  fields: {
    'System.Title': string
    'System.Description'?: string
    'System.State'?: string
    'System.WorkItemType'?: string
    'System.AssignedTo'?: any
    'System.CreatedDate'?: string
    'System.ChangedDate'?: string
    'System.Tags'?: string
  }
  url: string
  _links?: any
}

export interface CreateWorkItemRequest {
  op: string
  path: string
  value: string | number
}

export interface CreateWorkItemResponse {
  id: number
  rev: number
  fields: {
    'System.Id': number
    'System.Title': string
    'System.WorkItemType': string
    'System.State': string
  }
  url: string
}

export class AzureDevOpsClient {
  private organization: string
  private pat: string
  private baseUrl: string
  private authHeader: string

  constructor(credentials: AzureDevOpsCredentials) {
    this.organization = credentials.organization
    this.pat = decryptTokenFromStorage(credentials.encryptedPat)
    this.baseUrl = `https://dev.azure.com/${this.organization}`
    
    // Azure DevOps uses Basic Auth with PAT
    // Format: base64(pat:pat) or base64(:pat) - both work
    const auth = Buffer.from(`:${this.pat}`).toString('base64')
    this.authHeader = `Basic ${auth}`
  }

  /**
   * Make authenticated request to Azure DevOps REST API
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`
    
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
      let errorMessage = `Azure DevOps API error: ${response.status} ${response.statusText}`
      
      // Check if response is HTML (error page)
      if (errorText.trim().startsWith('<!DOCTYPE') || errorText.trim().startsWith('<html')) {
        console.error('❌ Azure DevOps API returned HTML instead of JSON:', {
          status: response.status,
          statusText: response.statusText,
          url: url,
          responsePreview: errorText.substring(0, 500)
        })
        throw new Error(`Azure DevOps API endpoint not found or returned HTML. Check the URL: ${url}`)
      }
      
      try {
        const errorJson = JSON.parse(errorText)
        console.error('❌ Azure DevOps API Error Response:', {
          status: response.status,
          statusText: response.statusText,
          errorJson,
          url: url
        })
        
        if (errorJson.message) {
          errorMessage = errorJson.message
        } else if (errorJson.value && Array.isArray(errorJson.value)) {
          const messages = errorJson.value.map((v: any) => v.message || v).join(', ')
          errorMessage = messages
        }
      } catch {
        errorMessage = errorText || errorMessage
        console.error('❌ Azure DevOps API Error (non-JSON):', errorText.substring(0, 500))
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
   * Test connection to Azure DevOps
   */
  async testConnection(): Promise<{ success: boolean; user?: any; error?: string }> {
    try {
      // Use projects endpoint to test authentication - if we can get projects, auth is valid
      const response = await this.request<{
        value: AzureDevOpsProject[]
        count: number
      }>('/_apis/projects?api-version=7.0')
      
      // If we got here, authentication is successful
      return { 
        success: true, 
        user: {
          authenticated: true,
          projectsCount: response.count || 0
        }
      }
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
  async getProjects(): Promise<AzureDevOpsProject[]> {
    const response = await this.request<{
      value: AzureDevOpsProject[]
    }>('/_apis/projects?api-version=7.0')
    
    return response.value || []
  }

  /**
   * Get work item types for a specific project
   * Accepts either project name or project ID
   * Project ID is more reliable, so we try to use that first
   */
  async getWorkItemTypes(projectNameOrId: string, projectId?: string): Promise<AzureDevOpsWorkItemType[]> {
    // If projectId is provided, use it directly (most reliable)
    const projectIdentifier = projectId || projectNameOrId
    
    try {
      // Try using the identifier directly (works for both ID and encoded name)
      const response = await this.request<{
        value: AzureDevOpsWorkItemType[]
      }>(`/${encodeURIComponent(projectIdentifier)}/_apis/wit/workitemtypes?api-version=7.0`)
      
      return response.value || []
    } catch (error) {
      console.error(`Error fetching work item types for project ${projectNameOrId}:`, error)
      
      // If we don't have projectId yet, try to find it from projects list
      if (!projectId) {
        try {
          const projects = await this.getProjects()
          const projectObj = projects.find(p => p.name === projectNameOrId || p.id === projectNameOrId)
          
          if (projectObj && projectObj.id && projectObj.id !== projectNameOrId) {
            // Try using project ID instead
            console.log(`Retrying with project ID: ${projectObj.id}`)
            const response = await this.request<{
              value: AzureDevOpsWorkItemType[]
            }>(`/${projectObj.id}/_apis/wit/workitemtypes?api-version=7.0`)
            return response.value || []
          }
        } catch (fallbackError) {
          console.error(`Fallback method also failed:`, fallbackError)
        }
      }
      
      // Return common default work item types as last resort
      console.log(`Returning default work item types for project ${projectNameOrId}`)
      return [
        { name: 'Bug', referenceName: 'Microsoft.VSTS.WorkItemTypes.Bug' },
        { name: 'Task', referenceName: 'Microsoft.VSTS.WorkItemTypes.Task' },
        { name: 'User Story', referenceName: 'Microsoft.VSTS.WorkItemTypes.UserStory' }
      ]
    }
  }

  /**
   * Create a new work item
   */
  async createWorkItem(
    project: string,
    workItemType: string,
    patches: CreateWorkItemRequest[]
  ): Promise<CreateWorkItemResponse> {
    const url = `/${encodeURIComponent(project)}/_apis/wit/workitems/$${workItemType}?api-version=7.0`
    
    console.log('🔵 Creating Azure DevOps work item with data:', JSON.stringify(patches, null, 2))
    
    try {
      const result = await this.request<CreateWorkItemResponse>(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify(patches)
      })
      console.log('✅ Azure DevOps work item created successfully:', result)
      return result
    } catch (error) {
      console.error('❌ Error creating Azure DevOps work item:', error)
      console.error('Request data was:', JSON.stringify(patches, null, 2))
      throw error
    }
  }

  /**
   * Get work item details by ID
   */
  async getWorkItem(project: string, workItemId: number): Promise<AzureDevOpsWorkItem> {
    return this.request<AzureDevOpsWorkItem>(
      `/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}?api-version=7.0`
    )
  }

  /**
   * Update an existing work item
   */
  async updateWorkItem(
    project: string,
    workItemId: number,
    patches: CreateWorkItemRequest[]
  ): Promise<void> {
    await this.request(
      `/${encodeURIComponent(project)}/_apis/wit/workitems/${workItemId}?api-version=7.0`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json-patch+json'
        },
        body: JSON.stringify(patches)
      }
    )
  }

  /**
   * Build full Azure DevOps URL for a work item
   */
  getWorkItemUrl(project: string, workItemId: number): string {
    return `${this.baseUrl}/${encodeURIComponent(project)}/_workitems/edit/${workItemId}`
  }

  /**
   * Add attachment to work item (Azure DevOps supports attachments via separate API)
   * Note: This is a placeholder - Azure DevOps attachment API is more complex
   */
  async addAttachment(
    project: string,
    workItemId: number,
    fileBuffer: Buffer,
    filename: string
  ): Promise<{ id: string; url: string }> {
    // Azure DevOps requires uploading attachment first, then linking it to work item
    // This is a simplified version - full implementation would:
    // 1. Upload attachment to /_apis/wit/attachments
    // 2. Update work item with attachment reference
    
    const uploadUrl = `/_apis/wit/attachments?fileName=${encodeURIComponent(filename)}&api-version=7.0`
    
    const uploadResponse = await fetch(`${this.baseUrl}${uploadUrl}`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/octet-stream',
        'Content-Length': fileBuffer.length.toString()
      },
      body: fileBuffer as any // Buffer is compatible with fetch body
    })

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      throw new Error(`Failed to upload attachment: ${uploadResponse.status} ${errorText}`)
    }

    const attachment = await uploadResponse.json()
    
    // Link attachment to work item
    // Note: Azure DevOps relations require a specific format
    // For now, we'll skip the relation update as attachments are linked in description
    // The attachment is uploaded and can be viewed in Azure DevOps UI

    return {
      id: attachment.id,
      url: attachment.url
    }
  }
}

