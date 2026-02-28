import Stripe from 'stripe'

const STRIPE_API_VERSION = '2025-08-27.basil' as const

let _stripe: Stripe | null = null

/** Lazy Stripe client so build never runs new Stripe() when env vars are missing. */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set')
    _stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION })
  }
  return _stripe
}

// Stripe configuration and price mappings (LIVE)
export const STRIPE_PRICE_IDS = {
  // Subscription Plans
  subscriptions: {
    unlimitedMonthly: 'price_1T5pQuRYsgNlHbsUQz4p4qJz',   // Unlimited Access Monthly (GBP)
    unlimitedYearly: 'price_1T5pQsRYsgNlHbsUi8XaD85w',    // Unlimited Access Yearly (GBP, ~20% discount)
  },

  // Credit Packages
  credits: {
    starterPack: 'price_1T5pRARYsgNlHbsUHh5ztgdp',        // Starter Pack (5 credits)
    professionalPack: 'price_1T5pR7RYsgNlHbsUPdOzxgML',   // Professional Pack (7 credits)
    businessPack: 'price_1T5pR4RYsgNlHbsUKUY8GcNu',       // Business Pack (9 credits)
    enterprisePack: 'price_1T5pQzRYsgNlHbsUnOui6tlG',    // Enterprise Pack (11 credits)
  }
}

// Plan type mappings for database storage
export const PLAN_TYPES = {
  'price_1T5pQuRYsgNlHbsUQz4p4qJz': 'complete_access',
  'price_1T5pQsRYsgNlHbsUi8XaD85w': 'complete_access',
}

// Credit amounts for credit packages
export const CREDIT_AMOUNTS = {
  'price_1T5pRARYsgNlHbsUHh5ztgdp': 5,     // Starter Pack
  'price_1T5pR7RYsgNlHbsUPdOzxgML': 7,     // Professional Pack
  'price_1T5pR4RYsgNlHbsUKUY8GcNu': 9,     // Business Pack
  'price_1T5pQzRYsgNlHbsUnOui6tlG': 11,    // Enterprise Pack
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
