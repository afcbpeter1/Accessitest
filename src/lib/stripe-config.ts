// Detect if we're in test mode based on the Stripe secret key
function isTestMode(): boolean {
  const secretKey = process.env.STRIPE_SECRET_KEY || ''
  return secretKey.startsWith('sk_test_')
}

// Stripe configuration and price mappings
// Automatically switches between test and live mode prices
export const STRIPE_PRICE_IDS = isTestMode() ? {
  // TEST MODE - Subscription Plans
  // TODO: Replace these with your actual test mode price IDs from Stripe Dashboard (test mode)
  subscriptions: {
    unlimitedMonthly: process.env.STRIPE_TEST_UNLIMITED_MONTHLY_PRICE_ID || 'price_test_monthly',
    unlimitedYearly: process.env.STRIPE_TEST_UNLIMITED_YEARLY_PRICE_ID || 'price_test_yearly',
  },
  
  // TEST MODE - Credit Packages
  // TODO: Replace these with your actual test mode price IDs from Stripe Dashboard (test mode)
  credits: {
    starterPack: process.env.STRIPE_TEST_STARTER_PACK_PRICE_ID || 'price_test_starter',
    professionalPack: process.env.STRIPE_TEST_PROFESSIONAL_PACK_PRICE_ID || 'price_test_professional',
    businessPack: process.env.STRIPE_TEST_BUSINESS_PACK_PRICE_ID || 'price_test_business',
    enterprisePack: process.env.STRIPE_TEST_ENTERPRISE_PACK_PRICE_ID || 'price_test_enterprise',
  }
} : {
  // LIVE MODE - Subscription Plans
  subscriptions: {
    unlimitedMonthly: 'price_1SWNfpDlESHKijI261EHN47W',
    unlimitedYearly: 'price_1SWNgrDlESHKijI27OB0Qyg5',
  },
  
  // LIVE MODE - Credit Packages
  credits: {
    starterPack: 'price_1S69FNDlESHKijI2GkCApIWQ',
    professionalPack: 'price_1S69G7DlESHKijI2Eb3uIxHZ',
    businessPack: 'price_1S69GqDlESHKijI2PsvK4k4o',
    enterprisePack: 'price_1S69HzDlESHKijI2K9H4o4FV',
  }
}

// Plan type mappings for database storage (works for both test and live)
export const PLAN_TYPES: Record<string, string> = {
  // Live mode prices
  'price_1SWNfpDlESHKijI261EHN47W': 'complete_access',
  'price_1SWNgrDlESHKijI27OB0Qyg5': 'complete_access',
  // Test mode prices (add your test price IDs here)
  // 'price_test_monthly': 'complete_access',
  // 'price_test_yearly': 'complete_access',
}

// Credit amounts for credit packages (works for both test and live)
export const CREDIT_AMOUNTS: Record<string, number> = {
  // Live mode prices
  'price_1S69FNDlESHKijI2GkCApIWQ': 5,   // Starter Pack
  'price_1S69G7DlESHKijI2Eb3uIxHZ': 7,   // Professional Pack
  'price_1S69GqDlESHKijI2PsvK4k4o': 9,   // Business Pack
  'price_1S69HzDlESHKijI2K9H4o4FV': 11,  // Enterprise Pack
  // Test mode prices (add your test price IDs here with same credit amounts)
  // 'price_test_starter': 5,
  // 'price_test_professional': 7,
  // 'price_test_business': 9,
  // 'price_test_enterprise': 11,
}

// Helper function to get plan type from price ID
export function getPlanTypeFromPriceId(priceId: string): string {
  // Check if it's a subscription price ID (works for both test and live)
  if (Object.values(STRIPE_PRICE_IDS.subscriptions).includes(priceId)) {
    return 'complete_access'
  }
  return PLAN_TYPES[priceId] || 'free'
}

// Helper function to get credit amount from price ID
export function getCreditAmountFromPriceId(priceId: string): number {
  // Map credit packages to amounts (works for both test and live)
  const creditPackageMap: Record<string, number> = {
    // Live mode
    'price_1S69FNDlESHKijI2GkCApIWQ': 5,   // Starter Pack
    'price_1S69G7DlESHKijI2Eb3uIxHZ': 7,   // Professional Pack
    'price_1S69GqDlESHKijI2PsvK4k4o': 9,   // Business Pack
    'price_1S69HzDlESHKijI2K9H4o4FV': 11,  // Enterprise Pack
  }
  
  // Check if it's a known credit package
  if (creditPackageMap[priceId]) {
    return creditPackageMap[priceId]
  }
  
  // For test mode, check if it's a credit package and use environment variable or default
  if (isCreditPriceId(priceId)) {
    // Try to get from environment variable or use default based on which package
    const testPrices = STRIPE_PRICE_IDS.credits
    if (priceId === testPrices.starterPack) return 5
    if (priceId === testPrices.professionalPack) return 7
    if (priceId === testPrices.businessPack) return 9
    if (priceId === testPrices.enterprisePack) return 11
  }
  
  return CREDIT_AMOUNTS[priceId] || 0
}

// Helper function to check if price ID is a subscription
export function isSubscriptionPriceId(priceId: string): boolean {
  return Object.values(STRIPE_PRICE_IDS.subscriptions).includes(priceId)
}

// Helper function to check if price ID is a credit package
export function isCreditPriceId(priceId: string): boolean {
  return Object.values(STRIPE_PRICE_IDS.credits).includes(priceId)
}
