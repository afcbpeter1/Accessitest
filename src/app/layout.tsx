import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ScanProvider } from '@/contexts/ScanContext'
import GlobalScanStatus from '@/components/GlobalScanStatus'
import AccessibilitySettingsHandler from '@/components/AccessibilitySettingsHandler'
import CookieConsent from '@/components/CookieConsent'
import PageTracker from '@/components/PageTracker'

// Force dynamic rendering to avoid static generation issues with React Context
export const dynamic = 'force-dynamic'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export const metadata: Metadata = {
  title: 'a11ytest.ai - Accessibility Testing Platform',
  description: 'Professional accessibility scanning and testing for your website',
  icons: {
    icon: [
      { url: '/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/favicon-48x48.png', sizes: '48x48', type: 'image/png' },
    ],
    shortcut: '/favicon-32x32.png',
    apple: [
      { url: '/favicon-180x180.png', sizes: '180x180', type: 'image/png' },
    ],
  },
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

