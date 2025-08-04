import { test, expect } from '@playwright/test'

test.describe('Example E2E Tests', () => {
  test('basic page load example', async ({ page }) => {
    // Navigate to the application
    await page.goto('/')

    // Wait for the page to load
    await page.waitForLoadState('networkidle')

    // Basic assertions
    await expect(page).toHaveTitle(/Yuragi|Haptic|Generator/i)
    await expect(page.locator('#root')).toBeVisible()
  })

  test('interaction example', async ({ page }) => {
    await page.goto('/')

    // Example of finding and interacting with elements
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()

    if (buttonCount > 0) {
      const firstButton = buttons.first()
      await expect(firstButton).toBeVisible()
      await firstButton.click()
    }

    // Example of waiting for elements
    await page.waitForTimeout(1000)
  })

  test('responsive design example', async ({ page }) => {
    // Mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await expect(page.locator('#root')).toBeVisible()

    // Desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 })
    await expect(page.locator('#root')).toBeVisible()
  })

  test('API mocking example', async ({ page }) => {
    // Mock an API response
    await page.route('**/api/status', route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'ok', message: 'Test response' }),
      })
    })

    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // Verify the page loaded with mocked API
    await expect(page.locator('#root')).toBeVisible()
  })

  test('screenshot on failure example', async ({ page }) => {
    await page.goto('/')

    // This test includes automatic screenshot on failure
    // due to our playwright.config.ts settings
    await expect(page.locator('#root')).toBeVisible()

    // Uncomment the line below to see screenshot functionality
    // await expect(page.locator('#non-existent')).toBeVisible();
  })
})
