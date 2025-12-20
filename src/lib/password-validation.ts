/**
 * Validates password strength
 * Requirements:
 * - At least 8 characters long
 * - Contains at least 1 number
 * - Contains at least 1 special character
 */
export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Password is required' }
  }

  if (password.length < 8) {
    return { valid: false, error: 'Password must be at least 8 characters long' }
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return { valid: false, error: 'Password must contain at least one number' }
  }

  // Check for at least one special character
  // Special characters: !@#$%^&*()_+-=[]{}|;:,.<>?
  if (!/[!@#$%^&*()_+\-=\[\]{}|;:,.<>?]/.test(password)) {
    return { valid: false, error: 'Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)' }
  }

  return { valid: true }
}

/**
 * Get password requirements text for UI
 */
export function getPasswordRequirements(): string {
  return 'Password must be at least 8 characters long and contain at least one number and one special character'
}














