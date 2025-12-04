/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
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

