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
    // Extract organization name from input - handle both full URL and just the name
    let orgName = credentials.organization.trim()
    
    // If a full URL is provided (e.g., "https://dev.azure.com/a11ytest"), extract just the org name
    if (orgName.includes('dev.azure.com/')) {
      const urlMatch = orgName.match(/dev\.azure\.com\/([^\/\s]+)/)
      if (urlMatch && urlMatch[1]) {
        orgName = urlMatch[1]
      }
    }
    
    // Remove any trailing slashes or paths
    orgName = orgName.split('/')[0].split('?')[0].split('#')[0]
    
    this.organization = orgName
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
   * Get teams for a specific project
   * Teams API is at organization level, we get all teams and filter by project
   */
  async getTeams(projectNameOrId: string, projectId?: string): Promise<Array<{ id: string; name: string }>> {
    try {
      // Get all teams from organization (teams API is at org level)
      // Use $top to get all teams (default is 100, but we can request more if needed)
      const response = await this.request<{
        value: Array<{ 
          id: string
          name: string
          projectId?: string
          projectName?: string
        }>
        count?: number
      }>('/_apis/teams?api-version=7.0&$top=1000')
      
      let teams = response.value || []
      console.log(`Total teams from organization: ${teams.length}`)
      
      // Filter teams by project
      if (projectId) {
        const beforeFilter = teams.length
        teams = teams.filter(team => team.projectId === projectId)
        console.log(`Filtered by projectId ${projectId}: ${beforeFilter} -> ${teams.length}`)
      } else {
        // Filter by project name if we don't have project ID
        const beforeFilter = teams.length
        teams = teams.filter(team => {
          const matches = team.projectName === projectNameOrId || 
                         team.projectId === projectNameOrId ||
                         (team.projectName && team.projectName.toLowerCase() === projectNameOrId.toLowerCase())
          return matches
        })
        console.log(`Filtered by project name "${projectNameOrId}": ${beforeFilter} -> ${teams.length}`)
      }
      
      // Log team details for debugging
      if (teams.length > 0) {
        console.log(`Teams found:`, teams.map(t => ({ id: t.id, name: t.name, projectId: t.projectId, projectName: t.projectName })))
      } else {
        console.log(`No teams found. All teams from org:`, response.value?.map(t => ({ id: t.id, name: t.name, projectId: t.projectId, projectName: t.projectName })))
      }
      
      return teams.map(t => ({ id: t.id, name: t.name }))
    } catch (error) {
      console.error(`Error fetching teams for project ${projectNameOrId}:`, error)
      // Try project-specific endpoint as fallback
      try {
        const projectIdentifier = projectId || projectNameOrId
        console.log(`Trying project-specific endpoint: /${projectIdentifier}/_apis/teams`)
        const response = await this.request<{
          value: Array<{ id: string; name: string }>
        }>(`/${encodeURIComponent(projectIdentifier)}/_apis/teams?api-version=7.0`)
        
        console.log(`Found ${response.value?.length || 0} teams using project-specific endpoint`)
        return response.value || []
      } catch (fallbackError) {
        console.error(`Fallback teams endpoint also failed:`, fallbackError)
        return []
      }
    }
  }

  /**
   * Get work item types from backlog configuration for a specific team
   * This gets the actual work item types that are configured for that team's backlog
   * Only returns work item types from the team's actual backlog level (not Epic/Feature levels)
   */
  async getWorkItemTypesForTeam(projectNameOrId: string, teamId: string, projectId?: string): Promise<AzureDevOpsWorkItemType[]> {
    const projectIdentifier = projectId || projectNameOrId
    const workItemTypesMap = new Map<string, AzureDevOpsWorkItemType>()
    
    try {
      // Use Backlog Configuration API with team ID to get work item types for that specific team
      const backlogConfig = await this.request<{
        backlogLevels: Array<{
          rank: number
          name: string
          workItemTypes: Array<{
            name: string
            referenceName: string
          }>
        }>
        portfolioBacklogs?: Array<{
          rank: number
          name: string
          workItemTypes: Array<{
            name: string
            referenceName: string
          }>
        }>
      }>(`/${encodeURIComponent(projectIdentifier)}/${encodeURIComponent(teamId)}/_apis/work/backlogconfiguration?api-version=7.0`)
      
      // Extract work item types ONLY from the team's actual backlog level
      // The backlogLevels array contains different levels - we want ONLY the team's backlog (not Epic/Feature)
      console.log(`Backlog config for team ${teamId}:`, JSON.stringify(backlogConfig, null, 2))
      
      if (backlogConfig.backlogLevels && backlogConfig.backlogLevels.length > 0) {
        // Log all backlog levels for debugging
        console.log(`Found ${backlogConfig.backlogLevels.length} backlog levels:`, backlogConfig.backlogLevels.map(l => `${l.name} (rank: ${l.rank}, WITs: ${l.workItemTypes?.length || 0})`).join(', '))
        
        // The team's actual backlog is typically the one with the LOWEST rank (rank 0 or 1)
        // Portfolio backlogs (Epic, Feature) have higher ranks
        // Sort by rank ascending (lowest rank = team backlog)
        const sortedLevels = [...backlogConfig.backlogLevels].sort((a, b) => (a.rank || 999) - (b.rank || 999))
        
        // Get the team's backlog level - it's usually the first one (lowest rank)
        // But exclude portfolio levels by name
        let teamBacklogLevel = null
        for (const level of sortedLevels) {
          const levelNameLower = (level.name || '').toLowerCase()
          // Skip portfolio levels by name
          if (levelNameLower.includes('epic') || 
              levelNameLower.includes('feature') || 
              levelNameLower.includes('theme') ||
              levelNameLower.includes('initiative') ||
              levelNameLower.includes('portfolio')) {
            console.log(`Skipping portfolio level: ${level.name}`)
            continue
          }
          // This is the team's backlog level (first non-portfolio level)
          teamBacklogLevel = level
          console.log(`Selected team backlog level: ${level.name} (rank: ${level.rank})`)
          break
        }
        
        // If we still didn't find one, use the first level (lowest rank = team backlog)
        if (!teamBacklogLevel && sortedLevels.length > 0) {
          teamBacklogLevel = sortedLevels[0]
          console.log(`Using first level as team backlog: ${teamBacklogLevel.name} (rank: ${teamBacklogLevel.rank})`)
        }
        
        // Get work item types ONLY from this specific level
        if (teamBacklogLevel && teamBacklogLevel.workItemTypes) {
          console.log(`Getting work item types from level "${teamBacklogLevel.name}":`, teamBacklogLevel.workItemTypes.map(w => w.name).join(', '))
          for (const wit of teamBacklogLevel.workItemTypes) {
            workItemTypesMap.set(wit.referenceName, {
              name: wit.name,
              referenceName: wit.referenceName
            })
          }
        } else {
          console.log(`No work item types found in selected backlog level`)
        }
      }
      
      // Convert map to array - should only have work item types from the team's backlog level
      const workItemTypes = Array.from(workItemTypesMap.values())
      
      if (workItemTypes.length > 0) {
        console.log(`✅ Found ${workItemTypes.length} work item types for team ${teamId} backlog:`, workItemTypes.map(w => w.name).join(', '))
        return workItemTypes
      } else {
        console.log(`❌ No work item types found for team ${teamId} - available backlog levels:`, backlogConfig.backlogLevels?.map(l => `${l.name} (rank: ${l.rank})`).join(', '))
      }
    } catch (error) {
      console.error(`❌ Error fetching work item types for team ${teamId} in project ${projectNameOrId}:`, error)
      // Don't fallback - return empty array so user knows it failed
      return []
    }
    
    // Return empty array instead of defaults - we want to show only what's actually configured
    console.log(`⚠️ Returning empty work item types - team backlog configuration not found`)
    return []
  }

  /**
   * Get work item types for a specific project
   * If teamId is provided, gets work item types for that team's backlog
   * Otherwise, gets work item types from the project level
   */
  async getWorkItemTypes(projectNameOrId: string, projectId?: string, teamId?: string): Promise<AzureDevOpsWorkItemType[]> {
    // If team ID provided, get work item types for that specific team
    if (teamId) {
      return this.getWorkItemTypesForTeam(projectNameOrId, teamId, projectId)
    }
    
    // Otherwise, get from project-level work item types API
    return this.getWorkItemTypesForProject(projectNameOrId, projectId)
  }

  /**
   * Get work item types from project level (not team-specific)
   * Uses the project-level work item types API
   */
  async getWorkItemTypesForProject(projectNameOrId: string, projectId?: string): Promise<AzureDevOpsWorkItemType[]> {
    const projectIdentifier = projectId || projectNameOrId
    
    try {
      // Use project-level work item types API
      const response = await this.request<{
        value: Array<{
          name: string
          referenceName: string
          description?: string
        }>
      }>(`/${encodeURIComponent(projectIdentifier)}/_apis/wit/workitemtypes?api-version=7.0`)
      
      const workItemTypes = (response.value || []).map(wit => ({
        name: wit.name,
        referenceName: wit.referenceName,
        description: wit.description
      }))
      
      console.log(`✅ Found ${workItemTypes.length} work item types for project ${projectIdentifier}:`, workItemTypes.map(w => w.name).join(', '))
      return workItemTypes
    } catch (error) {
      console.error(`❌ Error fetching work item types for project ${projectIdentifier}:`, error)
      // Return empty array instead of throwing - allows UI to handle gracefully
      return []
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

