'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { 
  Building2, Users, CreditCard, Settings, Plus, Mail, 
  UserPlus, Trash2, Edit, Crown, Shield, User, 
  ChevronDown, X, Check, AlertCircle, Loader2, ExternalLink, CheckCircle
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
  const [activeTab, setActiveTab] = useState<'overview' | 'members' | 'teams' | 'billing'>('overview')
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

  useEffect(() => {
    loadOrganizations()
    
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
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Role</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {currentOrg.members.map((member) => (
                                  <tr key={member.id}>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      {member.first_name} {member.last_name}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">{member.email}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center">
                                        {getRoleIcon(member.role)}
                                        <span className="ml-2 capitalize">{member.role}</span>
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                                      {new Date(member.joined_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <div className="flex items-center space-x-2">
                                        {member.role !== 'owner' && (
                                          <>
                                            <select
                                              value={member.role}
                                              onChange={(e) => handleUpdateRole(member.user_id, e.target.value as 'owner' | 'admin' | 'user')}
                                              className="text-sm border border-gray-300 rounded px-2 py-1"
                                            >
                                              <option value="user">User</option>
                                              <option value="admin">Admin</option>
                                              <option value="owner">Owner</option>
                                            </select>
                                            <button
                                              onClick={() => handleRemoveMember(member.user_id)}
                                              className="text-red-600 hover:text-red-800"
                                              title="Remove member"
                                            >
                                              <Trash2 className="h-5 w-5" />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                ))}
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
                                  <div className="flex items-center justify-between">
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
                                </div>
                              ))}
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
  const [billingStatus, setBillingStatus] = useState<{ canAdd: boolean; currentUsers: number; maxUsers: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [addingUsers, setAddingUsers] = useState(false)
  const [usersToAdd, setUsersToAdd] = useState(1)

  useEffect(() => {
    if (organization) {
      loadBillingStatus()
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
          numberOfUsers: usersToAdd
        })
      })

      const data = await response.json()
      if (data.success && data.url) {
        window.location.href = data.url
      } else {
        alert(data.error || 'Failed to create checkout session')
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
            <div className="flex items-center space-x-4">
              <input
                type="number"
                min="1"
                value={usersToAdd}
                onChange={(e) => setUsersToAdd(parseInt(e.target.value) || 1)}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg"
              />
              <span className="text-gray-600">users</span>
              <button
                onClick={handleAddUsers}
                disabled={addingUsers}
                className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
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
            </div>
            <p className="text-sm text-gray-600 mt-2">
              You'll be redirected to Stripe to complete the payment
            </p>
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

