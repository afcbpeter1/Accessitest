import { expect } from '@playwright/test';

/**
 * Wait for API response
 */
export async function waitForAPIResponse(page, urlPattern, timeout = 10000) {
  return page.waitForResponse(
    response => response.url().includes(urlPattern) && response.status() === 200,
    { timeout }
  );
}

/**
 * Wait for element to be visible and stable
 */
export async function waitForStable(page, selector, timeout = 5000) {
  const element = page.locator(selector);
  await element.waitFor({ state: 'visible', timeout });
  
  // Wait for any loading states to finish
  await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
  
  return element;
}

/**
 * Fill form field safely
 */
export async function fillField(page, selector, value) {
  const field = page.locator(selector);
  await field.waitFor({ state: 'visible', timeout: 5000 });
  await field.clear();
  await field.fill(value);
}

/**
 * Click button safely
 */
export async function clickButton(page, selector, options = {}) {
  const button = page.locator(selector);
  await button.waitFor({ state: 'visible', timeout: 5000 });
  await button.click(options);
}

/**
 * Wait for toast/notification to appear
 */
export async function waitForNotification(page, text, timeout = 5000) {
  const notification = page.locator(`text=${text}`).first();
  await notification.waitFor({ state: 'visible', timeout });
  return notification;
}

/**
 * Check for error message
 */
export async function checkForError(page, errorText) {
  const error = page.locator(`text=${errorText}`).first();
  await expect(error).toBeVisible({ timeout: 5000 });
}

/**
 * Check for success message
 */
export async function checkForSuccess(page, successText) {
  const success = page.locator(`text=${successText}`).first();
  await expect(success).toBeVisible({ timeout: 5000 });
}

/**
 * Wait for scan to complete
 */
export async function waitForScanComplete(page, timeout = 60000) {
  // Wait for scan progress to finish or results to appear
  await Promise.race([
    page.waitForSelector('text=Scan complete', { timeout }).catch(() => {}),
    page.waitForSelector('[data-testid="scan-results"]', { timeout }).catch(() => {}),
    page.waitForSelector('text=Results', { timeout }).catch(() => {}),
  ]);
}

