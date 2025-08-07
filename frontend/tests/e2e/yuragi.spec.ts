import { test, expect } from '@playwright/test'

test.describe('YURAGI Massage Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000')
    // Wait for the app to load
    await page.waitForSelector('.app-header', { timeout: 10000 })
  })

  test('should display YURAGI control panel', async ({ page }) => {
    // Check that YURAGI control is visible
    await expect(page.locator('text=YURAGI Massage Control')).toBeVisible()

    // Check preset selector
    await expect(page.locator('select[aria-label="Massage preset"]')).toBeVisible()

    // Check duration input
    await expect(page.locator('input[aria-label="Session duration in seconds"]')).toBeVisible()

    // Check enable toggle
    await expect(
      page.locator('input[type="checkbox"][aria-label="Enable YURAGI control"]')
    ).toBeVisible()

    // Check start button
    await expect(page.locator('button:has-text("Start YURAGI")')).toBeVisible()
  })

  test('should start YURAGI with gentle preset', async ({ page }) => {
    // Select gentle preset
    await page.selectOption('select[aria-label="Massage preset"]', 'gentle')

    // Set duration to 30 seconds
    await page.fill('input[aria-label="Session duration in seconds"]', '30')

    // Enable YURAGI
    await page.check('input[type="checkbox"][aria-label="Enable YURAGI control"]')

    // Click start button
    await page.click('button:has-text("Start YURAGI")')

    // Wait for API call
    await page.waitForResponse(
      resp => resp.url().includes('/api/yuragi/preset') && resp.status() === 200
    )

    // Check button changed to Stop
    await expect(page.locator('button:has-text("Stop YURAGI")')).toBeVisible()

    // Check progress bar appears
    await expect(page.locator('.progress-bar')).toBeVisible()

    // Stop YURAGI
    await page.click('button:has-text("Stop YURAGI")')

    // Check button changed back to Start
    await expect(page.locator('button:has-text("Start YURAGI")')).toBeVisible()
  })

  test('should validate duration input', async ({ page }) => {
    // Enable YURAGI first
    await page.check('input[type="checkbox"][aria-label="Enable YURAGI control"]')

    // Test below minimum
    await page.fill('input[aria-label="Session duration in seconds"]', '10')
    await page.click('button:has-text("Start YURAGI")')
    await expect(page.locator('text=Duration must be between 30 and 300 seconds')).toBeVisible()

    // Test above maximum
    await page.fill('input[aria-label="Session duration in seconds"]', '500')
    await page.click('button:has-text("Start YURAGI")')
    await expect(page.locator('text=Duration must be between 30 and 300 seconds')).toBeVisible()

    // Test valid value
    await page.fill('input[aria-label="Session duration in seconds"]', '60')
    await page.click('button:has-text("Start YURAGI")')
    await expect(page.locator('button:has-text("Stop YURAGI")')).toBeVisible()
  })
})
