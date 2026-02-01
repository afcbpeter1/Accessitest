/**
 * Shared base URL and links for user-facing emails.
 * Use these so users can update profile or manage subscription/billing (Stripe Customer Portal) from any email.
 */
export function getAppBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
}

export function getProfileUrl(): string {
  return `${getAppBaseUrl()}/settings`
}

export function getManageBillingUrl(): string {
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
  const billingUrl = getManageBillingUrl()
  return `

Update profile: ${profileUrl}
Manage subscription & billing: ${billingUrl}

You can update your details, payment method, or cancel your subscription from the links above.

This email was sent to ${recipientEmail}`
}
