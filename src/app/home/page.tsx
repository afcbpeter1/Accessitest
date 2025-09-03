'use client'

import { useState } from 'react'
import { 
  Shield, 
  FileText, 
  Globe, 
  Zap, 
  CheckCircle, 
  BarChart3, 
  ArrowRight
} from 'lucide-react'
import Link from 'next/link'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'features' | 'compliance' | 'pricing'>('overview')

  // SEO-optimized content with 1000+ words
  const seoContent = {
    title: "AccessiTest - Complete Section 508 & WCAG 2.2 Accessibility Testing Platform",
    description: "Professional accessibility testing for documents and websites. Section 508 compliance, WCAG 2.2 AA standards, AI-powered recommendations. Test PDFs, Word, PowerPoint, and websites for federal accessibility requirements.",
    keywords: "accessibility testing, Section 508 compliance, WCAG 2.2, document accessibility, website accessibility, PDF accessibility, federal compliance, accessibility audit, AI accessibility, disability compliance"
  }

  const features = [
    {
      icon: Shield,
      title: 'Section 508 Compliance',
      description: 'Full compliance with all 16 subsections of 36 CFR § 1194.22 federal accessibility standards',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      icon: Globe,
      title: 'WCAG 2.2 Level AA',
      description: 'Latest web accessibility guidelines with automated testing and detailed reporting',
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      icon: FileText,
      title: 'Multi-Format Support',
      description: 'PDF, Word, PowerPoint, HTML, and text documents with intelligent content analysis',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      icon: Zap,
      title: 'AI-Powered Recommendations',
      description: 'Claude AI integration for intelligent accessibility fixes and remediation guidance',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
    {
      icon: BarChart3,
      title: 'Comprehensive Reporting',
      description: 'Detailed issue breakdowns, severity categorization, and compliance scoring',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50'
    },
    
  ]

  const complianceStandards = [
    {
      standard: 'Section 508',
      description: 'Federal accessibility requirements for electronic and information technology',
      coverage: 'Full compliance with all 16 subsections',
      icon: Shield,
      color: 'text-blue-600'
    },
    {
      standard: 'WCAG 2.2',
      description: 'Web Content Accessibility Guidelines Level AA compliance',
      coverage: 'Automated testing for all success criteria',
      icon: Globe,
      color: 'text-green-600'
    },
    {
      standard: 'PDF/UA',
      description: 'Universal accessibility standard for PDF documents',
      coverage: 'Tag structure and content analysis',
      icon: FileText,
      color: 'text-purple-600'
    },
    {
      standard: 'Microsoft Accessibility',
      description: 'Office document accessibility standards',
      coverage: 'Word, PowerPoint, and Excel compliance',
      icon: FileText,
      color: 'text-orange-600'
    }
  ]

  

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="h-8 w-8 text-blue-600" />
                <span className="text-xl font-bold text-gray-900">AccessiTest</span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link 
                href="/login" 
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Log In
              </Link>
              <Link 
                href="/signup" 
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

             {/* Hero Section */}
       <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-700 text-white">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
           <h1 className="text-5xl font-bold mb-6">
             Professional Accessibility Testing Platform
             <br />
             <span className="text-blue-200">Section 508 & WCAG 2.2 Compliance Made Simple</span>
           </h1>
           <p className="text-xl text-blue-100 mb-8 max-w-4xl mx-auto">
             AccessiTest is the leading accessibility testing platform that ensures your documents and websites meet federal Section 508 requirements and international WCAG 2.2 AA standards. Our AI-powered technology provides comprehensive accessibility audits for PDFs, Word documents, PowerPoint presentations, and websites, helping organizations achieve full compliance and create inclusive digital experiences for all users.
           </p>
                     <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <Link 
               href="/signup" 
               className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors flex items-center justify-center"
             >
               Get Started
               <ArrowRight className="ml-2 h-5 w-5" />
             </Link>
           </div>
        </div>
      </section>

             {/* Stats Section */}
       <section className="py-16 bg-white">
         <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="text-center mb-12">
             <h2 className="text-3xl font-bold text-gray-900 mb-4">Trusted by Organizations Worldwide</h2>
             <p className="text-lg text-gray-600 max-w-3xl mx-auto">
               Our accessibility testing platform provides reliable, accurate, and comprehensive accessibility testing solutions for organizations that need to meet federal and international accessibility standards.
             </p>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
             <div className="text-center">
               <div className="text-4xl font-bold text-blue-600 mb-2">16</div>
               <div className="text-gray-600">Section 508 Standards</div>
               <p className="text-sm text-gray-500 mt-2">Complete federal compliance testing coverage</p>
             </div>
             <div className="text-center">
               <div className="text-4xl font-bold text-green-600 mb-2">50+</div>
               <div className="text-gray-600">File Formats Supported</div>
               <p className="text-sm text-gray-500 mt-2">Comprehensive document and web content testing</p>
             </div>
             <div className="text-center">
               <div className="text-4xl font-bold text-purple-600 mb-2">WCAG 2.2</div>
               <div className="text-gray-600">Accessibility Standards</div>
               <p className="text-sm text-gray-500 mt-2">Latest web accessibility guidelines</p>
             </div>
             <div className="text-center">
               <div className="text-4xl font-bold text-orange-600 mb-2">AI</div>
               <div className="text-gray-600">Powered Analysis</div>
               <p className="text-sm text-gray-500 mt-2">Intelligent issue detection and recommendations</p>
             </div>
           </div>
         </div>
       </section>

      {/* Tab Navigation */}
      <section className="py-8 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center space-x-1 bg-white rounded-lg p-1 shadow-sm">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'features', label: 'Features' },
              { id: 'compliance', label: 'Compliance' },
              { id: 'pricing', label: 'Pricing' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-3 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white shadow-sm'
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
             <div className="space-y-12">
               <div className="text-center">
                 <h2 className="text-3xl font-bold text-gray-900 mb-4">
                   Comprehensive Accessibility Testing for Modern Organizations
                 </h2>
                 <p className="text-lg text-gray-600 max-w-4xl mx-auto">
                   AccessiTest revolutionizes accessibility compliance by combining advanced artificial intelligence with comprehensive testing methodologies. Our platform addresses the critical need for organizations to ensure their digital content is accessible to all users, including those with disabilities. Whether you're a government agency requiring Section 508 compliance, a business seeking WCAG 2.2 AA certification, or an educational institution needing accessible document standards, AccessiTest provides the tools and expertise to achieve full accessibility compliance.
                 </p>
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

               {/* Why Accessibility Testing Matters */}
               <div className="bg-blue-50 rounded-lg p-8">
                 <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
                   Why Accessibility Testing is Critical for Your Organization
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                     <h4 className="text-lg font-semibold text-gray-900 mb-4">Legal Compliance & Risk Management</h4>
                     <p className="text-gray-600 mb-4">
                       Federal agencies and organizations receiving federal funding must comply with Section 508 of the Rehabilitation Act, which requires electronic and information technology to be accessible to people with disabilities. Non-compliance can result in legal action, loss of federal contracts, and significant financial penalties.
                     </p>
                     <ul className="text-sm text-gray-600 space-y-2">
                       <li>• Section 508 compliance for government contracts</li>
                       <li>• Americans with Disabilities Act (ADA) requirements</li>
                       <li>• International accessibility standards (WCAG 2.2)</li>
                       <li>• Protection against accessibility lawsuits</li>
                     </ul>
                   </div>
                   <div>
                     <h4 className="text-lg font-semibold text-gray-900 mb-4">Inclusive User Experience</h4>
                     <p className="text-gray-600 mb-4">
                       Creating accessible digital content ensures that all users, including those with disabilities, can access and interact with your information. This includes users with visual, auditory, motor, and cognitive disabilities who rely on assistive technologies like screen readers, voice recognition software, and alternative input devices.
                     </p>
                     <ul className="text-sm text-gray-600 space-y-2">
                       <li>• Support for assistive technologies</li>
                       <li>• Improved usability for all users</li>
                       <li>• Enhanced brand reputation and trust</li>
                       <li>• Increased market reach and customer satisfaction</li>
                     </ul>
                   </div>
                 </div>
               </div>

               {/* Industry Applications */}
               <div className="bg-gray-50 rounded-lg p-8">
                 <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
                   Accessibility Testing Solutions for Every Industry
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   <div className="text-center">
                     <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Shield className="h-8 w-8 text-blue-600" />
                     </div>
                     <h4 className="font-semibold text-gray-900 mb-2">Government & Federal Agencies</h4>
                     <p className="text-sm text-gray-600">
                       Ensure Section 508 compliance for federal contracts, government websites, and public documents. Our platform helps federal agencies meet accessibility requirements and avoid compliance issues.
                     </p>
                   </div>
                   <div className="text-center">
                     <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                       <Globe className="h-8 w-8 text-green-600" />
                     </div>
                     <h4 className="font-semibold text-gray-900 mb-2">Business & Enterprise</h4>
                     <p className="text-sm text-gray-600">
                       Achieve WCAG 2.2 compliance for corporate websites, applications, and digital communications. Protect your business from accessibility lawsuits and create inclusive customer experiences.
                     </p>
                   </div>
                   <div className="text-center">
                     <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                       <FileText className="h-8 w-8 text-purple-600" />
                     </div>
                     <h4 className="font-semibold text-gray-900 mb-2">Education & Publishing</h4>
                     <p className="text-sm text-gray-600">
                       Ensure educational materials, publications, and digital content are accessible to students and readers with disabilities. Meet educational accessibility requirements and support inclusive learning.
                     </p>
                   </div>
                 </div>
               </div>

               {/* Technology & Innovation */}
               <div className="bg-white rounded-lg p-8 border border-gray-200">
                 <h3 className="text-2xl font-semibold text-gray-900 mb-6 text-center">
                   Advanced Technology for Superior Accessibility Testing
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div>
                     <h4 className="text-lg font-semibold text-gray-900 mb-4">AI-Powered Analysis</h4>
                     <p className="text-gray-600 mb-4">
                       Our platform leverages cutting-edge artificial intelligence to provide intelligent accessibility analysis that goes beyond basic automated testing. The AI engine understands context, identifies complex accessibility issues, and provides actionable recommendations for remediation.
                     </p>
                     <ul className="text-sm text-gray-600 space-y-2">
                       <li>• Context-aware issue detection</li>
                       <li>• Intelligent remediation suggestions</li>
                       <li>• Learning algorithms for improved accuracy</li>
                       <li>• Natural language processing for content analysis</li>
                     </ul>
                   </div>
                   <div>
                     <h4 className="text-lg font-semibold text-gray-900 mb-4">Comprehensive Testing Coverage</h4>
                     <p className="text-gray-600 mb-4">
                       AccessiTest provides the most comprehensive accessibility testing coverage available, supporting all major file formats and web technologies. Our platform continuously updates to support new standards and emerging accessibility requirements.
                     </p>
                     <ul className="text-sm text-gray-600 space-y-2">
                       <li>• Multi-format document support</li>
                       <li>• Dynamic web content testing</li>
                       <li>• Mobile accessibility validation</li>
                       <li>• Real-time compliance monitoring</li>
                     </ul>
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
                  Powerful Features for Every Need
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  From individual developers to enterprise teams, our platform provides the tools 
                  you need to ensure accessibility compliance.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature, index) => {
                  const IconComponent = feature.icon
                  return (
                    <div key={index} className="bg-white rounded-lg p-6 border border-gray-200 hover:shadow-lg transition-shadow">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg ${feature.bgColor} ${feature.color} mb-4`}>
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                      <p className="text-gray-600">{feature.description}</p>
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
                  Comprehensive Compliance Standards
                </h2>
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Our platform ensures compliance with the most important accessibility standards 
                  used by governments, businesses, and organizations worldwide.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
                <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                  Choose the plan that fits your needs. All plans include our core accessibility testing features.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Web Scan Only</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-4">$29<span className="text-lg text-gray-600">/month</span></div>
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      Unlimited website scans
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      WCAG 2.2 compliance
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      AI recommendations
                    </li>
                  </ul>
                  <Link 
                    href="/signup" 
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Get Started
                  </Link>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Document Scan Only</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-4">$39<span className="text-lg text-gray-600">/month</span></div>
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      Unlimited document scans
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      Section 508 compliance
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      PDF, Word, PowerPoint support
                    </li>
                  </ul>
                  <Link 
                    href="/signup" 
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Get Started
                  </Link>
                </div>

                <div className="bg-white rounded-lg border-2 border-blue-500 p-6 text-center relative">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Complete Access</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-4">$59<span className="text-lg text-gray-600">/month</span></div>
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      Unlimited website scans
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      Unlimited document scans
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      WCAG 2.2 + Section 508 compliance
                    </li>
                  </ul>
                  <Link 
                    href="/signup" 
                    className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Get Started
                  </Link>
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">Pay Per Scan</h3>
                  <div className="text-3xl font-bold text-gray-900 mb-4">$1.50<span className="text-lg text-gray-600">/scan</span></div>
                  <ul className="text-left space-y-2 mb-6">
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      No monthly commitment
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      Buy credits as needed
                    </li>
                    <li className="flex items-center">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                      Same features as plans
                    </li>
                  </ul>
                  <Link 
                    href="/signup" 
                    className="w-full bg-gray-100 text-gray-900 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
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
       <section className="py-16 bg-blue-600">
         <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
           <h2 className="text-3xl font-bold text-white mb-4">
             Ready to Achieve Full Accessibility Compliance?
           </h2>
           <p className="text-xl text-blue-100 mb-8">
             Start your accessibility journey today with our comprehensive testing platform for Section 508 requirements and WCAG 2.2 compliance.
           </p>
                     <div className="flex flex-col sm:flex-row gap-4 justify-center">
             <Link 
               href="/signup" 
               className="bg-white text-blue-600 px-8 py-4 rounded-lg font-semibold text-lg hover:bg-gray-100 transition-colors"
             >
               Get Started
             </Link>
           </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-1 gap-8">
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Shield className="h-8 w-8 text-blue-400" />
                <span className="text-xl font-bold">AccessiTest</span>
              </div>
              <p className="text-gray-400 max-w-2xl mx-auto">
                Professional accessibility testing platform for Section 508 compliance, WCAG 2.2 standards, and inclusive digital experiences. AI-powered document and website accessibility testing for government, enterprise, and educational organizations.
              </p>
            </div>
            
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 AccessiTest. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
