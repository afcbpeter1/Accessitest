import { NextRequest, NextResponse } from 'next/server'
import { getAuthToken, verifyToken } from '@/lib/auth-middleware'
import { queryOne } from '@/lib/database'
import { getStripe } from '@/lib/stripe-config'

/**
 * GET /api/billing/portal
 * Creates a Stripe Customer Portal session and redirects the user there.
 * From the portal they can update payment method, cancel subscription, view invoices, etc.
 * Requires auth; if not logged in, redirects to login with returnTo so they can come back.
 */
export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const loginUrl = `${baseUrl}/login?returnTo=${encodeURIComponent('/api/billing/portal')}`
  const settingsUrl = `${baseUrl}/settings`

  const token = getAuthToken(request)
  if (!token) {
    return NextResponse.redirect(loginUrl)
  }
  const user = verifyToken(token)
  if (!user) {
    return NextResponse.redirect(loginUrl)
  }

  try {
    const userData = await queryOne(
      `SELECT stripe_subscription_id, email FROM users WHERE id = $1`,
      [user.userId]
    )
    if (!userData?.email) {
      return NextResponse.redirect(settingsUrl + '?error=no-email')
    }

    const stripe = getStripe()
    let customerId: string | null = null

    if (userData.stripe_subscription_id) {
      const subscription = await stripe.subscriptions.retrieve(userData.stripe_subscription_id)
      customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id ?? null
    }

    if (!customerId) {
      const customers = await stripe.customers.list({ email: userData.email, limit: 1 })
      if (customers.data.length > 0) {
        customerId = customers.data[0].id
      }
    }

    if (!customerId) {
      return NextResponse.redirect(settingsUrl + '?error=no-billing')
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: settingsUrl,
    })

    if (!session?.url) {
      return NextResponse.redirect(settingsUrl + '?error=portal')
    }
    return NextResponse.redirect(session.url)
  } catch (error) {
    console.error('Billing portal error:', error)
    return NextResponse.redirect(settingsUrl + '?error=portal')
  }
}
