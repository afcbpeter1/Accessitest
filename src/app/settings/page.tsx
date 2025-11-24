'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Settings, CreditCard, User, Bell, Shield, LogOut, Save, AlertCircle, X, CheckCircle } from 'lucide-react'
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

  // Load subscription when subscription tab is active and user has subscription
  useEffect(() => {
    if (activeTab === 'subscription' && user && user.plan !== 'free') {
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
      if (data.success) {
        setNotificationPrefs(data.preferences)
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error)
    }
  }

  const loadSubscription = async () => {
    setLoadingSubscription(true)
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/subscription', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setSubscription(data.subscription)
      }
    } catch (error) {
      console.error('Failed to load subscription:', error)
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
          text: 'Subscription reactivated successfully!' 
        })
        // Reload subscription to show updated status
        await loadSubscription()
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
      router.push('/login')
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
                  {user && user.plan === 'free' ? (
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
                            <span className="font-medium">{user.creditsRemaining}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Credits Used:</span>
                            <span className="font-medium">{user.creditsUsed}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-600">Member Since:</span>
                            <span className="font-medium">
                              {new Date(user.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                      
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
                            <h5 className="font-medium text-gray-900">Unlimited Access</h5>
                            <p className="text-sm text-gray-600 mt-1">All features included</p>
                            <p className="text-lg font-semibold text-primary-600 mt-2">$59/month</p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex space-x-3">
                        <Link href="/pricing" className="btn-primary">Upgrade Plan</Link>
                      </div>
                    </>
                  ) : (
                    <>
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
                              {subscription.nextBillingDate && !subscription.cancelAtPeriodEnd && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">Next Billing Date:</span>
                                  <span className="font-medium">
                                    {new Date(subscription.nextBillingDate).toLocaleDateString('en-US', {
                                      year: 'numeric',
                                      month: 'long',
                                      day: 'numeric'
                                    })}
                                  </span>
                                </div>
                              )}
                              {subscription.currentPeriodEnd && (
                                <div className="flex justify-between text-sm">
                                  <span className="text-gray-600">
                                    {subscription.cancelAtPeriodEnd ? 'Access Ends:' : 'Current Period Ends:'}
                                  </span>
                                  <span className="font-medium">
                                    {new Date(subscription.currentPeriodEnd).toLocaleDateString('en-US', {
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
                        </>
                      ) : (
                        <div className="border border-gray-200 rounded-lg p-4">
                          <p className="text-sm text-gray-600">No active subscription found.</p>
                        </div>
                      )}
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



