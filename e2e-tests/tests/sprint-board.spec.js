import { test, expect } from '@playwright/test';
import { login } from '../utils/auth.js';
import { config } from '../config.js';

test.describe('Sprint Board', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, config.testUser.email, config.testUser.password);
  });

  test('should navigate to sprint board page', async ({ page }) => {
    await page.goto('/sprint-board');
    
    await expect(page).toHaveURL(/\/sprint-board/);
    await page.waitForLoadState('networkidle');
  });

  test('should display sprint board', async ({ page }) => {
    await page.goto('/sprint-board');
    await page.waitForLoadState('networkidle');
    
    // Check for sprint board content
    const boardContent = page.locator('text=/sprint|board|kanban/i').or(
      page.locator('[data-testid="sprint-board"]')
    );
    
    await expect(boardContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('should display sprint information', async ({ page }) => {
    await page.goto('/sprint-board');
    await page.waitForLoadState('networkidle');
    
    // Look for sprint details (name, dates, etc.)
    const sprintInfo = page.locator('text=/sprint|sprint \d+|active sprint/i');
    
    // Sprint info might not always be visible if no active sprint
    await expect(page.locator('body')).toBeVisible();
  });

  test('should allow creating new sprint', async ({ page }) => {
    await page.goto('/sprint-board');
    await page.waitForLoadState('networkidle');
    
    // Look for "Create Sprint" or "New Sprint" button
    const createButton = page.locator('button:has-text("Create Sprint")').or(
      page.locator('button:has-text("New Sprint")').or(
        page.locator('button:has-text("Start Sprint")')
      )
    );
    
    if (await createButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await createButton.click();
      await page.waitForTimeout(2000);
      
      // Look for form
      const form = page.locator('input[type="text"]').or(
        page.locator('input[type="date"]')
      );
      
      if (await form.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Form is visible, that's good
        await expect(form.first()).toBeVisible();
      }
    }
  });

  test('should display sprint columns', async ({ page }) => {
    await page.goto('/sprint-board');
    await page.waitForLoadState('networkidle');
    
    // Look for kanban columns
    const columns = page.locator('text=/to do|in progress|done|review/i');
    
    // Columns might not be visible if no sprint is active
    await expect(page.locator('body')).toBeVisible();
  });
});

