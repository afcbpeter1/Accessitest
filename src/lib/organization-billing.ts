import Stripe from 'stripe'
import { query, queryOne } from '@/lib/database'
import { updateOrganization } from './organization-service'
import { getStripe } from './stripe-config'

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
  const customer = await getStripe().customers.create({
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
 * Get the appropriate seat price ID based on billing period
 * @param billingPeriod - 'monthly' or 'yearly'. If not provided, defaults based on owner's subscription
 */
async function getSeatPriceId(organizationId: string, billingPeriod?: 'monthly' | 'yearly'): Promise<string> {
  // If billing period is explicitly provided, use it
  if (billingPeriod === 'yearly') {
    const yearlyPriceId = process.env.STRIPE_PER_USER_PRICE_ID_YEARLY
    if (!yearlyPriceId) {
      throw new Error('STRIPE_PER_USER_PRICE_ID_YEARLY not configured')
    }
    return yearlyPriceId
  }
  
  if (billingPeriod === 'monthly') {
    const monthlyPriceId = process.env.STRIPE_PER_USER_PRICE_ID
    if (!monthlyPriceId) {
      throw new Error('STRIPE_PER_USER_PRICE_ID not configured')
    }
    return monthlyPriceId
  }
  
  // Auto-detect based on owner's subscription (backward compatibility)
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
    const monthlyPriceId = process.env.STRIPE_PER_USER_PRICE_ID
    if (!monthlyPriceId) {
      throw new Error('STRIPE_PER_USER_PRICE_ID not configured')
    }
    return monthlyPriceId
  }
  
  // Check if owner has a yearly subscription
  if (owner.stripe_subscription_id) {
    try {
      const subscription = await getStripe().subscriptions.retrieve(owner.stripe_subscription_id)
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
 * Get owner's subscription billing period
 */
export async function getOwnerBillingPeriod(organizationId: string): Promise<'monthly' | 'yearly' | null> {
  const owner = await queryOne(
    `SELECT u.stripe_subscription_id
     FROM organization_members om
     INNER JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
     LIMIT 1`,
    [organizationId]
  )
  
  if (!owner?.stripe_subscription_id) {
    return null
  }
  
  try {
    const subscription = await getStripe().subscriptions.retrieve(owner.stripe_subscription_id)
    const price = subscription.items.data[0]?.price
    
    if (price?.recurring?.interval === 'year') {
      return 'yearly'
    }
    return 'monthly'
  } catch (error) {
    console.error('Error checking owner subscription:', error)
    return null
  }
}

/**
 * Get price information for display
 */
export async function getSeatPriceInfo(billingPeriod: 'monthly' | 'yearly'): Promise<{ priceId: string; amount: number; currency: string }> {
  const priceId = billingPeriod === 'yearly' 
    ? (process.env.STRIPE_PER_USER_PRICE_ID_YEARLY || '')
    : (process.env.STRIPE_PER_USER_PRICE_ID || '')
  
  if (!priceId) {
    throw new Error(`STRIPE_PER_USER_PRICE_ID${billingPeriod === 'yearly' ? '_YEARLY' : ''} not configured`)
  }
  
  try {
    const price = await getStripe().prices.retrieve(priceId)
    return {
      priceId,
      amount: (price.unit_amount || 0) / 100, // Convert cents to dollars
      currency: price.currency.toUpperCase()
    }
  } catch (error) {
    console.error('Error retrieving price:', error)
    throw new Error('Could not retrieve price information')
  }
}

/** Sum only proration line items from an invoice (for "pay proration only today" flow). */
function sumProrationOnlyFromInvoice(invoice: Stripe.Invoice): number {
  const lines = invoice.lines?.data ?? []
  let sumCents = 0
  for (const line of lines) {
    const details = (line as any).subscription_item_details ?? (line as any)
    if (details?.proration === true) {
      sumCents += line.amount ?? 0
    }
  }
  return sumCents / 100
}

/**
 * Preview prorated amount when adding seats (no subscription change).
 * Uses Stripe upcoming invoice with subscription_details to simulate the add.
 */
/** Helper: days between two Unix timestamps (end of day logic: same day = 1 day remaining). */
function daysBetween(startSec: number, endSec: number): number {
  const start = new Date(startSec * 1000)
  const end = new Date(endSec * 1000)
  const ms = end.getTime() - start.getTime()
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)))
}

export async function previewAddSeats(
  organizationId: string,
  numberOfUsers: number
): Promise<{
  proratedAmount: number
  prorationOnlyAmount: number
  currency: string
  nextBillingDate: string | null
  seatPrice: number
  billingPeriod: 'monthly' | 'yearly'
  /** Total subscription amount for this line at renewal (all seats). */
  totalAtRenewal: number
  /** Amount at renewal for the new seats only (seatPrice × numberOfUsers). */
  newSeatsAtRenewal: number
  numberOfUsers: number
  /** When the current billing period started (ISO). */
  periodStart: string | null
  /** When the current billing period ends (ISO). Same as nextBillingDate. */
  periodEnd: string | null
  /** Total days in the current period. */
  daysInPeriod: number | null
  /** Days remaining in the current period (from today). Drives proration: less remaining = lower pay today. */
  daysRemainingInPeriod: number | null
}> {
  const owner = await queryOne(
    `SELECT u.stripe_subscription_id
     FROM organization_members om
     INNER JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
     LIMIT 1`,
    [organizationId]
  )
  if (!owner?.stripe_subscription_id) {
    throw new Error('Organization owner does not have an active subscription.')
  }
  const subscription = await getStripe().subscriptions.retrieve(owner.stripe_subscription_id)
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    throw new Error('Owner subscription is not active.')
  }
  const billingPeriod = (subscription.items.data[0]?.price?.recurring?.interval === 'year') ? 'yearly' : 'monthly'
  const priceId = await getSeatPriceId(organizationId, billingPeriod)
  const existingItem = subscription.items.data.find(item => item.price.id === priceId)
  const periodStartSec = (subscription as any).current_period_start as number | undefined
  const periodEndSec = (subscription as any).current_period_end as number | undefined
  const nowSec = Math.floor(Date.now() / 1000)
  const periodStart = periodStartSec ? new Date(periodStartSec * 1000).toISOString() : null
  const periodEnd = periodEndSec ? new Date(periodEndSec * 1000).toISOString() : null
  const daysInPeriod = periodStartSec != null && periodEndSec != null ? daysBetween(periodStartSec, periodEndSec) : null
  const daysRemainingInPeriod = periodEndSec != null ? daysBetween(nowSec, periodEndSec) : null

  const baseReturn = {
    periodStart,
    periodEnd,
    daysInPeriod,
    daysRemainingInPeriod
  }

  if (!existingItem) {
    const stripe = getStripe()
    const upcoming = await stripe.invoices.createPreview({
      customer: subscription.customer as string,
      subscription: subscription.id,
      subscription_details: {
        items: [
          ...subscription.items.data.map(item => ({ id: item.id, quantity: item.quantity || 1 })),
          { price: priceId, quantity: numberOfUsers }
        ],
        proration_behavior: 'create_prorations'
      }
    })
    const proratedAmount = (upcoming.amount_due || 0) / 100
    const seatPrice = (await getSeatPriceInfo(billingPeriod)).amount
    const prorationOnlyAmount = sumProrationOnlyFromInvoice(upcoming)
    const newSeatsAtRenewal = Math.round(seatPrice * numberOfUsers * 100) / 100
    return {
      proratedAmount: Math.round(proratedAmount * 100) / 100,
      prorationOnlyAmount: Math.round(prorationOnlyAmount * 100) / 100,
      currency: (upcoming.currency || 'gbp').toUpperCase(),
      nextBillingDate: upcoming.period_end ? new Date(upcoming.period_end * 1000).toISOString() : null,
      seatPrice,
      billingPeriod,
      totalAtRenewal: newSeatsAtRenewal,
      newSeatsAtRenewal,
      numberOfUsers,
      ...baseReturn
    }
  }
  const subscriptionDetailsItems: { id: string; quantity: number }[] = subscription.items.data.map(item => ({
    id: item.id,
    quantity: item.price.id === priceId ? (item.quantity || 0) + numberOfUsers : (item.quantity || 1)
  }))
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : (subscription.customer as Stripe.Customer)?.id
  const upcoming = await getStripe().invoices.createPreview({
    ...(customerId ? { customer: customerId } : {}),
    subscription: subscription.id,
    subscription_details: {
      items: subscriptionDetailsItems,
      proration_behavior: 'create_prorations'
    }
  })
  const proratedAmount = (upcoming.amount_due || 0) / 100
  const seatPrice = (await getSeatPriceInfo(billingPeriod)).amount
  const prorationOnlyAmount = sumProrationOnlyFromInvoice(upcoming)
  const newSeatsAtRenewal = Math.round(seatPrice * numberOfUsers * 100) / 100
  const totalAtRenewal = Math.round(seatPrice * ((existingItem.quantity || 0) + numberOfUsers) * 100) / 100
  return {
    proratedAmount: Math.round(proratedAmount * 100) / 100,
    prorationOnlyAmount: Math.round(prorationOnlyAmount * 100) / 100,
    currency: (upcoming.currency || 'gbp').toUpperCase(),
    nextBillingDate: upcoming.period_end ? new Date(upcoming.period_end * 1000).toISOString() : null,
    seatPrice,
    billingPeriod,
    totalAtRenewal,
    newSeatsAtRenewal,
    numberOfUsers,
    ...baseReturn
  }
}

/**
 * Add seats to owner's existing subscription (preferred method)
 * This adds organization seats to the owner's personal subscription for unified billing
 * @param options.sendEmail - If false, skip sending billing confirmation (e.g. when paying prorated now; email sent on invoice.paid)
 */
export async function addSeatsToOwnerSubscription(
  organizationId: string,
  numberOfUsers: number,
  billingPeriod?: 'monthly' | 'yearly', // Optional - if not provided, auto-detects from owner's subscription
  options?: { sendEmail?: boolean }
): Promise<{ 
  success: boolean
  subscriptionId?: string
  message: string
  billingDetails?: {
    proratedAmount: number
    nextPeriodAmount: number
    totalUpcomingInvoice: number
    currency: string
    nextBillingDate: string | null
    numberOfUsers: number
    seatPrice: number
  } | null
}> {
  // Get organization owner
  const owner = await queryOne(
    `SELECT u.id, u.stripe_subscription_id, u.email
     FROM organization_members om
     INNER JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
     LIMIT 1`,
    [organizationId]
  )
  
  if (!owner) {
    throw new Error('Organization owner not found')
  }
  
  if (!owner.stripe_subscription_id) {
    throw new Error('Organization owner does not have an active subscription. Please subscribe first.')
  }
  
  // Get owner's subscription
  let subscription: Stripe.Subscription
  try {
    subscription = await getStripe().subscriptions.retrieve(owner.stripe_subscription_id)
  } catch (error) {
    throw new Error('Could not retrieve owner subscription. Please ensure the subscription is active.')
  }
  
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    throw new Error('Owner subscription is not active. Please activate your subscription first.')
  }
  
  // Get appropriate price ID (monthly or yearly based on owner's subscription)
  // If billingPeriod is provided, use it; otherwise auto-detect from owner's subscription
  const priceId = await getSeatPriceId(organizationId, billingPeriod)
  
  if (!priceId) {
    throw new Error('Seat pricing not configured. Please set STRIPE_PER_USER_PRICE_ID and/or STRIPE_PER_USER_PRICE_ID_YEARLY')
  }
  
  // Check if this price already exists in the subscription
  const existingItem = subscription.items.data.find(item => item.price.id === priceId)
  
  let updatedSubscription: Stripe.Subscription
  
  if (existingItem) {
    // Update existing item quantity
    // Stripe automatically prorates when quantity changes mid-cycle
    const newQuantity = (existingItem.quantity || 0) + numberOfUsers
    updatedSubscription = await getStripe().subscriptions.update(subscription.id, {
      items: [{
        id: existingItem.id,
        quantity: newQuantity
      }],
      proration_behavior: 'create_prorations', // Explicitly enable prorating
      metadata: {
        ...subscription.metadata,
        organization_seats_added: (parseInt(subscription.metadata?.organization_seats_added || '0', 10) + numberOfUsers).toString(),
        organization_id: organizationId // Track which organization these seats belong to
      }
    })
    console.log(`✅ Added ${numberOfUsers} seats to existing subscription item. New quantity: ${newQuantity} (prorated)`)
  } else {
    // Add new item to subscription
    updatedSubscription = await getStripe().subscriptions.update(subscription.id, {
      items: [
        ...subscription.items.data.map(item => ({ id: item.id })),
        {
          price: priceId,
          quantity: numberOfUsers
        }
      ],
      proration_behavior: 'create_prorations', // Explicitly enable prorating
      metadata: {
        ...subscription.metadata,
        organization_seats_added: numberOfUsers.toString(),
        organization_id: organizationId // Track which organization these seats belong to
      }
    })
    console.log(`✅ Added new subscription item with ${numberOfUsers} seats (prorated)`)
  }
  
  // Update organization max_users immediately
  console.log(`🔄 Updating organization ${organizationId} max_users...`)
  const org = await queryOne(
    `SELECT max_users FROM organizations WHERE id = $1`,
    [organizationId]
  )
  
  if (!org) {
    throw new Error(`Organization ${organizationId} not found`)
  }
  
  const currentMaxUsers = org?.max_users || 0
  const newMaxUsers = currentMaxUsers + numberOfUsers
  
  console.log(`📊 Organization ${organizationId}: current=${currentMaxUsers}, adding=${numberOfUsers}, new=${newMaxUsers}`)
  
  const updateResult = await query(
    `UPDATE organizations 
     SET max_users = $1, subscription_status = 'active', updated_at = NOW()
     WHERE id = $2`,
    [newMaxUsers, organizationId]
  )
  
  console.log(`✅ Updated organization ${organizationId} max_users from ${currentMaxUsers} to ${newMaxUsers} (rows affected: ${updateResult.rowCount || 0})`)
  
  // Verify the update
  const verifyOrg = await queryOne(
    `SELECT max_users, subscription_status FROM organizations WHERE id = $1`,
    [organizationId]
  )
  console.log(`✅ Verified organization ${organizationId} update: max_users=${verifyOrg?.max_users}, status=${verifyOrg?.subscription_status}`)
  
  // Get organization name for email
  const orgInfo = await queryOne(
    `SELECT name FROM organizations WHERE id = $1`,
    [organizationId]
  )
  const organizationName = orgInfo?.name || 'Your Organization'
  
  // Get billing details from upcoming invoice
  let billingDetails = null
  try {
    const upcomingInvoice = await getStripe().invoices.createPreview({
      subscription: updatedSubscription.id
    })
    
    // Calculate totals
    const totalAmount = (upcomingInvoice.amount_due || 0) / 100
    const currency = (upcomingInvoice.currency || 'gbp').toUpperCase()
    
    // Find the user license line items
    const userLicenseItems = upcomingInvoice.lines?.data?.filter((line: any) => 
      line.price?.id === priceId
    ) || []
    
    // Calculate prorated amount (for current period) and full amount (for next period)
    let proratedAmount = 0
    let nextPeriodAmount = 0
    const seatPrice = (priceId === process.env.STRIPE_PER_USER_PRICE_ID || priceId === process.env.STRIPE_PER_USER_PRICE_ID_YEARLY)
      ? (await getSeatPriceInfo(billingPeriod || 'monthly'))?.amount || 0
      : 0
    
    userLicenseItems.forEach((line: any) => {
      const lineAmount = (line.amount || 0) / 100
      // If it's a proration, it's for the current period
      if (line.proration || line.description?.includes('Remaining time')) {
        proratedAmount += lineAmount
      } else {
        // Otherwise it's for the next period
        nextPeriodAmount += lineAmount
      }
    })
    
    // Get next billing date
    const nextBillingDate = upcomingInvoice.period_end
      ? new Date(upcomingInvoice.period_end * 1000)
      : (updatedSubscription as any).current_period_end
      ? new Date((updatedSubscription as any).current_period_end * 1000)
      : null
    
    billingDetails = {
      proratedAmount: Math.round(proratedAmount * 100) / 100, // Round to 2 decimals
      nextPeriodAmount: Math.round(nextPeriodAmount * 100) / 100,
      totalUpcomingInvoice: Math.round(totalAmount * 100) / 100,
      currency,
      nextBillingDate: nextBillingDate?.toISOString() || null,
      numberOfUsers,
      seatPrice: Math.round(seatPrice * 100) / 100
    }
    
    console.log(`📊 Billing details:`, billingDetails)
  } catch (error) {
    console.warn('⚠️ Could not fetch upcoming invoice details:', error)
  }
  
  // Send billing confirmation email with breakdown (skip when sendEmail is false, e.g. payment will be on Stripe and receipt sent after payment)
  if (options?.sendEmail !== false) {
    try {
      const { EmailService } = await import('@/lib/email-service')
      
      // Determine billing period from price ID
      const billingPeriod = priceId === process.env.STRIPE_PER_USER_PRICE_ID_YEARLY ? 'yearly' : 'monthly'
      
      // Calculate amount for email (use next period amount as the recurring amount)
      const seatPrice = billingDetails?.seatPrice || (await getSeatPriceInfo(billingPeriod))?.amount || 0
      const amount = `£${(seatPrice * numberOfUsers).toFixed(2)}`
      
      await EmailService.sendBillingConfirmation({
        email: owner.email,
        organizationName,
        numberOfUsers,
        amount,
        billingPeriod,
        subscriptionId: updatedSubscription.id,
        billingDetails: billingDetails || undefined
      })
      
      console.log(`✅ Sent billing confirmation email to ${owner.email} with billing breakdown`)
    } catch (emailError) {
      console.error('⚠️ Failed to send billing confirmation email:', emailError)
      // Don't fail the whole operation if email fails
    }
  }

  return {
    success: true,
    subscriptionId: updatedSubscription.id,    
    message: `Successfully added ${numberOfUsers} seat(s) to your subscription. Charges are prorated and will appear on your next invoice.`,
    billingDetails: billingDetails || undefined
  }
}

/**
 * Create a Stripe Checkout Session for the proration-only amount (rest of current period).
 * Seats are NOT added until payment succeeds; the webhook adds seats and sends the receipt.
 * Customer pays today; the full seat fee is added to their next renewal.
 */
export async function addSeatsAndPayProratedNow(
  organizationId: string,
  numberOfUsers: number,
  successUrl: string,
  cancelUrl: string
): Promise<{ hostedInvoiceUrl: string }> {
  const stripe = getStripe()
  const preview = await previewAddSeats(organizationId, numberOfUsers)
  const prorationOnlyCents = Math.round(preview.prorationOnlyAmount * 100)
  if (prorationOnlyCents <= 0) {
    throw new Error('No proration amount for the rest of the period')
  }
  const owner = await queryOne(
    `SELECT u.id, u.email, u.stripe_subscription_id
     FROM organization_members om
     INNER JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
     LIMIT 1`,
    [organizationId]
  )
  if (!owner?.stripe_subscription_id) {
    throw new Error('Organization owner does not have an active subscription.')
  }
  const subscription = await stripe.subscriptions.retrieve(owner.stripe_subscription_id, { expand: ['customer'] })
  const rawCustomer = subscription.customer
  const customerId = typeof rawCustomer === 'string' ? rawCustomer : (rawCustomer as Stripe.Customer)?.id
  if (!customerId || typeof customerId !== 'string') {
    throw new Error('Subscription has no customer ID; cannot create checkout session.')
  }
  const successUrlWithParams = `${successUrl}${successUrl.includes('?') ? '&' : '?'}seats=${numberOfUsers}&amount=${encodeURIComponent(preview.prorationOnlyAmount.toFixed(2))}&type=proration`
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: [
      {
        price_data: {
          currency: (preview.currency || 'gbp').toLowerCase(),
          unit_amount: prorationOnlyCents,
          product_data: {
            name: `Proration for ${numberOfUsers} seat(s) – rest of current ${preview.billingPeriod} period`,
            description: 'The full seat fee will be added to your next bill at renewal.'
          }
        },
        quantity: 1
      }
    ],
    success_url: successUrlWithParams,
    cancel_url: cancelUrl,
    metadata: {
      organization_id: organizationId,
      number_of_users: String(numberOfUsers),
      source: 'add_seats_proration_only',
      proration_amount_cents: String(prorationOnlyCents)
    }
  })
  const url = session.url
  if (!url) {
    throw new Error('Stripe did not return a checkout URL')
  }
  return { hostedInvoiceUrl: url }
}

/**
 * Reduce seats from owner's existing subscription
 * This reduces organization seats from the owner's personal subscription
 */
export async function reduceSeatsFromOwnerSubscription(
  organizationId: string,
  numberOfUsersToRemove: number
): Promise<{ success: boolean; subscriptionId?: string; message: string }> {
  // Get organization owner
  const owner = await queryOne(
    `SELECT u.id, u.stripe_subscription_id, u.email
     FROM organization_members om
     INNER JOIN users u ON om.user_id = u.id
     WHERE om.organization_id = $1 AND om.role = 'owner' AND om.is_active = true
     LIMIT 1`,
    [organizationId]
  )
  
  if (!owner) {
    throw new Error('Organization owner not found')
  }
  
  if (!owner.stripe_subscription_id) {
    throw new Error('Organization owner does not have an active subscription.')
  }
  
  // Get owner's subscription
  let subscription: Stripe.Subscription
  try {
    subscription = await getStripe().subscriptions.retrieve(owner.stripe_subscription_id)
  } catch (error) {
    throw new Error('Could not retrieve owner subscription. Please ensure the subscription is active.')
  }
  
  if (subscription.status !== 'active' && subscription.status !== 'trialing') {
    throw new Error('Owner subscription is not active.')
  }
  
  // Get appropriate price ID - try to find existing seat price first
  // Check both monthly and yearly prices to find which one is in the subscription
  const monthlyPriceId = process.env.STRIPE_PER_USER_PRICE_ID
  const yearlyPriceId = process.env.STRIPE_PER_USER_PRICE_ID_YEARLY
  
  // Find the organization seat item (could be monthly or yearly)
  const existingItem = subscription.items.data.find(item => 
    item.price.id === monthlyPriceId || item.price.id === yearlyPriceId
  )
  
  if (!existingItem) {
    throw new Error('No organization seats found in subscription.')
  }
  
  const priceId = existingItem.price.id
  
  if (!existingItem) {
    throw new Error('No organization seats found in subscription.')
  }
  
  const currentQuantity = existingItem.quantity || 0
  const newQuantity = Math.max(0, currentQuantity - numberOfUsersToRemove)
  
  if (newQuantity === currentQuantity) {
    throw new Error('Cannot reduce seats - already at minimum.')
  }
  
  let updatedSubscription: Stripe.Subscription
  
  if (newQuantity === 0) {
    // Remove the item entirely
    updatedSubscription = await getStripe().subscriptions.update(subscription.id, {
      items: [
        ...subscription.items.data
          .filter(item => item.id !== existingItem.id)
          .map(item => ({ id: item.id }))
      ],
      proration_behavior: 'create_prorations', // Prorate the refund
      metadata: {
        ...subscription.metadata,
        organization_seats_added: '0'
      }
    })
    console.log(`✅ Removed all organization seats from subscription (prorated refund)`)
  } else {
    // Update quantity
    updatedSubscription = await getStripe().subscriptions.update(subscription.id, {
      items: [{
        id: existingItem.id,
        quantity: newQuantity
      }],
      proration_behavior: 'create_prorations', // Prorate the refund
      metadata: {
        ...subscription.metadata,
        organization_seats_added: newQuantity.toString()
      }
    })
    console.log(`✅ Reduced ${numberOfUsersToRemove} seats from subscription. New quantity: ${newQuantity} (prorated refund)`)
  }
  
  // Update organization max_users immediately
  const org = await queryOne(
    `SELECT max_users FROM organizations WHERE id = $1`,
    [organizationId]
  )
  const currentMaxUsers = org?.max_users || 0
  const newMaxUsers = Math.max(0, currentMaxUsers - numberOfUsersToRemove)
  
  await query(
    `UPDATE organizations 
     SET max_users = $1, updated_at = NOW()
     WHERE id = $2`,
    [newMaxUsers, organizationId]
  )
  
  console.log(`✅ Updated organization ${organizationId} max_users from ${currentMaxUsers} to ${newMaxUsers}`)
  
  return {
    success: true,
    subscriptionId: updatedSubscription.id,
    message: `Successfully reduced ${numberOfUsersToRemove} seat(s). You'll receive a prorated credit on your next invoice.`
  }
}

/**
 * Create Stripe checkout session for adding users to organization
 * This creates a separate subscription for the organization (fallback method)
 */
export async function createCheckoutSession(
  organizationId: string,
  numberOfUsers: number,
  successUrl: string,
  cancelUrl: string,
  useOwnerSubscription: boolean = true,
  billingPeriod?: 'monthly' | 'yearly'
): Promise<{ 
  sessionId: string
  url: string
  billingDetails?: {
    proratedAmount: number
    nextPeriodAmount: number
    totalUpcomingInvoice: number
    currency: string
    nextBillingDate: string | null
    numberOfUsers: number
    seatPrice: number
  } | null
}> {
  // Require owner to have a subscription before adding users
  if (useOwnerSubscription) {
    try {
      const result = await addSeatsToOwnerSubscription(organizationId, numberOfUsers, billingPeriod)
      if (result.success) {
        // Return a success response that redirects immediately with billing details
        return {
          sessionId: 'immediate',
          url: successUrl + '&added=true&method=subscription',
          billingDetails: result.billingDetails || null
        }
      }
    } catch (error) {
      // If owner doesn't have a subscription, throw error instead of falling back
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('does not have an active subscription')) {
        throw new Error('You must have an active monthly or yearly subscription before you can add users to your organization. Please subscribe first.')
      } else if (errorMessage.includes('subscription is not active')) {
        throw new Error('Your subscription is not active. Please activate your subscription before adding users.')
      } else {
        // Re-throw other errors
        throw error
      }
    }
  }
  
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
  
  // Get appropriate price ID (monthly or yearly based on parameter or owner's subscription)
  const priceId = await getSeatPriceId(organizationId, billingPeriod)
  
  if (!priceId) {
    throw new Error('Seat pricing not configured. Please set STRIPE_PER_USER_PRICE_ID and/or STRIPE_PER_USER_PRICE_ID_YEARLY')
  }
  
  // Create checkout session
  console.log(`🛒 Creating separate checkout session for organization ${organizationId}:`)
  console.log(`   - Number of users: ${numberOfUsers}`)
  console.log(`   - Price ID: ${priceId}`)
  console.log(`   - Customer ID: ${customerId}`)
  console.log(`   - Billing period: ${billingPeriod || 'monthly'}`)
  
  const session = await getStripe().checkout.sessions.create({
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
  
  console.log(`✅ Checkout session created: ${session.id}`)
  console.log(`   - URL: ${session.url}`)
  console.log(`   - Metadata: organization_id=${organizationId}, number_of_users=${numberOfUsers}`)
  
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
  const session = await getStripe().checkout.sessions.create({
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

