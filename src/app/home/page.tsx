'use client'

import { useState, useEffect } from 'react'
import { 
  Shield, 
  FileText, 
  Globe, 
  Zap, 
  CheckCircle, 
  BarChart3, 
  ArrowRight,
  Search,
  AlertTriangle,
  ExternalLink,
  Code,
  X,
  Contrast
} from 'lucide-react'
import Link from 'next/link'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import { useScreenReaderAnnounce } from '../../hooks/useScreenReaderAnnounce'
import LoadingSpinner from '../../components/LoadingSpinner'

interface ScanResults {
  success: boolean
  url: string
  scanDate: string
  summary: {
    totalIssues: number
    criticalIssues: number
    seriousIssues: number
    moderateIssues: number
    minorIssues: number
  }
  topIssues: Array<{
    id: string
    type: string
    severity: string
    title: string
    description: string
    helpUrl: string
    tags: string[]
    nodes: number
    page: string
  }>
  screenshots?: {
    fullPage?: string
    viewport?: string
    elements?: Array<{
      selector: string
      issueId: string
      severity: string
      screenshot: string
      boundingBox?: {
        x: number
        y: number
        width: number
        height: number
      }
    }>
  }
  codeAnalysis?: {
    fixes: Array<{
      issueId: string
      selector: string
      originalCode: string
      fixedCode: string
      explanation: string
      wcagGuideline: string
      severity: 'critical' | 'serious' | 'moderate' | 'minor'
    }>
    summary: {
      totalFixes: number
      criticalFixes: number
      seriousFixes: number
      moderateFixes: number
      minorFixes: number
    }
  }
  requiresSignup: boolean
  message: string
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly')
  const [scanUrl, setScanUrl] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanStage, setScanStage] = useState('')
  const [scanResults, setScanResults] = useState<ScanResults | null>(null)
  const [showSignupForm, setShowSignupForm] = useState(false)
  const [showIssuesModal, setShowIssuesModal] = useState(false)
  const [showCodeFixes, setShowCodeFixes] = useState(false)
  const [showSignupInModal, setShowSignupInModal] = useState(false)
  
  // Accessibility hooks
  const modalRef = useFocusTrap(showIssuesModal)
  useScreenReaderAnnounce(isScanning ? 'Scanning website for accessibility issues...' : '', 'polite')
  const [signupData, setSignupData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    password: '',
    confirmPassword: ''
  })
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [signupError, setSignupError] = useState('')
  const [signupSuccess, setSignupSuccess] = useState('')
  
  // Screen reader announcements for errors and success
  useScreenReaderAnnounce(signupError, 'assertive')
  useScreenReaderAnnounce(signupSuccess, 'polite')

  // Load scan state from localStorage on component mount
  useEffect(() => {
    const savedScanState = localStorage.getItem('freeScanState')
    if (savedScanState) {
      try {
        const state = JSON.parse(savedScanState)
        setScanUrl(state.scanUrl || '')
        setIsScanning(state.isScanning || false)
        setScanResults(state.scanResults || null)
        setShowSignupForm(state.showSignupForm || false)
        
        // If we were scanning, switch to free-scan tab
        if (state.isScanning || state.scanResults) {
          setActiveTab('free-scan')
        }
      } catch (error) {
        console.warn('Failed to load scan state from localStorage:', error)
        localStorage.removeItem('freeScanState')
      }
    }
  }, [])

  // Save scan state to localStorage whenever it changes
  useEffect(() => {
    const scanState = {
      scanUrl,
      isScanning,
      scanResults,
      showSignupForm
    }
    localStorage.setItem('freeScanState', JSON.stringify(scanState))
  }, [scanUrl, isScanning, scanResults, showSignupForm])

  // Cleanup free scan data when user leaves the page
  useEffect(() => {
    const handleBeforeUnload = () => {
      // Clear free scan state when user leaves the page
      if (scanResults?.requiresSignup) {
        localStorage.removeItem('freeScanState')
      }
    }

    const handleVisibilityChange = () => {
      // Clear free scan state when tab becomes hidden (user switches tabs)
      if (document.hidden && scanResults?.requiresSignup) {
        localStorage.removeItem('freeScanState')
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [scanResults])

  const clearScanState = () => {
    setScanUrl('')
    setIsScanning(false)
    setScanResults(null)
    setShowSignupForm(false)
    setSignupError('')
    setSignupSuccess('')
    localStorage.removeItem('freeScanState')
  }

  const handleFreeScan = async () => {
    if (!scanUrl.trim()) return
    
    setIsScanning(true)
    setScanProgress(0)
    setScanResults(null)
    setSignupError('')
    
    // Realistic progress updates based on scan stages
    const progressStages = [
      { stage: 'Connecting to website...', progress: 20 },
      { stage: 'Loading page content...', progress: 40 },
      { stage: 'Running accessibility tests...', progress: 70 },
      { stage: 'Capturing screenshots...', progress: 85 },
      { stage: 'Processing results...', progress: 95 }
    ]
    
    let currentStage = 0
    const progressInterval = setInterval(() => {
      if (currentStage < progressStages.length) {
        setScanProgress(progressStages[currentStage].progress)
        setScanStage(progressStages[currentStage].stage)
        currentStage++
      }
    }, 800) // Update every 800ms for realistic timing
    
    try {
      const response = await fetch('/api/free-scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: scanUrl }),
      })
      
      const data = await response.json()
      
      // Complete the progress bar
      setScanProgress(100)
      
      if (data.success) {
        setScanResults(data)
        setShowSignupForm(true)
      } else {
        setSignupError(data.error || 'Scan failed. Please try again.')
      }
    } catch (error) {
      console.error('Scan error:', error)
      setSignupError('Network error. Please try again.')
    } finally {
      clearInterval(progressInterval)
      setTimeout(() => {
        setIsScanning(false)
        setScanProgress(0)
      }, 1000) // Keep progress bar visible for a moment
    }
  }

  const handleSignup = async () => {
    // Clear previous errors
    setSignupError('')
    setSignupSuccess('')
    
    // Validate required fields
    if (!signupData.firstName || !signupData.lastName || !signupData.email || !signupData.password) {
      setSignupError('Please fill in all required fields')
      return
    }
    
    // Validate password
    if (signupData.password.length < 8) {
      setSignupError('Password must be at least 8 characters long')
      return
    }
    
    if (signupData.password !== signupData.confirmPassword) {
      setSignupError('Passwords do not match')
      return
    }
    
    setIsSigningUp(true)
    
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'register',
          name: `${signupData.firstName} ${signupData.lastName}`,
          email: signupData.email,
          password: signupData.password,
          company: signupData.company
        })
      })

      const data = await response.json()

      if (data.success) {
        setSignupSuccess('Account created successfully! Redirecting to dashboard...')
        
        // Store token and user data
        localStorage.setItem('accessToken', data.token)
        localStorage.setItem('user', JSON.stringify(data.user))
        
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          window.location.href = '/dashboard'
        }, 2000)
      } else {
        setSignupError(data.error || 'Registration failed')
      }
    } catch (error) {
      setSignupError('Network error. Please try again.')
    } finally {
      setIsSigningUp(false)
    }
  }

  const features = [
    {
      icon: FileText,
      title: 'Document Accessibility Testing',
      description: 'Comprehensive Section 508 compliance testing for PDFs, Word documents, PowerPoint presentations, and more',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      icon: Globe,
      title: 'Website Accessibility Testing',
      description: 'WCAG 2.2 Level AA compliance testing for websites and web applications',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: Code,
      title: 'Accessibility Playground',
      description: 'Interactive learning tool to practice fixing accessibility issues with real code examples',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      link: '/playground'
    },
    {
      icon: AlertTriangle,
      title: 'Issues Demo',
      description: 'See real accessibility issues in action and understand how they affect users with disabilities',
      color: 'text-[#0B1220]',
      bgColor: 'bg-gray-50',
      link: '/accessibility-issues'
    },
    {
      icon: Contrast,
      title: 'Logo Contrast Checker',
      description: 'Free tool to check color contrast ratios in your logos against WCAG accessibility standards',
      color: 'text-[#06B6D4]',
      bgColor: 'bg-[#06B6D4]/10',
      link: '/logo-contrast-checker'
    },
    {
      icon: Zap,
      title: 'AI-Powered Analysis',
      description: 'Advanced artificial intelligence for intelligent issue detection and automated remediation recommendations',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      icon: BarChart3,
      title: 'Comprehensive Reporting',
      description: 'Detailed compliance reports with severity categorization and actionable remediation steps',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    }
  ]

  const complianceStandards = [
    {
      icon: Shield,
      standard: 'ADA Compliant',
      description: 'Americans with Disabilities Act compliance through WCAG 2.2 AA standards',
      coverage: 'Legal compliance guaranteed',
      color: 'text-green-600'
    },
    {
      icon: Shield,
      standard: 'Section 508 Compliance',
      description: 'Federal accessibility standards for electronic and information technology',
      coverage: 'All 16 subsections tested',
      color: 'text-blue-600'
    },
    {
      icon: Globe,
      standard: 'WCAG 2.2 Level AA',
      description: 'International web accessibility guidelines for inclusive digital experiences',
      coverage: 'Latest standards compliance',
      color: 'text-green-600'
    },
    {
      icon: FileText,
      standard: 'Document Accessibility',
      description: 'Comprehensive testing for all major document formats and content types',
      coverage: 'PDF, Word, PowerPoint, HTML support',
      color: 'text-purple-600'
    }
  ]

  return (
    <div className="min-h-screen bg-white" lang="en">
      {/* Skip Links for Keyboard Navigation */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-[#06B6D4] text-white px-4 py-2 rounded-md z-50"
      >
        Skip to main content
      </a>
      <a 
        href="#navigation" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-32 bg-[#06B6D4] text-white px-4 py-2 rounded-md z-50"
      >
        Skip to navigation
      </a>
      {/* Navigation */}
      <nav id="navigation" className="bg-white shadow-sm border-b" role="navigation" aria-label="Main navigation">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <img 
                src="/allytest.png" 
                alt="Accessibility testing platform logo" 
                className="h-8 w-auto object-contain" 
              />
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/login" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign in
              </Link>
              <Link 
                href="/signup" 
                className="bg-[#0B1220] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main id="main-content" className="py-20 bg-gradient-to-br from-[#06B6D4] to-[#0B1220] text-white" role="main">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Professional Accessibility Testing Platform
          </h1>
          <p className="text-xl mb-8 max-w-3xl mx-auto">
            A11ytest.ai is the leading accessibility testing platform that ensures your documents and websites meet <strong>ADA compliance</strong>, federal Section 508 requirements, and international WCAG 2.2 AA standards. Our AI-powered technology provides comprehensive accessibility audits for PDFs, Word documents, PowerPoint presentations, and websites, helping organizations achieve full legal compliance and create inclusive digital experiences for all users.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/signup" 
              className="bg-white text-[#0B1220] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors flex items-center justify-center"
            >
              Get Started
              <ArrowRight className="ml-2 h-5 w-5" />
            </Link>
            <Link 
              href="/playground" 
              className="bg-[#0B1220] text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
            >
              🎓 Try Playground
              <Code className="ml-2 h-5 w-5" />
            </Link>
            <Link 
              href="/accessibility-issues" 
              className="bg-white text-[#0B1220] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors flex items-center justify-center"
            >
              🔍 See Issues Demo
              <AlertTriangle className="ml-2 h-5 w-5" />
            </Link>
            <Link 
              href="/logo-contrast-checker" 
              className="bg-[#0B1220] text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-800 transition-colors flex items-center justify-center"
            >
              🎨 Logo Contrast Checker
              <Contrast className="ml-2 h-5 w-5" />
            </Link>
          </div>
        </div>
      </main>

      {/* Why We're Different Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Why We're Different</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Unlike other accessibility testing tools that only identify problems, we provide actionable code solutions to fix every issue found.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <div className="bg-[#0B1220] p-3 rounded-lg mr-4">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Code Solutions</h3>
              </div>
              <p className="text-gray-600">
                Get specific HTML, CSS, and JavaScript code snippets to fix every accessibility issue. No more guessing how to implement fixes.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <div className="bg-[#0B1220] p-3 rounded-lg mr-4">
                  <Globe className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">Visual Screenshots</h3>
              </div>
              <p className="text-gray-600">
                See exactly where issues are located with annotated screenshots, just like Lighthouse. Visual context for every problem found.
              </p>
            </div>
            
            <div className="bg-white p-6 rounded-lg shadow-sm border">
              <div className="flex items-center mb-4">
                <div className="bg-[#0B1220] p-3 rounded-lg mr-4">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900">AI-Powered Fixes</h3>
              </div>
              <p className="text-gray-600">
                Our AI analyzes your specific code and generates custom solutions tailored to your website's structure and design.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Professional Accessibility Testing</h2>
            <p className="text-lg text-gray-600 max-w-3xl mx-auto">
              Our accessibility testing platform provides reliable, accurate, and comprehensive accessibility testing solutions for organisations that need to meet federal and international accessibility standards.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#0B1220] mb-2">16</div>
              <div className="text-gray-600">Section 508 Standards</div>
              <p className="text-sm text-gray-500 mt-2">Complete federal compliance testing coverage</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#0B1220] mb-2">8+</div>
              <div className="text-gray-600">File Formats Supported</div>
              <p className="text-sm text-gray-500 mt-2">PDF, Word, PowerPoint, HTML, Text + Live websites</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#0B1220] mb-2">WCAG 2.2</div>
              <div className="text-gray-600">Accessibility Standards</div>
              <p className="text-sm text-gray-500 mt-2">Latest web accessibility guidelines</p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#0B1220] mb-2">AI</div>
              <div className="text-gray-600">Powered Analysis</div>
              <p className="text-sm text-gray-500 mt-2">Intelligent issue detection and recommendations</p>
            </div>
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="py-8 bg-gray-50" aria-label="Page sections">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center space-x-1 bg-white rounded-lg p-1 shadow-sm" role="tablist">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'free-scan', label: 'Free Scan' },
              { id: 'features', label: 'Features' },
              { id: 'compliance', label: 'Compliance' },
              { id: 'pricing', label: 'Pricing' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`${tab.id}-panel`}
                id={`${tab.id}-tab`}
                className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#0B1220] text-white shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tab Content */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div id="overview-panel" role="tabpanel" aria-labelledby="overview-tab" className="space-y-12">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Comprehensive Accessibility Testing for Modern Organizations
                </h2>
                <p className="text-lg text-gray-600 max-w-4xl mx-auto mb-8">
                  A11ytest.ai revolutionizes accessibility compliance by combining advanced artificial intelligence with comprehensive testing methodologies. Our platform addresses the critical need for organizations to ensure their digital content is accessible to all users, including those with disabilities. Whether you're a government agency requiring Section 508 compliance, a business seeking WCAG 2.2 AA certification, or an educational institution needing accessible document standards, A11ytest.ai provides the tools and expertise to achieve full accessibility compliance.
                </p>
                
                {/* Accessibility Playground CTA */}
                <div className="bg-[#0B1220] text-white p-6 rounded-lg max-w-2xl mx-auto mb-8">
                  <div className="flex items-center justify-center space-x-3 mb-3">
                    <Code className="h-8 w-8" />
                    <h3 className="text-2xl font-bold">🎓 Learn Accessibility Hands-On</h3>
                  </div>
                  <p className="text-gray-200 mb-4">
                    Practice fixing real accessibility issues with our interactive playground. Perfect for developers, designers, and content creators!
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link 
                      href="/playground"
                      className="inline-flex items-center px-6 py-3 bg-white text-[#0B1220] rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                      Try the Playground
                      <ArrowRight className="h-5 w-5 ml-2" />
                    </Link>
                    <Link 
                      href="/accessibility-issues"
                      className="inline-flex items-center px-6 py-3 bg-white text-[#0B1220] rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                      See Issues Demo
                      <AlertTriangle className="h-5 w-5 ml-2" />
                    </Link>
                    <Link 
                      href="/logo-contrast-checker"
                      className="inline-flex items-center px-6 py-3 bg-white text-[#0B1220] rounded-lg font-semibold hover:bg-gray-100 transition-colors"
                    >
                      Logo Contrast Checker
                      <Contrast className="h-5 w-5 ml-2" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-2xl font-semibold text-gray-900">Document Accessibility Testing</h3>
                  <p className="text-gray-600 mb-4">
                    Our advanced document scanning technology provides comprehensive accessibility testing for all major file formats used in modern business and government operations. Whether you're working with PDFs, Word documents, PowerPoint presentations, or HTML files, our platform ensures your content meets the highest accessibility standards required by federal regulations and international guidelines.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Complete Section 508 Compliance Testing</div>
                        <div className="text-sm text-gray-600">Automated testing for all 16 subsections of federal accessibility standards, ensuring your documents meet government requirements</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Multi-Format Document Support</div>
                        <div className="text-sm text-gray-600">Comprehensive testing for PDF, Word, PowerPoint, HTML, and text documents with intelligent content analysis</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">AI-Powered Content Analysis</div>
                        <div className="text-sm text-gray-600">Advanced artificial intelligence for intelligent issue detection, automated remediation recommendations, and accessibility scoring</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Detailed Compliance Reporting</div>
                        <div className="text-sm text-gray-600">Comprehensive reports with severity categorization, compliance scoring, and actionable remediation steps</div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-2xl font-semibold text-gray-900">Website Accessibility Testing</h3>
                  <p className="text-gray-600 mb-4">
                    Comprehensive web accessibility testing that ensures your websites and web applications meet international accessibility standards and provide an inclusive user experience for all visitors. Our platform provides detailed analysis of your web content with actionable insights for continuous improvement and compliance maintenance.
                  </p>
                  <div className="space-y-4">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">WCAG 2.2 Level AA Compliance Testing</div>
                        <div className="text-sm text-gray-600">Latest web accessibility guidelines with automated testing for all success criteria and international standards compliance</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Multi-Page Website Scanning</div>
                        <div className="text-sm text-gray-600">Complete website accessibility testing and analysis across entire domains and web applications</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Real-Time Compliance Reports</div>
                        <div className="text-sm text-gray-600">Instant accessibility scoring, detailed issue breakdowns, and prioritized remediation recommendations</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-6 w-6 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-medium text-gray-900">Interactive Element Testing</div>
                        <div className="text-sm text-gray-600">Comprehensive testing of forms, navigation, multimedia content, and dynamic web components</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Free Scan Tab */}
          {activeTab === 'free-scan' && (
            <div id="free-scan-panel" role="tabpanel" aria-labelledby="free-scan-tab" className="space-y-12">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Free Website Accessibility Scan
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Get a quick accessibility assessment of your website's homepage. See what issues we find, then sign up for detailed recommendations and remediation steps.
                </p>
              </div>

              <div className="max-w-4xl mx-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Left Column - Scan Form */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Scan Your Website</h3>
                    
                    {!scanResults ? (
                      <div className="space-y-4">
                        {isScanning && (
                          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
                            <div className="flex items-center mb-3">
                              <LoadingSpinner message="Scanning website..." size="sm" />
                              <div className="ml-3">
                                <p className="text-sm text-blue-800">
                                  <strong>{scanStage || 'Starting scan...'}</strong>
                                </p>
                                <p className="text-xs text-blue-600 mt-1">
                                  You can navigate away and come back - your scan will continue.
                                </p>
                              </div>
                            </div>
                            
                            {/* Progress Bar */}
                            <div className="w-full bg-blue-200 rounded-full h-2">
                              <div 
                                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                                style={{ width: `${scanProgress}%` }}
                              ></div>
                            </div>
                            <p className="text-xs text-blue-600 mt-2 text-center">
                              {Math.round(scanProgress)}% complete
                            </p>
                          </div>
                        )}
                        <div>
                          <label htmlFor="scanUrl" className="block text-sm font-medium text-gray-700 mb-2">
                            Website URL
                          </label>
                          <input
                            type="text"
                            id="scanUrl"
                            value={scanUrl}
                            onChange={(e) => setScanUrl(e.target.value)}
                            placeholder="example.com or https://example.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                        </div>
                        
                        <button
                          onClick={handleFreeScan}
                          disabled={!scanUrl.trim() || isScanning}
                          className="w-full bg-[#0B1220] text-white py-3 px-4 rounded-md font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          {isScanning ? (
                            <LoadingSpinner message="Scanning website..." size="sm" />
                          ) : (
                            <>
                              <Search className="h-4 w-4 mr-2" />
                              Start Free Scan
                            </>
                          )}
                        </button>
                        
                        <p className="text-sm text-gray-500 text-center">
                          This will scan your homepage for accessibility issues
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="text-center">
                          <div className="text-4xl font-bold text-red-600 mb-2">
                            {scanResults.summary.totalIssues}
                          </div>
                          <div className="text-lg text-gray-900 mb-4">
                            accessibility violations found
                          </div>
                          <div className="text-sm text-gray-600">
                            on <span className="font-medium">{scanResults.url}</span>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-red-600">Critical:</span>
                            <span className="font-medium">{scanResults.summary.criticalIssues}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-orange-600">Serious:</span>
                            <span className="font-medium">{scanResults.summary.seriousIssues}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-yellow-600">Moderate:</span>
                            <span className="font-medium">{scanResults.summary.moderateIssues}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-blue-600">Minor:</span>
                            <span className="font-medium">{scanResults.summary.minorIssues}</span>
                          </div>
                        </div>
                        
                        {/* Screenshot Display */}
                        {scanResults.screenshots?.viewport && (
                          <div className="mb-4">
                            <div className="text-sm text-gray-600 mb-2">Website Screenshot:</div>
                            <div className="border border-gray-200 rounded-lg overflow-hidden max-w-full">
                              <img 
                                src={scanResults.screenshots.viewport}
                                alt={`Screenshot of ${scanResults.url}`}
                                className="w-full h-auto max-h-32 sm:max-h-40 md:max-h-48 lg:max-h-56 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(scanResults.screenshots?.viewport, '_blank')}
                              />
                            </div>
                            <div className="text-xs text-gray-500 mt-1">Click to view full size</div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <button
                            onClick={() => setShowIssuesModal(true)}
                            className="w-full bg-[#0B1220] text-white py-2 px-4 rounded-md font-medium hover:bg-gray-800 flex items-center justify-center"
                          >
                            <Search className="h-4 w-4 mr-2" />
                            View {scanResults.summary.totalIssues} Issues Found
                          </button>
                          
                          {scanResults.codeAnalysis && !scanResults.requiresSignup && (
                            <button
                              onClick={() => setShowCodeFixes(true)}
                              className="w-full bg-[#06B6D4] text-white py-2 px-4 rounded-md font-medium hover:bg-[#0891B2] flex items-center justify-center"
                            >
                              <Code className="h-4 w-4 mr-2" />
                              View Code Fixes ({scanResults.codeAnalysis.summary.totalFixes})
                            </button>
                          )}
                          
                          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                            <div className="flex items-start">
                              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                              <div className="text-sm text-yellow-800">
                                <strong>Sign up required</strong> to see detailed recommendations and remediation steps.
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={clearScanState}
                            className="w-full text-gray-600 hover:text-gray-900 text-sm"
                          >
                            Scan another website
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right Column - Signup Form */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">See Detailed Results</h3>
                    
                    {scanResults && showSignupForm ? (
                      <div className="space-y-4">
                        <p className="text-sm text-gray-600 mb-4">
                          Enter your details to access detailed recommendations and remediation steps for your accessibility issues.
                        </p>
                        
                        <div className="space-y-3">
                          <div>
                            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                              First Name *
                            </label>
                            <input
                              type="text"
                              id="firstName"
                              value={signupData.firstName}
                              onChange={(e) => setSignupData({...signupData, firstName: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                              Last Name *
                            </label>
                            <input
                              type="text"
                              id="lastName"
                              value={signupData.lastName}
                              onChange={(e) => setSignupData({...signupData, lastName: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                              Business Email *
                            </label>
                            <input
                              type="email"
                              id="email"
                              value={signupData.email}
                              onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              required
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                              Company
                            </label>
                            <input
                              type="text"
                              id="company"
                              value={signupData.company}
                              onChange={(e) => setSignupData({...signupData, company: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                          
                          <div>
                            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                              Password *
                            </label>
                            <input
                              type="password"
                              id="password"
                              value={signupData.password}
                              onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Create a password"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Must be at least 8 characters long
                            </p>
                          </div>
                          
                          <div>
                            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                              Confirm Password *
                            </label>
                            <input
                              type="password"
                              id="confirmPassword"
                              value={signupData.confirmPassword}
                              onChange={(e) => setSignupData({...signupData, confirmPassword: e.target.value})}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                              placeholder="Confirm your password"
                            />
                          </div>
                        </div>
                        
                        {/* Error Message */}
                        {signupError && (
                          <div className="flex items-center space-x-2 text-red-600 text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            <span>{signupError}</span>
                          </div>
                        )}

                        {/* Success Message */}
                        {signupSuccess && (
                          <div className="flex items-center space-x-2 text-green-600 text-sm">
                            <CheckCircle className="h-4 w-4" />
                            <span>{signupSuccess}</span>
                          </div>
                        )}
                        
                        <button
                          onClick={handleSignup}
                          disabled={isSigningUp}
                          className="w-full bg-[#0B1220] text-white py-3 px-4 rounded-md font-medium hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                          {isSigningUp ? 'Creating Account...' : 'Get My Results'}
                          <ExternalLink className="h-4 w-4 ml-2" />
                        </button>
                        
                        <p className="text-xs text-gray-500 text-center">
                          By continuing, you agree to our terms and privacy policy
                        </p>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <div className="text-gray-400 mb-4">
                          <Search className="h-12 w-12 mx-auto" />
                        </div>
                        <p className="text-gray-600">
                          {scanResults ? 'Complete the scan to see this form' : 'Start a free scan to see detailed results'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Features Tab */}
          {activeTab === 'features' && (
            <div className="space-y-12">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Advanced Features for Professional Accessibility Testing
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  A11ytest.ai combines cutting-edge technology with industry expertise to deliver the most comprehensive accessibility testing solution available.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {features.map((feature, index) => {
                  const IconComponent = feature.icon
                  const content = (
                    <div className="bg-white rounded-lg p-6 border border-gray-200">
                      <div className="flex items-center space-x-3 mb-4">
                        <IconComponent className={`h-8 w-8 ${feature.color}`} />
                        <h3 className="text-xl font-semibold text-gray-900">{feature.title}</h3>
                      </div>
                      <p className="text-gray-600">{feature.description}</p>
                      {feature.link && (
                        <div className="mt-4 flex items-center text-blue-600 text-sm font-medium">
                          Try it now
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </div>
                      )}
                    </div>
                  )
                  
                  return feature.link ? (
                    <Link key={index} href={feature.link} className="block hover:scale-105 transition-transform">
                      {content}
                    </Link>
                  ) : (
                    <div key={index}>
                      {content}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Compliance Tab */}
          {activeTab === 'compliance' && (
            <div className="space-y-12">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Meeting Global Accessibility Standards
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Our platform ensures compliance with the most comprehensive accessibility standards used by government agencies, educational institutions, and businesses worldwide.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {complianceStandards.map((standard, index) => {
                  const IconComponent = standard.icon
                  return (
                    <div key={index} className="bg-white rounded-lg p-6 border border-gray-200">
                      <div className="flex items-center space-x-3 mb-4">
                        <IconComponent className={`h-6 w-6 ${standard.color}`} />
                        <h3 className="text-lg font-semibold text-gray-900">{standard.standard}</h3>
                      </div>
                      <p className="text-gray-600 mb-3">{standard.description}</p>
                      <div className="text-sm font-medium text-green-600">{standard.coverage}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Pricing Tab */}
          {activeTab === 'pricing' && (
            <div className="space-y-12">
              <div className="text-center">
                <h2 className="text-3xl font-bold text-gray-900 mb-4">
                  Simple, Transparent Pricing
                </h2>
                <p className="text-lg text-gray-700 max-w-3xl mx-auto">
                  Choose the plan that fits your needs. All plans include our core accessibility testing features.
                </p>
              </div>

              {/* Billing Toggle */}
              <div className="flex justify-center">
                <div className="bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setBillingCycle('monthly')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      billingCycle === 'monthly'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle('yearly')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      billingCycle === 'yearly'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                  >
                    Yearly
                    <span className="ml-1 px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded-full">
                      Save 20%
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Web Scan Only</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    ${billingCycle === 'monthly' ? '29' : '278'}
                    <span className="text-lg text-gray-700">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 mb-4">
                      <p>Save $70 per year</p>
                      <p className="text-xs text-gray-500 mt-1">Billed annually</p>
                    </div>
                  )}
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">3 free scans</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">No card details up front</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">Unlimited website scans</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">WCAG 2.2 compliance</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">AI recommendations</span>
                    </li>
                  </ul>
                  <Link 
                    href="/signup" 
                    className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Get Started
                  </Link>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Document Scan Only</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    ${billingCycle === 'monthly' ? '39' : '374'}
                    <span className="text-lg text-gray-700">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 mb-4">
                      <p>Save $94 per year</p>
                      <p className="text-xs text-gray-500 mt-1">Billed annually</p>
                    </div>
                  )}
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">3 free scans</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">No card details up front</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">Unlimited document scans</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">Section 508 compliance</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">PDF, Word, PowerPoint support</span>
                    </li>
                  </ul>
                  <Link 
                    href="/signup" 
                    className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Get Started
                  </Link>
                </div>

                <div className="bg-white rounded-lg border-2 border-primary-500 p-6 text-center relative">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-primary-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Complete Access</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-2">
                    ${billingCycle === 'monthly' ? '59' : '566'}
                    <span className="text-lg text-gray-700">
                      /{billingCycle === 'monthly' ? 'month' : 'year'}
                    </span>
                  </div>
                  {billingCycle === 'yearly' && (
                    <div className="text-sm text-green-600 mb-4">
                      <p>Save $142 per year</p>
                      <p className="text-xs text-gray-500 mt-1">Billed annually</p>
                    </div>
                  )}
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">3 free scans</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">No card details up front</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">Unlimited website scans</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">Unlimited document scans</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">WCAG 2.2 + Section 508 compliance</span>
                    </li>
                  </ul>
                  <Link 
                    href="/signup" 
                    className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Get Started
                  </Link>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Pay Per Scan</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-4">$1.50<span className="text-lg text-gray-700">/scan</span></div>
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">3 free scans</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">No card details up front</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">No monthly commitment</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">Buy credits as needed</span>
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      <span className="text-gray-800">Same features as plans</span>
                    </li>
                  </ul>
                  <Link 
                    href="/pricing" 
                    className="w-full bg-primary-600 text-white py-3 px-4 rounded-lg hover:bg-primary-700 transition-colors font-medium"
                  >
                    Get Started
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#0B1220]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Achieve Full Accessibility Compliance?
          </h2>
          <p className="text-xl text-white mb-8">
            Start your accessibility journey today with our comprehensive testing platform for Section 508 requirements and WCAG 2.2 compliance.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/signup" 
              className="bg-white text-[#0B1220] px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors"
            >
              Get Started
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0B1220] text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
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
              <p className="text-gray-400 max-w-2xl mx-auto">
                Professional accessibility testing platform for Section 508 compliance, WCAG 2.2 standards, and inclusive digital experiences. AI-powered document and website accessibility testing for government, enterprise, and educational organisations.
              </p>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Issues Modal */}
      {showIssuesModal && scanResults && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          aria-describedby="modal-description"
        >
          <div ref={modalRef} className="bg-white rounded-lg max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-8 border-b">
              <h3 id="modal-title" className="text-xl font-semibold text-gray-900">
                Accessibility Issues Found
              </h3>
              <button
                onClick={() => setShowIssuesModal(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close modal"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div id="modal-description" className="p-8 overflow-y-auto flex-1">
              {!showSignupInModal ? (
                <>
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Found <strong>{scanResults.summary.totalIssues}</strong> accessibility violations on{' '}
                      <strong>{scanResults.url}</strong>
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    {scanResults.topIssues.map((issue, index) => (
                      <div key={issue.id} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              issue.severity === 'critical' ? 'bg-red-100 text-red-800' :
                              issue.severity === 'serious' ? 'bg-orange-100 text-orange-800' :
                              issue.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {issue.severity.toUpperCase()}
                            </span>
                            <span className="text-sm text-gray-500">
                              {issue.nodes} occurrence{issue.nodes !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        
                        <h4 className="font-medium text-gray-900 mb-2">
                          {issue.title}
                        </h4>
                        
                        <p className="text-sm text-gray-600 mb-3">
                          {issue.description}
                        </p>
                    
                    {/* Element Screenshot */}
                    {scanResults.screenshots?.elements && (() => {
                      const elementScreenshot = scanResults.screenshots.elements.find(
                        el => el.issueId === issue.id
                      )
                      return elementScreenshot ? (
                        <div className="mb-3">
                          <div className="text-xs text-gray-500 mb-2">Affected Element:</div>
                          <div className="border border-gray-200 rounded-lg overflow-hidden bg-gray-50 max-w-sm">
                            <img
                              src={elementScreenshot.screenshot}
                              alt={`Screenshot showing ${issue.title} issue`}
                              className="w-full h-auto max-h-24 sm:max-h-28 md:max-h-32 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                              onClick={() => window.open(elementScreenshot.screenshot, '_blank')}
                            />
                            {elementScreenshot.boundingBox && (
                              <div className="px-2 py-1 bg-gray-100 text-xs text-gray-600">
                                {Math.round(elementScreenshot.boundingBox.width)}×{Math.round(elementScreenshot.boundingBox.height)}px
                              </div>
                            )}
                            <div className="text-xs text-gray-400 px-2 py-1 text-center">Click to enlarge</div>
                          </div>
                        </div>
                      ) : null
                    })()}
                    
                    <div className="flex items-center justify-between">
                      <div className="flex flex-wrap gap-1">
                        {issue.tags.slice(0, 3).map((tag) => (
                          <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                      
                      {issue.helpUrl && (
                        <a
                          href={issue.helpUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
                        >
                          Learn more
                          <ExternalLink className="h-3 w-3 ml-1" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
                  <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-start">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="text-sm text-yellow-800">
                        <strong>Sign up required</strong> to see detailed remediation steps and AI-powered recommendations for fixing these issues.
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Get Detailed Fixes</h3>
                    <p className="text-sm text-gray-600">
                      Sign up to see step-by-step code fixes and detailed remediation steps for all accessibility issues.
                    </p>
                  </div>
                  
                  <form onSubmit={handleSignup} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">
                          First Name
                        </label>
                        <input
                          type="text"
                          id="firstName"
                          value={signupData.firstName}
                          onChange={(e) => setSignupData(prev => ({ ...prev, firstName: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">
                          Last Name
                        </label>
                        <input
                          type="text"
                          id="lastName"
                          value={signupData.lastName}
                          onChange={(e) => setSignupData(prev => ({ ...prev, lastName: e.target.value }))}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                    
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        type="email"
                        id="email"
                        value={signupData.email}
                        onChange={(e) => setSignupData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="company" className="block text-sm font-medium text-gray-700 mb-1">
                        Company (Optional)
                      </label>
                      <input
                        type="text"
                        id="company"
                        value={signupData.company}
                        onChange={(e) => setSignupData(prev => ({ ...prev, company: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        value={signupData.password}
                        onChange={(e) => setSignupData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        minLength={8}
                      />
                    </div>
                    
                    <div>
                      <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password
                      </label>
                      <input
                        type="password"
                        id="confirmPassword"
                        value={signupData.confirmPassword}
                        onChange={(e) => setSignupData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                        minLength={8}
                      />
                    </div>
                    
                    {signupError && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-sm text-red-600">{signupError}</p>
                      </div>
                    )}
                    
                    {signupSuccess && (
                      <div className="bg-green-50 border border-green-200 rounded-md p-3">
                        <p className="text-sm text-green-600">{signupSuccess}</p>
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-4">
                      <Link 
                        href="/login" 
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Already have an account? Sign in
                      </Link>
                      <button
                        type="submit"
                        disabled={isSigningUp}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSigningUp ? 'Creating Account...' : 'Create Account'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between p-6 border-t bg-gray-50 flex-shrink-0">
              {!showSignupInModal ? (
                <>
                  <button
                    onClick={() => setShowIssuesModal(false)}
                    className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => setShowSignupInModal(true)}
                    className="bg-blue-600 text-white px-8 py-3 rounded-md font-medium hover:bg-blue-700"
                  >
                    Get Detailed Fixes
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowSignupInModal(false)}
                    className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Back to Issues
                  </button>
                  <button
                    onClick={() => setShowIssuesModal(false)}
                    className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Code Fixes Modal */}
      {showCodeFixes && scanResults?.codeAnalysis && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div 
            ref={modalRef}
            className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden"
            role="dialog"
            aria-modal="true"
            aria-labelledby="code-modal-title"
            aria-describedby="code-modal-description"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <div>
                <h3 id="code-modal-title" className="text-xl font-semibold text-gray-900">
                  Code Fixes for {scanResults.url}
                </h3>
                <p id="code-modal-description" className="text-sm text-gray-600 mt-1">
                  Before and after code examples with specific fixes for accessibility issues
                </p>
              </div>
              <button
                onClick={() => setShowCodeFixes(false)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close code fixes modal"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
              <div className="space-y-6">
                {scanResults.codeAnalysis.fixes.map((fix, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          fix.severity === 'critical' ? 'bg-red-100 text-red-800' :
                          fix.severity === 'serious' ? 'bg-orange-100 text-orange-800' :
                          fix.severity === 'moderate' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-blue-100 text-blue-800'
                        }`}>
                          {fix.severity.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-600">Selector: {fix.selector}</span>
                      </div>
                    </div>
                    
                    <div className="mb-3">
                      <p className="text-sm text-gray-700 mb-2">{fix.explanation}</p>
                      <p className="text-xs text-gray-500">WCAG Guideline: {fix.wcagGuideline}</p>
                    </div>
                    
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Before Code */}
                      <div>
                        <h4 className="text-sm font-medium text-red-700 mb-2 flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-1" />
                          Before (Current Code)
                        </h4>
                        <div className="bg-red-50 border border-red-200 rounded p-3">
                          <pre className="text-xs text-red-800 whitespace-pre-wrap break-words max-w-full">
                            {fix.originalCode}
                          </pre>
                        </div>
                      </div>
                      
                      {/* After Code */}
                      <div>
                        <h4 className="text-sm font-medium text-green-700 mb-2 flex items-center">
                          <CheckCircle className="h-4 w-4 mr-1" />
                          After (Fixed Code)
                        </h4>
                        <div className="bg-green-50 border border-green-200 rounded p-3">
                          <pre className="text-xs text-green-800 whitespace-pre-wrap break-words max-w-full">
                            {fix.fixedCode}
                          </pre>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(fix.fixedCode)
                          // You could add a toast notification here
                        }}
                        className="text-xs bg-[#06B6D4] text-white px-3 py-1 rounded hover:bg-[#0891B2]"
                      >
                        Copy Fixed Code
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
                {scanResults.codeAnalysis.summary.totalFixes} fixes available
              </div>
              <button
                onClick={() => setShowCodeFixes(false)}
                className="bg-[#0B1220] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
