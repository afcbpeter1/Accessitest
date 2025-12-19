/**
 * Social Media Links Configuration
 * Update these URLs with your actual social media profiles
 */

export const socialLinks = {
  twitter: 'https://twitter.com/a11ytestai',
  linkedin: 'https://www.linkedin.com/company/a11ytestai',
  github: 'https://github.com/a11ytestai',
  email: 'mailto:contact@a11ytest.ai',
} as const

/**
 * Get social media link by platform
 */
export function getSocialLink(platform: keyof typeof socialLinks): string {
  return socialLinks[platform]
}



