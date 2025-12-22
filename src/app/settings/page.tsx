'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings, CreditCard, User, Bell, Shield, LogOut, Save, AlertCircle, X, CheckCircle, ExternalLink, Loader2 } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

interface UserData {
  id: string
  email: string
  firstName: string
  lastName: string
  name: string
  company?: string
  plan: string
  creditsRemaining: number
  creditsUsed: number
  unlimitedCredits: boolean
  emailVerified: boolean
  createdAt: string
  lastLogin?: string
  subscription?: {
    id: string
    status: string
    billingPeriod: string
    cancelAtPeriodEnd: boolean
    currentPeriodEnd: string | null
  } | null
}

interface SubscriptionData {
  id: string
  status: string
  planName: string
  amount: string
  billingPeriod: string
  nextBillingDate: string | null
  accessEndDate: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
}

interface NotificationPreferences {
  scanCompletion: boolean
  criticalIssues: boolean
  weeklyReports: boolean
  securityAlerts: boolean
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account')
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loadingSubscription, setLoadingSubscription] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>({
    scanCompletion: true,
    criticalIssues: true,
    weeklyReports: false,
    securityAlerts: true
  })
  const router = useRouter()

  const tabs = [
    { id: 'account', name: 'Account', icon: User },
    { id: 'subscription', name: 'Subscription', icon: CreditCard },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'integrations', name: 'Integrations', icon: Settings },
    { id: 'security', name: 'Security', icon: Shield },
  ]

  // Form states
  const [accountForm, setAccountForm] = useState({
    firstName: '',
    lastName: '',
    company: ''
  })

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  })

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
  const [azureDevOpsProjects, setAzureDevOpsProjects] = useState<any[]>([])
  const [azureDevOpsWorkItemTypes, setAzureDevOpsWorkItemTypes] = useState<any[]>([])
  const [testingAzureDevOpsConnection, setTestingAzureDevOpsConnection] = useState(false)
  const [loadingAzureDevOpsProjects, setLoadingAzureDevOpsProjects] = useState(false)
  const [loadingAzureDevOpsWorkItemTypes, setLoadingAzureDevOpsWorkItemTypes] = useState(false)

  // Load user data on component mount
  useEffect(() => {
    loadUserData()
    loadNotificationPreferences()
    loadJiraIntegration()
    loadAzureDevOpsIntegration()
  }, [])

  // Load integrations when integrations tab is active
  useEffect(() => {
    if (activeTab === 'integrations') {
      // Load immediately when tab becomes active
      loadJiraIntegration()
      if (integrationSubTab === 'azure') {
        loadAzureDevOpsIntegration()
      }
    }
  }, [activeTab, integrationSubTab])

  // Load subscription when subscription tab is active
  // Always try to load subscription - it will return null if user doesn't have one
  useEffect(() => {
    if (activeTab === 'subscription') {
      loadSubscription()
    }
  }, [activeTab, user])

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        router.push('/login')
        return
      }

      const response = await fetch('/api/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setUser(data.user)
        setAccountForm({
          firstName: data.user.firstName,
          lastName: data.user.lastName,
          company: data.user.company || ''
        })
      } else {
        setMessage({ type: 'error', text: 'Failed to load user data' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to load user data' })
    } finally {
      setLoading(false)
    }
  }

  const loadNotificationPreferences = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success && data.preferences) {
        setNotificationPrefs({
          scanCompletion: data.preferences.scanCompletion ?? true,
          criticalIssues: data.preferences.criticalIssues ?? true,
          weeklyReports: data.preferences.weeklyReports ?? false,
          securityAlerts: data.preferences.securityAlerts ?? true
        })
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
    }
  }

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
        // Set integration state first
        setJiraIntegration(data.integration)
        
        // Force populate form with saved values - this ensures UI shows the data
        setJiraForm({
          jiraUrl: data.integration.jiraUrl || '',
          email: data.integration.email || '',
          apiToken: '', // Never load token from DB for security
          projectKey: data.integration.projectKey || '',
          issueType: data.integration.issueType || 'Bug',
          autoSyncEnabled: data.integration.autoSyncEnabled ?? false
        })
        
        // Always show credentials step so user can see all fields
        setJiraStep('credentials')
        
        // If we have a saved project, try to load issue types for the dropdown
        if (data.integration.projectKey) {
          loadIssueTypes(data.integration.projectKey).catch(() => {
            // Silently fail - user can still select from defaults
          })
        }
      } else {
        // No integration found - only reset if form is empty
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
      
      // If API token is empty but we have an existing integration, don't send it (keep existing encrypted one)
      const saveData = { ...jiraForm }
      if (!saveData.apiToken && jiraIntegration) {
        // Don't include apiToken in the request if it's empty and integration exists
        // The backend will keep the existing encrypted token
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
        // Clear API token field after save (for security)
        setJiraForm(prev => ({ ...prev, apiToken: '' }))
        await loadJiraIntegration()
        // Always go back to credentials step after saving so user can see/edit all fields
        setJiraStep('credentials')
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
          pat: '', // Never load PAT from DB for security
          workItemType: data.integration.workItemType || 'Bug',
          areaPath: data.integration.areaPath || '',
          iterationPath: data.integration.iterationPath || '',
          autoSyncEnabled: data.integration.autoSyncEnabled ?? false
        })
        
        // If we have a saved project, try to load work item types
        if (data.integration.project) {
          loadAzureDevOpsWorkItemTypes(data.integration.project).catch(() => {
            // Silently fail - user can still select from defaults
          })
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

      const data = await response.json()
      if (data.success) {
        // Store projects from test response
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
      setMessage({ type: 'error', text: 'Failed to test connection' })
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

  const loadAzureDevOpsWorkItemTypes = async (project: string) => {
    setLoadingAzureDevOpsWorkItemTypes(true)
    try {
      const token = localStorage.getItem('accessToken')
      
      // Find project ID from projects list if available
      const projectObj = azureDevOpsProjects.find(p => p.name === project)
      const projectId = projectObj?.id
      
      // Build URL with projectId if available (more reliable)
      let url = `/api/azure-devops/settings/work-item-types?project=${encodeURIComponent(project)}`
      if (projectId) {
        url += `&projectId=${encodeURIComponent(projectId)}`
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setAzureDevOpsWorkItemTypes(data.workItemTypes || [])
      } else {
        console.error('Failed to load work item types:', data.error)
        // Still allow user to proceed with defaults
      }
    } catch (error) {
      console.error('Failed to load work item types:', error)
      // Don't block the user - they can still select from defaults
    } finally {
      setLoadingAzureDevOpsWorkItemTypes(false)
    }
  }

  const handleAzureDevOpsProjectChange = (project: string) => {
    setAzureDevOpsForm({ ...azureDevOpsForm, project })
    if (project) {
      loadAzureDevOpsWorkItemTypes(project)
    } else {
      // Clear work item types when project is cleared
      setAzureDevOpsWorkItemTypes([])
    }
  }

  const handleAzureDevOpsSave = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('accessToken')
      
      // If PAT is empty but we have an existing integration, don't send it (keep existing encrypted one)
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
        // Clear PAT field after save (for security)
        setAzureDevOpsForm(prev => ({ ...prev, pat: '' }))
        await loadAzureDevOpsIntegration()
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
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to disconnect Azure DevOps integration' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to disconnect Azure DevOps integration' })
    } finally {
      setSaving(false)
    }
  }

  const loadSubscription = async () => {
    setLoadingSubscription(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        return
      }

      const response = await fetch('/api/subscription', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      
      if (data.success) {
        setSubscription(data.subscription)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to load subscription details' })
      }
    } catch (error) {
      console.error('❌ Error loading subscription:', error)
      setMessage({ type: 'error', text: 'Failed to load subscription details' })
    } finally {
      setLoadingSubscription(false)
    }
  }

  const handleCancelSubscription = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/subscription', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: 'Your subscription will be cancelled at the end of the current billing period. You will continue to have access until then.' 
        })
        setShowCancelConfirm(false)
        // Reload subscription to show updated status
        await loadSubscription()
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to cancel subscription' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to cancel subscription' })
    } finally {
      setSaving(false)
    }
  }

  const handleReactivateSubscription = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action: 'reactivate' })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ 
          type: 'success', 
          text: 'Subscription reactivated successfully! Your subscription will continue to renew automatically.' 
        })
        // Reload subscription to show updated status - add small delay to ensure Stripe has updated
        setTimeout(async () => {
          await loadSubscription()
        }, 1000)
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to reactivate subscription' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to reactivate subscription' })
    } finally {
      setSaving(false)
    }
  }


  const handleAccountUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/user', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(accountForm)
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Profile updated successfully' })
        // Update user state
        if (user) {
          setUser({
            ...user,
            firstName: accountForm.firstName,
            lastName: accountForm.lastName,
            name: `${accountForm.firstName} ${accountForm.lastName}`,
            company: accountForm.company
          })
        }
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update profile' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update profile' })
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage(null)

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' })
      setSaving(false)
      return
    }

    // Validate password strength
    const passwordValidation = await import('@/lib/password-validation').then(m => m.validatePassword(passwordForm.newPassword))
    if (!passwordValidation.valid) {
      setMessage({ type: 'error', text: passwordValidation.error || 'Password does not meet requirements' })
      setSaving(false)
      return
    }

    try {
      const token = localStorage.getItem('accessToken')
      const response = await fetch('/api/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword
        })
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Password changed successfully' })
        setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to change password' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to change password' })
    } finally {
      setSaving(false)
    }
  }

  const handleNotificationUpdate = async () => {
    setSaving(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!notificationPrefs) {
        setMessage({ type: 'error', text: 'Notification preferences not loaded' })
        setSaving(false)
        return
      }
      
      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(notificationPrefs)
      })

      const data = await response.json()
      if (data.success) {
        setMessage({ type: 'success', text: 'Notification preferences updated successfully' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to update preferences' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update preferences' })
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (token) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local storage and redirect
      localStorage.removeItem('accessToken')
      localStorage.removeItem('user')
      router.push('/login')
    }
  }

  const handleDeleteAccount = async () => {
    setDeletingAccount(true)
    setMessage(null)

    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setMessage({ type: 'error', text: 'Not authenticated' })
        setDeletingAccount(false)
        return
      }

      const response = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()

      if (data.success) {
        // Stop token refresh service
        if (typeof window !== 'undefined') {
          try {
            const { tokenRefreshService } = await import('@/lib/token-refresh-service')
            tokenRefreshService.stop()
          } catch (error) {
            // Ignore if service not available
          }
        }
        
        // Clear all local storage and session storage
        localStorage.clear()
        sessionStorage.clear()
        
        // Immediately redirect to home page after account deletion
        // Using window.location.href ensures a complete page reload and clears all state
        window.location.href = '/home'
        return // Exit early to prevent any further execution
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to delete account' })
        setDeletingAccount(false)
        setShowDeleteConfirm(false)
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      setMessage({ type: 'error', text: 'Failed to delete account' })
      setDeletingAccount(false)
      setShowDeleteConfirm(false)
    }
  }

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case 'free': return 'Pay as You Go'
      case 'web_only': return 'Web Only'
      case 'document_only': return 'Document Only'
      case 'complete_access': return 'Unlimited Access'
      default: return 'Pay as You Go'
    }
  }

  const getPlanDescription = (plan: string) => {
    switch (plan) {
      case 'free': return '3 free credits to get started'
      case 'web_only': return 'Unlimited web accessibility scans'
      case 'document_only': return 'Unlimited document accessibility scans'
      case 'complete_access': return 'Unlimited scans for all content types'
      default: return '3 free credits to get started'
    }
  }

  if (loading) {
    return (
      <Sidebar>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading settings...</p>
          </div>
        </div>
      </Sidebar>
    )
  }

  return (
    <Sidebar>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-800 bg-red-50 hover:bg-red-100 rounded-md transition-colors duration-200"
          >
            <LogOut className="h-4 w-4" />
            <span>Logout</span>
          </button>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`p-4 rounded-md ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 mr-2" />
              {message.text}
            </div>
          </div>
        )}

        <div className="flex space-x-8">
          {/* Sidebar */}
          <div className="w-64">
            <nav className="space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                      activeTab === tab.id
                        ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="mr-3 h-5 w-5" />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            {activeTab === 'account' && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Settings</h2>
                <form onSubmit={handleAccountUpdate} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">First Name</label>
                    <input 
                      type="text" 
                      className="input-field mt-1" 
                      value={accountForm.firstName}
                      onChange={(e) => setAccountForm({...accountForm, firstName: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Name</label>
                    <input 
                      type="text" 
                      className="input-field mt-1" 
                      value={accountForm.lastName}
                      onChange={(e) => setAccountForm({...accountForm, lastName: e.target.value})}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input 
                      type="email" 
                      className="input-field mt-1 bg-gray-50" 
                      value={user?.email || ''}
                      disabled
                    />
                    <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company</label>
                    <input 
                      type="text" 
                      className="input-field mt-1" 
                      value={accountForm.company}
                      onChange={(e) => setAccountForm({...accountForm, company: e.target.value})}
                      placeholder="Optional"
                    />
                  </div>
                  <div className="flex items-center space-x-4">
                    <button 
                      type="submit" 
                      className="btn-primary flex items-center space-x-2"
                      disabled={saving}
                    >
                      <Save className="h-4 w-4" />
                      <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'subscription' && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>
                <div className="space-y-4">
                  {loadingSubscription ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                    </div>
                  ) : subscription ? (
                    <>
                          <div className="border border-gray-200 rounded-lg p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h3 className="text-lg font-medium text-gray-900">{subscription.planName}</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                  {subscription.amount} per {subscription.billingPeriod === 'monthly' ? 'month' : 'year'}
                                </p>
                              </div>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                subscription.cancelAtPeriodEnd 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {subscription.cancelAtPeriodEnd ? 'Cancelling' : 'Active'}
                              </span>
                            </div>

                            {subscription.cancelAtPeriodEnd && subscription.accessEndDate && (
                              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                <div className="flex items-start">
                                  <AlertCircle className="h-5 w-5 text-amber-600 mr-2 mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium text-amber-900">Subscription Cancelled</p>
                                    <p className="text-sm text-amber-700 mt-1">
                                      Your subscription will end on {new Date(subscription.accessEndDate).toLocaleDateString('en-US', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric'
                                      })}. You'll continue to have access until then.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}

                            <div className="space-y-3 pt-4 border-t border-gray-200">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Billing Period:</span>
                                <span className="font-medium capitalize">{subscription.billingPeriod}</span>
                              </div>
                              
                              {/* Current Period - Show as date range like Stripe */}
                              {subscription.currentPeriodStart && subscription.currentPeriodEnd ? (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Current Period:</span>
                                  <span className="font-medium text-gray-900">
                                    {new Date(subscription.currentPeriodStart).toLocaleDateString('en-GB', {
                                      day: 'numeric',
                                      month: 'short'
                                    })} to {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-GB', {
                                      day: 'numeric',
                                      month: 'short'
                                    })}
                                  </span>
                                </div>
                              ) : null}
                              
                              {/* Next Payment Due - Only show if subscription is active and not cancelled */}
                              {!subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Next Payment Due:</span>
                                  <span className="font-medium text-gray-900">
                                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                              )}
                              
                              {/* Subscription Ends - Only show if cancelled */}
                              {subscription.cancelAtPeriodEnd && subscription.accessEndDate && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Subscription Ends:</span>
                                  <span className="font-medium text-amber-700">
                                    {new Date(subscription.accessEndDate).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                              )}
                              
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Status:</span>
                                <span className="font-medium capitalize">{subscription.status}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex flex-col space-y-3">
                            <div className="flex space-x-3">
                              {subscription.cancelAtPeriodEnd ? (
                                <button
                                  onClick={handleReactivateSubscription}
                                  className="btn-primary"
                                  disabled={saving}
                                >
                                  {saving ? 'Reactivating...' : 'Reactivate Subscription'}
                                </button>
                              ) : (
                                <button
                                  onClick={() => setShowCancelConfirm(true)}
                                  className="btn-secondary flex items-center space-x-2"
                                  disabled={saving}
                                >
                                  <X className="h-4 w-4" />
                                  <span>Cancel Subscription</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="text-lg font-medium text-gray-900">Pay as You Go</h3>
                                <p className="text-sm text-gray-500">3 free credits to get started</p>
                              </div>
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                Active
                              </span>
                            </div>
                            <div className="mt-4 space-y-2">
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Credits Remaining:</span>
                                <span className="font-medium">{user?.creditsRemaining || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Credits Used:</span>
                                <span className="font-medium">{user?.creditsUsed || 0}</span>
                              </div>
                              <div className="flex justify-between text-sm">
                                <span className="text-gray-600">Member Since:</span>
                                <span className="font-medium">
                                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex space-x-3">
                            <Link href="/pricing" className="btn-primary">Upgrade Plan</Link>
                          </div>
                        </>
                      )}

                  {/* Cancel Confirmation Modal */}
                  {showCancelConfirm && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Cancel Subscription?</h3>
                        <p className="text-sm text-gray-600 mb-4">
                          Your subscription will remain active until the end of your current billing period. 
                          You'll continue to have full access until {subscription?.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : 'the period ends'}. After that, you'll be switched back to the free plan and can use any saved credits you have.
                        </p>
                        <div className="flex space-x-3 justify-end">
                          <button
                            onClick={() => setShowCancelConfirm(false)}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md"
                            disabled={saving}
                          >
                            Keep Subscription
                          </button>
                          <button
                            onClick={handleCancelSubscription}
                            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md"
                            disabled={saving}
                          >
                            {saving ? 'Cancelling...' : 'Cancel Subscription'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Email Preferences Section */}
                  <div className="mt-8 pt-8 border-t border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Subscription Email Preferences</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      We automatically send you emails for important subscription events. These are transactional emails that help you stay informed about your account.
                    </p>
                    <div className="space-y-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-blue-900 mb-1">Payment Confirmation Emails</h4>
                            <p className="text-sm text-blue-700">
                              You'll receive an email each time your subscription payment is processed (monthly or yearly). 
                              This includes payment details, invoice ID, and your next billing date.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-amber-900 mb-1">Cancellation Emails</h4>
                            <p className="text-sm text-amber-700">
                              If you cancel your subscription, you'll receive an email confirming the cancellation, 
                              when your access ends, and information about any saved credits you have.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-green-900 mb-1">Subscription Activation Emails</h4>
                            <p className="text-sm text-green-700">
                              When you first subscribe, you'll receive a welcome email with your subscription details and receipt.
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                        <p className="text-xs text-gray-600">
                          <strong>Note:</strong> These are transactional emails related to your subscription and payments. 
                          They cannot be disabled as they contain important account information. All emails are sent to: <strong>{user?.email}</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'notifications' && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Notification Preferences</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Scan Completion</h3>
                      <p className="text-sm text-gray-500">Get notified when scans are completed</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={notificationPrefs?.scanCompletion ?? true}
                      onChange={(e) => setNotificationPrefs({...notificationPrefs, scanCompletion: e.target.checked})}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Critical Issues</h3>
                      <p className="text-sm text-gray-500">Get notified about critical accessibility issues</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={notificationPrefs?.criticalIssues ?? true}
                      onChange={(e) => setNotificationPrefs({...notificationPrefs, criticalIssues: e.target.checked})}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Weekly Reports</h3>
                      <p className="text-sm text-gray-500">Receive weekly summary reports</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={notificationPrefs?.weeklyReports ?? false}
                      onChange={(e) => setNotificationPrefs({...notificationPrefs, weeklyReports: e.target.checked})}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Security Alerts</h3>
                      <p className="text-sm text-gray-500">Get notified about security-related events</p>
                    </div>
                    <input 
                      type="checkbox" 
                      checked={notificationPrefs?.securityAlerts ?? true}
                      onChange={(e) => setNotificationPrefs({...notificationPrefs, securityAlerts: e.target.checked})}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" 
                    />
                  </div>
                  <button 
                    onClick={handleNotificationUpdate}
                    className="btn-primary flex items-center space-x-2"
                    disabled={saving}
                  >
                    <Save className="h-4 w-4" />
                    <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
                  </button>
                </div>
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
                      
                      {/* Always show project field if we have saved data or if user is entering new data */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Project {jiraForm.projectKey && <span className="text-green-600">✓</span>}
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
                            ✓ Saved project: {jiraForm.projectKey}
                          </p>
                        )}
                      </div>

                      {/* Always show issue type field if we have saved data or project is selected */}
                      {(jiraForm.projectKey || jiraForm.issueType) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Issue Type {jiraForm.issueType && <span className="text-green-600">✓</span>}
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
                              ✓ Saved issue type: {jiraForm.issueType}
                            </p>
                          )}
                        </div>
                      )}

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
                                // Save with default issue type, then reload to show credentials step
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
                                    setJiraStep('credentials') // Go back to credentials step with all fields
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
                      {/* Show saved credentials (read-only) */}
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
                          Project {azureDevOpsForm.project && <span className="text-green-600">✓</span>}
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
                            ✓ Saved project: {azureDevOpsForm.project}
                          </p>
                        )}
                        {(!azureDevOpsProjects || azureDevOpsProjects.length === 0) && !azureDevOpsForm.project && (
                          <p className="text-xs text-gray-500 mt-1">
                            Test connection to load available projects
                          </p>
                        )}
                        {azureDevOpsProjects && azureDevOpsProjects.length > 0 && (
                          <p className="text-xs text-blue-600 mt-1">
                            ✓ {azureDevOpsProjects.length} project(s) loaded - select from dropdown above
                          </p>
                        )}
                      </div>
                      {(azureDevOpsForm.project || azureDevOpsForm.workItemType) && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Work Item Type {azureDevOpsForm.workItemType && <span className="text-green-600">✓</span>}
                          </label>
                          <select
                            className="input-field"
                            value={azureDevOpsForm.workItemType}
                            onChange={(e) => setAzureDevOpsForm({ ...azureDevOpsForm, workItemType: e.target.value })}
                            disabled={loadingAzureDevOpsWorkItemTypes}
                          >
                            {loadingAzureDevOpsWorkItemTypes ? (
                              <option>Loading work item types...</option>
                            ) : (
                              <>
                                {azureDevOpsWorkItemTypes.length > 0 ? (
                                  azureDevOpsWorkItemTypes.map((type) => (
                                    <option key={type.referenceName} value={type.name}>
                                      {type.name}
                                    </option>
                                  ))
                                ) : (
                                  <>
                                    <option value="Bug">Bug</option>
                                    <option value="Task">Task</option>
                                    <option value="User Story">User Story</option>
                                    <option value="Issue">Issue</option>
                                  </>
                                )}
                              </>
                            )}
                          </select>
                          {azureDevOpsForm.workItemType && (
                            <p className="text-xs text-green-600 mt-1">
                              ✓ Saved work item type: {azureDevOpsForm.workItemType}
                            </p>
                          )}
                        </div>
                      )}
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

            {activeTab === 'security' && (
              <div className="space-y-6">
                <div className="card">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h2>
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Current Password</label>
                      <input 
                        type="password" 
                        className="input-field mt-1" 
                        value={passwordForm.currentPassword}
                        onChange={(e) => setPasswordForm({...passwordForm, currentPassword: e.target.value})}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">New Password</label>
                      <input 
                        type="password" 
                        className="input-field mt-1" 
                        value={passwordForm.newPassword}
                        onChange={(e) => setPasswordForm({...passwordForm, newPassword: e.target.value})}
                        required
                        minLength={8}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                      Password must be at least 8 characters long and contain at least one number and one special character
                    </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                      <input 
                        type="password" 
                        className="input-field mt-1" 
                        value={passwordForm.confirmPassword}
                        onChange={(e) => setPasswordForm({...passwordForm, confirmPassword: e.target.value})}
                        required
                      />
                    </div>
                    <button 
                      type="submit" 
                      className="btn-primary flex items-center space-x-2"
                      disabled={saving}
                    >
                      <Save className="h-4 w-4" />
                      <span>{saving ? 'Changing...' : 'Change Password'}</span>
                    </button>
                  </form>
                </div>

                {/* Delete Account Section */}
                <div className="card border-red-200 bg-red-50">
                  <div className="border-b border-red-200 pb-4 mb-4">
                    <h2 className="text-lg font-semibold text-red-900">Delete Account</h2>
                    <p className="text-sm text-red-700 mt-1">
                      Permanently delete your account and all associated data. This action cannot be undone.
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-white p-4 rounded border border-red-200">
                      <p className="text-sm font-medium text-gray-900 mb-2">This will delete:</p>
                      <ul className="text-sm text-gray-700 space-y-1 list-disc list-inside">
                        <li>Your account and profile information</li>
                        <li>All scan history and results</li>
                        <li>All saved credits and transaction history</li>
                        <li>All notifications and preferences</li>
                        <li>All product backlog items and issues</li>
                        <li>Your active subscription (if any)</li>
                      </ul>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="btn-danger flex items-center space-x-2"
                      disabled={deletingAccount}
                    >
                      <AlertCircle className="h-4 w-4" />
                      <span>{deletingAccount ? 'Deleting...' : 'Delete My Account'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal - Outside tabs so it's always accessible */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
              <h3 className="text-lg font-semibold text-gray-900">Delete Account</h3>
            </div>
            <p className="text-sm text-gray-700 mb-6">
              Are you absolutely sure you want to delete your account? This action cannot be undone and will permanently delete:
            </p>
            <ul className="text-sm text-gray-600 mb-6 space-y-1 list-disc list-inside">
              <li>All your scan history and results</li>
              <li>All saved credits and transaction history</li>
              <li>All notifications and preferences</li>
              <li>All product backlog items and issues</li>
              <li>Your active subscription (if any)</li>
            </ul>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeletingAccount(false)
                }}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                disabled={deletingAccount}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                disabled={deletingAccount}
              >
                {deletingAccount ? 'Deleting...' : 'Yes, Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sidebar>
  )
}



