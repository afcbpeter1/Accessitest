import { test, expect } from '@playwright/test';
import { login, logout } from '../utils/auth.js';
import { config } from '../config.js';

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    // Clear storage before each test
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });
  });

  test('should display login page', async ({ page }) => {
    await page.goto('/login');
    
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should login successfully with valid credentials', async ({ page }) => {
    await login(page, config.testUser.email, config.testUser.password);
    
    // Verify we're on dashboard
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Verify user is logged in (check for user-specific content)
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeTruthy();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.goto('/login');
    
    await page.fill('input[type="email"]', 'invalid@example.com');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]');
    
    // Wait for error message
    await expect(page.locator('text=/invalid|error|failed/i')).toBeVisible({ timeout: 5000 });
  });

  test('should redirect to login when accessing protected route without auth', async ({ page }) => {
    await page.goto('/dashboard');
    
    // Should redirect to login or home
    await expect(page).toHaveURL(/\/(login|home)/);
  });

  test('should logout successfully', async ({ page }) => {
    // Login first
    await login(page, config.testUser.email, config.testUser.password);
    
    // Logout
    await logout(page);
    
    // Verify we're logged out
    const token = await page.evaluate(() => localStorage.getItem('accessToken'));
    expect(token).toBeNull();
    
    // Should be on home or login page
    await expect(page).toHaveURL(/\/(home|login)/);
  });

  test('should display signup page', async ({ page }) => {
    await page.goto('/signup');
    
    // Check for signup form elements
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });

  test('should navigate between login and signup', async ({ page }) => {
    await page.goto('/login');
    
    // Look for link to signup
    const signupLink = page.locator('a[href*="signup"]').or(page.locator('text=/sign up|get started/i'));
    if (await signupLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await signupLink.click();
      await expect(page).toHaveURL(/\/signup/);
    }
  });
});

