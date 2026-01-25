/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'accessitest.onrender.com'],
  },
  // Enable minification
  swcMinify: true,
  // Optimize production builds
  compress: true,
  // Reduce JavaScript bundle size
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? {
      exclude: ['error', 'warn'],
    } : false,
  },
  // Output standalone for better Docker/container support
  output: 'standalone',
  // Skip static generation for error pages - they'll be rendered dynamically
  // This prevents Html import errors during build
  skipTrailingSlashRedirect: true,
  // Allow build to continue even with static generation errors
  // Pages will be rendered dynamically at runtime instead
  experimental: {
    // This helps with build stability
    // Keep @sparticuz/chromium out of the server bundle so its __dirname stays correct
    // (it looks for ../bin relative to __dirname; when bundled that became .next/server/bin)
    serverComponentsExternalPackages: ['@sparticuz/chromium'],
  },
  // Skip static optimization for pages that use contexts
  // They will be rendered dynamically at runtime
  onDemandEntries: {
    // Period (in ms) where the server will keep pages in the buffer
    maxInactiveAge: 25 * 1000,
    // Number of pages that should be kept simultaneously without being disposed
    pagesBufferLength: 2,
  },
  webpack: (config, { isServer }) => {
    // Handle pdf-parse and other Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    
    // Also mark as external in webpack for compatibility
    config.externals = config.externals || []
    if (isServer) {
      config.externals.push('pdf-parse')
      // Mark pdfjs-dist as external - it will be loaded at runtime via dynamic import
      config.externals.push('pdfjs-dist')
    }
    
    return config
  },
}

module.exports = nextConfig

