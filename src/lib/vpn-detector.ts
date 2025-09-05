// VPN and proxy detection service
export interface VPNCheckResult {
  isVPN: boolean
  isProxy: boolean
  isTor: boolean
  country?: string
  provider?: string
  risk: 'low' | 'medium' | 'high'
}

export interface VPNDetectionOptions {
  logToDatabase?: boolean
  actionType?: 'registration' | 'free_scan' | 'login'
  userId?: string
}

// Known VPN/proxy IP ranges and providers
const KNOWN_VPN_PROVIDERS = [
  'nordvpn', 'expressvpn', 'surfshark', 'cyberghost', 'private internet access',
  'protonvpn', 'windscribe', 'tunnelbear', 'ipvanish', 'hotspot shield',
  'vyprvpn', 'purevpn', 'zenmate', 'hide.me', 'strongvpn',
  'tor', 'proxy', 'vpn', 'anonymizer'
]

// Known VPN/proxy ASN ranges (simplified list)
const KNOWN_VPN_ASNS = [
  'AS60068', // NordVPN
  'AS20473', // ExpressVPN
  'AS19994', // Surfshark
  'AS60068', // CyberGhost
  'AS32934', // Private Internet Access
  'AS20473', // ProtonVPN
  'AS20473', // Windscribe
  'AS20473', // TunnelBear
  'AS20473', // IPVanish
  'AS20473', // Hotspot Shield
]

export class VPNDetector {
  private static instance: VPNDetector
  private cache = new Map<string, VPNCheckResult>()
  private cacheExpiry = 24 * 60 * 60 * 1000 // 24 hours

  static getInstance(): VPNDetector {
    if (!VPNDetector.instance) {
      VPNDetector.instance = new VPNDetector()
    }
    return VPNDetector.instance
  }

  async checkVPN(ip: string, options: VPNDetectionOptions = {}): Promise<VPNCheckResult> {
    // Check cache first
    const cached = this.cache.get(ip)
    if (cached && Date.now() - (cached as any).timestamp < this.cacheExpiry) {
      return cached
    }

    try {
      // Use multiple services for better detection
      const [ipapiResult, ipinfoResult] = await Promise.allSettled([
        this.checkWithIPAPI(ip),
        this.checkWithIPInfo(ip)
      ])

      const result: VPNCheckResult = {
        isVPN: false,
        isProxy: false,
        isTor: false,
        risk: 'low'
      }

      // Process IPAPI result
      if (ipapiResult.status === 'fulfilled' && ipapiResult.value) {
        const data = ipapiResult.value
        result.isVPN = data.is_vpn || data.is_proxy || data.is_tor
        result.isProxy = data.is_proxy
        result.isTor = data.is_tor
        result.country = data.country
        result.provider = data.org
        result.risk = this.calculateRisk(data)
      }

      // Process IPInfo result
      if (ipinfoResult.status === 'fulfilled' && ipinfoResult.value) {
        const data = ipinfoResult.value
        if (data.privacy?.vpn || data.privacy?.proxy || data.privacy?.tor) {
          result.isVPN = true
          result.isProxy = data.privacy.proxy || false
          result.isTor = data.privacy.tor || false
          result.risk = 'high'
        }
      }

      // Additional checks
      if (result.provider) {
        const providerLower = result.provider.toLowerCase()
        if (KNOWN_VPN_PROVIDERS.some(vpn => providerLower.includes(vpn))) {
          result.isVPN = true
          result.risk = 'high'
        }
      }

      // Cache the result
      this.cache.set(ip, { ...result, timestamp: Date.now() } as any)

      // Log to database if requested
      if (options.logToDatabase) {
        this.logToDatabase(ip, result, options)
      }

      return result
    } catch (error) {
      console.error('VPN detection error:', error)
      // Return safe default
      return {
        isVPN: false,
        isProxy: false,
        isTor: false,
        risk: 'low'
      }
    }
  }

  private async checkWithIPAPI(ip: string): Promise<any> {
    try {
      const response = await fetch(`https://ipapi.co/${ip}/json/`, {
        headers: {
          'User-Agent': 'AccessiTest/1.0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`IPAPI error: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('IPAPI check failed:', error)
      return null
    }
  }

  private async checkWithIPInfo(ip: string): Promise<any> {
    try {
      // Using a free IP info service
      const response = await fetch(`https://ipinfo.io/${ip}/json`, {
        headers: {
          'User-Agent': 'AccessiTest/1.0'
        }
      })
      
      if (!response.ok) {
        throw new Error(`IPInfo error: ${response.status}`)
      }
      
      return await response.json()
    } catch (error) {
      console.error('IPInfo check failed:', error)
      return null
    }
  }

  private calculateRisk(data: any): 'low' | 'medium' | 'high' {
    if (data.is_tor) return 'high'
    if (data.is_vpn || data.is_proxy) return 'high'
    if (data.org && KNOWN_VPN_PROVIDERS.some(vpn => data.org.toLowerCase().includes(vpn))) {
      return 'high'
    }
    return 'low'
  }

  // Check if IP should be blocked
  shouldBlockIP(result: VPNCheckResult): boolean {
    return result.isVPN || result.isProxy || result.isTor || result.risk === 'high'
  }

  // Get block reason
  getBlockReason(result: VPNCheckResult): string {
    if (result.isTor) return 'Tor network detected'
    if (result.isVPN) return 'VPN detected'
    if (result.isProxy) return 'Proxy detected'
    if (result.risk === 'high') return 'High-risk IP detected'
    return 'Unknown risk'
  }

  // Log VPN detection to database
  private async logToDatabase(ip: string, result: VPNCheckResult, options: VPNDetectionOptions) {
    try {
      const { query } = await import('@/lib/database')
      
      await query(
        `INSERT INTO vpn_detection_log (ip_address, is_vpn, is_proxy, is_tor, country, provider, risk_level, action_type, user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          ip,
          result.isVPN,
          result.isProxy,
          result.isTor,
          result.country,
          result.provider,
          result.risk,
          options.actionType || 'unknown',
          options.userId || null
        ]
      )
    } catch (error) {
      console.error('Failed to log VPN detection to database:', error)
    }
  }
}
