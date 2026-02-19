import { AccessibilityScanner, ScanResult } from './accessibility-scanner';
import { getLaunchOptionsForServerAsync } from './puppeteer-config';

// Lazy load puppeteer based on platform (ESM-compatible)
// On Linux (Railway/server) use puppeteer-core + system Chromium; locally use full puppeteer
let puppeteer: any = null;
async function getPuppeteer() {
  if (!puppeteer) {
    if (process.platform === 'linux') {
      puppeteer = await import('puppeteer-core');
    } else {
      puppeteer = await import('puppeteer');
    }
  }
  return puppeteer.default || puppeteer;
}

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
  private cancellationFlags: Map<string, boolean> = new Map();
  private activeDiscoveryId: string | null = null;

  constructor() {
    this.scanner = new AccessibilityScanner();
  }

  /**
   * Cancel an active discovery process
   */
  cancelDiscovery(discoveryId: string): void {
    this.cancellationFlags.set(discoveryId, true);
    // Immediately close browser if it's the active discovery
    if (this.activeDiscoveryId === discoveryId && this.browser) {
      console.log('🛑 Force closing browser due to cancellation');
      this.browser.close().catch(() => {
        // Ignore errors when closing
      });
      this.browser = null;
    }
  }

  /**
   * Check if discovery should be cancelled
   */
  private isCancelled(discoveryId: string): boolean {
    return this.cancellationFlags.get(discoveryId) === true;
  }

  /**
   * Clear cancellation flag
   */
  private clearCancellation(discoveryId: string): void {
    this.cancellationFlags.delete(discoveryId);
  }

  /**
   * Discover pages on a website without scanning them
   */
  async discoverPages(
    options: ScanOptions,
    onProgress?: (progress: ScanProgress) => void,
    discoveryId?: string
  ): Promise<string[]> {
    const id = discoveryId || `discovery-${Date.now()}`;
    this.clearCancellation(id); // Clear any previous cancellation
    try {
      const puppeteerModule = await getPuppeteer();
      // Use system Chromium on Railway/Linux (from nixpacks) or @sparticuz/chromium fallback
      this.browser = await puppeteerModule.launch(await getLaunchOptionsForServerAsync({
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
      }));

      // Crawl the website to get all URLs
      onProgress?.({
        currentPage: 0,
        totalPages: 0,
        currentUrl: options.url,
        status: 'crawling',
        message: 'Discovering pages to scan...'
      });

      this.activeDiscoveryId = id;
      const urls = await this.crawlWebsite(options, onProgress, id);
      this.activeDiscoveryId = null;
      
      // Check if cancelled before returning
      if (this.isCancelled(id)) {
        this.clearCancellation(id);
        throw new Error('Discovery cancelled by user');
      }
      
      onProgress?.({
        currentPage: urls.length,
        totalPages: urls.length,
        currentUrl: '',
        status: 'complete',
        message: `Discovered ${urls.length} pages`
      });

      this.clearCancellation(id);
      return urls;
    } catch (error) {
      console.error('Page discovery failed:', error);
      this.clearCancellation(id);
      this.activeDiscoveryId = null;
      throw error;
    } finally {
      if (this.browser) {
        await this.browser.close().catch(() => {
          // Ignore errors when closing
        });
        this.browser = null;
      }
      this.activeDiscoveryId = null;
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
      const puppeteerModule = await getPuppeteer();
      // Use system Chromium on Railway/Linux (from nixpacks) or @sparticuz/chromium fallback
      this.browser = await puppeteerModule.launch(await getLaunchOptionsForServerAsync({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }));

      // Crawl the website to get all URLs
      onProgress?.({
        currentPage: 0,
        totalPages: 0,
        currentUrl: options.url,
        status: 'crawling',
        message: 'Discovering pages to scan...'
      });

      const urls = await this.crawlWebsite(options, onProgress);
      
      // If no URLs found from crawling, fall back to the original URL
      // This ensures we always scan at least the requested page
      const urlsToScan = urls.length > 0 ? urls : [this.normalizeUrl(options.url)];
      
      // Scan each page for accessibility issues
      const results: ScanResult[] = [];
      
      for (let i = 0; i < urlsToScan.length; i++) {
        const url = urlsToScan[i];
        
        onProgress?.({
          currentPage: i + 1,
          totalPages: urlsToScan.length,
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
   * Also adds protocol if missing (http:// or https://)
   */
  private normalizeUrl(url: string): string {
    try {
      // Add protocol if missing
      let urlWithProtocol = url.trim();
      if (!urlWithProtocol.match(/^https?:\/\//i)) {
        urlWithProtocol = 'https://' + urlWithProtocol;
      }
      
      const urlObj = new URL(urlWithProtocol);
      // Remove hash fragments (anchors)
      urlObj.hash = '';
      // Remove query parameters to avoid duplicates (e.g., ?page=1, ?page=2, etc.)
      urlObj.search = '';
      // Remove trailing slash for root paths
      if (urlObj.pathname === '/' && urlWithProtocol.endsWith('/')) {
        urlObj.pathname = '';
      }
      // Normalize pathname (remove trailing slashes except root)
      if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }
      return urlObj.href;
    } catch (error) {
      // If URL parsing fails, try adding protocol and retry
      if (!url.match(/^https?:\/\//i)) {
        try {
          return 'https://' + url;
        } catch {
          return url;
        }
      }
      return url;
    }
  }

  /**
   * Crawl website to discover all pages
   */
  /**
   * Short delay so the page main frame is ready (avoids "Requesting main frame too early!" in Docker/Railway).
   */
  private async waitForPageReady(): Promise<void> {
    await new Promise((r) => setTimeout(r, 300)); // Reduced from 800ms to 300ms
  }

  private async crawlWebsite(
    options: ScanOptions,
    onProgress?: (progress: ScanProgress) => void,
    discoveryId?: string
  ): Promise<string[]> {
    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    let page = await this.browser.newPage();
    await this.waitForPageReady();
    const visited = new Set<string>();
    const toVisit = [this.normalizeUrl(options.url)];
    const discoveredUrls: string[] = [];
    const retryCount = new Map<string, number>(); // one retry per URL when goto fails
    const startTime = Date.now();
    const MAX_DISCOVERY_TIME = 2 * 60 * 1000; // 2 minutes maximum (reduced from 5 for faster UX)
    const MAX_QUEUE_SIZE = 500; // Maximum URLs in queue to prevent infinite growth
    const QUICK_DISCOVERY_LIMIT = 30; // Stop early if we find enough important pages
    const QUICK_DISCOVERY_TIME = 30 * 1000; // 30 seconds for quick discovery mode

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
    let highPriorityCount = 0; // Track high-priority pages found

    // Prioritize URLs - put homepage and important pages first
    const prioritizeUrl = (url: string): number => {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname.toLowerCase();
        if (path === '/' || path === '/home' || path === '/index' || path === '') return 0; // Homepage first
        if (path.includes('/contact') || path.includes('/form') || path.includes('/signup') || path.includes('/login')) return 1; // Forms
        if (path.includes('/about') || path.includes('/services') || path.includes('/products')) return 2; // Important content
        if (path.includes('/blog') || path.includes('/news') || path.includes('/article')) return 3; // Blog
        return 4; // Everything else
      } catch {
        return 4; // Default priority if URL parsing fails
      }
    };

    // Sort initial queue by priority
    toVisit.sort((a, b) => prioritizeUrl(a) - prioritizeUrl(b));

    while (toVisit.length > 0 && discoveredUrls.length < options.maxPages) {
      // Check for cancellation
      if (discoveryId && this.isCancelled(discoveryId)) {
        console.log('🛑 Discovery cancelled by user');
        onProgress?.({
          currentPage: discoveredUrls.length,
          totalPages: options.maxPages,
          currentUrl: '',
          status: 'cancelled',
          message: 'Discovery cancelled'
        });
        break;
      }

      // Quick discovery mode: stop early if we've found enough important pages quickly
      const elapsed = Date.now() - startTime;
      if (elapsed > QUICK_DISCOVERY_TIME && highPriorityCount >= QUICK_DISCOVERY_LIMIT && discoveredUrls.length >= 20) {
        console.log('⚡ Quick discovery complete - found enough important pages');
        onProgress?.({
          currentPage: discoveredUrls.length,
          totalPages: options.maxPages,
          currentUrl: '',
          status: 'complete',
          message: `Quick discovery complete. Found ${discoveredUrls.length} important pages.`
        });
        break;
      }

      // Check maximum time limit
      if (elapsed > MAX_DISCOVERY_TIME) {
        console.log('⏱️ Discovery time limit reached (2 minutes)');
        onProgress?.({
          currentPage: discoveredUrls.length,
          totalPages: options.maxPages,
          currentUrl: '',
          status: 'complete',
          message: `Time limit reached. Found ${discoveredUrls.length} pages.`
        });
        break;
      }

      // Limit queue size to prevent infinite growth
      if (toVisit.length > MAX_QUEUE_SIZE) {
        console.log(`⚠️ Queue size limit reached (${MAX_QUEUE_SIZE}). Stopping discovery of new links.`);
        // Process remaining queue but don't add more links
        const remainingUrls = toVisit.splice(0, options.maxPages - discoveredUrls.length);
        toVisit.length = 0;
        toVisit.push(...remainingUrls);
      }

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
        
        // Calculate how many unique pages are likely to be found (accounting for filtering)
        // Most URLs in queue will be processed, but some will be filtered or duplicates
        const likelyUniqueRemaining = Math.min(remainingPages, toVisit.length);
        
        onProgress?.({
          currentPage: discoveredUrls.length,
          totalPages: options.maxPages,
          currentUrl: currentUrl,
          status: 'crawling',
          message: `${discoveryTips[tipIndex % discoveryTips.length]} Found ${discoveredUrls.length} pages so far. ${toVisit.length > 0 ? `${toVisit.length} URLs in queue` : 'Processing...'} ${estimatedTimeRemaining > 0 ? `Est. ${estimatedTimeRemaining}s remaining.` : ''}`
        });
        
        lastProgressUpdate = now;
        tipIndex++;
      }

      try {
        // Check cancellation before navigation
        if (discoveryId && this.isCancelled(discoveryId)) {
          console.log('🛑 Discovery cancelled - stopping navigation');
          break;
        }

        // Navigate to the page - use domcontentloaded for faster discovery (we don't need full page load)
        await page.goto(currentUrl, {
          waitUntil: 'domcontentloaded', // Faster than networkidle2 - we just need links, not full page load
          timeout: 0 // No timeout - let it take as long as needed
        });

        // Check cancellation after navigation
        if (discoveryId && this.isCancelled(discoveryId)) {
          console.log('🛑 Discovery cancelled - stopping after navigation');
          break;
        }

        // Add to discovered URLs (use normalized URL)
        discoveredUrls.push(normalizedUrl);
        
        // Track high-priority pages
        const path = new URL(normalizedUrl).pathname.toLowerCase();
        if (path === '/' || path.includes('/contact') || path.includes('/form') || 
            path.includes('/about') || path.includes('/services') || path.includes('/products')) {
          highPriorityCount++;
        }

        // If deep crawl is enabled, discover more links
        if (options.deepCrawl) {
          // Check cancellation before processing links
          if (discoveryId && this.isCancelled(discoveryId)) {
            console.log('🛑 Discovery cancelled - stopping link discovery');
            break;
          }

          // Brief delay so JS-rendered links (SPAs, lazy nav) are in the DOM - reduced for speed
          await new Promise((r) => setTimeout(r, 300)); // Reduced from 500ms to 300ms for faster discovery
          
          // Check cancellation again after delay
          if (discoveryId && this.isCancelled(discoveryId)) {
            console.log('🛑 Discovery cancelled - stopping link discovery');
            break;
          }

          const links = await page.evaluate(() => {
            const anchors = document.querySelectorAll('a[href]');
            return Array.from(anchors).map(a => a.getAttribute('href')).filter(Boolean) as string[];
          });

          // Process discovered links with smart filtering
          for (const link of links) {
            try {
              const absoluteUrl = new URL(link, currentUrl).href;
              
              // Skip if queue is too large
              if (toVisit.length >= MAX_QUEUE_SIZE) {
                break;
              }
              
              // Filter out problematic URLs that cause infinite crawling
              if (this.shouldSkipUrl(absoluteUrl, currentUrl)) {
                continue;
              }
              
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
                  // Insert based on priority (important pages first)
                  const priority = prioritizeUrl(absoluteUrl);
                  if (priority <= 2) {
                    // High priority - add to front
                    toVisit.unshift(absoluteUrl);
                  } else {
                    // Lower priority - add to back
                    toVisit.push(absoluteUrl);
                  }
                }
              }
            } catch (error) {
              // Skip invalid URLs
              continue;
            }
          }
        }

        // Small delay to be respectful - reduced for faster discovery
        await new Promise(resolve => setTimeout(resolve, 100)); // Reduced from 200ms to 100ms for faster discovery

      } catch (error) {
        console.error(`Failed to crawl ${currentUrl}:`, error);
        // Re-queue for one retry so we don't lose pages to transient failures
        const retries = retryCount.get(normalizedUrl) ?? 0;
        if (retries < 1) {
          visited.delete(normalizedUrl);
          toVisit.unshift(currentUrl);
          retryCount.set(normalizedUrl, retries + 1);
        }
        // Replace page so we don't reuse a broken one (avoids "Requesting main frame too early!" on next goto)
        try {
          await page.close();
        } catch {
          // Ignore close errors (page may already be detached)
        }
        page = await this.browser.newPage();
        await this.waitForPageReady();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      }
    }

    try {
      await page.close();
    } catch {
      // Ignore if page already closed/detached
    }
    
    // Final deduplication to ensure no duplicates remain
    const uniqueUrls = Array.from(new Set(discoveredUrls));
    
    // Remove template duplicates - keep only one representative per template pattern
    const deduplicatedUrls = this.removeTemplateDuplicates(uniqueUrls);
    
    console.log(`🔍 Page discovery completed: ${discoveredUrls.length} URLs found, ${uniqueUrls.length} unique, ${deduplicatedUrls.length} after template deduplication`);
    
    return deduplicatedUrls;
  }

  /**
   * Remove template duplicates - pages that use the same template (e.g., article pages)
   * Only keeps one representative page per template pattern
   */
  private removeTemplateDuplicates(urls: string[]): string[] {
    const templateGroups = new Map<string, string[]>();
    const result: string[] = [];
    
    for (const url of urls) {
      try {
        const urlObj = new URL(url);
        const path = urlObj.pathname;
        
        // Extract template pattern from path
        // Examples:
        // /article/123 -> /article/*
        // /blog/2024/post-name -> /blog/*
        // /news/123/title -> /news/*
        // /products/123 -> /products/*
        const templatePattern = this.extractTemplatePattern(path);
        
        if (!templateGroups.has(templatePattern)) {
          templateGroups.set(templatePattern, []);
        }
        templateGroups.get(templatePattern)!.push(url);
      } catch (error) {
        // If URL parsing fails, keep it as-is
        result.push(url);
      }
    }
    
    // For each template group, keep only the first one (or a representative)
    for (const [pattern, groupUrls] of templateGroups.entries()) {
      if (groupUrls.length === 1) {
        // Only one URL in this pattern, keep it
        result.push(groupUrls[0]);
      } else {
        // Multiple URLs with same template - keep only the first one
        // Prefer shorter URLs (often the first/example article)
        const sorted = groupUrls.sort((a, b) => {
          const aPath = new URL(a).pathname;
          const bPath = new URL(b).pathname;
          // Prefer shorter paths, or if same length, alphabetical
          if (aPath.length !== bPath.length) {
            return aPath.length - bPath.length;
          }
          return aPath.localeCompare(bPath);
        });
        result.push(sorted[0]);
        console.log(`📄 Template pattern "${pattern}": found ${groupUrls.length} pages, keeping 1 representative`);
      }
    }
    
    return result;
  }

  /**
   * Extract template pattern from a URL path
   * Identifies pages that likely use the same template
   */
  private extractTemplatePattern(path: string): string {
    // Remove leading/trailing slashes and split
    const parts = path.split('/').filter(p => p.length > 0);
    
    if (parts.length === 0) {
      return '/'; // Homepage
    }
    
    // Common template patterns to detect:
    const templatePatterns = [
      /^\/article\//i,           // /article/*
      /^\/articles\//i,          // /articles/*
      /^\/blog\//i,              // /blog/*
      /^\/blogs\//i,             // /blogs/*
      /^\/news\//i,              // /news/*
      /^\/post\//i,              // /post/*
      /^\/posts\//i,             // /posts/*
      /^\/story\//i,             // /story/*
      /^\/stories\//i,           // /stories/*
      /^\/product\//i,           // /product/*
      /^\/products\//i,          // /products/*
      /^\/item\//i,              // /item/*
      /^\/items\//i,             // /items/*
      /^\/event\//i,             // /event/*
      /^\/events\//i,            // /events/*
      /^\/job\//i,               // /job/*
      /^\/jobs\//i,              // /jobs/*
      /^\/case-study\//i,        // /case-study/*
      /^\/case-studies\//i,      // /case-studies/*
    ];
    
    // Check if path matches a known template pattern
    for (const pattern of templatePatterns) {
      if (pattern.test(path)) {
        // Extract the base pattern (e.g., /article/*)
        const match = path.match(/^(\/[^\/]+)/);
        if (match) {
          return match[1] + '/*';
        }
      }
    }
    
    // Check for numeric IDs or slugs in path (common in article/blog URLs)
    // Pattern: /category/numeric-id or /category/slug
    if (parts.length >= 2) {
      const lastPart = parts[parts.length - 1];
      // If last part looks like an ID (numeric) or slug (alphanumeric with dashes)
      if (/^\d+$/.test(lastPart) || /^[a-z0-9-]+$/i.test(lastPart)) {
        // Return pattern like /category/*
        return '/' + parts.slice(0, -1).join('/') + '/*';
      }
    }
    
    // Check for date-based patterns (e.g., /2024/01/article-name)
    if (parts.length >= 3 && /^\d{4}$/.test(parts[0]) && /^\d{1,2}$/.test(parts[1])) {
      // Year/month pattern - return /YYYY/MM/*
      return '/' + parts[0] + '/' + parts[1] + '/*';
    }
    
    // If no template pattern detected, return the full path as unique
    return path;
  }

  /**
   * Check if a URL should be skipped to prevent infinite crawling
   */
  private shouldSkipUrl(url: string, currentUrl: string): boolean {
    try {
      const urlObj = new URL(url);
      const path = urlObj.pathname.toLowerCase();
      
      // Skip common patterns that create infinite pages
      const skipPatterns = [
        /\/page\/\d+/,           // Pagination: /page/1, /page/2, etc.
        /\/p\/\d+/,              // Pagination: /p/1, /p/2
        /\/\d+$/,                // Numeric endings that might be pagination
        /\/search/,              // Search pages
        /\/filter/,              // Filter pages
        /\/sort/,                // Sort pages
        /\/archive/,             // Archive pages (often infinite)
        /\/tag\//,               // Tag pages (often many)
        /\/category\//,          // Category pages (often many)
        /\/author\//,            // Author pages
        /\/feed/,                // RSS feeds
        /\/rss/,                 // RSS feeds
        /\/xml/,                 // XML files
        /\/json/,                // JSON files
        /\.(pdf|doc|docx|xls|xlsx|zip|rar)$/i, // File downloads
        /\/print/,               // Print versions
        /\/amp$/,                // AMP pages
        /\/amp\//,               // AMP pages
        /\/mobile/,              // Mobile versions
        /\/m\//,                 // Mobile versions
        /\/api\//,               // API endpoints
        /\/ajax\//,              // AJAX endpoints
        /\/wp-json/,             // WordPress API
        /\/wp-admin/,            // WordPress admin
        /\/wp-content/,          // WordPress content
        /\/admin/,               // Admin pages
        /\/login/,               // Login pages
        /\/logout/,              // Logout pages
        /\/register/,           // Registration pages
        /\/cart/,                // Shopping cart
        /\/checkout/,            // Checkout
        /\/account/,            // Account pages
        /\/profile/,             // Profile pages
        /\/settings/,            // Settings pages
      ];

      // Check if path matches any skip pattern
      if (skipPatterns.some(pattern => pattern.test(path))) {
        return true;
      }

      // Skip URLs with query parameters (often create infinite variations)
      // But allow specific important query params
      const allowedParams = ['id', 'slug', 'name'];
      const params = new URLSearchParams(urlObj.search);
      const paramKeys = Array.from(params.keys());
      const hasOnlyAllowedParams = paramKeys.every(key => allowedParams.includes(key.toLowerCase()));
      
      if (urlObj.search && !hasOnlyAllowedParams && paramKeys.length > 2) {
        // Skip if has many query params (likely filters/pagination)
        return true;
      }

      // Skip very deep paths (more than 4 levels)
      const pathDepth = path.split('/').filter(p => p.length > 0).length;
      if (pathDepth > 4) {
        return true;
      }

      // Skip if path is too long (likely dynamic/generated)
      if (path.length > 200) {
        return true;
      }

      return false;
    } catch (error) {
      // If URL parsing fails, skip it
      return true;
    }
  }

  /**
   * Initialize browser for scanning
   */
  async initializeBrowser(): Promise<void> {
    if (!this.browser) {
      const puppeteerModule = await getPuppeteer();
      this.browser = await puppeteerModule.launch(await getLaunchOptionsForServerAsync({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }));
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
    await this.waitForPageReady();

    try {
      console.log(`🌐 Navigating to ${url}...`)
      // Navigate to the page (domcontentloaded first avoids "main frame too early" in containers)
      await page.goto(url, {
        waitUntil: ['domcontentloaded', 'networkidle2'],
        timeout: 0 // No timeout
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
