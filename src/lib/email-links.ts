/**
 * Shared base URL and links for user-facing emails.
 * Use these so users can update profile or manage subscription/billing (Stripe Customer Portal) from any email.
 *
 * Stripe Customer Portal: If STRIPE_BILLING_PORTAL_LOGIN_URL is set (from Dashboard → Customer portal → Activate link),
 * "Manage subscription & billing" links go directly to Stripe. Customers land on Stripe, enter email (or it's prefilled),
 * get a one-time passcode, and manage invoices/payment/cancel there. Otherwise we use our /api/billing/portal redirect.
 */
export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

export function getProfileUrl(): string {
  return `${getAppBaseUrl()}/settings`
}

/**
 * URL for "Manage subscription & billing". Prefer Stripe's shareable portal login link when set.
 * @param recipientEmail - Optional. When using Stripe login link, prefill this email (faster for the customer).
 */
export function getManageBillingUrl(recipientEmail?: string): string {
  const stripePortalLogin = process.env.STRIPE_BILLING_PORTAL_LOGIN_URL?.trim()
  if (stripePortalLogin) {
    const base = stripePortalLogin.replace(/\?.*$/, '')
    const params = new URLSearchParams()
    if (recipientEmail) params.set('prefilled_email', recipientEmail)
    const qs = params.toString()
    return qs ? `${base}?${qs}` : base
  }
  return `${getAppBaseUrl()}/api/billing/portal`
}

/**
 * HTML snippet for email footers: "Update profile" and "Manage subscription & billing" links.
 * Stripe Customer Portal lets users update payment method, cancel, view invoices, etc.
 */
export function getEmailManageLinksFooterHtml(recipientEmail: string): string {
  const base = getAppBaseUrl()
  const profileUrl = getProfileUrl()
  const billingUrl = getManageBillingUrl()
  return `
    <div style="text-align: center; margin-top: 20px; padding-top: 16px; border-top: 1px solid #eee; color: #666; font-size: 14px;">
      <p style="margin: 0 0 8px 0;">
        <a href="${profileUrl}" style="color: #06B6D4; text-decoration: none;">Update profile</a>
        &nbsp;·&nbsp;
        <a href="${billingUrl}" style="color: #06B6D4; text-decoration: none;">Manage subscription & billing</a>
      </p>
      <p style="margin: 0; font-size: 12px;">You can update your details, payment method, or cancel your subscription from the links above.</p>
      <p style="margin: 12px 0 0 0;">This email was sent to ${recipientEmail}</p>
    </div>`
}

/**
 * Plain text version for multipart emails.
 */
export function getEmailManageLinksFooterText(recipientEmail: string): string {
  const profileUrl = getProfileUrl()
  const billingUrl = getManageBillingUrl(recipientEmail)
  return `

Update profile: ${profileUrl}
Manage subscription & billing: ${billingUrl}

You can update your details, payment method, or cancel your subscription from the links above.

This email was sent to ${recipientEmail}`
}
