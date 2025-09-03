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
    
    // Allow pdf-parse to work in server-side
    config.externals = config.externals || []
    if (isServer) {
      config.externals.push('pdf-parse')
    }
    
    return config
  },
}

module.exports = nextConfig

