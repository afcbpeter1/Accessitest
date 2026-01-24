// Stripe configuration and price mappings
export const STRIPE_PRICE_IDS = {
  // Subscription Plans
  subscriptions: {
    unlimitedMonthly: 'price_1St8nsRYsgNlHbsUScMIfGLU',   // Unlimited Access Monthly (GBP)
    unlimitedYearly: 'price_1St8sYRYsgNlHbsUleGDBwAO',    // Unlimited Access Yearly (GBP, ~20% discount)
  },
  
  // Credit Packages
  credits: {
    starterPack: 'price_1St8uARYsgNlHbsUusfjINkC',        // Starter Pack (5 credits)
    professionalPack: 'price_1St95GRYsgNlHbsUWvQbvhhJ',   // Professional Pack (7 credits)
    businessPack: 'price_1St96IRYsgNlHbsUSh1gdwI0',       // Business Pack (9 credits)
    enterprisePack: 'price_1St9A3RYsgNlHbsU6Ukd0igt',     // Enterprise Pack (11 credits)
  }
}

// Plan type mappings for database storage
export const PLAN_TYPES = {
  'price_1St8nsRYsgNlHbsUScMIfGLU': 'complete_access',
  'price_1St8sYRYsgNlHbsUleGDBwAO': 'complete_access',
}

// Credit amounts for credit packages
export const CREDIT_AMOUNTS = {
  'price_1St8uARYsgNlHbsUusfjINkC': 5,     // Starter Pack
  'price_1St95GRYsgNlHbsUWvQbvhhJ': 7,     // Professional Pack
  'price_1St96IRYsgNlHbsUSh1gdwI0': 9,     // Business Pack
  'price_1St9A3RYsgNlHbsU6Ukd0igt': 11,    // Enterprise Pack
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
