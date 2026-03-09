'use client'

import Link from 'next/link'
import { socialLinks } from '@/lib/social-links'

export default function Footer() {
  return (
    <footer className="bg-[#0B1220] text-white py-12" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className="bg-white p-2 rounded-lg">
              <img
                src="/allytest.png"
                alt="A11ytest.ai Logo"
                className="h-8 w-auto object-contain"
              />
            </div>
          </div>
          <p className="text-gray-400 max-w-2xl mx-auto mb-6">
            AI-powered accessibility testing for websites and documents. We help you meet Section 508, WCAG 2.2, and PDF/UA standards — for government, enterprise, and education.
          </p>
          <p className="text-gray-400 mb-4">
            Contact us: <a href="mailto:hello@a11ytest.ai" className="text-white hover:underline">hello@a11ytest.ai</a>
          </p>
          <div className="flex justify-center items-center space-x-4 mb-6">
            <a
              href={socialLinks.twitter}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
              aria-label="Follow us on Twitter"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </a>
            <a
              href={socialLinks.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors p-2 rounded-lg hover:bg-gray-800"
              aria-label="Connect with us on LinkedIn"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
            </a>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8">
          <div className="flex flex-wrap justify-center items-center gap-4 text-sm text-gray-400 mb-4">
            <Link href="/privacy-policy" className="hover:text-white transition-colors">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms-of-service" className="hover:text-white transition-colors">
              Terms of Service
            </Link>
            <span>•</span>
            <Link href="/cookie-policy" className="hover:text-white transition-colors">
              Cookie Policy
            </Link>
            <span>•</span>
            <Link href="/accessibility-statement" className="hover:text-white transition-colors">
              Accessibility Statement
            </Link>
          </div>
          <p className="text-center text-gray-400">
            &copy; {new Date().getFullYear()} A11ytest.ai. All rights reserved.
          </p>
          <p className="text-center text-gray-500 text-xs mt-2">
            A11YTEST.AI LTD · Company no. 17070504
          </p>
        </div>
      </div>
    </footer>
  )
}
