'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { 
  LayoutDashboard, 
  Plus, 
  FileText, 
  Settings,
  Bell,
  User,
  DollarSign,
  Upload,
  ChevronDown,
  LogOut,
  CreditCard,
  Zap,
  X,
  History,
  AlertTriangle,
  Target,
  Twitter,
  Linkedin,
  Building2,
  Check,
  Menu,
} from 'lucide-react'
import Link from 'next/link'
import { socialLinks } from '@/lib/social-links'

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, current: true },
  { name: 'Web Scan', href: '/new-scan', icon: Plus, current: false },
  { name: 'Document Scan', href: '/document-scan', icon: Upload, current: false },
  { name: 'Product Backlog', href: '/product-backlog', icon: AlertTriangle, current: false },
  { name: 'Sprint Board', href: '/sprint-board', icon: Target, current: false },
  { name: 'Scan History', href: '/scan-history', icon: History, current: false },
  { name: 'Organizations', href: '/organization', icon: Building2, current: false },
  { name: 'Pricing', href: '/pricing', icon: DollarSign, current: false },
  { name: 'Settings', href: '/settings', icon: Settings, current: false },
]

interface SidebarProps {
  children: React.ReactNode
}

interface UserData {
  id: string
  email: string
  firstName: string
  lastName: string
  name: string
  company?: string
  plan: string
  creditsRemaining: number
  unlimitedCredits: boolean
  organizationRole?: 'owner' | 'admin' | 'user' | null
  organizationId?: string | null
}

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error'
  is_read: boolean
  created_at: string
}

interface Organization {
  id: string
  name: string
  role: string
}

export default function Sidebar({ children }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const firstMenuItemRef = useRef<HTMLAnchorElement>(null)

  // Load user data, notifications, and organizations
  useEffect(() => {
    const token = localStorage.getItem('accessToken')
    if (token) {
      loadUserData()
      loadNotifications()
      loadOrganizations()
    } else {
      setLoading(false)
    }
    
    // Listen for refresh events from other components
    const handleRefreshUserData = () => {
      const currentToken = localStorage.getItem('accessToken')
      if (currentToken) {
        loadUserData()
        loadNotifications()
      }
    }
    
    window.addEventListener('refreshUserData', handleRefreshUserData)
    
    // Check if we're returning from a successful purchase (check URL params)
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('success') === 'true') {
      // Refetch user data after a short delay to let webhook process
      setTimeout(() => {
        loadUserData()
        loadNotifications()
      }, 1500)
    }
    
    return () => {
      window.removeEventListener('refreshUserData', handleRefreshUserData)
    }
  }, [])

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.dropdown-container')) {
        setShowUserMenu(false)
        setShowNotifications(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Handle Escape key to close mobile menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && mobileMenuOpen) {
        setMobileMenuOpen(false)
        menuButtonRef.current?.focus()
      }
    }

    if (mobileMenuOpen) {
      document.addEventListener('keydown', handleEscape)
      // Prevent body scroll when menu is open
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [mobileMenuOpen])

  // Focus management for mobile menu
  useEffect(() => {
    if (mobileMenuOpen && firstMenuItemRef.current) {
      // Focus first menu item when menu opens
      setTimeout(() => {
        firstMenuItemRef.current?.focus()
      }, 100)
    }
  }, [mobileMenuOpen])

  const loadOrganizations = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/organization', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      const data = await response.json()
      if (data.success && data.organizations.length > 0) {
        const orgs = data.organizations.map((org: any) => ({
          id: org.id,
          name: org.name,
          role: org.role || 'user'
        }))
        setOrganizations(orgs)
        // Set first org as current, or get from localStorage
        const savedOrgId = localStorage.getItem('currentOrganizationId')
        const savedOrg = orgs.find((o: Organization) => o.id === savedOrgId)
        setCurrentOrg(savedOrg || orgs[0])
      }
    } catch (error) {
      console.error('Failed to load organizations:', error)
    }
  }

  // Removed switchOrganization - users only have one organization

  const loadUserData = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) {
        setLoading(false)
        return // Don't redirect, just don't load user data
      }

      const response = await fetch('/api/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      if (!response.ok) {
        if (response.status === 401) {
          // Token is invalid, remove it and don't load user data
          localStorage.removeItem('accessToken')
          setLoading(false)
          return
        }
        throw new Error('Failed to load user data')
      }

      const data = await response.json()
      if (data.success) {
        setUser(data.user)
      } else {
        console.error('Failed to load user data:', data.error)
      }
    } catch (error) {
      console.error('Failed to load user data:', error)
      // If token is invalid, remove it and don't load user data
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('Invalid or expired token')) {
        localStorage.removeItem('accessToken')
      }
    } finally {
      setLoading(false)
    }
  }

  const loadNotifications = async () => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/notifications?limit=5', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })

      const data = await response.json()
      if (data.success) {
        setNotifications(data.notifications)
        setUnreadCount(data.unreadCount)
      }
    } catch (error) {
      console.error('Failed to load notifications:', error)
    }
  }

  const markNotificationsAsRead = async (notificationIds?: string[]) => {
    try {
      const token = localStorage.getItem('accessToken')
      if (!token) return

      const response = await fetch('/api/notifications', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          notificationIds,
          markAllAsRead: !notificationIds
        })
      })

      if (response.ok) {
        loadNotifications() // Reload notifications
      }
    } catch (error) {
      console.error('Failed to mark notifications as read:', error)
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
      localStorage.removeItem('accessToken')
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

  const getCreditDisplay = () => {
    if (!user) return null
    
    if (user.unlimitedCredits) {
      return (
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
          <div className="flex items-center gap-1 text-green-600 flex-shrink-0">
            <span className="text-lg font-bold">∞</span>
            {user.creditsRemaining > 0 && (
              <span className="text-xs text-gray-500 whitespace-nowrap">({user.creditsRemaining} saved)</span>
            )}
          </div>
          <div className="h-4 w-px bg-gray-300 flex-shrink-0 hidden sm:block" aria-hidden />
          <span className="text-sm text-gray-600 font-medium whitespace-nowrap truncate">
            {getPlanDisplayName(user.plan)}
          </span>
        </div>
      )
    }
    
    return (
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 min-w-0">
        <div className="flex items-center gap-1 text-blue-600 flex-shrink-0">
          <CreditCard className="h-4 w-4" />
          <span className="text-sm font-medium">{user.creditsRemaining}</span>
        </div>
        <div className="h-4 w-px bg-gray-300 flex-shrink-0 hidden sm:block" aria-hidden />
        <span className="text-sm text-gray-600 font-medium whitespace-nowrap truncate">
          {getPlanDisplayName(user.plan)}
        </span>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => {
            setMobileMenuOpen(false)
            menuButtonRef.current?.focus()
          }}
          role="button"
          aria-label="Close menu"
          tabIndex={-1}
        />
      )}

      {/* Sidebar - Hidden on mobile, shown as drawer */}
      <aside 
        className={`
          fixed lg:static inset-y-0 left-0 z-50
          w-64 bg-white shadow-sm flex flex-col border-r border-gray-200
          transform transition-transform duration-300 ease-in-out
          ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
        role="navigation"
        aria-label="Main navigation"
        aria-hidden={!mobileMenuOpen ? 'true' : undefined}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="bg-white p-2 rounded-lg">
              <img 
                src="/allytest.png" 
                alt="A11ytest.ai Logo" 
                className="h-8 w-auto object-contain" 
              />
            </div>
          </div>
          {/* Close button for mobile */}
          <button
            onClick={() => {
              setMobileMenuOpen(false)
              menuButtonRef.current?.focus()
            }}
            className="lg:hidden p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav id="mobile-navigation" className="mt-6 px-3 flex-1" aria-label="Main navigation">
          <div className="space-y-1">
            {navigation
              .filter((item) => {
                // Hide Organizations tab for regular users (only show for owner/admin)
                if (item.name === 'Organizations') {
                  return user?.organizationRole === 'owner' || user?.organizationRole === 'admin'
                }
                return true
              })
              .map((item, index) => {
              const isActive = pathname === item.href
              const isFirstItem = index === 0
              
              return (
                <Link
                  key={item.name}
                  ref={isFirstItem ? firstMenuItemRef : null}
                  href={item.href}
                  onClick={() => {
                    setMobileMenuOpen(false)
                    menuButtonRef.current?.focus()
                  }}
                  className={`group flex items-center px-3 py-3 text-sm font-medium rounded-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    isActive
                      ? 'bg-blue-600 text-white border-r-2 border-blue-400'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon
                    className={`mr-3 h-5 w-5 flex-shrink-0 ${
                      isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-700'
                    }`}
                    aria-hidden="true"
                  />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </div>
        </nav>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-4 overflow-hidden">
          <div className="flex items-center justify-between lg:justify-end gap-2 min-w-0">
            {/* Mobile menu button */}
            <button
              ref={menuButtonRef}
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden flex-shrink-0 p-2 text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded-md min-h-[44px] min-w-[44px] items-center justify-center"
              aria-label="Open menu"
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation"
            >
              <Menu className="h-6 w-6" />
            </button>
            
            <div className="flex items-center flex-wrap justify-end gap-1 sm:gap-2 min-w-0 flex-1">
              {/* Credit Display - Hide on very small screens; allow shrink so header doesn't overflow */}
              {!loading && user && (
                <div className="hidden sm:flex items-center min-w-0 max-w-[160px] sm:max-w-none">
                  {getCreditDisplay()}
                </div>
              )}
              
              {/* Social Media Links - Hide on mobile */}
              <div className="hidden md:flex items-center space-x-2 border-r border-gray-200 pr-4 mr-2">
                <a 
                  href={socialLinks.twitter} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-500 transition-colors"
                  aria-label="Follow us on Twitter"
                  title="Follow us on Twitter"
                >
                  <Twitter className="h-5 w-5" />
                </a>
                <a 
                  href={socialLinks.linkedin} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                  aria-label="Connect with us on LinkedIn"
                  title="Connect with us on LinkedIn"
                >
                  <Linkedin className="h-5 w-5" />
                </a>
              </div>

              {/* Notifications */}
              <div className="relative dropdown-container flex-shrink-0">
                <button 
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 transition-colors relative min-h-[44px] min-w-[44px] rounded-md"
                  aria-label="Notifications"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                
                {/* Notifications Dropdown */}
                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                          <button
                            onClick={() => markNotificationsAsRead()}
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Mark all as read
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          No notifications
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`p-4 border-b border-gray-100 hover:bg-gray-50 ${
                              !notification.is_read ? 'bg-blue-50' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <h4 className="text-sm font-medium text-gray-900">
                                  {notification.title}
                                </h4>
                                <p className="text-sm text-gray-600 mt-1">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-400 mt-2">
                                  {new Date(notification.created_at).toLocaleDateString()}
                                </p>
                              </div>
                              {!notification.is_read && (
                                <div className="w-2 h-2 bg-blue-500 rounded-full ml-2 mt-1"></div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Organization Name (simplified - single org per user); narrow on mobile to prevent overflow */}
              {currentOrg && (
                <div className="flex items-center space-x-1 sm:space-x-2 px-1 sm:px-3 py-2 text-sm text-gray-700 flex-shrink min-w-0 max-w-[80px] sm:max-w-[140px]">
                  <Building2 className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate" title={currentOrg.name}>{currentOrg.name}</span>
                </div>
              )}
              
              {/* User Menu */}
              <div className="relative dropdown-container flex-shrink-0">
                <button 
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center justify-center p-2 text-gray-400 hover:text-gray-600 transition-colors min-h-[44px] min-w-[44px] rounded-md"
                  aria-label="User menu"
                >
                  <User className="h-5 w-5" />
                  <ChevronDown className="h-4 w-4 ml-0.5" />
                </button>
                
                {/* User Menu Dropdown */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-56 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <User className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {user?.name || 'User'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="py-2">
                      <Link
                        href="/settings"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Settings className="h-4 w-4 mr-3" />
                        Settings
                      </Link>
                      <Link
                        href="/pricing"
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <CreditCard className="h-4 w-4 mr-3" />
                        Buy Credits
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <LogOut className="h-4 w-4 mr-3" />
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
