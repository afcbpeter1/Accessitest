'use client'

import Link from 'next/link'
import { MessageCircle, Eye, Home, Search, DollarSign, Twitter, Linkedin, Github, Mail } from 'lucide-react'
import { socialLinks } from '@/lib/social-links'

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <>
      {/* Free Tools Section - Full Width */}
      <div className="bg-gray-50 py-12 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
        <div className="text-center max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-gray-600 mb-4">
            Explore more free accessibility tools
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link 
              href="/playground" 
              className="flex items-center space-x-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 transition-colors px-6 py-3 rounded-lg font-medium"
            >
              <MessageCircle className="h-4 w-4" />
              <span>Accessibility Playground</span>
            </Link>
            <Link 
              href="/logo-contrast-checker" 
              className="flex items-center space-x-2 bg-white border border-gray-200 hover:border-gray-300 text-gray-700 hover:text-gray-900 transition-colors px-6 py-3 rounded-lg font-medium"
            >
              <Eye className="h-4 w-4" />
              <span>Logo Contrast Checker</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Main Footer - Full Width */}
      <footer className="bg-[#1A202C] text-white py-8 w-screen relative left-1/2 right-1/2 -ml-[50vw] -mr-[50vw]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* About Us */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-[#E2E8F0]">About Us</h4>
              <p className="text-[#A0AEC0] text-sm leading-relaxed">
                We're passionate about creating accessible web experiences that work for everyone.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-[#E2E8F0]">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <Link href="/" className="text-[#CBD5E0] hover:text-white block transition-colors">Home</Link>
                <Link href="/playground" className="text-[#CBD5E0] hover:text-white block transition-colors">Accessibility Playground</Link>
                <Link href="/new-scan" className="text-[#CBD5E0] hover:text-white block transition-colors">Start New Scan</Link>
                <Link href="/pricing" className="text-[#CBD5E0] hover:text-white block transition-colors">Pricing</Link>
              </div>
            </div>

            {/* Connect */}
            <div>
              <h4 className="text-lg font-semibold mb-4 text-[#E2E8F0]">Connect</h4>
              <div className="space-y-2 text-sm">
                <a 
                  href={socialLinks.twitter} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#CBD5E0] hover:text-white block transition-colors flex items-center space-x-2"
                  aria-label="Follow us on Twitter"
                >
                  <Twitter className="h-4 w-4" />
                  <span>Twitter</span>
                </a>
                <a 
                  href={socialLinks.linkedin} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#CBD5E0] hover:text-white block transition-colors flex items-center space-x-2"
                  aria-label="Connect with us on LinkedIn"
                >
                  <Linkedin className="h-4 w-4" />
                  <span>LinkedIn</span>
                </a>
                <a 
                  href={socialLinks.github} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[#CBD5E0] hover:text-white block transition-colors flex items-center space-x-2"
                  aria-label="View our GitHub"
                >
                  <Github className="h-4 w-4" />
                  <span>GitHub</span>
                </a>
                <a 
                  href={socialLinks.email} 
                  className="text-[#CBD5E0] hover:text-white block transition-colors flex items-center space-x-2"
                  aria-label="Send us an email"
                >
                  <Mail className="h-4 w-4" />
                  <span>Email</span>
                </a>
              </div>
            </div>
          </div>

          {/* Separator */}
          <div className="border-t border-[#4A5568] mt-8 pt-4">
            <p className="text-center text-[#A0AEC0] text-sm mb-4">
              © {currentYear} AccessScan. All rights reserved.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-2 text-sm text-[#A0AEC0]">
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
          </div>
        </div>
      </footer>
    </>
  )
}
