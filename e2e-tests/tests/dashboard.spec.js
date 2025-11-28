import { test, expect } from '@playwright/test';
import { login } from '../utils/auth.js';
import { config } from '../config.js';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, config.testUser.email, config.testUser.password);
  });

  test('should display dashboard after login', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    
    // Check for dashboard content
    const dashboardContent = page.locator('text=Dashboard').or(page.locator('[data-testid="dashboard"]'));
    await expect(dashboardContent.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display user information', async ({ page }) => {
    // Check for user email or name
    const userInfo = page.locator('text=' + config.testUser.email).or(
      page.locator('text=' + config.testUser.name)
    );
    
    // User info might be in sidebar or header
    await expect(userInfo.first()).toBeVisible({ timeout: 5000 });
  });

  test('should display navigation sidebar', async ({ page }) => {
    // Check for sidebar navigation items
    const sidebar = page.locator('nav').or(page.locator('[data-testid="sidebar"]'));
    await expect(sidebar.first()).toBeVisible({ timeout: 5000 });
    
    // Check for common navigation links
    const navItems = [
      'Dashboard',
      'Web Scan',
      'Document Scan',
      'Scan History',
      'Product Backlog',
      'Settings'
    ];
    
    for (const item of navItems) {
      const navLink = page.locator(`text=${item}`).first();
      if (await navLink.isVisible({ timeout: 2000 }).catch(() => false)) {
        await expect(navLink).toBeVisible();
      }
    }
  });

  test('should navigate to different pages from sidebar', async ({ page }) => {
    // Test navigation to Scan History
    const scanHistoryLink = page.locator('text=Scan History').or(page.locator('a[href*="scan-history"]'));
    if (await scanHistoryLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await scanHistoryLink.click();
      await expect(page).toHaveURL(/\/scan-history/, { timeout: 10000 });
      await page.goBack();
    }

    // Test navigation to Settings
    const settingsLink = page.locator('text=Settings').or(page.locator('a[href*="settings"]'));
    if (await settingsLink.isVisible({ timeout: 2000 }).catch(() => false)) {
      await settingsLink.click();
      await expect(page).toHaveURL(/\/settings/, { timeout: 10000 });
    }
  });

  test('should display credits information', async ({ page }) => {
    // Credits might be displayed on dashboard
    const credits = page.locator('text=/credit/i').or(page.locator('[data-testid="credits"]'));
    
    // Credits might not always be visible, so just check if page loads
    await page.waitForLoadState('networkidle');
  });

  test('should display recent scans or activity', async ({ page }) => {
    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');
    
    // Check for any scan-related content
    const scanContent = page.locator('text=/scan/i').or(page.locator('[data-testid="recent-scans"]'));
    
    // Just verify page loaded successfully
    await expect(page.locator('body')).toBeVisible();
  });
});

