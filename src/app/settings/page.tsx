'use client'

import { useState } from 'react'
import { Settings, CreditCard, User, Bell, Shield, Download } from 'lucide-react'
import Sidebar from '@/components/Sidebar'

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account')

  const tabs = [
    { id: 'account', name: 'Account', icon: User },
    { id: 'subscription', name: 'Subscription', icon: CreditCard },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'security', name: 'Security', icon: Shield },
    { id: 'export', name: 'Export Data', icon: Download },
  ]

  return (
    <Sidebar>
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

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
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Name</label>
                    <input type="text" className="input-field mt-1" defaultValue="John Doe" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" className="input-field mt-1" defaultValue="john@example.com" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Company</label>
                    <input type="text" className="input-field mt-1" defaultValue="Example Corp" />
                  </div>
                  <button className="btn-primary">Save Changes</button>
                </div>
              </div>
            )}

            {activeTab === 'subscription' && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Subscription</h2>
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">Pro Plan</h3>
                        <p className="text-sm text-gray-500">$99/year</p>
                      </div>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Active
                      </span>
                    </div>
                    <div className="mt-4">
                      <p className="text-sm text-gray-600">Next billing date: January 15, 2025</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-900">Plan Features:</h4>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• Unlimited accessibility scans</li>
                      <li>• PDF reports</li>
                      <li>• Priority support</li>
                      <li>• Advanced analytics</li>
                    </ul>
                  </div>
                  <div className="flex space-x-3">
                    <button className="btn-primary">Upgrade Plan</button>
                    <button className="btn-secondary">Cancel Subscription</button>
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
                    <input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Critical Issues</h3>
                      <p className="text-sm text-gray-500">Get notified about critical accessibility issues</p>
                    </div>
                    <input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium text-gray-900">Weekly Reports</h3>
                      <p className="text-sm text-gray-500">Receive weekly summary reports</p>
                    </div>
                    <input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded" />
                  </div>
                  <button className="btn-primary">Save Preferences</button>
                </div>
              </div>
            )}

            {activeTab === 'security' && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Security Settings</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Current Password</label>
                    <input type="password" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">New Password</label>
                    <input type="password" className="input-field mt-1" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Confirm New Password</label>
                    <input type="password" className="input-field mt-1" />
                  </div>
                  <button className="btn-primary">Change Password</button>
                </div>
              </div>
            )}

            {activeTab === 'export' && (
              <div className="card">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Data</h2>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Download your scan data and reports in various formats.
                  </p>
                  <div className="space-y-3">
                    <button className="w-full btn-secondary flex items-center justify-center space-x-2">
                      <Download className="h-4 w-4" />
                      <span>Export All Scan Data (CSV)</span>
                    </button>
                    <button className="w-full btn-secondary flex items-center justify-center space-x-2">
                      <Download className="h-4 w-4" />
                      <span>Export All Reports (PDF)</span>
                    </button>
                    <button className="w-full btn-secondary flex items-center justify-center space-x-2">
                      <Download className="h-4 w-4" />
                      <span>Export Account Data (JSON)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Sidebar>
  )
}



