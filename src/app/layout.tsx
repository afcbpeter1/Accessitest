import type { Metadata, Viewport } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import { ScanProvider } from '@/contexts/ScanContext'
import GlobalScanStatus from '@/components/GlobalScanStatus'
import AccessibilitySettingsHandler from '@/components/AccessibilitySettingsHandler'
import CookieConsent from '@/components/CookieConsent'
import PageTracker from '@/components/PageTracker'
import ExtensionScanBridge from '@/components/ExtensionScanBridge'

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
      <head>
        <script
          src="https://analytics.ahrefs.com/analytics.js"
          data-key="aWiU18FD0RD4XBrDgOBg6Q"
          async
        ></script>
        {/* Apollo.io website tracker — paste location equivalent to before </head> */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'function initApollo(){var n=Math.random().toString(36).substring(7),o=document.createElement("script");o.src="https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache="+n,o.async=!0,o.defer=!0,o.onload=function(){window.trackingFunctions.onLoad({appId:"69b90093d40a1300217d55e9"})},document.head.appendChild(o)}initApollo();',
          }}
        />
      </head>
      <body className="bg-gray-50 min-h-screen overflow-x-hidden">
        <AuthProvider>
          <ScanProvider>
            <AccessibilitySettingsHandler />
            <ExtensionScanBridge />
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

