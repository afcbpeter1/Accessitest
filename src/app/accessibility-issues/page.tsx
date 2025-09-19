'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle, Info, Eye, EyeOff, Volume2, VolumeX, MessageCircle } from 'lucide-react'

export default function AccessibilityIssuesPage() {
  const [showIssues, setShowIssues] = useState(true)

  return (
    <div className="min-h-screen bg-gray-50 accessibility-issues-demo">
      {/* Header with multiple accessibility issues */}
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/home" className="text-blue-600 hover:underline">
              <ArrowLeft className="h-5 w-5 inline mr-1" />
              Back to Home
            </Link>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setShowIssues(!showIssues)}
                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md"
              >
                {showIssues ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span>{showIssues ? 'Hide Issues' : 'Show Issues'}</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Blog Post Header */}
        <header className="mb-12">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-gray-900 mb-4">
              The Complete Guide to Web Accessibility Issues
            </h1>
            <h1 className="text-3xl font-semibold text-gray-800 mb-6">
              Every Major Axe Issue Explained with Real Examples
            </h1>
            
            <div className="flex items-center justify-center space-x-4 text-gray-600 mb-8">
              <span>By Web Accessibility Expert</span>
              <span>•</span>
              <span>March 15, 2024</span>
              <span>•</span>
              <span>15 min read</span>
            </div>
          </div>

          <div className="prose prose-lg max-w-none">
            <p className="text-xl text-gray-700 leading-relaxed mb-6">
              Web accessibility isn't just a nice-to-have feature—it's a fundamental requirement for creating 
              inclusive digital experiences. As developers, we have a responsibility to ensure our websites 
              and applications work for everyone, regardless of their abilities or the tools they use to access the web.
              Want to test your own website's accessibility? Try our <Link href="/playground" className="text-blue-600 hover:underline font-semibold">accessibility playground</Link> to see these issues in action.
            </p>

            <p className="text-lg text-gray-600 leading-relaxed mb-8">
              In this comprehensive guide, we'll explore every major accessibility issue that automated tools 
              like Axe can detect. Each issue includes real-world examples, detailed explanations of why it's 
              problematic, and step-by-step solutions. Whether you're a seasoned developer or just starting 
              your accessibility journey, this guide will help you understand and fix these critical issues.
              Ready to get started? <Link href="/home" className="text-blue-600 hover:underline font-semibold">Return to our home page</Link> to explore more accessibility tools and resources.
            </p>

            {showIssues && (
              <div className="bg-amber-50 border-l-4 border-amber-400 p-6 mb-8">
                <div className="flex items-start">
                  <AlertTriangle className="h-6 w-6 text-amber-600 flex-shrink-0 mt-1 mr-3" />
                  <div>
                    <h3 className="text-lg font-semibold text-amber-800 mb-2">Educational Notice</h3>
                    <p className="text-amber-700">
                      This page intentionally contains accessibility violations for educational purposes. 
                      Each issue is deliberately implemented to demonstrate common problems and their solutions. 
                      Use this page to test your accessibility scanner and learn how to identify and fix these issues.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Issue 1: Missing Alt Text - Blog Post */}
        <article className="mb-16">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">1. Missing Alternative Text: The Silent Barrier</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full">Critical Issue</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">WCAG 2.2 A</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full">Screen Reader Impact</span>
                </div>
              </div>
            </div>

            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Alternative text (alt text) is perhaps the most fundamental accessibility feature for images, yet it's 
                one of the most commonly overlooked. When screen readers encounter an image without proper alternative 
                text, users with visual impairments are left completely in the dark about what the image contains. 
                This creates a significant barrier to understanding and engagement with your content.
              </p>

              <p className="text-gray-700 leading-relaxed mb-6">
                The impact of missing alt text extends beyond just screen reader users. Alternative text also serves 
                users with slow internet connections who have images disabled, users with certain cognitive disabilities 
                who benefit from text descriptions, and search engines that use alt text to understand and index images. 
                In essence, alt text is the bridge that makes visual content accessible to everyone.
              </p>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Problem in Practice</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Let's examine some common scenarios where missing alt text creates real problems. Consider an e-commerce 
                site where product images have no alternative text. A screen reader user shopping for a laptop would 
                hear "image" or nothing at all, making it impossible to know if they're looking at the front view, 
                back view, or specific features of the product. This isn't just inconvenient—it's exclusionary.
              </p>

              <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-red-800 mb-3">❌ Common Broken Examples:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <img src="/allytest.png" className="w-32 h-32 object-cover rounded border mb-2" />
                    <p className="text-sm font-medium text-gray-900 mb-1">No alt attribute at all</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;img src="/product.jpg" /&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Screen reader says: "image" or skips entirely</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <img src="/allytest.png" alt="" className="w-32 h-32 object-cover rounded border mb-2" />
                    <p className="text-sm font-medium text-gray-900 mb-1">Empty alt attribute on informative image</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;img src="/chart.png" alt="" /&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Screen reader skips important data visualization</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <img src="/allytest.png" alt="image" className="w-32 h-32 object-cover rounded border mb-2" />
                    <p className="text-sm font-medium text-gray-900 mb-1">Generic, unhelpful alt text</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;img src="/screenshot.png" alt="image" /&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Screen reader says: "image" - no context provided</p>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Solution: Meaningful Alternative Text</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Writing effective alternative text is both an art and a science. The goal is to convey the same 
                information that a sighted user would get from the image, but in a concise, meaningful way. 
                Good alt text should be specific, descriptive, and contextually relevant.
              </p>

              <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-green-800 mb-3">✅ Proper Implementation Examples:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <img src="/allytest.png" alt="MacBook Pro 16-inch laptop showing the keyboard and trackpad" className="w-32 h-32 object-cover rounded border mb-2" />
                    <p className="text-sm font-medium text-gray-900 mb-1">Descriptive alt text for product image</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;img src="/laptop.jpg" alt="MacBook Pro 16-inch laptop showing the keyboard and trackpad" /&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader provides clear product description</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <img src="/allytest.png" alt="Bar chart showing 25% increase in sales from Q3 to Q4" className="w-32 h-32 object-cover rounded border mb-2" />
                    <p className="text-sm font-medium text-gray-900 mb-1">Data visualization with key insights</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;img src="/chart.png" alt="Bar chart showing 25% increase in sales from Q3 to Q4" /&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader conveys the data and its meaning</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <img src="/allytest.png" alt="" className="w-32 h-32 object-cover rounded border mb-2" />
                    <p className="text-sm font-medium text-gray-900 mb-1">Decorative image with empty alt</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;img src="/decoration.png" alt="" /&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader skips decorative elements appropriately</p>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Best Practices for Alternative Text</h3>
              
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">Guidelines for Writing Effective Alt Text:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Be specific:</strong> Instead of "chart," describe what the chart shows and its key insights</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Keep it concise:</strong> Aim for 125 characters or less, but don't sacrifice clarity</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Consider context:</strong> The same image might need different alt text depending on its purpose</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Don't start with "Image of":</strong> Screen readers already announce it's an image</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Use empty alt for decorative images:</strong> alt="" tells screen readers to skip the image</span>
                  </li>
                </ul>
              </div>

              <p className="text-gray-700 leading-relaxed mb-6">
                Remember, alternative text isn't just about compliance—it's about inclusion. When you write good alt text, 
                you're ensuring that your content is accessible to millions of users who rely on screen readers and other 
                assistive technologies. This isn't just the right thing to do; it's also good business practice, as it 
                expands your potential audience and improves your SEO.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">💡 Pro Tip:</h4>
                <p className="text-yellow-700">
                  Test your alt text by reading it aloud. If it makes sense and provides useful information without the image, 
                  you're on the right track. If it sounds awkward or unhelpful, revise it until it clearly conveys the image's purpose.
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* Issue 2: Color Contrast - Comprehensive Blog Post */}
        <article className="mb-16">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">2. Color Contrast: The Foundation of Readable Design</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full">Critical Issue</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">WCAG 2.2 AA</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full">Visual Impairment</span>
                </div>
              </div>
            </div>
            
            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Color contrast is the difference in light between text (or graphics) and their background colors. It's measured as a ratio ranging from 1:1 (no contrast) to 21:1 (maximum contrast). This seemingly simple concept is actually one of the most critical aspects of web accessibility, affecting millions of users worldwide.
              </p>

              <p className="text-gray-700 leading-relaxed mb-6">
                Why does color contrast matter so much? Consider that approximately 8% of men and 0.5% of women have some form of color vision deficiency. Additionally, many users experience temporary or permanent visual impairments due to aging, eye strain, or medical conditions. Poor contrast doesn't just make text harder to read—it can make it completely unreadable, effectively excluding users from your content.
              </p>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Understanding Contrast Ratios</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                The Web Content Accessibility Guidelines (WCAG) define specific contrast ratio requirements:
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">WCAG Contrast Requirements:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Level AA (Normal Text):</strong> 4.5:1 contrast ratio minimum</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Level AA (Large Text):</strong> 3:1 contrast ratio minimum (18pt+ or 14pt+ bold)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Level AAA (Normal Text):</strong> 7:1 contrast ratio minimum</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Level AAA (Large Text):</strong> 4.5:1 contrast ratio minimum</span>
                  </li>
                </ul>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Real-World Impact of Poor Contrast</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Imagine trying to read important information on a website with light gray text on a white background. For users with visual impairments, this isn't just inconvenient—it's impossible. Consider these scenarios:
              </p>

              <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-red-800 mb-3">❌ Common Contrast Failures:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <p className="text-gray-400 text-lg mb-2">This light gray text on white background is nearly invisible</p>
                    <p className="text-sm text-red-600">Contrast ratio: 1.2:1 (fails AA by 275%)</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-2 rounded">color: #999999; background: #ffffff;</code>
                    <p className="text-sm text-red-600 mt-2">Impact: Users with visual impairments cannot read this text at all</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <p className="text-blue-300 text-lg mb-2">Light blue text on white background</p>
                    <p className="text-sm text-red-600">Contrast ratio: 1.8:1 (fails AA by 150%)</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-2 rounded">color: #66b3ff; background: #ffffff;</code>
                    <p className="text-sm text-red-600 mt-2">Impact: Difficult to read even for users with normal vision</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <p className="text-red-400 text-lg mb-2">Light red text on white background</p>
                    <p className="text-sm text-red-600">Contrast ratio: 2.1:1 (fails AA by 114%)</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-2 rounded">color: #ff9999; background: #ffffff;</code>
                    <p className="text-sm text-red-600 mt-2">Impact: Particularly problematic for users with red-green color blindness</p>
                  </div>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Solution: Proper Contrast Implementation</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Achieving proper contrast doesn't mean sacrificing your design aesthetic. With careful color selection and testing, you can create beautiful, accessible designs that work for everyone. The key is understanding how to measure and implement contrast effectively.
              </p>

              <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-green-800 mb-3">✅ Proper Contrast Examples:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <p className="text-gray-900 text-lg mb-2">Dark gray text on white background</p>
                    <p className="text-sm text-green-600">Contrast ratio: 21:1 (exceeds AAA by 200%)</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-2 rounded">color: #000000; background: #ffffff;</code>
                    <p className="text-sm text-green-600 mt-2">Impact: Excellent readability for all users</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <p className="text-blue-800 text-lg mb-2">Dark blue text on white background</p>
                    <p className="text-sm text-green-600">Contrast ratio: 8.6:1 (exceeds AA by 91%)</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-2 rounded">color: #1e40af; background: #ffffff;</code>
                    <p className="text-sm text-green-600 mt-2">Impact: Great readability with brand color</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <p className="text-red-700 text-lg mb-2">Dark red text on white background</p>
                    <p className="text-sm text-green-600">Contrast ratio: 5.3:1 (exceeds AA by 18%)</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-2 rounded">color: #b91c1c; background: #ffffff;</code>
                    <p className="text-sm text-green-600 mt-2">Impact: Good readability with warm color</p>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Advanced Contrast Considerations</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Beyond basic text contrast, consider these additional factors that affect readability:
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-4">Additional Contrast Factors:</h4>
                <ul className="space-y-3 text-yellow-700">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Interactive elements:</strong> Buttons and links need sufficient contrast in all states (normal, hover, focus, active)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Focus indicators:</strong> Focus outlines must have at least 3:1 contrast against adjacent colors</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Graphical elements:</strong> Icons, charts, and infographics need proper contrast</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Color-only information:</strong> Never rely solely on color to convey information</span>
                  </li>
                </ul>
            </div>
            
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Testing and Implementation Tools</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Proper contrast testing requires more than just visual inspection. Use these tools and techniques to ensure your designs meet accessibility standards:
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">Essential Contrast Testing Tools:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>WebAIM Contrast Checker:</strong> Free online tool for testing color combinations</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>axe DevTools:</strong> Browser extension that automatically detects contrast issues</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Color Oracle:</strong> Simulates different types of color vision deficiency</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Browser DevTools:</strong> Built-in contrast ratio calculations in modern browsers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Our Accessibility Playground:</strong> <Link href="/playground" className="text-blue-600 hover:underline">Test contrast issues live</Link> with interactive examples</span>
                  </li>
                </ul>
            </div>

              <p className="text-gray-700 leading-relaxed mb-6">
                Remember, color contrast isn't just about compliance—it's about creating inclusive experiences. When you design with proper contrast, you're ensuring that your content is accessible to users with visual impairments, those using devices in bright sunlight, and anyone experiencing temporary vision difficulties. This isn't just good accessibility practice; it's good design practice that benefits all users.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">💡 Pro Tip:</h4>
                <p className="text-yellow-700">
                  Test your designs in different lighting conditions and on various devices. What looks good on your high-resolution monitor in a dark room might be unreadable on a mobile device in bright sunlight. Always test with real users when possible, especially those with visual impairments.
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* Issue 3: Missing Form Labels - Comprehensive Blog Post */}
        <article className="mb-16">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">3. Missing Form Labels: The Silent Barrier to Digital Interaction</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full">Critical Issue</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">WCAG 2.2 A</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full">Screen Reader Impact</span>
                </div>
              </div>
            </div>

            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Form labels are the bridge between visual design and assistive technology. They provide essential context that tells users what information is expected in each form field. Without proper labels, screen readers can only announce "edit text" or "button" without any indication of what the field is for, making forms completely unusable for users with visual impairments.
              </p>

              <p className="text-gray-700 leading-relaxed mb-6">
                The impact of missing form labels extends far beyond just screen reader users. Labels also benefit users with cognitive disabilities who need clear instructions, users with motor impairments who rely on voice recognition software, and even sighted users who benefit from clear, persistent labels that don't disappear when they start typing.
              </p>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Understanding the Problem</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                When a screen reader encounters an unlabeled form field, it has no way to communicate the field's purpose to the user. This creates a fundamental barrier to completing any form-based task, from simple contact forms to complex multi-step registration processes. The user is left guessing what information to enter, leading to frustration and abandonment.
              </p>

              <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-red-800 mb-3">❌ Common Label Failures:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <input type="text" placeholder="Enter your name" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                    <p className="text-sm font-medium text-gray-900 mb-1">Relying only on placeholder text</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;input type="text" placeholder="Enter your name" /&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Screen reader says: "edit text" - no context provided</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <span className="text-sm text-gray-600">Email:</span>
                    <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1" />
                    <p className="text-sm font-medium text-gray-900 mb-1">Visual label without proper association</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;span&gt;Email:&lt;/span&gt;<br/>&lt;input type="email" /&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Screen reader doesn't connect the label with the input</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <input type="password" placeholder="Password" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                    <p className="text-sm font-medium text-gray-900 mb-1">No accessible name for password field</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;input type="password" placeholder="Password" /&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Critical security issue - users don't know it's a password field</p>
                  </div>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Solution: Proper Label Implementation</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                There are several ways to properly associate labels with form controls, each with specific use cases and benefits. The key is ensuring that every form control has a programmatically associated label that clearly describes its purpose.
              </p>

              <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-green-800 mb-3">✅ Proper Label Implementation:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                    <input type="text" id="name" name="name" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
                    <p className="text-sm font-medium text-gray-900 mb-1">Explicit label association with for/id</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;label for="name"&gt;Full Name&lt;/label&gt;<br/>&lt;input type="text" id="name" name="name" /&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader says: "Full Name, edit text"</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email Address
                      <input type="email" name="email" className="w-full px-3 py-2 border border-gray-300 rounded-md mt-1" />
                    </label>
                    <p className="text-sm font-medium text-gray-900 mb-1">Implicit label association (wrapped)</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;label&gt;Email Address<br/>&nbsp;&nbsp;&lt;input type="email" name="email" /&gt;<br/>&lt;/label&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader says: "Email Address, edit text"</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                    <textarea id="message" name="message" rows={3} className="w-full px-3 py-2 border border-gray-300 rounded-md"></textarea>
                    <p className="text-sm font-medium text-gray-900 mb-1">Label for textarea element</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;label for="message"&gt;Message&lt;/label&gt;<br/>&lt;textarea id="message" name="message"&gt;&lt;/textarea&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader says: "Message, edit text"</p>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Advanced Labeling Techniques</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Sometimes, simple labels aren't enough. Complex forms may require additional context, error messages, or instructions. Here are advanced techniques for comprehensive form accessibility:
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">Advanced Labeling Strategies:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>aria-describedby:</strong> Link additional instructions or error messages to form controls</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>aria-required:</strong> Indicate required fields programmatically</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>aria-invalid:</strong> Communicate validation errors to screen readers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>fieldset and legend:</strong> Group related form controls with clear section headers</span>
                  </li>
                </ul>
            </div>
            
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Common Labeling Mistakes to Avoid</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Even experienced developers make these common mistakes when implementing form labels. Understanding these pitfalls helps prevent accessibility issues:
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-4">Labeling Anti-Patterns:</h4>
                <ul className="space-y-3 text-yellow-700">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Placeholder-only labels:</strong> Placeholders disappear when users start typing and aren't accessible to screen readers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Vague labels:</strong> "Input" or "Field" don't provide meaningful context</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Missing required indicators:</strong> Users need to know which fields are mandatory</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Inconsistent labeling:</strong> Similar fields should have consistent label patterns</span>
                  </li>
                </ul>
            </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Testing and Validation</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Proper form label testing requires both automated tools and manual testing with assistive technologies. Here's how to ensure your forms are truly accessible:
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">Form Label Testing Checklist:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Screen reader testing:</strong> Navigate through forms using only keyboard and screen reader</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Automated testing:</strong> Use axe-core or similar tools to detect missing labels</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Visual inspection:</strong> Ensure labels are visible and properly positioned</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>User testing:</strong> Test with real users who rely on assistive technologies</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Interactive testing:</strong> <Link href="/playground" className="text-blue-600 hover:underline">Try our playground</Link> to test form accessibility in real-time</span>
                  </li>
                </ul>
          </div>

              <p className="text-gray-700 leading-relaxed mb-6">
                Remember, form labels aren't just about compliance—they're about creating inclusive digital experiences. When you properly label your forms, you're ensuring that all users can successfully complete tasks, submit information, and engage with your application. This isn't just good accessibility practice; it's good user experience design that benefits everyone.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">💡 Pro Tip:</h4>
                <p className="text-yellow-700">
                  Test your forms by navigating through them using only the Tab key and listening to what screen readers announce. If you can't understand what each field is for without looking at the screen, your labels need improvement. The goal is to make forms completely usable without any visual context.
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* Issue 4: Poor Heading Structure - Comprehensive Blog Post */}
        <article className="mb-16">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">4. Poor Heading Structure: The Invisible Navigation System</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full">Critical Issue</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">WCAG 2.2 A</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full">Navigation Impact</span>
                </div>
              </div>
            </div>

            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Heading structure is the invisible skeleton that gives your content meaning and organization. Just as a book has chapters, sections, and subsections, web content needs a logical hierarchy that screen readers and other assistive technologies can understand and navigate. When this structure is broken or inconsistent, users lose their way in your content.
              </p>

              <p className="text-gray-700 leading-relaxed mb-6">
                Screen readers use headings to create a navigation map of your page, allowing users to jump directly to sections that interest them. Without proper heading structure, this navigation becomes impossible, forcing users to read through content linearly from beginning to end—a time-consuming and frustrating experience.
              </p>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Understanding Heading Hierarchy</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                HTML provides six heading levels (h1 through h6), each representing a different level of importance and hierarchy. The key principles are:
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">Heading Structure Principles:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>One h1 per page:</strong> The main topic or page title should be the only h1</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Logical progression:</strong> Don't skip heading levels (h1 → h2 → h3, not h1 → h3)</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Semantic meaning:</strong> Use headings to structure content, not for styling</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Consistent hierarchy:</strong> Similar content should use the same heading level</span>
                  </li>
                </ul>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Real-World Impact of Poor Structure</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Consider a user trying to navigate a long article or documentation page. With proper heading structure, they can quickly jump to the section they need. Without it, they're forced to read everything sequentially, making the content effectively unusable for efficient navigation.
              </p>

              <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-red-800 mb-3">❌ Common Heading Structure Failures:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <h1 className="text-2xl font-bold mb-2">Page Title</h1>
                    <h3 className="text-lg font-semibold mb-2">Skipped h2, went directly to h3</h3>
                    <h4 className="text-base font-semibold mb-2">Then h4</h4>
                    <p className="text-sm font-medium text-gray-900 mb-1">Skipping heading levels</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;h1&gt;Page Title&lt;/h1&gt;<br/>&lt;h3&gt;Section&lt;/h3&gt;<br/>&lt;h4&gt;Subsection&lt;/h4&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Screen reader navigation is broken - users can't understand the hierarchy</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <h1 className="text-2xl font-bold mb-2">First h1</h1>
                    <h1 className="text-2xl font-bold mb-2">Second h1</h1>
                    <h1 className="text-2xl font-bold mb-2">Third h1</h1>
                    <p className="text-sm font-medium text-gray-900 mb-1">Multiple h1 elements</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;h1&gt;Section 1&lt;/h1&gt;<br/>&lt;h1&gt;Section 2&lt;/h1&gt;<br/>&lt;h1&gt;Section 3&lt;/h1&gt;</code>
                    <p className="text-sm text-red-600 mt-2">No clear page structure - confusing for screen readers</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <h2 className="text-xl font-semibold mb-2">No h1 on the page</h2>
                    <h3 className="text-lg font-semibold mb-2">Starting with h2</h3>
                    <h4 className="text-base font-semibold mb-2">Then h3</h4>
                    <p className="text-sm font-medium text-gray-900 mb-1">Missing main heading</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;h2&gt;Main Section&lt;/h2&gt;<br/>&lt;h3&gt;Subsection&lt;/h3&gt;</code>
                    <p className="text-sm text-red-600 mt-2">No clear page title or main topic</p>
                  </div>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Solution: Proper Heading Implementation</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Creating proper heading structure is about understanding your content's logical organization and expressing that hierarchy through semantic HTML. The goal is to create a clear, navigable structure that works for all users.
              </p>

              <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-green-800 mb-3">✅ Proper Heading Structure:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <h1 className="text-2xl font-bold mb-2">Web Accessibility Guide</h1>
                    <h2 className="text-xl font-semibold mb-2">Understanding WCAG Guidelines</h2>
                    <h3 className="text-lg font-semibold mb-2">Level A Requirements</h3>
                    <h4 className="text-base font-semibold mb-2">Color Contrast Standards</h4>
                    <p className="text-sm font-medium text-gray-900 mb-1">Logical hierarchy with proper progression</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;h1&gt;Web Accessibility Guide&lt;/h1&gt;<br/>&lt;h2&gt;Understanding WCAG Guidelines&lt;/h2&gt;<br/>&lt;h3&gt;Level A Requirements&lt;/h3&gt;<br/>&lt;h4&gt;Color Contrast Standards&lt;/h4&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader can navigate: h1 → h2 → h3 → h4</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <h1 className="text-2xl font-bold mb-2">Single h1 per page</h1>
                    <h2 className="text-xl font-semibold mb-2">Section 1: Introduction</h2>
                    <h2 className="text-xl font-semibold mb-2">Section 2: Implementation</h2>
                    <h3 className="text-lg font-semibold mb-2">Subsection 2.1: Best Practices</h3>
                    <h3 className="text-lg font-semibold mb-2">Subsection 2.2: Common Mistakes</h3>
                    <p className="text-sm font-medium text-gray-900 mb-1">Consistent structure with parallel sections</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;h1&gt;Page Title&lt;/h1&gt;<br/>&lt;h2&gt;Section 1&lt;/h2&gt;<br/>&lt;h2&gt;Section 2&lt;/h2&gt;<br/>&lt;h3&gt;Subsection 2.1&lt;/h3&gt;<br/>&lt;h3&gt;Subsection 2.2&lt;/h3&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Clear parallel structure for similar content</p>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Advanced Heading Considerations</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Beyond basic hierarchy, there are several advanced considerations for creating truly accessible heading structures:
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-4">Advanced Heading Best Practices:</h4>
                <ul className="space-y-3 text-yellow-700">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Descriptive headings:</strong> Make headings meaningful and descriptive, not just "Section 1"</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Consistent styling:</strong> Use CSS to style headings, not different heading levels for visual appearance</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Landmark integration:</strong> Consider how headings work with ARIA landmarks and regions</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Content organization:</strong> Group related content under appropriate heading levels</span>
                  </li>
                </ul>
            </div>
            
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Testing Heading Structure</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Proper heading structure testing involves both automated tools and manual navigation testing. Here's how to ensure your headings work correctly:
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">Heading Structure Testing Methods:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Screen reader navigation:</strong> Use heading navigation shortcuts to jump through your content</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Browser developer tools:</strong> Use accessibility panels to inspect heading hierarchy</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Automated testing:</strong> Use axe-core or similar tools to detect heading structure issues</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Visual inspection:</strong> Review your content outline to ensure logical flow</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Practice with examples:</strong> <Link href="/playground" className="text-blue-600 hover:underline">Visit our playground</Link> to see heading structure in action</span>
                  </li>
                </ul>
            </div>

              <p className="text-gray-700 leading-relaxed mb-6">
                Remember, heading structure isn't just about accessibility—it's about creating well-organized, navigable content that benefits all users. When you structure your headings properly, you're creating a roadmap that helps everyone understand and navigate your content efficiently. This isn't just good accessibility practice; it's good information architecture that improves the user experience for everyone.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">💡 Pro Tip:</h4>
                <p className="text-yellow-700">
                  Think of your headings as a table of contents. If you can create a meaningful outline from your headings alone, your structure is likely good. If your outline doesn't make sense or is confusing, your heading structure needs improvement. The goal is to make your content's organization immediately clear to all users.
                </p>
          </div>
            </div>
          </div>
        </article>

        {/* Issue 5: Missing Focus Indicators */}
        <section className="mb-12">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start space-x-3 mb-4">
              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">5. Missing Focus Indicators</h2>
                <p className="text-gray-600 mb-4">
                  <strong>Issue:</strong> Interactive elements without visible focus indicators are hard to navigate with keyboard.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-3">❌ No Focus Indicators:</h3>
                <div className="space-y-4">
                  <div>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-md focus:outline-none">
                      Button with no focus
                    </button>
                    <p className="text-sm text-red-600 mt-1">No visible focus indicator</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">button:focus {`{ outline: none; }`}</code>
                  </div>
                  <div>
                    <a href="#" className="text-blue-600 hover:underline focus:outline-none">
                      Link with no focus
                    </a>
                    <p className="text-sm text-red-600 mt-1">No visible focus indicator</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">a:focus {`{ outline: none; }`}</code>
                  </div>
                  <div>
                    <input type="text" placeholder="Input with no focus" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none" />
                    <p className="text-sm text-red-600 mt-1">No visible focus indicator</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">input:focus {`{ outline: none; }`}</code>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Good Focus Indicators:</h3>
                <div className="space-y-4">
                  <div>
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                      Button with focus
                    </button>
                    <p className="text-sm text-green-600 mt-1">Clear focus indicator</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">button:focus {`{ ring: 2px solid blue; }`}</code>
                  </div>
                  <div>
                    <a href="#" className="text-blue-600 hover:underline focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
                      Link with focus
                    </a>
                    <p className="text-sm text-green-600 mt-1">Clear focus indicator</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">a:focus {`{ ring: 2px solid blue; }`}</code>
                  </div>
                  <div>
                    <input type="text" placeholder="Input with focus" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" />
                    <p className="text-sm text-green-600 mt-1">Clear focus indicator</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">input:focus {`{ ring: 2px solid blue; }`}</code>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">How to Fix:</h4>
              <p className="text-blue-800 text-sm">
                Provide visible focus indicators for all interactive elements. Use CSS :focus pseudo-class with outline, border, or box-shadow. 
                Focus indicators should have at least 2px thickness and sufficient color contrast.
              </p>
            </div>
          </div>
        </section>

        {/* Issue 6: Unclear Link Purpose */}
        <section className="mb-12">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start space-x-3 mb-4">
              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">6. Unclear Link Purpose</h2>
                <p className="text-gray-600 mb-4">
                  <strong>Issue:</strong> Links with generic text don't explain their destination or purpose.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-3">❌ Unclear Link Text:</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded border border-red-200">
                    <p>Learn about accessibility <a href="#" className="text-blue-600 hover:underline">click here</a></p>
                    <p className="text-sm text-red-600 mt-1">Generic "click here" text</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;a href="#"&gt;click here&lt;/a&gt;</code>
                  </div>
                  <div className="p-4 bg-red-50 rounded border border-red-200">
                    <p>For more information <a href="#" className="text-blue-600 hover:underline">read more</a></p>
                    <p className="text-sm text-red-600 mt-1">Generic "read more" text</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;a href="#"&gt;read more&lt;/a&gt;</code>
                  </div>
                  <div className="p-4 bg-red-50 rounded border border-red-200">
                    <p>Additional resources: <a href="#" className="text-blue-600 hover:underline">more</a></p>
                    <p className="text-sm text-red-600 mt-1">Generic "more" text</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;a href="#"&gt;more&lt;/a&gt;</code>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Clear Link Text:</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded border border-green-200">
                    <p>Learn about <a href="#" className="text-blue-600 hover:underline">WCAG accessibility guidelines</a></p>
                    <p className="text-sm text-green-600 mt-1">Descriptive link text</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;a href="#"&gt;WCAG accessibility guidelines&lt;/a&gt;</code>
                  </div>
                  <div className="p-4 bg-green-50 rounded border border-green-200">
                    <p>For more information about <a href="#" className="text-blue-600 hover:underline">accessibility testing tools</a></p>
                    <p className="text-sm text-green-600 mt-1">Descriptive link text</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;a href="#"&gt;accessibility testing tools&lt;/a&gt;</code>
                  </div>
                  <div className="p-4 bg-green-50 rounded border border-green-200">
                    <p>Additional resources: <a href="#" className="text-blue-600 hover:underline">inclusive design principles</a></p>
                    <p className="text-sm text-green-600 mt-1">Descriptive link text</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;a href="#"&gt;inclusive design principles&lt;/a&gt;</code>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">How to Fix:</h4>
              <p className="text-blue-800 text-sm">
                Make link text descriptive and self-explanatory. The link text should clearly indicate the destination or action. 
                Avoid generic phrases like "click here", "read more", or "more". Screen readers can navigate by links, so clear text is essential.
              </p>
            </div>
          </div>
        </section>

        {/* Issue 7: Buttons Without Accessible Names */}
        <section className="mb-12">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start space-x-3 mb-4">
              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">7. Buttons Without Accessible Names</h2>
                <p className="text-gray-600 mb-4">
                  <strong>Issue:</strong> Buttons with only icons or symbols have no accessible text for screen readers.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-3">❌ Inaccessible Buttons:</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-red-50 rounded border border-red-200">
                    <button className="bg-green-600 text-white px-4 py-2 rounded-md">
                      ✓
                    </button>
                    <p className="text-sm text-red-600 mt-1">Button with only symbol</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;button&gt;✓&lt;/button&gt;</code>
                  </div>
                  <div className="p-4 bg-red-50 rounded border border-red-200">
                    <button className="bg-red-600 text-white px-4 py-2 rounded-md">
                      ✗
                    </button>
                    <p className="text-sm text-red-600 mt-1">Button with only symbol</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;button&gt;✗&lt;/button&gt;</code>
                  </div>
                  <div className="p-4 bg-red-50 rounded border border-red-200">
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-md">
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <p className="text-sm text-red-600 mt-1">Button with only icon</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;button&gt;&lt;Icon /&gt;&lt;/button&gt;</code>
                  </div>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Accessible Buttons:</h3>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded border border-green-200">
                    <button className="bg-green-600 text-white px-4 py-2 rounded-md" aria-label="Approve">
                      ✓
                    </button>
                    <p className="text-sm text-green-600 mt-1">Button with aria-label</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;button aria-label="Approve"&gt;✓&lt;/button&gt;</code>
                  </div>
                  <div className="p-4 bg-green-50 rounded border border-green-200">
                    <button className="bg-red-600 text-white px-4 py-2 rounded-md" aria-label="Reject">
                      ✗
                    </button>
                    <p className="text-sm text-green-600 mt-1">Button with aria-label</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;button aria-label="Reject"&gt;✗&lt;/button&gt;</code>
                  </div>
                  <div className="p-4 bg-green-50 rounded border border-green-200">
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-md" aria-label="Send message">
                      <MessageCircle className="h-4 w-4" />
                    </button>
                    <p className="text-sm text-green-600 mt-1">Button with aria-label</p>
                    <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;button aria-label="Send message"&gt;&lt;Icon /&gt;&lt;/button&gt;</code>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">How to Fix:</h4>
              <p className="text-blue-800 text-sm">
                Provide accessible names for buttons using text content, aria-label, or aria-labelledby. 
                Screen readers need to know what the button does, not just that it's a button.
              </p>
            </div>
          </div>
        </section>

        {/* Issue 8: Table Without Headers */}
        <section className="mb-12">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start space-x-3 mb-4">
              <XCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-1" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">8. Table Without Headers</h2>
                <p className="text-gray-600 mb-4">
                  <strong>Issue:</strong> Tables without proper header structure are hard to understand with screen readers.
                </p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-red-800 mb-3">❌ Table Without Headers:</h3>
                <div className="p-4 bg-red-50 rounded border border-red-200">
                  <table className="w-full border border-gray-300">
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2 font-semibold">Disability Type</td>
                        <td className="border border-gray-300 px-4 py-2 font-semibold">Percentage</td>
                        <td className="border border-gray-300 px-4 py-2 font-semibold">Impact</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2">Visual Impairment</td>
                        <td className="border border-gray-300 px-4 py-2">2.2%</td>
                        <td className="border border-gray-300 px-4 py-2">Screen readers</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2">Motor Impairment</td>
                        <td className="border border-gray-300 px-4 py-2">6.8%</td>
                        <td className="border border-gray-300 px-4 py-2">Keyboard navigation</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-sm text-red-600 mt-2">Using td instead of th for headers</p>
                  <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;td&gt;Disability Type&lt;/td&gt;</code>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-green-800 mb-3">✅ Table With Headers:</h3>
                <div className="p-4 bg-green-50 rounded border border-green-200">
                  <table className="w-full border border-gray-300">
                    <caption className="text-left font-semibold mb-2">Accessibility Statistics</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="border border-gray-300 px-4 py-2 bg-gray-100">Disability Type</th>
                        <th scope="col" className="border border-gray-300 px-4 py-2 bg-gray-100">Percentage</th>
                        <th scope="col" className="border border-gray-300 px-4 py-2 bg-gray-100">Impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2">Visual Impairment</td>
                        <td className="border border-gray-300 px-4 py-2">2.2%</td>
                        <td className="border border-gray-300 px-4 py-2">Screen readers</td>
                      </tr>
                      <tr>
                        <td className="border border-gray-300 px-4 py-2">Motor Impairment</td>
                        <td className="border border-gray-300 px-4 py-2">6.8%</td>
                        <td className="border border-gray-300 px-4 py-2">Keyboard navigation</td>
                      </tr>
                    </tbody>
                  </table>
                  <p className="text-sm text-green-600 mt-2">Proper th elements with scope</p>
                  <code className="text-xs bg-gray-100 p-2 block mt-1">&lt;th scope="col"&gt;Disability Type&lt;/th&gt;</code>
                </div>
              </div>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">How to Fix:</h4>
              <p className="text-blue-800 text-sm">
                Use proper table structure with &lt;th&gt; elements for headers, &lt;thead&gt; for header rows, and scope attributes. 
                Add captions to describe the table's purpose. Screen readers use this structure to understand table relationships.
              </p>
            </div>
          </div>
        </section>

        {/* Issue 9: Improper List Structure - Comprehensive Blog Post */}
        <article className="mb-16">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">9. Improper List Structure: Breaking the Information Hierarchy</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full">Critical Issue</span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">WCAG 2.2 A</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full">Screen Reader Impact</span>
                </div>
              </div>
            </div>
            
            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                Lists are fundamental building blocks of web content, providing structure and meaning to related items. When lists are improperly structured, screen readers lose the ability to understand relationships between items, navigate efficiently, and provide users with context about the number of items and their position within the list.
              </p>

              <p className="text-gray-700 leading-relaxed mb-6">
                The impact of improper list structure extends beyond just screen reader users. Lists also benefit users with cognitive disabilities who rely on clear organization, users with motor impairments who use voice recognition software, and all users who benefit from well-structured, scannable content.
              </p>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Understanding List Semantics</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                HTML provides three main list types, each with specific semantic meaning:
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">List Types and Their Purposes:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Unordered lists (&lt;ul&gt;):</strong> For items without a specific order or sequence</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Ordered lists (&lt;ol&gt;):</strong> For items with a specific sequence or ranking</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Description lists (&lt;dl&gt;):</strong> For term-definition pairs or name-value groups</span>
                  </li>
                </ul>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Common List Structure Failures</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Many developers create visual lists without proper semantic structure, breaking the accessibility of their content. Here are the most common mistakes:
              </p>

              <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-red-800 mb-3">❌ Common List Structure Failures:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <p className="text-gray-700 mb-2">Common accessibility issues:</p>
                    <div className="text-gray-700">
                      • Missing alternative text for images<br/>
                      • Poor color contrast ratios<br/>
                      • Missing form labels<br/>
                      • Inaccessible keyboard navigation<br/>
                      • Missing heading structure
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Using br tags instead of proper list structure</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">• Item 1&lt;br/&gt;• Item 2&lt;br/&gt;• Item 3&lt;br/&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Screen reader treats as separate paragraphs, not a list</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <ul className="list-disc list-inside">
                      <div>List without li elements</div>
                      <div>Another item without li</div>
                      <div>Third item without li</div>
                    </ul>
                    <p className="text-sm font-medium text-gray-900 mb-1">ul with div instead of li elements</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;ul&gt;&lt;div&gt;Item&lt;/div&gt;&lt;div&gt;Item&lt;/div&gt;&lt;/ul&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Invalid HTML - screen readers can't navigate properly</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <div className="text-gray-700">
                      1. First step<br/>
                      2. Second step<br/>
                      3. Third step
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Numbered list without ol structure</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">1. Step&lt;br/&gt;2. Step&lt;br/&gt;3. Step</code>
                    <p className="text-sm text-red-600 mt-2">Screen reader doesn't understand this is a sequential list</p>
                  </div>
                </div>
              </div>
              
              <h3 className="text-2xl font-bold text-gray-900 mb-4">The Solution: Proper List Implementation</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Creating proper list structure is about using semantic HTML elements that convey meaning to assistive technologies. The goal is to create lists that are both visually appealing and programmatically accessible.
              </p>

              <div className="bg-green-50 border-l-4 border-green-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-green-800 mb-3">✅ Proper List Implementation:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <p className="text-gray-700 mb-2">Common accessibility issues:</p>
                    <ul className="list-disc list-inside text-gray-700 space-y-1">
                      <li>Missing alternative text for images</li>
                      <li>Poor color contrast ratios</li>
                      <li>Missing form labels</li>
                      <li>Inaccessible keyboard navigation</li>
                      <li>Missing heading structure</li>
                    </ul>
                    <p className="text-sm font-medium text-gray-900 mb-1">Proper ul with li elements</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;ul&gt;<br/>&nbsp;&nbsp;&lt;li&gt;Item 1&lt;/li&gt;<br/>&nbsp;&nbsp;&lt;li&gt;Item 2&lt;/li&gt;<br/>&lt;/ul&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader announces: "List with 5 items"</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <p className="text-gray-700 mb-2">Implementation steps:</p>
                    <ol className="list-decimal list-inside text-gray-700 space-y-1">
                      <li>Identify the list type needed</li>
                      <li>Use proper HTML structure</li>
                      <li>Test with screen reader</li>
                      <li>Verify navigation works</li>
                    </ol>
                    <p className="text-sm font-medium text-gray-900 mb-1">Proper ol with li elements</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;ol&gt;<br/>&nbsp;&nbsp;&lt;li&gt;Step 1&lt;/li&gt;<br/>&nbsp;&nbsp;&lt;li&gt;Step 2&lt;/li&gt;<br/>&lt;/ol&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader announces: "List with 4 items, item 1 of 4"</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <dl className="text-gray-700">
                      <dt className="font-semibold">WCAG:</dt>
                      <dd className="ml-4 mb-2">Web Content Accessibility Guidelines</dd>
                      <dt className="font-semibold">ARIA:</dt>
                      <dd className="ml-4">Accessible Rich Internet Applications</dd>
                    </dl>
                    <p className="text-sm font-medium text-gray-900 mb-1">Proper dl with dt and dd elements</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;dl&gt;<br/>&nbsp;&nbsp;&lt;dt&gt;Term&lt;/dt&gt;<br/>&nbsp;&nbsp;&lt;dd&gt;Definition&lt;/dd&gt;<br/>&lt;/dl&gt;</code>
                    <p className="text-sm text-green-600 mt-2">Screen reader announces term-definition pairs</p>
                </div>
              </div>
            </div>
            
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Advanced List Considerations</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Beyond basic list structure, there are several advanced considerations for creating truly accessible lists:
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-4">Advanced List Best Practices:</h4>
                <ul className="space-y-3 text-yellow-700">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Nested lists:</strong> Use proper nesting with ul/ol inside li elements for sub-lists</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>List styling:</strong> Use CSS to style lists, not different HTML structures for visual appearance</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Empty lists:</strong> Avoid empty list elements that confuse screen readers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>List context:</strong> Provide context about what the list contains when appropriate</span>
                  </li>
                </ul>
            </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Testing List Structure</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Proper list testing involves both automated tools and manual testing with assistive technologies. Here's how to ensure your lists work correctly:
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">List Structure Testing Methods:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Screen reader navigation:</strong> Use list navigation shortcuts to jump through list items</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Browser developer tools:</strong> Use accessibility panels to inspect list structure</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Automated testing:</strong> Use axe-core or similar tools to detect list structure issues</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Visual inspection:</strong> Ensure lists look and behave as expected</span>
                  </li>
                </ul>
          </div>

              <p className="text-gray-700 leading-relaxed mb-6">
                Remember, proper list structure isn't just about accessibility—it's about creating well-organized, scannable content that benefits all users. When you structure your lists properly, you're creating content that's easier to read, understand, and navigate. This isn't just good accessibility practice; it's good content design that improves the user experience for everyone.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">💡 Pro Tip:</h4>
                <p className="text-yellow-700">
                  Test your lists by navigating through them using screen reader list navigation shortcuts. If you can't easily jump from item to item or understand the list's structure, your list implementation needs improvement. The goal is to make list navigation as smooth and intuitive as possible.
                </p>
              </div>
            </div>
          </div>
        </article>

        {/* Additional Accessibility Issues Section */}
        <article className="mb-16">
          <div className="bg-white rounded-lg shadow-sm border p-8">
            <div className="flex items-start space-x-4 mb-6">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <Info className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Additional Critical Accessibility Issues</h2>
                <div className="flex items-center space-x-4 text-sm text-gray-600 mb-4">
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full">Important Issues</span>
                  <span className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full">Multiple WCAG Criteria</span>
                </div>
              </div>
            </div>

            <div className="prose prose-lg max-w-none mb-8">
              <p className="text-lg text-gray-700 leading-relaxed mb-6">
                While we've covered the most common accessibility issues, there are several additional problems that automated tools like Axe frequently detect. These issues, while less common, can have significant impact on users with disabilities.
              </p>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Keyboard Navigation Issues</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Keyboard navigation is essential for users with motor impairments, visual impairments, and those who prefer keyboard shortcuts. Common keyboard navigation failures include:
              </p>

              <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-red-800 mb-3">❌ Keyboard Navigation Failures:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <button className="bg-blue-600 text-white px-4 py-2 rounded-md" tabIndex={-1}>
                      Button not in tab order
                    </button>
                    <p className="text-sm font-medium text-gray-900 mb-1">tabIndex="-1" removes element from tab order</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;button tabIndex="-1"&gt;Button&lt;/button&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Keyboard users cannot reach this button</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <div className="bg-gray-200 p-4 rounded cursor-pointer" onClick={() => alert('Clicked')}>
                      Clickable div without button semantics
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">div with click handler but no button role</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;div onClick="..."&gt;Click me&lt;/div&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Not keyboard accessible, no button semantics</p>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">ARIA Implementation Issues</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                ARIA (Accessible Rich Internet Applications) attributes can enhance accessibility when used correctly, but incorrect implementation can create barriers:
              </p>

              <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-red-800 mb-3">❌ Common ARIA Mistakes:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <button aria-label="Submit form" aria-describedby="help-text">
                      Submit
                    </button>
                    <div id="help-text" style={{ display: 'none' }}>
                      This will submit your form
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">aria-describedby pointing to hidden content</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">aria-describedby="help-text" (hidden element)</code>
                    <p className="text-sm text-red-600 mt-2">Screen readers can't access hidden referenced content</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <div role="button" tabIndex={0} aria-pressed="true">
                      Toggle button
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Missing keyboard event handlers</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;div role="button"&gt;Button&lt;/div&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Looks like a button but doesn't respond to keyboard</p>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Semantic HTML Issues</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Using the wrong HTML elements or missing semantic elements can create confusion for assistive technologies:
              </p>

              <div className="bg-red-50 border-l-4 border-red-400 p-6 mb-6">
                <h4 className="text-lg font-semibold text-red-800 mb-3">❌ Semantic HTML Problems:</h4>
                <div className="space-y-4">
                  <div className="bg-white p-4 rounded border">
                    <div className="text-2xl font-bold mb-2">Page Title</div>
                    <p className="text-sm font-medium text-gray-900 mb-1">Using div instead of h1 for page title</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;div class="title"&gt;Page Title&lt;/div&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Screen readers don't recognize this as the main heading</p>
                  </div>
                  
                  <div className="bg-white p-4 rounded border">
                    <div className="bg-blue-600 text-white px-4 py-2 rounded cursor-pointer">
                      Click here to submit
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">div styled as button without button semantics</p>
                    <code className="text-xs bg-gray-100 p-2 block rounded">&lt;div class="button"&gt;Submit&lt;/div&gt;</code>
                    <p className="text-sm text-red-600 mt-2">Not recognized as interactive element</p>
                  </div>
                </div>
              </div>

              <h3 className="text-2xl font-bold text-gray-900 mb-4">Testing and Prevention</h3>
              
              <p className="text-gray-700 leading-relaxed mb-6">
                Preventing these issues requires a combination of automated testing, manual testing, and user testing. Here's a comprehensive approach:
              </p>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-lg font-semibold text-blue-900 mb-4">Comprehensive Accessibility Testing Strategy:</h4>
                <ul className="space-y-3 text-blue-800">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Automated testing:</strong> Use axe-core, WAVE, or similar tools in your development workflow</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Manual testing:</strong> Test with keyboard navigation and screen readers</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>User testing:</strong> Test with real users who have disabilities</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Code reviews:</strong> Include accessibility checks in your code review process</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2">•</span>
                    <span><strong>Interactive learning:</strong> <Link href="/playground" className="text-blue-600 hover:underline">Use our playground</Link> to practice identifying and fixing accessibility issues</span>
                  </li>
                </ul>
              </div>

              <p className="text-gray-700 leading-relaxed mb-6">
                Remember, accessibility isn't a one-time check—it's an ongoing process that should be integrated into your development workflow. By understanding these common issues and implementing proper testing strategies, you can create web experiences that work for everyone.
                Ready to put this knowledge into practice? <Link href="/home" className="text-blue-600 hover:underline font-semibold">Explore our accessibility tools</Link> and start building more inclusive web experiences today.
              </p>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <h4 className="text-lg font-semibold text-yellow-800 mb-2">💡 Pro Tip:</h4>
                <p className="text-yellow-700">
                  Start with semantic HTML and progressive enhancement. If you build with proper HTML structure first, many accessibility issues are automatically resolved. Then use ARIA and JavaScript to enhance the experience, not to fix fundamental problems.
                </p>
              </div>
            </div>
          </div>
        </article>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-white py-8 mt-12">
        <div className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-3 gap-8">
            <div>
              <h4 className="text-lg font-semibold mb-4">About Us</h4>
              <p className="text-gray-300 text-sm">
                We're passionate about creating accessible web experiences that work for everyone.
              </p>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <div className="space-y-2 text-sm">
                <Link href="/home" className="text-gray-300 hover:text-white block">Home</Link>
                <Link href="/playground" className="text-gray-300 hover:text-white block">Accessibility Playground</Link>
                <Link href="/new-scan" className="text-gray-300 hover:text-white block">Start New Scan</Link>
                <Link href="/pricing" className="text-gray-300 hover:text-white block">Pricing</Link>
              </div>
            </div>
            <div>
              <h4 className="text-lg font-semibold mb-4">Connect</h4>
              <div className="space-y-2 text-sm">
                <a href="#" className="text-gray-300 hover:text-white block">Twitter</a>
                <a href="#" className="text-gray-300 hover:text-white block">LinkedIn</a>
                <a href="#" className="text-gray-300 hover:text-white block">GitHub</a>
                <a href="#" className="text-gray-300 hover:text-white block">Email</a>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-700 mt-8 pt-4 text-center text-sm text-gray-400">
            <p>&copy; 2024 Accessibility Blog. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Hidden content that affects accessibility */}
      <div style={{ display: 'none' }}>
        <p>This content is hidden with display: none</p>
      </div>
      
      <div style={{ visibility: 'hidden' }}>
        <p>This content is hidden with visibility: hidden</p>
      </div>

      <div aria-hidden="true">
        <p>This content is hidden with aria-hidden</p>
      </div>
    </div>
  )
}
