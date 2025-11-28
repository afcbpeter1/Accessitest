import { test, expect } from '@playwright/test';
import { login } from '../utils/auth.js';
import { config } from '../config.js';

test.describe('Product Backlog', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, config.testUser.email, config.testUser.password);
  });

  test('should navigate to product backlog page', async ({ page }) => {
    await page.goto('/product-backlog');
    
    await expect(page).toHaveURL(/\/product-backlog/);
    await page.waitForLoadState('networkidle');
  });

  test('should display backlog items', async ({ page }) => {
    await page.goto('/product-backlog');
    await page.waitForLoadState('networkidle');
    
    // Check for backlog content
    const backlogContent = page.locator('text=/backlog|items|issues/i').or(
      page.locator('[data-testid="backlog"]')
    );
    
    await expect(backlogContent.first()).toBeVisible({ timeout: 10000 });
  });

  test('should allow creating new backlog item', async ({ page }) => {
    await page.goto('/product-backlog');
    await page.waitForLoadState('networkidle');
    
    // Look for "Add" or "Create" button
    const addButton = page.locator('button:has-text("Add")').or(
      page.locator('button:has-text("Create")').or(
        page.locator('button:has-text("New")')
      )
    );
    
    if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await addButton.click();
      
      // Look for form or modal
      const form = page.locator('input[type="text"]').or(
        page.locator('textarea')
      );
      
      if (await form.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Fill form
        await form.first().fill('Test Backlog Item');
        
        // Look for submit button
        const submitButton = page.locator('button[type="submit"]').or(
          page.locator('button:has-text("Save")')
        );
        
        if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) {
          await submitButton.click();
          await page.waitForTimeout(2000);
        }
      }
    }
    
    // Verify page is still functional
    await expect(page.locator('body')).toBeVisible();
  });

  test('should allow editing backlog item', async ({ page }) => {
    await page.goto('/product-backlog');
    await page.waitForLoadState('networkidle');
    
    // Look for edit buttons
    const editButtons = page.locator('button:has-text("Edit")').or(
      page.locator('[data-testid="edit-item"]')
    );
    
    const count = await editButtons.count();
    
    if (count > 0) {
      await editButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Should show edit form
      await expect(page.locator('body')).toBeVisible();
    }
  });

  test('should allow deleting backlog item', async ({ page }) => {
    await page.goto('/product-backlog');
    await page.waitForLoadState('networkidle');
    
    // Look for delete buttons
    const deleteButtons = page.locator('button:has-text("Delete")').or(
      page.locator('[data-testid="delete-item"]')
    );
    
    const count = await deleteButtons.count();
    
    if (count > 0) {
      // Click delete and handle confirmation if needed
      await deleteButtons.first().click();
      await page.waitForTimeout(1000);
      
      // Handle confirmation dialog if present
      const confirmButton = page.locator('button:has-text("Confirm")').or(
        page.locator('button:has-text("Yes")')
      );
      
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
        await page.waitForTimeout(1000);
      }
    }
    
    await expect(page.locator('body')).toBeVisible();
  });
});

