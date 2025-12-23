import Stripe from 'stripe'
import { query, queryOne } from '@/lib/database'
import { updateOrganization } from './organization-service'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
})

/**
 * Create or get Stripe customer for organization
 */
export async function getOrCreateStripeCustomer(organizationId: string, organizationName: string, email: string): Promise<string> {
  // Check if organization already has a Stripe customer ID
  const org = await queryOne(
    `SELECT stripe_customer_id FROM organizations WHERE id = $1`,
    [organizationId]
  )
  
  if (org?.stripe_customer_id) {
    return org.stripe_customer_id
  }
  
  // Create new Stripe customer
  const customer = await stripe.customers.create({
    name: organizationName,
    email: email,
    metadata: {
      organization_id: organizationId
    }
  })
  
  // Update organization with Stripe customer ID (direct update for system operations)
  await query(
    `UPDATE organizations SET stripe_customer_id = $1, updated_at = NOW() WHERE id = $2`,
    [customer.id, organizationId]
  )
  
  return customer.id
}

/**
 * Get the appropriate seat price ID based on organization owner's subscription
 */
async function getSeatPriceId(organizationId: string): Promise<string> {
  // Get organization owner
  const owner = await queryOne(
    `SELECT u.id, u.stripe_subscription_id
     FROM organization_members om
     INNER JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
     LIMIT 1`,
    [organizationId]
  )
  
  if (!owner) {
    // Default to monthly if no owner found
    return process.env.STRIPE_PER_USER_PRICE_ID || ''
  }
  
  // Check if owner has a yearly subscription
  if (owner.stripe_subscription_id) {
    try {
      const subscription = await stripe.subscriptions.retrieve(owner.stripe_subscription_id)
      const price = subscription.items.data[0]?.price
      
      // Check if subscription is yearly (interval === 'year')
      if (price?.recurring?.interval === 'year') {
        const yearlyPriceId = process.env.STRIPE_PER_USER_PRICE_ID_YEARLY
        if (yearlyPriceId) {
          return yearlyPriceId
        }
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      // Fall through to monthly
    }
  }
  
  // Default to monthly
  const monthlyPriceId = process.env.STRIPE_PER_USER_PRICE_ID
  if (!monthlyPriceId) {
    throw new Error('STRIPE_PER_USER_PRICE_ID not configured')
  }
  
  return monthlyPriceId
}

/**
 * Create Stripe checkout session for adding users to organization
 */
export async function createCheckoutSession(
  organizationId: string,
  numberOfUsers: number,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  const org = await queryOne(
    `SELECT name, stripe_customer_id FROM organizations WHERE id = $1`,
    [organizationId]
  )
  
  if (!org) {
    throw new Error('Organization not found')
  }
  
  // Get or create Stripe customer
  const customerId = org.stripe_customer_id 
    ? org.stripe_customer_id
    : await getOrCreateStripeCustomer(organizationId, org.name, '') // Email will be set later
  
  // Get appropriate price ID (monthly or yearly based on owner's subscription)
  const priceId = await getSeatPriceId(organizationId)
  
  if (!priceId) {
    throw new Error('Seat pricing not configured. Please set STRIPE_PER_USER_PRICE_ID and/or STRIPE_PER_USER_PRICE_ID_YEARLY')
  }
  
  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: numberOfUsers
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      organization_id: organizationId,
      number_of_users: numberOfUsers.toString()
    }
  })
  
  return {
    sessionId: session.id,
    url: session.url || ''
  }
}

/**
 * Update organization subscription based on Stripe webhook
 */
export async function updateOrganizationSubscription(
  organizationId: string,
  subscription: Stripe.Subscription
): Promise<void> {
  const quantity = subscription.items.data[0]?.quantity || 1
  
  // Direct update for system operations (webhook)
  await query(
    `UPDATE organizations 
     SET subscription_status = $1, max_users = $2, updated_at = NOW()
     WHERE id = $3`,
    [subscription.status, quantity, organizationId]
  )
}

/**
 * Get active user count for an organization
 * Excludes pending invitations (only counts users who have actually joined)
 */
export async function getActiveUserCount(organizationId: string): Promise<number> {
  const result = await queryOne(
    `SELECT COUNT(*) as count
     FROM organization_members
     WHERE organization_id = $1 AND is_active = true AND joined_at IS NOT NULL`,
    [organizationId]
  )
  
  return parseInt(result?.count || '0', 10)
}

/**
 * Check if organization can add more users (DEPRECATED - use canAddTeam instead)
 * @deprecated Use canAddTeam for team-based billing
 */
export async function canAddUser(organizationId: string): Promise<{ canAdd: boolean; currentUsers: number; maxUsers: number }> {
  const org = await queryOne(
    `SELECT max_users FROM organizations WHERE id = $1`,
    [organizationId]
  )
  
  if (!org) {
    return { canAdd: false, currentUsers: 0, maxUsers: 0 }
  }
  
  const currentUsers = await getActiveUserCount(organizationId)
  const maxUsers = org.max_users || 1
  
  return {
    canAdd: currentUsers < maxUsers,
    currentUsers,
    maxUsers
  }
}

/**
 * Get active team count for an organization
 */
export async function getActiveTeamCount(organizationId: string): Promise<number> {
  const result = await queryOne(
    `SELECT COUNT(*) as count
     FROM teams
     WHERE organization_id = $1 AND subscription_status = 'active'`,
    [organizationId]
  )
  
  return parseInt(result?.count || '0', 10)
}

/**
 * Check if organization can add more teams
 */
export async function canAddTeam(organizationId: string): Promise<{ canAdd: boolean; currentTeams: number; maxTeams: number }> {
  const org = await queryOne(
    `SELECT max_teams FROM organizations WHERE id = $1`,
    [organizationId]
  )
  
  if (!org) {
    return { canAdd: false, currentTeams: 0, maxTeams: 0 }
  }
  
  const currentTeams = await getActiveTeamCount(organizationId)
  const maxTeams = org.max_teams || 0
  
  return {
    canAdd: currentTeams < maxTeams,
    currentTeams,
    maxTeams
  }
}

/**
 * Create Stripe checkout session for adding a team
 */
export async function createTeamCheckoutSession(
  organizationId: string,
  successUrl: string,
  cancelUrl: string
): Promise<{ sessionId: string; url: string }> {
  const org = await queryOne(
    `SELECT name, stripe_customer_id FROM organizations WHERE id = $1`,
    [organizationId]
  )
  
  if (!org) {
    throw new Error('Organization not found')
  }
  
  // Get or create Stripe customer
  const customerId = org.stripe_customer_id 
    ? org.stripe_customer_id
    : await getOrCreateStripeCustomer(organizationId, org.name, '')
  
  // Get team price ID (monthly or yearly based on owner's subscription)
  const priceId = await getSeatPriceId(organizationId) // Reuse same logic for now
  
  if (!priceId) {
    throw new Error('Team pricing not configured')
  }
  
  // Create checkout session for one team
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [
      {
        price: priceId,
        quantity: 1 // One team
      }
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      organization_id: organizationId,
      type: 'team'
    }
  })
  
  return {
    sessionId: session.id,
    url: session.url || ''
  }
}

