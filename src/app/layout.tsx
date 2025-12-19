import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ScanProvider } from '@/contexts/ScanContext'
import GlobalScanStatus from '@/components/GlobalScanStatus'
import AccessibilitySettingsHandler from '@/components/AccessibilitySettingsHandler'
import CookieConsent from '@/components/CookieConsent'
import PageTracker from '@/components/PageTracker'

export const metadata: Metadata = {
  title: 'AccessScan - Accessibility Testing Platform',
  description: 'Professional accessibility scanning and testing for your website',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="bg-gray-50 min-h-screen overflow-x-hidden">
        <AuthProvider>
          <ScanProvider>
            <AccessibilitySettingsHandler />
            <PageTracker />
            {children}
            <GlobalScanStatus />
            <CookieConsent />
          </ScanProvider>
        </AuthProvider>
      </body>
    </html>
  )
}

