import { expect } from '@playwright/test';

/**
 * Login helper function
 */
export async function login(page, email, password) {
  await page.goto('/login');
  
  // Fill in login form
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  
  // Submit form
  await page.click('button[type="submit"]');
  
  // Wait for navigation to dashboard
  await page.waitForURL('/dashboard', { timeout: 10000 });
  
  // Wait for page to load
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  
  // Verify we're logged in by checking for dashboard content
  // The dashboard has "Accessibility Dashboard" as the h1, or we can check for sidebar
  const dashboardHeading = page.locator('text=Accessibility Dashboard').or(page.locator('h1:has-text("Dashboard")'));
  await expect(dashboardHeading.first()).toBeVisible({ timeout: 10000 });
}

/**
 * Logout helper function
 */
export async function logout(page) {
  // Look for logout button in sidebar or user menu
  const logoutButton = page.locator('text=Logout').or(page.locator('text=Sign out')).or(page.locator('[data-testid="logout"]'));
  
  if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL(/\/home|\/login/, { timeout: 5000 });
  }
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(page) {
  try {
    // Check for dashboard or authenticated content
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    return token !== null;
  } catch {
    return false;
  }
}

