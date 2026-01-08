import { AccessibilityScanner, ScanResult } from './accessibility-scanner';
import puppeteer from 'puppeteer';

export interface ScanOptions {
  url: string;
  includeSubdomains: boolean;
  deepCrawl: boolean;
  maxPages: number;
  scanType: 'quick' | 'full';
  selectedTags?: string[];
}

export interface ScanProgress {
  currentPage: number;
  totalPages: number;
  currentUrl: string;
  status: 'crawling' | 'scanning' | 'analyzing' | 'complete' | 'error';
  message: string;
}

export class ScanService {
  private scanner: AccessibilityScanner;
  private browser: any = null;

  constructor() {
    this.scanner = new AccessibilityScanner();
  }

  /**
   * Discover pages on a website without scanning them
   */
  async discoverPages(
    options: ScanOptions,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<string[]> {
    try {
      // Initialize browser
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      // Crawl the website to get all URLs
      onProgress?.({
        currentPage: 0,
        totalPages: 0,
        currentUrl: options.url,
        status: 'crawling',
        message: 'Discovering pages to scan...'
      });

      const urls = await this.crawlWebsite(options, onProgress);
      
      onProgress?.({
        currentPage: urls.length,
        totalPages: urls.length,
        currentUrl: '',
        status: 'complete',
        message: `Discovered ${urls.length} pages`
      });

      return urls;
    } catch (error) {
      console.error('Page discovery failed:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Start a comprehensive accessibility scan
   */
  async startScan(
    options: ScanOptions,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<ScanResult[]> {
    try {
      // Initialize browser
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      // Crawl the website to get all URLs
      onProgress?.({
        currentPage: 0,
        totalPages: 0,
        currentUrl: options.url,
        status: 'crawling',
        message: 'Discovering pages to scan...'
      });

      const urls = await this.crawlWebsite(options, onProgress);
      
      // Scan each page for accessibility issues
      const results: ScanResult[] = [];
      
      for (let i = 0; i < urls.length; i++) {
        const url = urls[i];
        
        onProgress?.({
          currentPage: i + 1,
          totalPages: urls.length,
          currentUrl: url,
          status: 'scanning',
          message: `Scanning ${url} for accessibility issues...`
        });

        try {
          const result = await this.scanPage(url, options.selectedTags);
          results.push(result);
        } catch (error) {
          console.error(`Failed to scan ${url}:`, error);
          // Continue with other pages even if one fails
        }
      }

      onProgress?.({
        currentPage: urls.length,
        totalPages: urls.length,
        currentUrl: '',
        status: 'analyzing',
        message: 'Analyzing results and generating report...'
      });

      return results;
    } catch (error) {
      console.error('Scan failed:', error);
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close();
      }
    }
  }

  /**
   * Normalize URL to remove duplicates (anchors, trailing slashes, etc.)
   */
  private normalizeUrl(url: string): string {
    try {
      let normalized = url.trim();
      
      // If URL doesn't have a protocol, add https://
      if (!normalized.match(/^https?:\/\//i)) {
        normalized = `https://${normalized}`;
      }
      
      const urlObj = new URL(normalized);
      
      // Remove hash fragments (anchors)
      urlObj.hash = '';
      
      // Remove trailing slash for root paths
      if (urlObj.pathname === '/' && normalized.endsWith('/')) {
        urlObj.pathname = '';
      }
      
      // Ensure we have a valid hostname
      if (!urlObj.hostname || urlObj.hostname === '') {
        throw new Error('Invalid hostname');
      }
      
      return urlObj.href.replace(/\/$/, ''); // Remove trailing slash
    } catch (error) {
      console.error(`Failed to normalize URL: ${url}`, error);
      // Try to fix common issues
      let fixed = url.trim();
      if (!fixed.match(/^https?:\/\//i)) {
        fixed = `https://${fixed}`;
      }
      try {
        return new URL(fixed).href.replace(/\/$/, '');
      } catch (e) {
        console.error(`Could not fix URL: ${url}`);
        return url; // Return original if we can't fix it
      }
    }
  }

  /**
   * Crawl website to discover all pages
   */
  private async crawlWebsite(
    options: ScanOptions,
    onProgress?: (progress: ScanProgress) => void
  ): Promise<string[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    const visited = new Set<string>();
    const toVisit = [this.normalizeUrl(options.url)];
    const discoveredUrls: string[] = [];
    const startTime = Date.now();

    // Set user agent to avoid being blocked
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

    // Discovery tips that cycle through
    const discoveryTips = [
      "🔍 Checking robots.txt and crawling policies...",
      "🌐 Discovering navigation links...",
      "📄 Finding content pages...",
      "📝 Locating forms and interactive elements...",
      "📰 Searching for blog and news pages...",
      "⚖️ Identifying legal and policy pages...",
      "🔗 Following internal links...",
      "📊 Categorizing discovered pages..."
    ];

    let tipIndex = 0;
    let lastProgressUpdate = 0;

    while (toVisit.length > 0 && discoveredUrls.length < options.maxPages) {
      const currentUrl = toVisit.shift()!;
      const normalizedUrl = this.normalizeUrl(currentUrl);
      
      if (visited.has(normalizedUrl)) continue;
      visited.add(normalizedUrl);

      // Update progress every 2 seconds or when we discover a new page
      const now = Date.now();
      if (now - lastProgressUpdate > 2000 || discoveredUrls.length % 5 === 0) {
        const elapsed = Math.floor((now - startTime) / 1000);
        const avgTimePerPage = elapsed / Math.max(discoveredUrls.length, 1);
        const remainingPages = Math.min(options.maxPages - discoveredUrls.length, toVisit.length);
        const estimatedTimeRemaining = Math.floor(avgTimePerPage * remainingPages);
        
        onProgress?.({
          currentPage: discoveredUrls.length,
          totalPages: options.maxPages,
          currentUrl: currentUrl,
          status: 'crawling',
          message: `${discoveryTips[tipIndex % discoveryTips.length]} Found ${discoveredUrls.length} pages so far. ${toVisit.length} more to check. ${estimatedTimeRemaining > 0 ? `Est. ${estimatedTimeRemaining}s remaining.` : ''}`
        });
        
        lastProgressUpdate = now;
        tipIndex++;
      }

      try {
        // Navigate to the page
        await page.goto(currentUrl, { 
          waitUntil: 'networkidle2',
          timeout: 30000 
        });

        // Add to discovered URLs (use normalized URL)
        discoveredUrls.push(normalizedUrl);

        // If deep crawl is enabled, discover more links
        if (options.deepCrawl) {
          const links = await page.evaluate(() => {
            const anchors = document.querySelectorAll('a[href]');
            return Array.from(anchors).map(a => a.getAttribute('href')).filter(Boolean) as string[];
          });

          // Process discovered links
          for (const link of links) {
            try {
              const absoluteUrl = new URL(link, currentUrl).href;
              const normalizedLinkUrl = this.normalizeUrl(absoluteUrl);
              
              // Check if URL is within the same domain
              const currentDomain = new URL(currentUrl).hostname;
              const linkDomain = new URL(absoluteUrl).hostname;
              
              // More robust domain matching: exact match or subdomain check
              const isSameDomain = linkDomain === currentDomain;
              const isSubdomain = options.includeSubdomains && (
                linkDomain.endsWith('.' + currentDomain) || 
                currentDomain.endsWith('.' + linkDomain)
              );
              
              if (isSameDomain || isSubdomain) {
                if (!visited.has(normalizedLinkUrl) && !toVisit.includes(normalizedLinkUrl)) {
                  toVisit.push(normalizedLinkUrl);
                }
              }
            } catch (error) {
              // Skip invalid URLs
              continue;
            }
          }
        }

        // Small delay to be respectful
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`Failed to crawl ${currentUrl}:`, error);
        // Continue with other URLs
      }
    }

    await page.close();
    
    // Final deduplication to ensure no duplicates remain
    const uniqueUrls = Array.from(new Set(discoveredUrls));
    console.log(`🔍 Page discovery completed: ${discoveredUrls.length} URLs found, ${uniqueUrls.length} unique after deduplication`);
    
    return uniqueUrls;
  }

  /**
   * Initialize browser for scanning
   */
  async initializeBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  /**
   * Scan a single page for accessibility issues
   */
  async scanPage(url: string, selectedTags?: string[]): Promise<ScanResult> {
    console.log(`🔍 ScanService.scanPage called for: ${url}`)
    
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    const page = await this.browser.newPage();
    
    try {
      console.log(`🌐 Navigating to ${url}...`)
      // Navigate to the page
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      console.log(`✅ Page loaded successfully`)

      console.log(`🔧 Injecting axe-core...`)
      // Inject axe-core into the page
      await page.addScriptTag({
        url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.3/axe.min.js'
      });
      console.log(`✅ Axe-core injected successfully`)

      // Use our accessibility scanner with selected tags
      // CRITICAL: Default to comprehensive WCAG compliance (includes all levels)
      const tagsToUse = selectedTags || ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice', 'section508'];
      console.log(`🧪 Running accessibility scan with tags: ${tagsToUse.join(', ')}`)
      
      const result = await this.scanner.scanPageInBrowser(page, tagsToUse);
      
      console.log(`📊 Scan result:`, {
        issues: result.issues?.length || 0,
        summary: result.summary,
        url: result.url
      })
      
      return result;
    } finally {
      await page.close();
    }
  }

  /**
   * Get WCAG 2.2 compliance summary from scan results
   */
  getComplianceSummary(results: ScanResult[]) {
    const summary = {
      totalPages: results.length,
      totalIssues: 0,
      criticalIssues: 0,
      seriousIssues: 0,
      moderateIssues: 0,
      minorIssues: 0,
      wcag22Compliance: {
        levelA: true,
        levelAA: true,
        levelAAA: true
      }
    };

    for (const result of results) {
      summary.totalIssues += result.summary.total;
      summary.criticalIssues += result.summary.critical;
      summary.seriousIssues += result.summary.serious;
      summary.moderateIssues += result.summary.moderate;
      summary.minorIssues += result.summary.minor;

      // Update compliance status
      if (!result.wcag22Compliance.levelA) summary.wcag22Compliance.levelA = false;
      if (!result.wcag22Compliance.levelAA) summary.wcag22Compliance.levelAA = false;
      if (!result.wcag22Compliance.levelAAA) summary.wcag22Compliance.levelAAA = false;
    }

    return summary;
  }

  /**
   * Generate remediation suggestions for all issues
   */
  generateRemediationReport(results: ScanResult[]) {
    const allIssues = results.flatMap(result => 
      result.issues.map(issue => ({
        ...issue,
        url: result.url
      }))
    );

    // Group issues by type
    const issuesByType = allIssues.reduce((acc, issue) => {
      if (!acc[issue.id]) {
        acc[issue.id] = [];
      }
      acc[issue.id].push(issue);
      return acc;
    }, {} as Record<string, typeof allIssues>);

    // Generate remediation suggestions for each issue type
    const remediationReport = Object.entries(issuesByType).map(([issueId, issues]) => {
      const firstIssue = issues[0];
      const suggestions = this.scanner.generateRemediationSuggestions(firstIssue);
      
      return {
        issueId,
        title: firstIssue.description,
        impact: firstIssue.impact,
        occurrences: issues.length,
        affectedUrls: issues.map(issue => issue.url),
        suggestions,
        wcag22Rule: this.scanner.getWCAG22RuleInfo(issueId)
      };
    });

    return remediationReport;
  }
}
