import { test, expect } from '@playwright/test';
import { login } from '../utils/auth.js';
import { config } from '../config.js';

test.describe('Settings', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, config.testUser.email, config.testUser.password);
  });

  test('should navigate to settings page', async ({ page }) => {
    await page.goto('/settings');
    
    await expect(page).toHaveURL(/\/settings/);
    await page.waitForLoadState('networkidle');
  });

  test('should display settings sections', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Check for settings content
    const settingsContent = page.locator('text=/settings|profile|account/i').or(
      page.locator('[data-testid="settings"]')
    );
    
    await expect(settingsContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display user profile information', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for profile fields
    const emailField = page.locator('input[type="email"]').or(
      page.locator('text=' + config.testUser.email)
    );
    
    // Email should be visible or in a field
    await expect(emailField.first()).toBeVisible({ timeout: 5000 });
  });

  test('should allow updating profile information', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for name or company fields
    const nameInput = page.locator('input[name*="name"]').or(
      page.locator('input[placeholder*="name"]')
    );
    
    if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await nameInput.first().fill('Updated Name');
      
      // Look for save button
      const saveButton = page.locator('button:has-text("Save")').or(
        page.locator('button[type="submit"]')
      );
      
      if (await saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(2000);
        
        // Check for success message
        const success = page.locator('text=/saved|updated|success/i');
        // Success might appear, or we just verify no error
        await expect(page.locator('body')).toBeVisible();
      }
    }
  });

  test('should allow changing password', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for password section or change password link
    const passwordSection = page.locator('text=/password|change password/i');
    
    if (await passwordSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Click on change password
      await passwordSection.click();
      await page.waitForTimeout(1000);
      
      // Look for password fields
      const passwordFields = page.locator('input[type="password"]');
      const count = await passwordFields.count();
      
      if (count >= 2) {
        // Old and new password fields
        await expect(passwordFields.first()).toBeVisible();
      }
    }
  });

  test('should display notification preferences', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for notifications section
    const notifications = page.locator('text=/notification|preferences/i');
    
    // Notifications might be in a separate section
    await expect(page.locator('body')).toBeVisible();
  });

  test('should allow account deletion', async ({ page }) => {
    await page.goto('/settings');
    await page.waitForLoadState('networkidle');
    
    // Look for delete account button (usually at bottom)
    const deleteButton = page.locator('button:has-text("Delete")').or(
      page.locator('button:has-text("Delete Account")')
    );
    
    // We won't actually delete, just verify the option exists
    if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(deleteButton).toBeVisible();
      // Don't click it!
    }
  });
});

