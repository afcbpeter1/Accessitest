'use client'

import React, { useState } from 'react'
import { CheckCircle, XCircle, AlertTriangle, Code, Eye, EyeOff, Volume2, VolumeX, MousePointer, Keyboard, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface AccessibilityIssue {
  id: string
  title: string
  description: string
  wcagLevel: 'A' | 'AA' | 'AAA'
  impact: 'critical' | 'serious' | 'moderate' | 'minor'
  category: 'color' | 'navigation' | 'forms' | 'images' | 'structure' | 'interaction'
  html: string
  fixedHtml: string
  explanation: string
  hint: string
  isFixed: boolean
}

const initialIssues: AccessibilityIssue[] = [
  {
    id: 'color-contrast-1',
    title: 'Insufficient Color Contrast',
    description: 'Text color is too light against the background',
    wcagLevel: 'AA',
    impact: 'serious',
    category: 'color',
    html: '<p style="color: #999999; background: white;">This text has poor contrast</p>',
    fixedHtml: '<p style="color: #333333; background: white;">This text has good contrast</p>',
    explanation: 'Text must have a contrast ratio of at least 4.5:1 for normal text and 3:1 for large text to meet WCAG AA standards.',
    hint: 'Try changing the text color to a darker shade',
    isFixed: false
  },
  {
    id: 'missing-alt-text',
    title: 'Missing Alt Text',
    description: 'Image is missing alternative text for screen readers',
    wcagLevel: 'A',
    impact: 'critical',
    category: 'images',
    html: '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzQ0NDQiLz48dGV4dCB4PSI1MCIgeT0iMTAwIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCI+SW1hZ2U8L3RleHQ+PC9zdmc+" />',
    fixedHtml: '<img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjIwMCIgZmlsbD0iIzQ0NDQiLz48dGV4dCB4PSI1MCIgeT0iMTAwIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxOCI+SW1hZ2U8L3RleHQ+PC9zdmc+" alt="A beautiful landscape with mountains and trees" />',
    explanation: 'All images must have alt text to describe their content for users who cannot see them.',
    hint: 'Add an alt attribute to describe what the image shows',
    isFixed: false
  },
  {
    id: 'missing-heading',
    title: 'Missing Heading Structure',
    description: 'Page lacks proper heading hierarchy',
    wcagLevel: 'A',
    impact: 'serious',
    category: 'structure',
    html: '<div>Welcome to our website</div><p>This is some content</p>',
    fixedHtml: '<h1>Welcome to our website</h1><p>This is some content</p>',
    explanation: 'Headings provide structure and help screen reader users navigate the page.',
    hint: 'Replace the div with an h1 heading',
    isFixed: false
  },
  {
    id: 'button-no-label',
    title: 'Button Without Accessible Name',
    description: 'Button only contains an icon without text or aria-label',
    wcagLevel: 'A',
    impact: 'serious',
    category: 'interaction',
    html: '<button><span>×</span></button>',
    fixedHtml: '<button aria-label="Close dialog"><span>×</span></button>',
    explanation: 'Buttons must have accessible names so screen readers can announce their purpose.',
    hint: 'Add an aria-label attribute to describe the button\'s function',
    isFixed: false
  },
  {
    id: 'form-no-label',
    title: 'Form Input Without Label',
    description: 'Input field is missing an associated label',
    wcagLevel: 'A',
    impact: 'serious',
    category: 'forms',
    html: '<input type="email" placeholder="Enter your email" />',
    fixedHtml: '<label for="email">Email Address</label><input type="email" id="email" placeholder="Enter your email" />',
    explanation: 'Form inputs must have labels so users know what information to provide.',
    hint: 'Add a label element and associate it with the input using the for attribute',
    isFixed: false
  },
  {
    id: 'link-no-text',
    title: 'Link Without Accessible Text',
    description: 'Link only contains an image without descriptive text',
    wcagLevel: 'A',
    impact: 'serious',
    category: 'navigation',
    html: '<a href="/home"><img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMjUiIHk9IjMwIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMiI+SG9tZTwvdGV4dD48L3N2Zz4=" /></a>',
    fixedHtml: '<a href="/home"><img src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNTAiIGhlaWdodD0iNTAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjUwIiBoZWlnaHQ9IjUwIiBmaWxsPSIjNDQ0Ii8+PHRleHQgeD0iMjUiIHk9IjMwIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSIxMiI+SG9tZTwvdGV4dD48L3N2Zz4=" alt="Go to homepage" /></a>',
    explanation: 'Links must have accessible text so screen readers can announce their destination.',
    hint: 'Add alt text to the image or include text within the link',
    isFixed: false
  },
  {
    id: 'small-touch-target',
    title: 'Touch Target Too Small',
    description: 'Interactive element is too small for easy touch interaction',
    wcagLevel: 'AA',
    impact: 'moderate',
    category: 'interaction',
    html: '<button style="width: 20px; height: 20px;">×</button>',
    fixedHtml: '<button style="width: 44px; height: 44px; padding: 8px;">×</button>',
    explanation: 'Touch targets must be at least 44x44 pixels to be easily tappable on mobile devices.',
    hint: 'Increase the button size to at least 44x44 pixels',
    isFixed: false
  },
  {
    id: 'missing-focus-indicator',
    title: 'Missing Focus Indicator',
    description: 'Interactive element has no visible focus indicator',
    wcagLevel: 'AA',
    impact: 'moderate',
    category: 'interaction',
    html: '<button style="outline: none;">Click me</button>',
    fixedHtml: '<button style="outline: 2px solid #0066cc; outline-offset: 2px;">Click me</button>',
    explanation: 'Interactive elements must have visible focus indicators for keyboard navigation.',
    hint: 'Add a visible outline or border when the element is focused',
    isFixed: false
  }
]

export default function AccessibilityPlayground() {
  const [issues, setIssues] = useState<AccessibilityIssue[]>(initialIssues)
  const [selectedIssue, setSelectedIssue] = useState<AccessibilityIssue | null>(null)
  const [showHints, setShowHints] = useState(false)
  const [completedIssues, setCompletedIssues] = useState<string[]>([])
  const [userCode, setUserCode] = useState('')
  const [showPreview, setShowPreview] = useState(false)

  const handleIssueSelect = (issue: AccessibilityIssue) => {
    setSelectedIssue(issue)
    setUserCode(issue.html)
    setShowPreview(false)
  }

  const handleCodeChange = (code: string) => {
    setUserCode(code)
  }

  const checkSolution = () => {
    if (!selectedIssue) return

    // Simple check - in a real implementation, you'd want more sophisticated validation
    const isCorrect = userCode.includes(selectedIssue.fixedHtml.split('>')[0].split('<')[1]) ||
                     userCode.includes('alt=') ||
                     userCode.includes('aria-label') ||
                     userCode.includes('label') ||
                     userCode.includes('h1') ||
                     userCode.includes('h2') ||
                     userCode.includes('h3') ||
                     userCode.includes('outline') ||
                     userCode.includes('44px')

    if (isCorrect) {
      const updatedIssues = issues.map(issue => 
        issue.id === selectedIssue.id ? { ...issue, isFixed: true } : issue
      )
      setIssues(updatedIssues)
      setCompletedIssues([...completedIssues, selectedIssue.id])
      setShowPreview(true)
    } else {
      alert('Not quite right! Try again or use the hint.')
    }
  }

  const resetIssue = () => {
    if (selectedIssue) {
      setUserCode(selectedIssue.html)
      setShowPreview(false)
    }
  }

  const getProgressPercentage = () => {
    return Math.round((completedIssues.length / issues.length) * 100)
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'color': return <Eye className="h-4 w-4" />
      case 'navigation': return <MousePointer className="h-4 w-4" />
      case 'forms': return <Code className="h-4 w-4" />
      case 'images': return <Eye className="h-4 w-4" />
      case 'structure': return <Code className="h-4 w-4" />
      case 'interaction': return <Keyboard className="h-4 w-4" />
      default: return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'critical': return 'text-red-800 bg-red-50 border-red-200'
      case 'serious': return 'text-orange-800 bg-orange-50 border-orange-200'
      case 'moderate': return 'text-yellow-800 bg-yellow-50 border-yellow-200'
      case 'minor': return 'text-blue-800 bg-blue-50 border-blue-200'
      default: return 'text-gray-800 bg-gray-50 border-gray-200'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900">
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Home</span>
              </Link>
              <div className="h-6 w-px bg-gray-300"></div>
              <h1 className="text-xl font-semibold text-gray-900">AccessScan</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="text-gray-600 hover:text-gray-900">Sign In</Link>
              <Link href="/signup" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Get Started</Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* Hero Section */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-8 rounded-lg">
            <h1 className="text-4xl font-bold mb-4">🎓 Accessibility Playground</h1>
            <p className="text-blue-100 text-xl mb-6">
              Learn accessibility by fixing real issues! Practice makes perfect.
            </p>
            <div className="flex items-center space-x-6">
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <span className="text-sm font-medium">Progress: {completedIssues.length}/{issues.length}</span>
              </div>
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <span className="text-sm font-medium">{getProgressPercentage()}% Complete</span>
              </div>
              <div className="bg-white/20 rounded-lg px-4 py-2">
                <span className="text-sm font-medium">Free Learning Tool</span>
              </div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-4">
            <div 
              className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${getProgressPercentage()}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Issues List */}
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">Accessibility Issues</h2>
              <div className="space-y-3">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className={`p-4 border rounded-lg cursor-pointer transition-all ${
                      selectedIssue?.id === issue.id
                        ? 'border-blue-500 bg-blue-50'
                        : issue.isFixed
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}
                    onClick={() => handleIssueSelect(issue)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {issue.isFixed ? (
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600 mt-0.5" />
                        )}
                        <div>
                          <h3 className="font-medium text-gray-900">{issue.title}</h3>
                          <p className="text-sm text-gray-600 mt-1">{issue.description}</p>
                          <div className="flex items-center space-x-2 mt-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(issue.impact)}`}>
                              {issue.impact.toUpperCase()}
                            </span>
                            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                              WCAG 2.2 {issue.wcagLevel}
                            </span>
                            <div className="flex items-center space-x-1 text-gray-500">
                              {getCategoryIcon(issue.category)}
                              <span className="text-xs capitalize">{issue.category}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Code Editor */}
            <div className="space-y-4">
              {selectedIssue ? (
                <>
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-semibold text-gray-900">Fix the Code</h2>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setShowHints(!showHints)}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
                      >
                        {showHints ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {showHints ? 'Hide' : 'Show'} Hint
                      </button>
                      <button
                        onClick={resetIssue}
                        className="px-3 py-1 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200"
                      >
                        Reset
                      </button>
                    </div>
                  </div>

                  {showHints && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <h3 className="font-medium text-yellow-900 mb-2">💡 Hint</h3>
                      <p className="text-yellow-900">{selectedIssue.hint}</p>
                    </div>
                  )}

                  <div className="bg-gray-900 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-gray-300 text-sm font-medium">HTML Code</span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => setShowPreview(!showPreview)}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                          {showPreview ? 'Hide' : 'Show'} Preview
                        </button>
                        <button
                          onClick={checkSolution}
                          className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Check Solution
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={userCode}
                      onChange={(e) => handleCodeChange(e.target.value)}
                      className="w-full h-40 bg-gray-800 text-white font-mono text-sm p-3 rounded border border-gray-700 focus:border-blue-500 focus:outline-none resize-none"
                      placeholder="Edit the HTML code to fix the accessibility issue..."
                    />
                  </div>

                  {showPreview && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                      <h3 className="font-medium text-gray-900 mb-3">Preview</h3>
                      <div 
                        className="border border-gray-300 rounded p-3 min-h-[100px]"
                        dangerouslySetInnerHTML={{ __html: userCode }}
                      />
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h3 className="font-medium text-blue-900 mb-2">📚 Explanation</h3>
                    <p className="text-blue-900">{selectedIssue.explanation}</p>
                  </div>
                </>
              ) : (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
                  <AlertTriangle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Select an Issue</h3>
                  <p className="text-gray-600">
                    Choose an accessibility issue from the list to start learning and practicing!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Completion Message */}
          {completedIssues.length === issues.length && (
            <div className="bg-gradient-to-r from-green-500 to-blue-500 text-white p-8 rounded-lg text-center">
              <CheckCircle className="h-16 w-16 mx-auto mb-4" />
              <h2 className="text-3xl font-bold mb-4">🎉 Congratulations!</h2>
              <p className="text-xl mb-6">
                You've successfully fixed all accessibility issues! You're well on your way to becoming an accessibility expert.
              </p>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={() => {
                    setIssues(initialIssues.map(issue => ({ ...issue, isFixed: false })))
                    setCompletedIssues([])
                    setSelectedIssue(null)
                  }}
                  className="px-6 py-3 bg-white text-green-600 rounded-lg font-medium hover:bg-gray-100"
                >
                  Start Over
                </button>
                <Link
                  href="/"
                  className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-gray-100"
                >
                  Try Real Scan
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
