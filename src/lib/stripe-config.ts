// Stripe configuration and price mappings
export const STRIPE_PRICE_IDS = {
  // Subscription Plans
  subscriptions: {
    webScanMonthly: 'price_1S696uDlESHKijI24XIbzGdH',
    webScanYearly: 'price_1S698gDlESHKijI2hVtPhtvZ',
    documentScanMonthly: 'price_1S69A4DlESHKijI2LNv4j2SI',
    documentScanYearly: 'price_1S69CADlESHKijI2SMX0XF1k',
    completeAccessMonthly: 'price_1S69D4DlESHKijI2LG4FvwyO',
    completeAccessYearly: 'price_1S69DvDlESHKijI2p2FIcY5a',
  },
  
  // Credit Packages
  credits: {
    starterPack: 'price_1S69FNDlESHKijI2GkCApIWQ',
    professionalPack: 'price_1S69G7DlESHKijI2Eb3uIxHZ',
    businessPack: 'price_1S69GqDlESHKijI2PsvK4k4o',
    enterprisePack: 'price_1S69HzDlESHKijI2K9H4o4FV',
  }
}

// Plan type mappings for database storage
export const PLAN_TYPES = {
  'price_1S696uDlESHKijI24XIbzGdH': 'web_only',
  'price_1S698gDlESHKijI2hVtPhtvZ': 'web_only',
  'price_1S69A4DlESHKijI2LNv4j2SI': 'document_only',
  'price_1S69CADlESHKijI2SMX0XF1k': 'document_only',
  'price_1S69D4DlESHKijI2LG4FvwyO': 'complete_access',
  'price_1S69DvDlESHKijI2p2FIcY5a': 'complete_access',
}

// Credit amounts for credit packages
export const CREDIT_AMOUNTS = {
  'price_1S69FNDlESHKijI2GkCApIWQ': 5,   // Starter Pack
  'price_1S69G7DlESHKijI2Eb3uIxHZ': 7,   // Professional Pack
  'price_1S69GqDlESHKijI2PsvK4k4o': 9,   // Business Pack
  'price_1S69HzDlESHKijI2K9H4o4FV': 11,  // Enterprise Pack
}

// Helper function to get plan type from price ID
export function getPlanTypeFromPriceId(priceId: string): string {
  return PLAN_TYPES[priceId as keyof typeof PLAN_TYPES] || 'free'
}

// Helper function to get credit amount from price ID
export function getCreditAmountFromPriceId(priceId: string): number {
  return CREDIT_AMOUNTS[priceId as keyof typeof CREDIT_AMOUNTS] || 0
}

// Helper function to check if price ID is a subscription
export function isSubscriptionPriceId(priceId: string): boolean {
  return Object.values(STRIPE_PRICE_IDS.subscriptions).includes(priceId)
}

// Helper function to check if price ID is a credit package
export function isCreditPriceId(priceId: string): boolean {
  return Object.values(STRIPE_PRICE_IDS.credits).includes(priceId)
}
