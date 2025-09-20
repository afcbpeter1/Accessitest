import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, Code, ExternalLink, FileText, Sparkles, Copy, Check, ChevronDown, ChevronRight, Clock, Bug, MessageSquare } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth-utils';

interface OffendingElement {
  html: string;
  target: string[];
  failureSummary: string;
  impact: string;
  url: string;
  screenshot?: string; // Base64 encoded screenshot of the element
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

interface RemediationSuggestion {
  type: 'fix' | 'improvement' | 'warning';
  description: string;
  codeExample?: string;
  priority: 'high' | 'medium' | 'low';
}

interface IssueStatus {
  status: 'unread' | 'read' | 'actioned' | 'deferred';
  deferredReason?: string;
  actionedDate?: string;
  deferredDate?: string;
}

interface DetailedReportProps {
  issueId: string;
  ruleName: string;
  description: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  wcag22Level: string;
  help: string;
  helpUrl: string;
  totalOccurrences: number;
  affectedUrls: string[];
  offendingElements: OffendingElement[];
  suggestions: RemediationSuggestion[];
  priority: 'high' | 'medium' | 'low';
  screenshots?: {
    fullPage?: string;
    viewport?: string;
    elements?: Array<{
      selector: string;
      issueId: string;
      severity: string;
      screenshot: string;
      boundingBox?: {
        x: number;
        y: number;
        width: number;
        height: number;
      };
    }>;
  };
  savedAIResponses?: any; // Saved AI responses from scan
  scanId?: string; // For tracking issue status
}

const getImpactColor = (impact: string) => {
  switch (impact) {
    case 'critical': return 'text-red-800 bg-red-50 border-red-200';
    case 'serious': return 'text-orange-800 bg-orange-50 border-orange-200';
    case 'moderate': return 'text-yellow-800 bg-yellow-50 border-yellow-200';
    case 'minor': return 'text-blue-800 bg-blue-50 border-blue-200';
    default: return 'text-gray-800 bg-gray-50 border-gray-200';
  }
};

const getPriorityColor = (priority: string) => {
  switch (priority) {
    case 'high': return 'text-red-800';
    case 'medium': return 'text-yellow-800';
    case 'low': return 'text-blue-800';
    default: return 'text-gray-800';
  }
};

const getSuggestionIcon = (type: string) => {
  switch (type) {
    case 'fix': return <CheckCircle className="h-4 w-4 text-green-600" />;
    case 'improvement': return <Info className="h-4 w-4 text-blue-600" />;
    case 'warning': return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    default: return <Info className="h-4 w-4 text-gray-600" />;
  }
};

export default function DetailedReport({
  issueId,
  ruleName,
  description,
  impact,
  wcag22Level,
  help,
  helpUrl,
  totalOccurrences,
  affectedUrls,
  offendingElements,
  suggestions,
  priority,
  screenshots,
  savedAIResponses,
  scanId
}: DetailedReportProps) {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [issueStatus, setIssueStatus] = useState<IssueStatus>({ status: 'unread' });
  const [showDeferModal, setShowDeferModal] = useState(false);
  const [deferReason, setDeferReason] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // Load issue status on component mount
  useEffect(() => {
    if (scanId) {
      loadIssueStatus();
    }
  }, [scanId, issueId]);

  const loadIssueStatus = async () => {
    try {
      const response = await authenticatedFetch(`/api/issue-status?scanId=${scanId}&issueId=${issueId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.status) {
          setIssueStatus(data.status);
        }
      }
    } catch (error) {
      console.error('Failed to load issue status:', error);
    }
  };

  const updateIssueStatus = async (newStatus: IssueStatus['status'], reason?: string) => {
    if (!scanId) return;
    
    setIsUpdatingStatus(true);
    try {
      const statusData: IssueStatus = {
        status: newStatus,
        ...(newStatus === 'actioned' && { actionedDate: new Date().toISOString() }),
        ...(newStatus === 'deferred' && { 
          deferredDate: new Date().toISOString(),
          deferredReason: reason 
        })
      };

      const response = await authenticatedFetch('/api/issue-status', {
        method: 'POST',
        body: JSON.stringify({
          scanId,
          issueId,
          status: statusData
        })
      });

      if (response.ok) {
        setIssueStatus(statusData);
        if (newStatus === 'read' || newStatus === 'actioned') {
          setIsCollapsed(true); // Auto-collapse after marking as read/actioned
        }
      }
    } catch (error) {
      console.error('Failed to update issue status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleDefer = () => {
    if (deferReason.trim()) {
      updateIssueStatus('deferred', deferReason.trim());
      setShowDeferModal(false);
      setDeferReason('');
    }
  };

  const getStatusColor = (status: IssueStatus['status']) => {
    switch (status) {
      case 'unread': return 'text-gray-600 bg-gray-50 border-gray-200';
      case 'read': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'actioned': return 'text-green-600 bg-green-50 border-green-200';
      case 'deferred': return 'text-orange-600 bg-orange-50 border-orange-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: IssueStatus['status']) => {
    switch (status) {
      case 'unread': return <FileText className="h-4 w-4" />;
      case 'read': return <CheckCircle className="h-4 w-4" />;
      case 'actioned': return <Bug className="h-4 w-4" />;
      case 'deferred': return <Clock className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  // Helper function to group elements by common patterns
  const groupElementsByPattern = (elements: OffendingElement[]) => {
    // For color contrast issues, group by the root cause - custom CSS classes
    const customClasses = new Set<string>();
    const otherElements: OffendingElement[] = [];
    
    elements.forEach(element => {
      const classMatch = element.html.match(/class="([^"]*)"/);
      if (classMatch) {
        const classes = classMatch[1];
        // Look for custom CSS classes (containing brand names, primary, accent, etc.)
        const customClass = classes.split(' ').find(cls => 
          cls.includes('primary') || cls.includes('accent') || cls.includes('secondary') ||
          cls.includes('ncpete') || cls.includes('brand') || cls.includes('custom')
        );
        
        if (customClass) {
          customClasses.add(customClass);
        } else {
          otherElements.push(element);
        }
      } else {
        otherElements.push(element);
      }
    });
    
    // Create a single group for all custom class issues
    const groups: { [key: string]: OffendingElement[] } = {};
    
    if (customClasses.size > 0) {
      // Group all custom class issues together as one root cause
      const customClassElements = elements.filter(element => {
        const classMatch = element.html.match(/class="([^"]*)"/);
        if (classMatch) {
          const classes = classMatch[1];
          return classes.split(' ').some(cls => 
            cls.includes('primary') || cls.includes('accent') || cls.includes('secondary') ||
            cls.includes('ncpete') || cls.includes('brand') || cls.includes('custom')
          );
        }
        return false;
      });
      
      if (customClassElements.length > 0) {
        groups['Custom CSS Classes'] = customClassElements;
      }
    }
    
    // Group remaining elements by type
    if (otherElements.length > 0) {
      const elementTypes: { [key: string]: OffendingElement[] } = {};
      otherElements.forEach(element => {
        const elementType = element.html.match(/<(\w+)/)?.[1] || 'unknown';
        if (!elementTypes[elementType]) {
          elementTypes[elementType] = [];
        }
        elementTypes[elementType].push(element);
      });
      
      Object.assign(groups, elementTypes);
    }
    
    return groups;
  };

  // Helper function to generate grouped elements section
  const generateGroupedElementsSection = (groupedElements: { [key: string]: OffendingElement[] }) => {
    let section = 'ELEMENTS\n';
    
    Object.entries(groupedElements).forEach(([pattern, elements], groupIndex) => {
      if (pattern === 'Custom CSS Classes') {
        section += `${elements.length} elements with color contrast issues\n`;
        section += `One fix resolves all elements\n`;
      } else {
        section += `${pattern}: ${elements.length} occurrence${elements.length !== 1 ? 's' : ''}\n`;
        section += `One fix resolves all elements\n`;
      }
    });
    
    return section;
  };

  // Helper function to generate consolidated fix
  const generateConsolidatedFix = (groupedElements: { [key: string]: OffendingElement[] }, aiSuggestions: any[]) => {
    let fix = '';
    
    Object.entries(groupedElements).forEach(([pattern, elements], groupIndex) => {
      if (pattern === 'Custom CSS Classes') {
        // Extract all unique custom classes
        const customClasses = new Set<string>();
        elements.forEach(element => {
          const classMatch = element.html.match(/class="([^"]*)"/);
          if (classMatch) {
            const classes = classMatch[1];
            classes.split(' ').forEach(cls => {
              if (cls.includes('primary') || cls.includes('accent') || cls.includes('secondary') ||
                  cls.includes('ncpete') || cls.includes('brand') || cls.includes('custom')) {
                customClasses.add(cls);
              }
            });
          }
        });
        
        fix += `Classes: ${Array.from(customClasses).join(', ')}\n\n`;
        
        // Use AI suggestions if available, otherwise provide specific fixes
        if (aiSuggestions && aiSuggestions.length > 0) {
          const suggestion = aiSuggestions[0];
          if (suggestion.codeExample || suggestion.code) {
            fix += `${suggestion.codeExample || suggestion.code}\n\n`;
          }
        } else {
          // Provide specific fixes for each class type
          customClasses.forEach(cls => {
            if (cls.includes('text-')) {
              fix += `.${cls} { color: #1a365d !important; }\n`;
            } else if (cls.includes('bg-')) {
              fix += `.${cls} { background-color: #2d3748 !important; }\n`;
            } else if (cls.includes('hover:')) {
              fix += `.${cls}:hover { color: #1a365d !important; }\n`;
            } else {
              fix += `.${cls} { color: #1a365d !important; }\n`;
            }
          });
          fix += `\n`;
        }
        
        fix += `IMPLEMENTATION:\n`;
        fix += `Copy CSS above → Paste in stylesheet → Save → Test\n`;
      } else {
        // Handle other element types
        fix += `\nFix ${groupIndex + 1}: ${pattern}\n`;
        fix += `This group contains ${elements.length} element${elements.length !== 1 ? 's' : ''} with the same issue.\n\n`;
        
        if (aiSuggestions && aiSuggestions.length > 0) {
          const suggestion = aiSuggestions[0];
          fix += `${suggestion.description || suggestion.text || 'AI-generated accessibility fix'}\n\n`;
          
          if (suggestion.codeExample || suggestion.code) {
            fix += `Code Example:\n${suggestion.codeExample || suggestion.code}\n\n`;
          }
        } else {
          fix += `Fix the accessibility issue for all ${elements.length} ${pattern} element${elements.length !== 1 ? 's' : ''}.\n\n`;
        }
      }
    });
    
    return fix;
  };

  const generateDefectTicket = () => {
    const currentDate = new Date().toISOString().split('T')[0];
    const severity = impact === 'critical' ? 'Critical' : 
                   impact === 'serious' ? 'Serious' : 
                   impact === 'moderate' ? 'Moderate' : 'Minor';
    
    // Use saved AI responses if available, otherwise fall back to suggestions
    const aiSuggestions = savedAIResponses || suggestions;
    
    // Group elements by common patterns for more efficient fixes
    const groupedElements = groupElementsByPattern(offendingElements);
    
    const ticketContent = `Accessibility Defect Report

Issue: ${ruleName}
Severity: ${severity} | Priority: ${priority?.toUpperCase() || 'MEDIUM'} | WCAG: 2.2 ${wcag22Level || 'A'}
Date: ${currentDate}

PROBLEM
${description || 'No description available'}

AFFECTED
${affectedUrls.map(url => `• ${url}`).join('\n')}
${totalOccurrences} occurrence${totalOccurrences !== 1 ? 's' : ''} across ${affectedUrls.length} page${affectedUrls.length !== 1 ? 's' : ''}

${generateGroupedElementsSection(groupedElements)}

HOW TO REPRODUCE
1. Navigate to ${affectedUrls[0]}
2. Use browser developer tools to inspect the page
3. Look for elements matching the CSS selectors provided
4. Verify the accessibility issue exists using accessibility testing tools

FIX
${generateConsolidatedFix(groupedElements, aiSuggestions)}

---
Generated by AccessiTest`;

    return ticketContent;
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(generateDefectTicket());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };
  return (
    <div className="bg-white border border-gray-200 rounded-lg mb-4 max-w-full overflow-hidden">
      {/* Collapsible Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <button className="flex-shrink-0 text-gray-400 hover:text-gray-600">
              {isCollapsed ? <ChevronRight className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
            
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3 className="text-base font-semibold text-gray-900 break-words">{ruleName}</h3>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getImpactColor(impact || 'minor')}`}>
                  {(impact || 'minor').toUpperCase()}
                </span>
                <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                  WCAG 2.2 {wcag22Level || 'A'}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(priority || 'medium')} bg-opacity-10`}>
                  {(priority || 'medium').toUpperCase()} PRIORITY
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(issueStatus.status)} flex items-center gap-1`}>
                  {getStatusIcon(issueStatus.status)}
                  {issueStatus.status.toUpperCase()}
                </span>
              </div>
              <p className="text-sm text-gray-600 mb-2 break-words">{description || 'No description available'}</p>
              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  {totalOccurrences} occurrence{totalOccurrences !== 1 ? 's' : ''}
                </span>
                <span className="flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" />
                  {affectedUrls.length} page{affectedUrls.length !== 1 ? 's' : ''} affected
                </span>
                {issueStatus.deferredReason && (
                  <span className="flex items-center gap-1 text-orange-600">
                    <MessageSquare className="h-3 w-3" />
                    Deferred: {issueStatus.deferredReason}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Status Action Buttons */}
            {scanId && (
              <div className="flex items-center gap-1">
                {issueStatus.status === 'unread' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateIssueStatus('read');
                    }}
                    disabled={isUpdatingStatus}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    Mark Read
                  </button>
                )}
                {issueStatus.status === 'read' && (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateIssueStatus('actioned');
                      }}
                      disabled={isUpdatingStatus}
                      className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50"
                    >
                      Mark Actioned
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeferModal(true);
                      }}
                      disabled={isUpdatingStatus}
                      className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 disabled:opacity-50"
                    >
                      Defer
                    </button>
                  </>
                )}
                {issueStatus.status === 'deferred' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updateIssueStatus('read');
                    }}
                    disabled={isUpdatingStatus}
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50"
                  >
                    Reopen
                  </button>
                )}
              </div>
            )}
            
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopy();
              }}
              className="flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="h-3 w-3" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-3 w-3" />
                  Copy Ticket
                </>
              )}
            </button>
            <a
              href={helpUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary-600 hover:text-primary-700 text-xs font-medium flex items-center justify-center gap-1 px-3 py-2 border border-primary-600 rounded-lg hover:bg-primary-50"
            >
              Learn More
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>

      {/* Collapsible Content */}
      {!isCollapsed && (
        <div className="px-4 pb-4 border-t border-gray-100">

      {/* Screenshots */}
      {screenshots && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            Visual Context
          </h4>
          
          {/* Website Screenshot */}
          {screenshots.viewport && (
            <div className="mb-3">
              <div className="text-xs text-gray-600 mb-1">Website Screenshot:</div>
              <div className="border border-gray-200 rounded overflow-hidden max-w-full">
            <img 
              src={screenshots.viewport}
              alt={`Screenshot of ${affectedUrls[0]}`}
              className="w-full h-auto max-h-24 sm:max-h-28 md:max-h-32 object-contain cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(screenshots.viewport, '_blank')}
            />
              </div>
              <div className="text-xs text-gray-500 mt-1">Click to view full size</div>
            </div>
          )}
          
          {/* Element Screenshots */}
          {screenshots.elements && screenshots.elements.length > 0 && (
            <div>
              <div className="text-xs text-gray-600 mb-2">Affected Elements:</div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                {screenshots.elements
                  .filter(el => el.issueId === issueId)
                  .map((element, index) => (
                    <div key={index} className="border border-gray-200 rounded overflow-hidden bg-gray-50">
                      <img
                        src={element.screenshot}
                        alt={`Screenshot showing ${ruleName} issue`}
                        className="w-full h-auto max-h-16 sm:max-h-18 md:max-h-20 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(element.screenshot, '_blank')}
                      />
                      {element.boundingBox && (
                        <div className="px-1 py-0.5 bg-gray-100 text-xs text-gray-600">
                          {Math.round(element.boundingBox.width)}×{Math.round(element.boundingBox.height)}px
                        </div>
                      )}
                      <div className="text-xs text-gray-400 px-1 py-0.5 text-center">Click to enlarge</div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Offending Elements */}
      <div className="mb-4">
        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          Offending Elements ({offendingElements.length})
        </h4>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {offendingElements.map((element, index) => (
            <div key={index} className="bg-gray-50 border border-gray-200 rounded p-3">
              <div className="flex items-start justify-between mb-2">
                <span className="text-xs font-medium text-gray-700 break-all max-w-xs">
                  {element.url}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getImpactColor(element.impact)}`}>
                  {element.impact}
                </span>
              </div>
              <div className="mb-2">
                <p className="text-xs text-gray-600 mb-1">HTML Element:</p>
                <pre className="bg-white border border-gray-300 rounded p-2 text-xs break-words max-w-full overflow-x-auto">
                  <code>{element.html}</code>
                </pre>
              </div>
              <div className="mb-2">
                <p className="text-xs text-gray-600 mb-1">CSS Selector:</p>
                <code className="bg-white border border-gray-300 rounded px-2 py-1 text-xs break-all max-w-full block">
                  {element.target.join(' ')}
                </code>
              </div>
              
            </div>
          ))}
        </div>
      </div>

      {/* Remediation Suggestions */}
      <div>
        <h4 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <CheckCircle className="h-4 w-4 text-green-600" />
          How to Fix ({suggestions.length} suggestions)
        </h4>
        <div className="space-y-3">
          {suggestions.map((suggestion, index) => {
            // Check if this is an AI-powered contextual suggestion
            const isAISuggestion = suggestion.description.length > 100 && 
              (suggestion.description.includes('#') || 
               suggestion.description.includes('Accessibility Fix:') ||
               suggestion.description.includes('Brief explanation') ||
               suggestion.description.includes('Issue Explanation') ||
               suggestion.description.includes('Specific Code Fix') ||
               suggestion.description.includes('Why this fix improves') ||
               suggestion.description.includes('Alternative approaches') ||
               suggestion.description.includes('This improves accessibility'));
            
            return (
              <div key={index} className={`border rounded p-3 ${
                isAISuggestion 
                  ? 'border-purple-200 bg-purple-50' 
                  : 'border-gray-200'
              }`}>
                <div className="flex items-start gap-3">
                  {isAISuggestion ? (
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
                        <Sparkles className="h-3 w-3 text-purple-600" />
                      </div>
                    </div>
                  ) : (
                    getSuggestionIcon(suggestion.type)
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {isAISuggestion && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full border border-purple-200">
                          AI SUGGESTION
                        </span>
                      )}
                      <span className="text-sm font-medium text-gray-700 capitalize">
                        {suggestion.type}
                      </span>
                    </div>
                    <p className={`mb-3 ${
                      isAISuggestion ? 'text-purple-900 font-medium' : 'text-gray-700'
                    }`}>
                      {suggestion.description}
                    </p>
                    {suggestion.codeExample && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1 flex items-center gap-1">
                          <Code className="h-4 w-4" />
                          {isAISuggestion ? 'Specific Code Fix:' : 'Code Example:'}
                        </p>
                        <pre className="rounded p-3 text-sm break-words max-w-full bg-gray-900 text-white">
                          <code>{suggestion.codeExample}</code>
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

          {/* Affected Pages */}
          {affectedUrls.length > 0 && (
            <div className="mt-6 pt-4 border-t border-gray-200">
              <h4 className="text-md font-semibold text-gray-900 mb-2">Affected Pages</h4>
              <div className="flex flex-wrap gap-2">
                {affectedUrls.map((url, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full border"
                  >
                    {url}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Defer Modal */}
      {showDeferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Defer Issue
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for deferring this issue:
              </label>
              <textarea
                value={deferReason}
                onChange={(e) => setDeferReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows={3}
                placeholder="e.g., Low priority, requires design review, technical constraints..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeferModal(false);
                  setDeferReason('');
                }}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleDefer}
                disabled={!deferReason.trim()}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Defer Issue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
