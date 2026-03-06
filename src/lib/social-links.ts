/**
 * Social Media Links Configuration
 * Update these URLs with your actual social media profiles
 */

export const socialLinks = {
  twitter: 'https://x.com/A11ytestAI',
  linkedin: 'https://www.linkedin.com/company/a11ytest-ai',
  email: 'mailto:hello@a11ytest.ai',
} as const

/**
 * Get social media link by platform
 */
export function getSocialLink(platform: keyof typeof socialLinks): string {
  return socialLinks[platform]
}





