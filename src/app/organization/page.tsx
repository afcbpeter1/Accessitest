'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { 
  Building2, Users, CreditCard, Settings, Plus, Mail, 
  UserPlus, Trash2, Edit, Crown, Shield, User, 
  ChevronDown, X, Check, AlertCircle, Loader2, ExternalLink, CheckCircle, Save, RefreshCw
} from 'lucide-react'

interface Organization {
  id: string
  name: string
  subscription_status: string
  max_users: number
  created_at: string
  members: OrganizationMember[]
  credits?: {
    credits_remaining: number
    credits_used: number
    unlimited_credits: boolean
  }
}

interface OrganizationMember {
  id: string
  user_id: string
  organization_id: string
  team_id?: string
  role: 'owner' | 'admin' | 'user'
  email?: string
  first_name?: string
  last_name?: string
  joined_at: string
}

interface Team {
  id: string
  name: string
  description?: string
  member_count: number
  jira_project_key?: string
  azure_devops_project?: string
  jira_issue_type?: string
  azure_devops_work_item_type?: string
  integrations: {
    jira?: boolean
    azure_devops?: boolean
  }
}

export default function OrganizationPage() {
  const router = useRouter()
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'teams' | 'billing' | 'integrations'>('overview')
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Auto-dismiss messages after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [message])
  
  // Forms
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'user' | 'admin'>('user')
  const [showCreateTeam, setShowCreateTeam] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [newTeamDescription, setNewTeamDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [availableJiraProjects, setAvailableJiraProjects] = useState<string[]>([])
  const [availableAzureDevOpsProjects, setAvailableAzureDevOpsProjects] = useState<string[]>([])
  const [teamJiraIssueTypes, setTeamJiraIssueTypes] = useState<Record<string, Array<{id: string, name: string}>>>({})
  const [teamAzureDevOpsWorkItemTypes, setTeamAzureDevOpsWorkItemTypes] = useState<Record<string, string[]>>({})
  // Track pending changes for each team (before saving)
  const [pendingTeamChanges, setPendingTeamChanges] = useState<Record<string, {
    jira_project_key?: string | null
    azure_devops_project?: string | null
    jira_issue_type?: string | null
    azure_devops_work_item_type?: string | null
  }>>({})

  // Integration sub-tab state
  const [integrationSubTab, setIntegrationSubTab] = useState<'jira' | 'azure'>('jira')
  
  // Jira integration state
  const [jiraIntegration, setJiraIntegration] = useState<any>(null)
  const [jiraForm, setJiraForm] = useState({
    jiraUrl: '',
    email: '',
    apiToken: '',
    projectKey: '',
    issueType: 'Bug',
    autoSyncEnabled: false
  })
  const [jiraProjects, setJiraProjects] = useState<any[]>([])
  const [jiraIssueTypes, setJiraIssueTypes] = useState<any[]>([])
  const [jiraStep, setJiraStep] = useState<'credentials' | 'project' | 'configure'>('credentials')
  const [testingConnection, setTestingConnection] = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(false)
  const [loadingIssueTypes, setLoadingIssueTypes] = useState(false)

  // Azure DevOps integration state
  const [azureDevOpsIntegration, setAzureDevOpsIntegration] = useState<any>(null)
  const [azureDevOpsForm, setAzureDevOpsForm] = useState({
    organization: '',
    project: '',
    pat: '',
    workItemType: 'Bug',
    areaPath: '',
    iterationPath: '',
    autoSyncEnabled: false
  })
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [azureDevOpsProjects, setAzureDevOpsProjects] = useState<any[]>([])
  const [azureDevOpsTeams, setAzureDevOpsTeams] = useState<any[]>([])
  const [azureDevOpsWorkItemTypes, setAzureDevOpsWorkItemTypes] = useState<any[]>([])
  const [testingAzureDevOpsConnection, setTestingAzureDevOpsConnection] = useState(false)
  const [loadingAzureDevOpsProjects, setLoadingAzureDevOpsProjects] = useState(false)
  const [loadingAzureDevOpsTeams, setLoadingAzureDevOpsTeams] = useState(false)
  const [loadingAzureDevOpsWorkItemTypes, setLoadingAzureDevOpsWorkItemTypes] = useState(false)

  useEffect(() => {
    loadOrganizations()
    loadJiraIntegration()
    loadAzureDevOpsIntegration()
    loadAvailableProjects()
    
    // Check for success/cancel params in URL
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    const canceled = urlParams.get('canceled')
    const tab = urlParams.get('tab')
    
    if (tab === 'billing') {
      setActiveTab('billing')
    }
    
    if (success === 'true') {
      setMessage({ type: 'success', text: 'Additional user seats have been successfully added! You will receive a confirmation email shortly.' })
    } else if (canceled === 'true') {
      setMessage({ type: 'error', text: 'Payment was canceled. No charges were made.' })
    }
    
    // Listen for organization switch events
    const handleRefresh = () => {
      loadOrganizations()
    }
    window.addEventListener('refreshUserData', handleRefresh)
    
    return () => {
      window.removeEventListener('refreshUserData', handleRefresh)
    }
  }, [])

  // Reload available projects when integrations change
  useEffect(() => {
    if (activeTab === 'teams') {
      loadAvailableProjects()
    }
  }, [activeTab, jiraIntegration, azureDevOpsIntegration])

  // Load integrations when integrations tab is active
  useEffect(() => {
    if (activeTab === 'integrations') {
      loadJiraIntegration()
      if (integrationSubTab === 'azure') {
        loadAzureDevOpsIntegration()
      }
    }
  }, [activeTab, integrationSubTab])

  const loadOrganizations = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/organization', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await response.json()
      if (data.success && data.organizations.length > 0) {
        setOrganizations(data.organizations)
        setCurrentOrg(data.organizations[0]) // Set first org as current
        if (data.organizations[0]) {
          loadTeams(data.organizations[0].id)
        }
      }
    } catch (error) {
      console.error('Error loading organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadTeams = async (organizationId: string) => {
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/organization/teams?organization_id=${organizationId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await response.json()
      if (data.success) {
        setTeams(data.teams)
      }
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  // Removed handleCreateOrganization - users can only have one organization (auto-created on signup)

  const handleInviteUser = async () => {
    if (!inviteEmail.trim() || !currentOrg) {
      setMessage({ type: 'error', text: 'Email is required' })
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/organization/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          email: inviteEmail.trim(),
          role: inviteRole
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Invitation sent successfully!' })
        setShowInviteModal(false)
        setInviteEmail('')
        loadOrganizations()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to send invitation' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  const handleCreateTeam = async () => {
    if (!newTeamName.trim() || !currentOrg) {
      setMessage({ type: 'error', text: 'Team name is required' })
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/organization/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          name: newTeamName.trim(),
          description: newTeamDescription.trim() || undefined
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Team created successfully!' })
        setShowCreateTeam(false)
        setNewTeamName('')
        setNewTeamDescription('')
        loadTeams(currentOrg.id)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to create team' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  const handleRemoveMember = async (userId: string) => {
    if (!currentOrg || !confirm('Are you sure you want to remove this member?')) return

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/organization/members?organization_id=${currentOrg.id}&user_id=${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Member removed successfully' })
        loadOrganizations()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to remove member' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  const handleUpdateRole = async (userId: string, newRole: 'owner' | 'admin' | 'user') => {
    if (!currentOrg) return

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/organization/members', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: currentOrg.id,
          userId,
          role: newRole
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Role updated successfully' })
        loadOrganizations()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update role' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  const handleAssignToTeam = async (userId: string, teamId: string | null) => {
    if (!currentOrg) return

    try {
      const token = localStorage.getItem('accessToken')
      
      if (teamId === null || teamId === '') {
        // Remove from team
        const response = await fetch('/api/organization/teams/remove', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            organizationId: currentOrg.id,
            userId
          })
        })

        const data = await response.json()
        if (data.success) {
          setMessage({ type: 'success', text: 'Member removed from team successfully' })
          loadOrganizations()
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed to remove member from team' })
        }
      } else {
        // Assign to team
        const response = await fetch('/api/organization/teams/assign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            organizationId: currentOrg.id,
            userId,
            teamId
          })
        })

        const data = await response.json()
        if (data.success) {
          setMessage({ type: 'success', text: 'Member assigned to team successfully' })
          loadOrganizations()
        } else {
          setMessage({ type: 'error', text: data.error || 'Failed to assign member to team' })
        }
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  // Get current user's role in the organization
  const getCurrentUserRole = (): 'owner' | 'admin' | 'user' | null => {
    if (!currentOrg) return null
    
    // Get user ID from localStorage
    try {
      const userStr = localStorage.getItem('user')
      if (!userStr) return null
      
      const user = JSON.parse(userStr)
      const userId = user.id || user.userId
      if (!userId) return null
      
      const member = currentOrg.members.find(m => m.user_id === userId)
      return member?.role || null
    } catch {
      return null
    }
  }

  // Integration functions
  const loadJiraIntegration = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        return
      }

      const response = await fetch('/api/jira/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      
      if (data.success && data.integration) {
        setJiraIntegration(data.integration)
        setJiraForm({
          jiraUrl: data.integration.jiraUrl || '',
          email: data.integration.email || '',
          apiToken: '',
          projectKey: data.integration.projectKey || '',
          issueType: data.integration.issueType || 'Bug',
          autoSyncEnabled: data.integration.autoSyncEnabled ?? false
        })
        setJiraStep('credentials')
        
        if (data.integration.projectKey) {
          loadIssueTypes(data.integration.projectKey).catch(() => {})
        }
      } else {
        setJiraIntegration(null)
        if (!jiraForm.jiraUrl && !jiraForm.email && !jiraForm.projectKey) {
          setJiraForm({
            jiraUrl: '',
            email: '',
            apiToken: '',
            projectKey: '',
            issueType: 'Bug',
            autoSyncEnabled: false
          })
          setJiraStep('credentials')
        }
      }
    } catch (error) {
      // Silently handle errors
    }
  }

  const testJiraConnection = async () => {
    setTestingConnection(true)
    setMessage(null)
    
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/jira/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          jiraUrl: jiraForm.jiraUrl,
          email: jiraForm.email,
          apiToken: jiraForm.apiToken
        })
      })

      const data = await response.json()
      if (data.success) {
        setJiraProjects(data.projects || [])
        setJiraStep('project')
        setMessage({ type: 'success', text: 'Connection successful! Please select a project.' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to connect to Jira' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to test connection' })
    } finally {
      setTestingConnection(false)
    }
  }

  const loadIssueTypes = async (projectKey: string) => {
    setLoadingIssueTypes(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/jira/settings/issue-types?projectKey=${projectKey}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setJiraIssueTypes(data.issueTypes || [])
        setJiraStep('configure')
      }
    } catch (error) {
      console.error('Failed to load issue types:', error)
    } finally {
      setLoadingIssueTypes(false)
    }
  }

  const handleJiraProjectChange = (projectKey: string) => {
    setJiraForm({ ...jiraForm, projectKey })
    if (projectKey) {
      loadIssueTypes(projectKey)
    }
  }

  const handleJiraSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('accessToken')
      
      const saveData = { ...jiraForm }
      if (!saveData.apiToken && jiraIntegration) {
        delete saveData.apiToken
      }
      
      const response = await fetch('/api/jira/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(saveData)
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Jira integration saved successfully' })
        setJiraForm(prev => ({ ...prev, apiToken: '' }))
        await loadJiraIntegration()
        setJiraStep('credentials')
        loadAvailableProjects()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save Jira integration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save Jira integration' })
    } finally {
      setSaving(false)
    }
  }

  const handleJiraDisconnect = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/jira/settings', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Jira integration disconnected' })
        setJiraIntegration(null)
        setJiraForm({
          jiraUrl: '',
          email: '',
          apiToken: '',
          projectKey: '',
          issueType: 'Bug',
          autoSyncEnabled: false
        })
        setJiraStep('credentials')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to disconnect Jira integration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect Jira integration' })
    } finally {
      setSaving(false)
    }
  }

  const loadAzureDevOpsIntegration = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        return
      }

      const response = await fetch('/api/azure-devops/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        return
      }

      const data = await response.json()
      
      if (data.success && data.integration) {
        setAzureDevOpsIntegration(data.integration)
        setAzureDevOpsForm({
          organization: data.integration.organization || '',
          project: data.integration.project || '',
          pat: '',
          workItemType: data.integration.workItemType || 'Bug',
          areaPath: data.integration.areaPath || '',
          iterationPath: data.integration.iterationPath || '',
          autoSyncEnabled: data.integration.autoSyncEnabled ?? false
        })
        
        if (data.integration.project) {
          loadAzureDevOpsWorkItemTypes(data.integration.project).catch(() => {})
        }
      } else {
        setAzureDevOpsIntegration(null)
        if (!azureDevOpsForm.organization && !azureDevOpsForm.project) {
          setAzureDevOpsForm({
            organization: '',
            project: '',
            pat: '',
            workItemType: 'Bug',
            areaPath: '',
            iterationPath: '',
            autoSyncEnabled: false
          })
        }
      }
    } catch (error) {
      // Silently handle errors
    }
  }

  const testAzureDevOpsConnection = async () => {
    setTestingAzureDevOpsConnection(true)
    setMessage(null)
    
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/azure-devops/settings/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organization: azureDevOpsForm.organization,
          pat: azureDevOpsForm.pat
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}: ${response.statusText}` }))
        setMessage({ type: 'error', text: errorData.error || `Failed to test connection (${response.status})` })
        console.error('Test connection failed:', errorData)
        return
      }

      const data = await response.json()
      if (data.success) {
        const projects = data.projects || []
        console.log('Projects received from test:', projects)
        setAzureDevOpsProjects(projects)
        if (projects.length > 0) {
          setMessage({ type: 'success', text: `Connection successful! Found ${projects.length} project(s). Please select a project.` })
        } else {
          setMessage({ type: 'success', text: 'Connection successful! No projects found. You can enter a project name manually.' })
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to connect to Azure DevOps' })
      }
    } catch (error) {
      console.error('Test connection error:', error)
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Failed to test connection' })
    } finally {
      setTestingAzureDevOpsConnection(false)
    }
  }

  const loadAzureDevOpsProjects = async () => {
    setLoadingAzureDevOpsProjects(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/azure-devops/settings/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setAzureDevOpsProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoadingAzureDevOpsProjects(false)
    }
  }

  const loadAzureDevOpsTeams = async (project: string) => {
    setLoadingAzureDevOpsTeams(true)
    try {
      const token = localStorage.getItem('accessToken')
      
      const projectObj = azureDevOpsProjects.find(p => p.name === project)
      const projectId = projectObj?.id
      
      let url = `/api/azure-devops/settings/teams?project=${encodeURIComponent(project)}`
      if (projectId) {
        url += `&projectId=${encodeURIComponent(projectId)}`
      }
      if (azureDevOpsForm.organization) {
        url += `&organization=${encodeURIComponent(azureDevOpsForm.organization)}`
      }
      if (azureDevOpsForm.pat) {
        url += `&pat=${encodeURIComponent(azureDevOpsForm.pat)}`
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        console.log(`Loaded ${data.teams?.length || 0} teams`)
        setAzureDevOpsTeams(data.teams || [])
      } else {
        console.error('Failed to load teams:', data.error)
        setAzureDevOpsTeams([])
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
      setAzureDevOpsTeams([])
    } finally {
      setLoadingAzureDevOpsTeams(false)
    }
  }

  const loadAzureDevOpsWorkItemTypes = async (project: string, teamId?: string) => {
    setLoadingAzureDevOpsWorkItemTypes(true)
    try {
      const token = localStorage.getItem('accessToken')
      
      const projectObj = azureDevOpsProjects.find(p => p.name === project)
      const projectId = projectObj?.id
      
      let url = `/api/azure-devops/settings/work-item-types?project=${encodeURIComponent(project)}`
      if (projectId) {
        url += `&projectId=${encodeURIComponent(projectId)}`
      }
      if (teamId) {
        url += `&teamId=${encodeURIComponent(teamId)}`
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        const workItemTypes = data.workItemTypes || []
        console.log(`Loaded ${workItemTypes.length} work item types from team backlog:`, workItemTypes.map(t => t.name).join(', '))
        setAzureDevOpsWorkItemTypes(workItemTypes)
      } else {
        console.error('Failed to load work item types:', data.error)
        setAzureDevOpsWorkItemTypes([])
      }
    } catch (error) {
      console.error('Failed to load work item types:', error)
      setAzureDevOpsWorkItemTypes([])
    } finally {
      setLoadingAzureDevOpsWorkItemTypes(false)
    }
  }

  const handleAzureDevOpsProjectChange = (project: string) => {
    setAzureDevOpsForm({ ...azureDevOpsForm, project })
    setSelectedTeamId('')
    if (project) {
      loadAzureDevOpsTeams(project)
      setAzureDevOpsWorkItemTypes([])
    } else {
      setAzureDevOpsTeams([])
      setAzureDevOpsWorkItemTypes([])
    }
  }

  const handleAzureDevOpsTeamChange = (teamId: string) => {
    setSelectedTeamId(teamId)
    if (azureDevOpsForm.project && teamId) {
      loadAzureDevOpsWorkItemTypes(azureDevOpsForm.project, teamId)
    } else {
      setAzureDevOpsWorkItemTypes([])
    }
  }

  const handleAzureDevOpsSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('accessToken')
      
      const saveData = { ...azureDevOpsForm }
      if (!saveData.pat && azureDevOpsIntegration) {
        delete saveData.pat
      }
      
      const response = await fetch('/api/azure-devops/settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(saveData)
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Azure DevOps integration saved successfully' })
        setAzureDevOpsForm(prev => ({ ...prev, pat: '' }))
        await loadAzureDevOpsIntegration()
        loadAvailableProjects()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save Azure DevOps integration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to save Azure DevOps integration' })
    } finally {
      setSaving(false)
    }
  }

  const handleAzureDevOpsDisconnect = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/azure-devops/settings', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Azure DevOps integration disconnected' })
        setAzureDevOpsIntegration(null)
        setAzureDevOpsForm({
          organization: '',
          project: '',
          pat: '',
          workItemType: 'Bug',
          areaPath: '',
          iterationPath: '',
          autoSyncEnabled: false
        })
        loadAvailableProjects()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to disconnect Azure DevOps integration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect Azure DevOps integration' })
    } finally {
      setSaving(false)
    }
  }

  const loadAvailableProjects = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      // Load all Jira projects
      if (jiraIntegration) {
        try {
          const jiraResponse = await fetch('/api/jira/settings/projects', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          const jiraData = await jiraResponse.json()
          if (jiraData.success && jiraData.projects) {
            // Use project key for Jira
            setAvailableJiraProjects(jiraData.projects.map((p: any) => p.key))
          } else {
            // Fallback to saved project if API fails
            setAvailableJiraProjects(jiraIntegration.projectKey ? [jiraIntegration.projectKey] : [])
          }
        } catch (error) {
          console.error('Error loading Jira projects:', error)
          // Fallback to saved project
          setAvailableJiraProjects(jiraIntegration.projectKey ? [jiraIntegration.projectKey] : [])
        }
      } else {
        setAvailableJiraProjects([])
      }

      // Load all Azure DevOps projects
      if (azureDevOpsIntegration) {
        try {
          const azureResponse = await fetch('/api/azure-devops/settings/projects', {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          })
          const azureData = await azureResponse.json()
          if (azureData.success && azureData.projects) {
            // Use project name for Azure DevOps
            setAvailableAzureDevOpsProjects(azureData.projects.map((p: any) => p.name))
          } else {
            // Fallback to saved project if API fails
            setAvailableAzureDevOpsProjects(azureDevOpsIntegration.project ? [azureDevOpsIntegration.project] : [])
          }
        } catch (error) {
          console.error('Error loading Azure DevOps projects:', error)
          // Fallback to saved project
          setAvailableAzureDevOpsProjects(azureDevOpsIntegration.project ? [azureDevOpsIntegration.project] : [])
        }
      } else {
        setAvailableAzureDevOpsProjects([])
      }
    } catch (error) {
      console.error('Error loading available projects:', error)
    }
  }

  const handleAssignProjectToTeam = async (teamId: string, projectType: 'jira' | 'azure', projectValue: string | null) => {
    if (!currentOrg) return

    try {
      const token = localStorage.getItem('accessToken')
      const updates: any = {}
      
      if (projectType === 'jira') {
        updates.jira_project_key = projectValue
      } else {
        updates.azure_devops_project = projectValue
      }

      const response = await fetch('/api/organization/teams', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          teamId,
          ...updates
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Project assigned to team successfully` })
        // Load work item types for the new project
        if (projectValue && projectType === 'jira') {
          await loadWorkItemTypesForTeam(teamId, projectType, projectValue)
        }
        loadTeams(currentOrg.id)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to assign project to team' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  // Update pending changes (local state, doesn't save yet)
  const updatePendingTeamChange = (teamId: string, field: string, value: string | null) => {
    setPendingTeamChanges(prev => ({
      ...prev,
      [teamId]: {
        ...prev[teamId],
        [field]: value
      }
    }))
  }

  // Save all pending changes for a team
  const saveTeamChanges = async (teamId: string) => {
    if (!currentOrg) return

    const changes = pendingTeamChanges[teamId]
    if (!changes || Object.keys(changes).length === 0) {
      return // No changes to save
    }

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/organization/teams', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          teamId,
          ...changes
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Team settings saved successfully` })
        // Clear pending changes for this team
        setPendingTeamChanges(prev => {
          const updated = { ...prev }
          delete updated[teamId]
          return updated
        })
        // Load work item types if Jira project changed
        if (changes.jira_project_key) {
          await loadWorkItemTypesForTeam(teamId, 'jira', changes.jira_project_key)
        }
        loadTeams(currentOrg.id)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to save team settings' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  const handleAssignWorkItemTypeToTeam = async (teamId: string, workItemType: 'jira' | 'azure', value: string | null) => {
    if (!currentOrg) return

    try {
      const token = localStorage.getItem('accessToken')
      const updates: any = {}
      
      if (workItemType === 'jira') {
        updates.jira_issue_type = value
      } else {
        updates.azure_devops_work_item_type = value
      }

      const response = await fetch('/api/organization/teams', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          teamId,
          ...updates
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: `Work item type assigned to team successfully` })
        loadTeams(currentOrg.id)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to assign work item type' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'An error occurred' })
    }
  }

  const canManageTeams = (): boolean => {
    const role = getCurrentUserRole()
    return role === 'owner' || role === 'admin'
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'owner': return <Crown className="h-4 w-4 text-yellow-500" />
      case 'admin': return <Shield className="h-4 w-4 text-blue-500" />
      default: return <User className="h-4 w-4 text-gray-500" />
    }
  }

  if (loading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      </Sidebar>
    )
  }

  return (
    <Sidebar>
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Organization</h1>
              <p className="text-gray-600 mt-1">Manage your teams, members, and billing</p>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-4 p-4 rounded-lg flex items-center ${
              message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-2" />
              ) : (
                <AlertCircle className="h-5 w-5 mr-2" />
              )}
              {message.text}
              <button onClick={() => setMessage(null)} className="ml-auto">
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          {organizations.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Loading organization...</h3>
              <p className="text-gray-600">Your organization should be created automatically</p>
            </div>
          ) : (
            <div>
              {/* Main Content - Single Organization */}
              {currentOrg && (
                <div className="bg-white rounded-lg shadow">
                  {/* Tabs */}
                  <div className="border-b border-gray-200">
                      <nav className="flex space-x-8 px-6">
                        {[
                          { id: 'overview', name: 'Overview', icon: Building2 },
                          { id: 'members', name: 'Members', icon: Users },
                          { id: 'teams', name: 'Teams', icon: Users },
                          { id: 'integrations', name: 'Integrations', icon: Settings },
                          { id: 'billing', name: 'Billing', icon: CreditCard }
                        ].map((tab) => {
                          const Icon = tab.icon
                          return (
                            <button
                              key={tab.id}
                              onClick={() => setActiveTab(tab.id as any)}
                              className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                                activeTab === tab.id
                                  ? 'border-primary-600 text-primary-600'
                                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                              }`}
                            >
                              <Icon className="h-5 w-5 mr-2" />
                              {tab.name}
                            </button>
                          )
                        })}
                      </nav>
                    </div>

                    {/* Tab Content */}
                    <div className="p-6">
                      {activeTab === 'overview' && (
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">{currentOrg.name}</h3>
                            <p className="text-gray-600">Created {new Date(currentOrg.created_at).toLocaleDateString()}</p>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Members</div>
                              <div className="text-2xl font-bold text-gray-900">{currentOrg.members.length}</div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Max Users</div>
                              <div className="text-2xl font-bold text-gray-900">{currentOrg.max_users}</div>
                            </div>
                            <div className="bg-gray-50 p-4 rounded-lg">
                              <div className="text-sm text-gray-600">Credits</div>
                              <div className="text-2xl font-bold text-gray-900">
                                {currentOrg.credits?.unlimited_credits ? '∞' : currentOrg.credits?.credits_remaining || 0}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeTab === 'members' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">Members</h3>
                            <button
                              onClick={() => setShowInviteModal(true)}
                              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                            >
                              <UserPlus className="h-5 w-5 mr-2" />
                              Invite Member
                            </button>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {currentOrg.members.map((member) => {
                                  const memberTeam = teams.find(t => t.id === member.team_id)
                                  const isAdminOrOwner = canManageTeams()
                                  
                                  return (
                                    <tr key={member.id}>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        {member.first_name} {member.last_name}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">{member.email}</td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        {isAdminOrOwner ? (
                                          <select
                                            value={member.team_id || ''}
                                            onChange={(e) => handleAssignToTeam(member.user_id, e.target.value || null)}
                                            className="text-sm border border-gray-300 rounded px-2 py-1"
                                          >
                                            <option value="">No Team</option>
                                            {teams.map((team) => (
                                              <option key={team.id} value={team.id}>
                                                {team.name}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <span className="text-gray-600">
                                            {memberTeam ? memberTeam.name : 'No Team'}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                          {getRoleIcon(member.role)}
                                          {isAdminOrOwner && member.role !== 'owner' ? (
                                            <select
                                              value={member.role}
                                              onChange={(e) => handleUpdateRole(member.user_id, e.target.value as 'owner' | 'admin' | 'user')}
                                              className="ml-2 text-sm border border-gray-300 rounded px-2 py-1"
                                            >
                                              <option value="user">User</option>
                                              <option value="admin">Admin</option>
                                            </select>
                                          ) : (
                                            <span className="ml-2 capitalize">{member.role}</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                        {new Date(member.joined_at).toLocaleDateString()}
                                      </td>
                                      <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center space-x-2">
                                          {isAdminOrOwner && member.role !== 'owner' && (
                                            <button
                                              onClick={() => handleRemoveMember(member.user_id)}
                                              className="text-red-600 hover:text-red-800"
                                              title="Remove member"
                                            >
                                              <Trash2 className="h-5 w-5" />
                                            </button>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {activeTab === 'teams' && (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">Teams</h3>
                            <button
                              onClick={() => setShowCreateTeam(true)}
                              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                            >
                              <Plus className="h-5 w-5 mr-2" />
                              Create Team
                            </button>
                          </div>

                          {teams.length === 0 ? (
                            <div className="text-center py-8 text-gray-600">
                              No teams yet. Create your first team to organize members.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {teams.map((team) => (
                                <div key={team.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                  <div className="flex justify-between items-start mb-2">
                                    <h4 className="font-semibold text-gray-900">{team.name}</h4>
                                    <button
                                      onClick={async () => {
                                        if (confirm('Delete this team? This cannot be undone.')) {
                                          try {
                                            const token = localStorage.getItem('accessToken')
                                            const response = await fetch(`/api/organization/teams?id=${team.id}`, {
                                              method: 'DELETE',
                                              headers: { 'Authorization': `Bearer ${token}` }
                                            })
                                            const data = await response.json()
                                            if (data.success) {
                                              setMessage({ type: 'success', text: 'Team deleted successfully' })
                                              loadTeams(currentOrg!.id)
                                            } else {
                                              setMessage({ type: 'error', text: data.error || 'Failed to delete team' })
                                            }
                                          } catch (error) {
                                            setMessage({ type: 'error', text: 'An error occurred' })
                                          }
                                        }
                                      }}
                                      className="text-red-600 hover:text-red-800"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                  {team.description && (
                                    <p className="text-sm text-gray-600 mb-3">{team.description}</p>
                                  )}
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center text-sm text-gray-600">
                                      <Users className="h-4 w-4 mr-1" />
                                      {team.member_count} members
                                    </div>
                                    <div className="flex items-center space-x-2 text-xs">
                                      {team.integrations.jira && (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded">Jira</span>
                                      )}
                                      {team.integrations.azure_devops && (
                                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded">Azure</span>
                                      )}
                                    </div>
                                  </div>
                                  
                                  {/* Project Assignments */}
                                  {canManageTeams() && (
                                    <div className="space-y-2 border-t pt-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-medium text-gray-700">Project Assignments</span>
                                        <div className="flex items-center space-x-2">
                                          {(jiraIntegration || azureDevOpsIntegration) && (
                                            <button
                                              onClick={loadAvailableProjects}
                                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                                              title="Refresh projects from integrations"
                                            >
                                              <RefreshCw className="h-3 w-3" />
                                              <span>Refresh</span>
                                            </button>
                                          )}
                                          {pendingTeamChanges[team.id] && Object.keys(pendingTeamChanges[team.id]).length > 0 && (
                                            <button
                                              onClick={() => saveTeamChanges(team.id)}
                                              className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded flex items-center space-x-1"
                                              title="Save team settings"
                                            >
                                              <Save className="h-3 w-3" />
                                              <span>Save</span>
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                      {availableJiraProjects.length > 0 && (
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Jira Project
                                          </label>
                                          <select
                                            value={team.jira_project_key || ''}
                                            onChange={(e) => handleAssignProjectToTeam(team.id, 'jira', e.target.value || null)}
                                            className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                                          >
                                            <option value="">None</option>
                                            {availableJiraProjects.map((project) => (
                                              <option key={project} value={project}>
                                                {project}
                                              </option>
                                            ))}
                                          </select>
                                          <p className="text-xs text-gray-500 mt-1">
                                            {availableJiraProjects.length} project{availableJiraProjects.length !== 1 ? 's' : ''} available
                                          </p>
                                          {team.jira_project_key && (
                                            <div className="mt-2">
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Jira Issue Type
                                              </label>
                                              {teamJiraIssueTypes[team.id] ? (
                                                <select
                                                  value={pendingTeamChanges[team.id]?.jira_issue_type !== undefined 
                                                    ? (pendingTeamChanges[team.id].jira_issue_type || '')
                                                    : (team.jira_issue_type || '')}
                                                  onChange={(e) => updatePendingTeamChange(team.id, 'jira_issue_type', e.target.value || null)}
                                                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                                                >
                                                  <option value="">Use integration default</option>
                                                  {teamJiraIssueTypes[team.id].map((type) => (
                                                    <option key={type.id} value={type.name}>
                                                      {type.name}
                                                    </option>
                                                  ))}
                                                </select>
                                              ) : (
                                                <input
                                                  type="text"
                                                  value={pendingTeamChanges[team.id]?.jira_issue_type !== undefined 
                                                    ? (pendingTeamChanges[team.id].jira_issue_type || '')
                                                    : (team.jira_issue_type || '')}
                                                  onChange={(e) => updatePendingTeamChange(team.id, 'jira_issue_type', e.target.value || null)}
                                                  placeholder="e.g., Bug, Task, Story"
                                                  className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                                                />
                                              )}
                                              <p className="text-xs text-gray-500 mt-1">
                                                Leave empty to use integration default
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {availableAzureDevOpsProjects.length > 0 && (
                                        <div>
                                          <label className="block text-xs font-medium text-gray-700 mb-1">
                                            Azure DevOps Project
                                          </label>
                                          <select
                                            value={team.azure_devops_project || ''}
                                            onChange={(e) => handleAssignProjectToTeam(team.id, 'azure', e.target.value || null)}
                                            className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                                          >
                                            <option value="">None</option>
                                            {availableAzureDevOpsProjects.map((project) => (
                                              <option key={project} value={project}>
                                                {project}
                                              </option>
                                            ))}
                                          </select>
                                          <p className="text-xs text-gray-500 mt-1">
                                            {availableAzureDevOpsProjects.length} project{availableAzureDevOpsProjects.length !== 1 ? 's' : ''} available
                                          </p>
                                          {team.azure_devops_project && (
                                            <div className="mt-2">
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Azure DevOps Work Item Type
                                              </label>
                                              <input
                                                type="text"
                                                value={pendingTeamChanges[team.id]?.azure_devops_work_item_type !== undefined 
                                                  ? (pendingTeamChanges[team.id].azure_devops_work_item_type || '')
                                                  : (team.azure_devops_work_item_type || '')}
                                                onChange={(e) => updatePendingTeamChange(team.id, 'azure_devops_work_item_type', e.target.value || null)}
                                                placeholder="e.g., Bug, Task, Product Backlog Item"
                                                className="w-full text-sm px-2 py-1 border border-gray-300 rounded"
                                              />
                                              <p className="text-xs text-gray-500 mt-1">
                                                Enter the exact work item type name. Leave empty to use integration default.
                                              </p>
                                            </div>
                                          )}
                                        </div>
                                      )}
                                      {availableJiraProjects.length === 0 && availableAzureDevOpsProjects.length === 0 && (
                                        <p className="text-xs text-gray-500">
                                          {jiraIntegration || azureDevOpsIntegration 
                                            ? 'No projects found. Click Refresh to reload from integrations.'
                                            : 'Configure integrations to assign projects to teams'
                                          }
                                        </p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'integrations' && (
                        <div className="space-y-6">
                          {/* Integration Sub-tabs */}
                          <div className="border-b border-gray-200">
                            <nav className="-mb-px flex space-x-8">
                              <button
                                onClick={() => setIntegrationSubTab('jira')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                  integrationSubTab === 'jira'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                              >
                                Jira
                              </button>
                              <button
                                onClick={() => setIntegrationSubTab('azure')}
                                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                                  integrationSubTab === 'azure'
                                    ? 'border-blue-500 text-blue-600'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                              >
                                Azure DevOps
                              </button>
                            </nav>
                          </div>

                          {integrationSubTab === 'jira' && (
                            <div className="card">
                              <h2 className="text-lg font-semibold text-gray-900 mb-4">Jira Integration</h2>
                              <p className="text-sm text-gray-600 mb-6">
                                Connect your Jira Cloud instance to create tickets from accessibility scan results.
                              </p>

                              {jiraIntegration && (
                                <div className="mb-6 p-4 bg-green-50 border-2 border-green-400 rounded-lg shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        <span className="font-semibold text-green-900 text-lg">✓ Jira Integration Active</span>
                                      </div>
                                      <div className="space-y-1 text-sm text-green-800">
                                        <p>
                                          <span className="font-medium">Jira URL:</span> {jiraIntegration.jiraUrl || 'Not set'}
                                        </p>
                                        <p>
                                          <span className="font-medium">Email:</span> {jiraIntegration.email || 'Not set'}
                                        </p>
                                        <p>
                                          <span className="font-medium">Project:</span> {jiraIntegration.projectKey || 'Not set'} | 
                                          <span className="font-medium"> Issue Type:</span> {jiraIntegration.issueType || 'Not set'}
                                        </p>
                                        {jiraIntegration.lastVerifiedAt && (
                                          <p className="text-xs text-green-600 mt-2">
                                            Last verified: {new Date(jiraIntegration.lastVerifiedAt).toLocaleString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={handleJiraDisconnect}
                                      className="ml-4 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md border border-red-200"
                                      disabled={saving}
                                    >
                                      Disconnect
                                    </button>
                                  </div>
                                </div>
                              )}

                              {jiraStep === 'credentials' && (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Jira URL
                                    </label>
                                    <input
                                      type="url"
                                      className="input-field"
                                      placeholder="https://your-domain.atlassian.net"
                                      value={jiraForm.jiraUrl}
                                      onChange={(e) => setJiraForm({ ...jiraForm, jiraUrl: e.target.value })}
                                      key={`jira-url-${jiraIntegration?.id || 'new'}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Email
                                    </label>
                                    <input
                                      type="email"
                                      className="input-field"
                                      placeholder="your-email@example.com"
                                      value={jiraForm.email}
                                      onChange={(e) => setJiraForm({ ...jiraForm, email: e.target.value })}
                                      key={`jira-email-${jiraIntegration?.id || 'new'}`}
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      API Token
                                    </label>
                                    <input
                                      type="password"
                                      className="input-field"
                                      placeholder={jiraIntegration ? "Leave blank to keep existing token" : "Enter your Jira API token"}
                                      value={jiraForm.apiToken}
                                      onChange={(e) => setJiraForm({ ...jiraForm, apiToken: e.target.value })}
                                      key={`jira-token-${jiraIntegration?.id || 'new'}`}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                      {jiraIntegration 
                                        ? "Leave blank to keep your existing token, or enter a new one to update it."
                                        : "Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens"
                                      }
                                      {!jiraIntegration && (
                                        <>
                                          {' '}
                                          <a
                                            href="https://id.atlassian.com/manage-profile/security/api-tokens"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:underline"
                                          >
                                            https://id.atlassian.com/manage-profile/security/api-tokens
                                          </a>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Project (Default) {jiraForm.projectKey && <span className="text-green-600">✓</span>}
                                    </label>
                                    {jiraProjects.length > 0 ? (
                                      <select
                                        className="input-field"
                                        value={jiraForm.projectKey}
                                        onChange={(e) => {
                                          setJiraForm({ ...jiraForm, projectKey: e.target.value })
                                          if (e.target.value) {
                                            loadIssueTypes(e.target.value)
                                          }
                                        }}
                                        key={`jira-project-${jiraIntegration?.id || 'new'}`}
                                      >
                                        <option value="">Select a project...</option>
                                        {jiraProjects.map((project) => (
                                          <option key={project.key} value={project.key}>
                                            {project.displayName}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                        <input
                                          type="text"
                                          className="input-field"
                                          value={jiraForm.projectKey}
                                          placeholder="Project Key (e.g., SCRUM)"
                                          onChange={(e) => setJiraForm({ ...jiraForm, projectKey: e.target.value })}
                                          key={`jira-project-input-${jiraIntegration?.id || 'new'}`}
                                        />
                                    )}
                                    {jiraForm.projectKey && (
                                      <p className="text-xs text-green-600 mt-1">
                                        ✓ Default project: {jiraForm.projectKey} (teams can override this)
                                      </p>
                                    )}
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Issue Type (Optional - Default) {jiraForm.issueType && <span className="text-green-600">✓</span>}
                                    </label>
                                      <select
                                        className="input-field"
                                        value={jiraForm.issueType}
                                        onChange={(e) => setJiraForm({ ...jiraForm, issueType: e.target.value })}
                                        disabled={loadingIssueTypes}
                                        key={`jira-issue-type-${jiraIntegration?.id || 'new'}`}
                                      >
                                        {loadingIssueTypes ? (
                                          <option>Loading issue types...</option>
                                        ) : (
                                          <>
                                            {jiraIssueTypes.length > 0 ? (
                                              jiraIssueTypes.map((type) => (
                                                <option key={type.id} value={type.name}>
                                                  {type.name}
                                                </option>
                                              ))
                                            ) : (
                                              <>
                                                <option value="Bug">Bug</option>
                                                <option value="Task">Task</option>
                                                <option value="Story">Story</option>
                                                <option value="Epic">Epic</option>
                                              </>
                                            )}
                                          </>
                                        )}
                                      </select>
                                      {jiraForm.issueType && (
                                        <p className="text-xs text-green-600 mt-1">
                                          ✓ Default issue type: {jiraForm.issueType} (teams can override this)
                                        </p>
                                      )}
                                      {!jiraForm.issueType && (
                                        <p className="text-xs text-gray-500 mt-1">
                                          Optional: If not set, will default to "Bug". Teams can set their own issue type in the Teams section.
                                        </p>
                                      )}
                                    </div>

                                  <div className="flex space-x-3">
                                    {!jiraIntegration && (
                                      <button
                                        onClick={testJiraConnection}
                                        className="btn-primary flex items-center space-x-2"
                                        disabled={testingConnection || !jiraForm.jiraUrl || !jiraForm.email || !jiraForm.apiToken}
                                      >
                                        {testingConnection ? (
                                          <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Testing...</span>
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle className="h-4 w-4" />
                                            <span>Test Connection</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                    {(jiraIntegration || jiraForm.projectKey) && (
                                      <button
                                        onClick={handleJiraSave}
                                        className="btn-primary flex items-center space-x-2"
                                        disabled={saving || !jiraForm.projectKey || !jiraForm.jiraUrl || !jiraForm.email}
                                      >
                                        <Save className="h-4 w-4" />
                                        <span>{saving ? 'Saving...' : jiraIntegration ? 'Update Integration' : 'Save Integration'}</span>
                                      </button>
                                    )}
                                    {jiraIntegration && (
                                      <button
                                        onClick={testJiraConnection}
                                        className="btn-secondary flex items-center space-x-2"
                                        disabled={testingConnection || !jiraForm.jiraUrl || !jiraForm.email || (!jiraForm.apiToken && !jiraIntegration)}
                                      >
                                        {testingConnection ? (
                                          <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Testing...</span>
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle className="h-4 w-4" />
                                            <span>Test Connection</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}

                              {jiraStep === 'project' && (
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                      Select Project
                                    </label>
                                    <select
                                      className="input-field"
                                      value={jiraForm.projectKey}
                                      onChange={(e) => handleJiraProjectChange(e.target.value)}
                                    >
                                      <option value="">Select a project...</option>
                                      {jiraProjects.map((project) => (
                                        <option key={project.key} value={project.key}>
                                          {project.displayName}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                  <div className="flex space-x-3">
                                    <button
                                      onClick={() => setJiraStep('credentials')}
                                      className="btn-secondary"
                                    >
                                      Back
                                    </button>
                                    {jiraForm.projectKey && (
                                      <>
                                        <button
                                          onClick={async () => {
                                            const saveData = { ...jiraForm, issueType: jiraForm.issueType || 'Bug' }
                                            if (!saveData.apiToken && jiraIntegration) {
                                              delete saveData.apiToken
                                            }
                                            
                                            setSaving(true)
                                            try {
                                              const token = localStorage.getItem('accessToken')
                                              const response = await fetch('/api/jira/settings', {
                                                method: 'POST',
                                                headers: {
                                                  'Content-Type': 'application/json',
                                                  'Authorization': `Bearer ${token}`
                                                },
                                                body: JSON.stringify(saveData)
                                              })
                                              
                                              const data = await response.json()
                                              if (data.success) {
                                                setMessage({ type: 'success', text: 'Jira integration saved successfully' })
                                                setJiraForm(prev => ({ ...prev, apiToken: '' }))
                                                await loadJiraIntegration()
                                                setJiraStep('credentials')
                                              } else {
                                                setMessage({ type: 'error', text: data.error || 'Failed to save Jira integration' })
                                              }
                                            } catch (error) {
                                              setMessage({ type: 'error', text: 'Failed to save Jira integration' })
                                            } finally {
                                              setSaving(false)
                                            }
                                          }}
                                          className="btn-primary flex items-center space-x-2"
                                          disabled={saving || !jiraForm.projectKey || !jiraForm.jiraUrl || !jiraForm.email}
                                        >
                                          <Save className="h-4 w-4" />
                                          <span>{saving ? 'Saving...' : 'Save Integration'}</span>
                                        </button>
                                        <button
                                          onClick={() => {
                                            if (jiraForm.projectKey) {
                                              loadIssueTypes(jiraForm.projectKey)
                                            }
                                          }}
                                          className="btn-secondary"
                                          disabled={loadingIssueTypes}
                                        >
                                          {loadingIssueTypes ? 'Loading...' : 'Continue to Configure'}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              )}

                              {jiraStep === 'configure' && (
                                <div className="space-y-4">
                                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Jira URL
                                      </label>
                                      <input
                                        type="url"
                                        className="input-field bg-white"
                                        value={jiraForm.jiraUrl}
                                        onChange={(e) => setJiraForm({ ...jiraForm, jiraUrl: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email
                                      </label>
                                      <input
                                        type="email"
                                        className="input-field bg-white"
                                        value={jiraForm.email}
                                        onChange={(e) => setJiraForm({ ...jiraForm, email: e.target.value })}
                                      />
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        API Token
                                      </label>
                                      <input
                                        type="password"
                                        className="input-field bg-white"
                                        placeholder={jiraIntegration ? "Leave blank to keep existing token" : "Enter your Jira API token"}
                                        value={jiraForm.apiToken}
                                        onChange={(e) => setJiraForm({ ...jiraForm, apiToken: e.target.value })}
                                      />
                                      <p className="text-xs text-gray-500 mt-1">
                                        {jiraIntegration 
                                          ? "Leave blank to keep your existing token, or enter a new one to update it."
                                          : "Create an API token at https://id.atlassian.com/manage-profile/security/api-tokens"
                                        }
                                      </p>
                                    </div>
                                  </div>

                                  {jiraForm.projectKey && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Issue Type
                                      </label>
                                      <select
                                        className="input-field"
                                        value={jiraForm.issueType}
                                        onChange={(e) => setJiraForm({ ...jiraForm, issueType: e.target.value })}
                                        disabled={loadingIssueTypes}
                                      >
                                        {loadingIssueTypes ? (
                                          <option>Loading issue types...</option>
                                        ) : (
                                          <>
                                            {jiraIssueTypes.length > 0 ? (
                                              jiraIssueTypes.map((type) => (
                                                <option key={type.id} value={type.name}>
                                                  {type.name}
                                                </option>
                                              ))
                                            ) : (
                                              <option value="Bug">Bug</option>
                                            )}
                                          </>
                                        )}
                                      </select>
                                    </div>
                                  )}
                                  <div className="flex space-x-3">
                                    <button
                                      onClick={handleJiraSave}
                                      className="btn-primary flex items-center space-x-2"
                                      disabled={saving || !jiraForm.projectKey || !jiraForm.jiraUrl || !jiraForm.email}
                                    >
                                      <Save className="h-4 w-4" />
                                      <span>{saving ? 'Saving...' : jiraIntegration ? 'Update Integration' : 'Save Integration'}</span>
                                    </button>
                                    {!jiraIntegration && (
                                      <button
                                        onClick={() => setJiraStep('credentials')}
                                        className="btn-secondary"
                                      >
                                        Back
                                      </button>
                                    )}
                                    {jiraIntegration && (
                                      <button
                                        onClick={testJiraConnection}
                                        className="btn-secondary flex items-center space-x-2"
                                        disabled={testingConnection || !jiraForm.jiraUrl || !jiraForm.email || !jiraForm.apiToken}
                                      >
                                        {testingConnection ? (
                                          <>
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            <span>Testing...</span>
                                          </>
                                        ) : (
                                          <>
                                            <CheckCircle className="h-4 w-4" />
                                            <span>Test Connection</span>
                                          </>
                                        )}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {integrationSubTab === 'azure' && (
                            <div className="card">
                              <h2 className="text-lg font-semibold text-gray-900 mb-4">Azure DevOps Integration</h2>
                              <p className="text-sm text-gray-600 mb-6">
                                Connect your Azure DevOps organization to create work items from accessibility scan results.
                              </p>

                              {azureDevOpsIntegration && (
                                <div className="mb-6 p-4 bg-green-50 border-2 border-green-400 rounded-lg shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center space-x-2 mb-2">
                                        <CheckCircle className="h-5 w-5 text-green-600" />
                                        <span className="font-semibold text-green-900 text-lg">✓ Azure DevOps Integration Active</span>
                                      </div>
                                      <div className="space-y-1 text-sm text-green-800">
                                        <p>
                                          <span className="font-medium">Organization:</span> {azureDevOpsIntegration.organization || 'Not set'}
                                        </p>
                                        <p>
                                          <span className="font-medium">Project:</span> {azureDevOpsIntegration.project || 'Not set'} | 
                                          <span className="font-medium"> Work Item Type:</span> {azureDevOpsIntegration.workItemType || 'Not set'}
                                        </p>
                                        {azureDevOpsIntegration.lastVerifiedAt && (
                                          <p className="text-xs text-green-600 mt-2">
                                            Last verified: {new Date(azureDevOpsIntegration.lastVerifiedAt).toLocaleString()}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    <button
                                      onClick={handleAzureDevOpsDisconnect}
                                      className="ml-4 px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-md border border-red-200"
                                      disabled={saving}
                                    >
                                      Disconnect
                                    </button>
                                  </div>
                                </div>
                              )}

                              <div className="space-y-4">
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Organization
                                  </label>
                                  <input
                                    type="text"
                                    className="input-field"
                                    placeholder="a11ytest"
                                    value={azureDevOpsForm.organization}
                                    onChange={(e) => setAzureDevOpsForm({ ...azureDevOpsForm, organization: e.target.value })}
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Your Azure DevOps organization name (e.g., "a11ytest" from https://dev.azure.com/a11ytest)
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Personal Access Token (PAT)
                                  </label>
                                  <input
                                    type="password"
                                    className="input-field"
                                    placeholder={azureDevOpsIntegration ? "Leave blank to keep existing token" : "Enter your Azure DevOps PAT"}
                                    value={azureDevOpsForm.pat}
                                    onChange={(e) => setAzureDevOpsForm({ ...azureDevOpsForm, pat: e.target.value })}
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    {azureDevOpsIntegration 
                                      ? "Leave blank to keep your existing token, or enter a new one to update it."
                                      : "Create a PAT at https://dev.azure.com/{organization}/_usersSettings/tokens with 'Work Items (Read & Write)' scope"}
                                    {!azureDevOpsIntegration && (
                                      <>
                                        {' '}
                                        <a
                                          href={`https://dev.azure.com/${azureDevOpsForm.organization || 'your-org'}/_usersSettings/tokens`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-blue-600 hover:underline"
                                        >
                                          Create PAT
                                        </a>
                                      </>
                                    )}
                                  </p>
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Project (Default) {azureDevOpsForm.project && <span className="text-green-600">✓</span>}
                                  </label>
                                  {azureDevOpsProjects && azureDevOpsProjects.length > 0 ? (
                                    <select
                                      className="input-field"
                                      value={azureDevOpsForm.project}
                                      onChange={(e) => handleAzureDevOpsProjectChange(e.target.value)}
                                      disabled={loadingAzureDevOpsProjects}
                                    >
                                      <option value="">Select a project...</option>
                                      {azureDevOpsProjects.map((project) => (
                                        <option key={project.id} value={project.name}>
                                          {project.displayName || project.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <input
                                      type="text"
                                      className="input-field"
                                      value={azureDevOpsForm.project}
                                      placeholder="Project Name (e.g., A11ytest Scrm)"
                                      onChange={(e) => setAzureDevOpsForm({ ...azureDevOpsForm, project: e.target.value })}
                                    />
                                  )}
                                  {azureDevOpsForm.project && (
                                    <p className="text-xs text-green-600 mt-1">
                                      ✓ Default project: {azureDevOpsForm.project} (teams can override this)
                                    </p>
                                  )}
                                  {(!azureDevOpsProjects || azureDevOpsProjects.length === 0) && !azureDevOpsForm.project && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      Test connection to load available projects. This will be used as a default if teams don't have a project assigned.
                                    </p>
                                  )}
                                  {azureDevOpsProjects && azureDevOpsProjects.length > 0 && (
                                    <p className="text-xs text-blue-600 mt-1">
                                      ✓ {azureDevOpsProjects.length} project(s) loaded - select from dropdown above
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Work Item Type (Optional - Default) {azureDevOpsForm.workItemType && <span className="text-green-600">✓</span>}
                                  </label>
                                  <input
                                    type="text"
                                    className="input-field"
                                    value={azureDevOpsForm.workItemType || ''}
                                    onChange={(e) => setAzureDevOpsForm({ ...azureDevOpsForm, workItemType: e.target.value })}
                                    placeholder="e.g., Bug, Task, Product Backlog Item, Issue"
                                  />
                                  <p className="text-xs text-gray-500 mt-1">
                                    Optional: Enter the default work item type name. Teams can override this with their own work item type. 
                                    Common types: Bug, Task, Product Backlog Item, User Story, Issue, Epic, Feature.
                                  </p>
                                  {azureDevOpsForm.workItemType && (
                                    <p className="text-xs text-green-600 mt-1">
                                      ✓ Default work item type: {azureDevOpsForm.workItemType} (teams can override this)
                                    </p>
                                  )}
                                  {!azureDevOpsForm.workItemType && (
                                    <p className="text-xs text-gray-500 mt-1">
                                      If not set, will default to "Bug". Teams can set their own work item type in the Teams section.
                                    </p>
                                  )}
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Area Path (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    className="input-field"
                                    value={azureDevOpsForm.areaPath}
                                    placeholder="MyProject\\Area\\Path"
                                    onChange={(e) => setAzureDevOpsForm({ ...azureDevOpsForm, areaPath: e.target.value })}
                                  />
                                </div>
                                <div>
                                  <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Iteration Path (Optional)
                                  </label>
                                  <input
                                    type="text"
                                    className="input-field"
                                    value={azureDevOpsForm.iterationPath}
                                    placeholder="MyProject\\Iteration\\Sprint1"
                                    onChange={(e) => setAzureDevOpsForm({ ...azureDevOpsForm, iterationPath: e.target.value })}
                                  />
                                </div>
                                <div className="flex space-x-3">
                                  {!azureDevOpsIntegration && (
                                    <button
                                      onClick={testAzureDevOpsConnection}
                                      className="btn-primary flex items-center space-x-2"
                                      disabled={testingAzureDevOpsConnection || !azureDevOpsForm.organization || !azureDevOpsForm.pat}
                                    >
                                      {testingAzureDevOpsConnection ? (
                                        <>
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          <span>Testing...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle className="h-4 w-4" />
                                          <span>Test Connection</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                  {(azureDevOpsIntegration || azureDevOpsForm.project) && (
                                    <button
                                      onClick={handleAzureDevOpsSave}
                                      className="btn-primary flex items-center space-x-2"
                                      disabled={saving || !azureDevOpsForm.project || !azureDevOpsForm.organization}
                                    >
                                      <Save className="h-4 w-4" />
                                      <span>{saving ? 'Saving...' : azureDevOpsIntegration ? 'Update Integration' : 'Save Integration'}</span>
                                    </button>
                                  )}
                                  {azureDevOpsIntegration && (
                                    <button
                                      onClick={testAzureDevOpsConnection}
                                      className="btn-secondary flex items-center space-x-2"
                                      disabled={testingAzureDevOpsConnection || !azureDevOpsForm.organization || (!azureDevOpsForm.pat && !azureDevOpsIntegration)}
                                    >
                                      {testingAzureDevOpsConnection ? (
                                        <>
                                          <Loader2 className="h-4 w-4 animate-spin" />
                                          <span>Testing...</span>
                                        </>
                                      ) : (
                                        <>
                                          <CheckCircle className="h-4 w-4" />
                                          <span>Test Connection</span>
                                        </>
                                      )}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {activeTab === 'billing' && (
                        <BillingTab organization={currentOrg} />
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>

      {/* Removed Create Organization Modal - users can only have one organization */}

      {/* Invite User Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Invite Member</h2>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as 'user' | 'admin')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowInviteModal(false)
                  setInviteEmail('')
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteUser}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Send Invitation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Team Modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Create Team</h2>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              placeholder="Team name"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
            />
            <textarea
              value={newTeamDescription}
              onChange={(e) => setNewTeamDescription(e.target.value)}
              placeholder="Description (optional)"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-4"
              rows={3}
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowCreateTeam(false)
                  setNewTeamName('')
                  setNewTeamDescription('')
                }}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTeam}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  )
}

// Billing Tab Component
function BillingTab({ organization }: { organization: Organization | null }) {
  const [billingStatus, setBillingStatus] = useState<{ 
    canAdd: boolean; 
    currentUsers: number; 
    maxUsers: number;
    pricing?: {
      monthly?: { priceId: string; amount: number; currency: string };
      yearly?: { priceId: string; amount: number; currency: string };
    };
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingUsers, setAddingUsers] = useState(false)
  const [usersToAdd, setUsersToAdd] = useState(1)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')

  useEffect(() => {
    if (organization) {
      loadBillingStatus()
    }
  }, [organization])

  // Reload billing status when returning from checkout
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const success = urlParams.get('success')
    if (success === 'true' && organization) {
      // Reload billing status after a short delay to allow webhook to process
      setTimeout(() => {
        loadBillingStatus()
      }, 2000)
    }
  }, [organization])

  const loadBillingStatus = async () => {
    if (!organization) return
    
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch(`/api/organization/billing/checkout?organization_id=${organization.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await response.json()
      if (data.success) {
        setBillingStatus(data)
      }
    } catch (error) {
      console.error('Error loading billing status:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddUsers = async () => {
    if (!organization || !usersToAdd || usersToAdd < 1) return

    setAddingUsers(true)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/organization/billing/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organizationId: organization.id,
          numberOfUsers: usersToAdd,
          billingPeriod: billingPeriod
        })
      })

      const data = await response.json()
      if (data.success && data.url) {
        // If sessionId is 'immediate', seats were added directly - just reload
        if (data.sessionId === 'immediate') {
          loadBillingStatus()
          alert('Users added successfully!')
        } else {
          window.location.href = data.url
        }
      } else {
        // Show user-friendly error message
        const errorMsg = data.error || 'Failed to create checkout session'
        if (errorMsg.includes('must have an active') || errorMsg.includes('Please subscribe first')) {
          alert('You need to have an active monthly or yearly subscription before you can add users to your organization. Please subscribe first.')
        } else {
          alert(errorMsg)
        }
      }
    } catch (error) {
      alert('An error occurred')
    } finally {
      setAddingUsers(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Billing & Users</h3>
        <p className="text-gray-600">Manage your organization's user limits and billing</p>
      </div>

      {billingStatus && (
        <div className="bg-gray-50 rounded-lg p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div>
              <div className="text-sm text-gray-600">Active Users</div>
              <div className="text-2xl font-bold text-gray-900">{billingStatus.currentUsers}</div>
              <div className="text-xs text-gray-500 mt-1">(Owner is free)</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Max Users</div>
              <div className="text-2xl font-bold text-gray-900">{billingStatus.maxUsers}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600">Available Slots</div>
              <div className="text-2xl font-bold text-gray-900">
                {Math.max(0, billingStatus.maxUsers - billingStatus.currentUsers)}
              </div>
            </div>
          </div>

          {!billingStatus.canAdd && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-800 font-medium mb-1">
                    You've reached your user limit ({billingStatus.currentUsers}/{billingStatus.maxUsers}).
                  </p>
                  <p className="text-sm text-yellow-700">
                    You can still invite users for free! They'll receive an invitation email, but they'll need to wait until you add more seats before they can accept and join.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="border-t border-gray-200 pt-6">
            <h4 className="font-semibold text-gray-900 mb-4">Add Users</h4>
            
            {/* Subscription Requirement Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <div className="flex items-start">
                <AlertCircle className="h-5 w-5 text-blue-600 mr-2 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm text-blue-800 font-medium mb-1">
                    Subscription Required
                  </p>
                  <p className="text-sm text-blue-700">
                    You must have an active monthly or yearly subscription before you can add users to your organization. 
                    <a href="/pricing" className="text-blue-600 hover:text-blue-800 underline ml-1">
                      Subscribe now
                    </a>
                  </p>
                </div>
              </div>
            </div>
            
            {/* Billing Period Selector */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Billing Period
              </label>
              <div className="flex space-x-4">
                <button
                  type="button"
                  onClick={() => setBillingPeriod('monthly')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    billingPeriod === 'monthly'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold">Monthly</div>
                  {billingStatus?.pricing?.monthly && (
                    <div className="text-xs mt-1">
                      ${billingStatus.pricing.monthly.amount.toFixed(2)}/user/month
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setBillingPeriod('yearly')}
                  className={`flex-1 px-4 py-2 rounded-lg border-2 transition-colors ${
                    billingPeriod === 'yearly'
                      ? 'border-primary-600 bg-primary-50 text-primary-700'
                      : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400'
                  }`}
                >
                  <div className="font-semibold">Yearly</div>
                  {billingStatus?.pricing?.yearly && (
                    <div className="text-xs mt-1">
                      ${billingStatus.pricing.yearly.amount.toFixed(2)}/user/year
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Number of Users Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Number of Users
              </label>
              <div className="flex items-center space-x-4">
                <input
                  type="number"
                  min="1"
                  value={usersToAdd}
                  onChange={(e) => setUsersToAdd(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
                />
                <span className="text-gray-600">users</span>
              </div>
            </div>

            {/* Total Amount Display */}
            {billingStatus?.pricing && (
              <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-700">Total Amount:</span>
                  <span className="text-2xl font-bold text-gray-900">
                    {billingPeriod === 'monthly' && billingStatus.pricing.monthly
                      ? `$${(billingStatus.pricing.monthly.amount * usersToAdd).toFixed(2)}`
                      : billingPeriod === 'yearly' && billingStatus.pricing.yearly
                      ? `$${(billingStatus.pricing.yearly.amount * usersToAdd).toFixed(2)}`
                      : '$0.00'}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  {billingPeriod === 'monthly' 
                    ? `Billed monthly: ${usersToAdd} × $${billingStatus.pricing.monthly?.amount.toFixed(2) || '0.00'} = $${((billingStatus.pricing.monthly?.amount || 0) * usersToAdd).toFixed(2)}`
                    : `Billed yearly: ${usersToAdd} × $${billingStatus.pricing.yearly?.amount.toFixed(2) || '0.00'} = $${((billingStatus.pricing.yearly?.amount || 0) * usersToAdd).toFixed(2)}`}
                </div>
              </div>
            )}

            {/* Add Users Button */}
            <button
              onClick={handleAddUsers}
              disabled={addingUsers}
              className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {addingUsers ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Users
                </>
              )}
            </button>
            <p className="text-sm text-gray-600 mt-2">
              You'll be redirected to Stripe to complete the payment
            </p>
            
            {/* Manual refresh button */}
            <button
              onClick={() => {
                loadBillingStatus()
                setMessage({ type: 'info', text: 'Refreshing billing status...' })
              }}
              className="mt-4 text-sm text-primary-600 hover:text-primary-700 underline"
            >
              Refresh Status
            </button>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <CreditCard className="h-5 w-5 text-blue-600 mr-2 mt-0.5" />
          <div>
            <h4 className="font-semibold text-blue-900 mb-1">Billing Information</h4>
            <p className="text-sm text-blue-800">
              User seats are billed monthly or yearly based on your subscription plan. 
              Each additional user gives access to shared credits, team integrations, and collaborative features.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

