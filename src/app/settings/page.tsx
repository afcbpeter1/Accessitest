'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Settings, CreditCard, User, Bell, Shield, LogOut, Save, AlertCircle } from 'lucide-react'
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

  // Load user data on component mount
  useEffect(() => {
    loadUserData()
    loadNotificationPreferences()
  }, [])

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
      if (data.success) {
        setNotificationPrefs(data.preferences)
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
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

    if (passwordForm.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'New password must be at least 8 characters long' })
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
      router.push('/home')
    }
  }

  const getPlanDisplayName = (plan: string) => {
    switch (plan) {
      case 'free': return 'Free Trial'
      case 'web_only': return 'Web Only'
      case 'document_only': return 'Document Only'
      case 'complete_access': return 'Complete Access'
      default: return 'Free Trial'
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
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {user ? getPlanDisplayName(user.plan) : 'Free Trial'}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {user ? getPlanDescription(user.plan) : '3 free credits to get started'}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                    {user && (
                      <div className="mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Credits Remaining:</span>
                          <span className="font-medium">
                            {user.unlimitedCredits ? 'Unlimited' : user.creditsRemaining}
                          </span>
                        </div>
                        {!user.unlimitedCredits && (
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Credits Used:</span>
                            <span className="font-medium">{user.creditsUsed}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-600">Member Since:</span>
                          <span className="font-medium">
                            {new Date(user.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {user && user.plan === 'free' && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-gray-900">Upgrade Options:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="border border-gray-200 rounded-lg p-4">
                          <h5 className="font-medium text-gray-900">Web Only</h5>
                          <p className="text-sm text-gray-600 mt-1">Unlimited web scans</p>
                          <p className="text-lg font-semibold text-primary-600 mt-2">$29/month</p>
                        </div>
                        <div className="border border-gray-200 rounded-lg p-4">
                          <h5 className="font-medium text-gray-900">Document Only</h5>
                          <p className="text-sm text-gray-600 mt-1">Unlimited document scans</p>
                          <p className="text-lg font-semibold text-primary-600 mt-2">$29/month</p>
                        </div>
                        <div className="border border-primary-200 rounded-lg p-4 bg-primary-50">
                          <h5 className="font-medium text-gray-900">Complete Access</h5>
                          <p className="text-sm text-gray-600 mt-1">All features included</p>
                          <p className="text-lg font-semibold text-primary-600 mt-2">$59/month</p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex space-x-3">
                    {user && user.plan === 'free' ? (
                      <button className="btn-primary">Upgrade Plan</button>
                    ) : (
                      <button className="btn-secondary">Manage Subscription</button>
                    )}
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
                      checked={notificationPrefs.scanCompletion}
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
                      checked={notificationPrefs.criticalIssues}
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
                      checked={notificationPrefs.weeklyReports}
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
                      checked={notificationPrefs.securityAlerts}
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

            {activeTab === 'security' && (
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
                    <p className="text-xs text-gray-500 mt-1">Password must be at least 8 characters long</p>
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
            )}
          </div>
        </div>
      </div>
    </Sidebar>
  )
}



