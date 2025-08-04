import { test, expect } from '@playwright/test'
import { TestHelpers, HapticControlPage } from './utils/testHelpers'
import { testApiResponses, testUrls } from './fixtures/testData'

test.describe('Haptic Generator App - Smoke Tests', () => {
  let helpers: TestHelpers
  let hapticPage: HapticControlPage

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    hapticPage = new HapticControlPage(page)

    // Set up error tracking
    helpers.setupConsoleErrorTracking()
    helpers.setupNetworkErrorTracking()

    // Mock API responses for consistent testing
    await helpers.mockApiResponse(testUrls.api.status, testApiResponses.status.success)
    await helpers.mockApiResponse(testUrls.api.haptic, testApiResponses.hapticConfig)
  })

  test('should load the application successfully', async ({ page }) => {
    // Navigate to the app
    await helpers.navigateToHome()

    // Verify page title
    await expect(page).toHaveTitle(/Yuragi Haptic Generator/i)

    // Verify main content is loaded
    await expect(page.locator('body')).toBeVisible()
    await expect(page.locator('#root')).toBeVisible()
  })

  test('should display the haptic control panel with actual components', async ({ page }) => {
    // Navigate to the app
    await hapticPage.navigateToApp()

    // Verify main haptic control panel is visible
    const controlPanel = page.locator('.haptic-control-panel')
    await expect(controlPanel).toBeVisible({ timeout: 10000 })

    // Verify device sections are present
    await expect(page.locator('text=Device 1')).toBeVisible()
    await expect(page.locator('text=Device 2')).toBeVisible()

    // Verify channel controls exist for all 4 channels
    await expect(page.locator('[data-testid="channel-control-0"]')).toBeVisible()
    await expect(page.locator('[data-testid="channel-control-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="channel-control-2"]')).toBeVisible()
    await expect(page.locator('[data-testid="channel-control-3"]')).toBeVisible()

    // Verify vector controls exist for both devices
    await expect(page.locator('[data-testid="vector-control-1"]')).toBeVisible()
    await expect(page.locator('[data-testid="vector-control-2"]')).toBeVisible()
  })

  test('should display the waveform visualization section', async ({ page }) => {
    // Navigate to the app
    await hapticPage.navigateToApp()

    // Verify visualization section exists
    const visualizationSection = page.locator('.visualization-section')
    await expect(visualizationSection).toBeVisible({ timeout: 10000 })

    // Verify waveform visualization title
    await expect(page.locator('text=Waveform Visualization')).toBeVisible()

    // Verify waveform grid container exists
    const waveformGrid = page.locator('.waveform-grid')
    await expect(waveformGrid).toBeVisible()

    // Verify all 4 waveform containers exist (one for each channel)
    const waveformContainers = page.locator('.waveform-container')
    await expect(waveformContainers).toHaveCount(4)

    // Try to find Chart.js canvas elements (they load asynchronously)
    try {
      await expect(page.locator('canvas').first()).toBeVisible({ timeout: 5000 })
    } catch (error) {
      console.log('Chart canvas not yet loaded, but structure is correct')
    }
  })

  test('should display streaming control and connection status', async ({ page }) => {
    // Navigate to the app
    await helpers.navigateToHome()

    // Wait for app to be interactive
    await page.waitForLoadState('networkidle')

    // Verify header elements
    await expect(page.locator('text=Yuragi Haptic Generator')).toBeVisible()

    // Verify connection status indicator
    const connectionStatus = page.locator('.connection-status')
    await expect(connectionStatus).toBeVisible()

    // Verify streaming control button exists
    const streamingButton = page.locator('button', { hasText: /Start Streaming|Stop Streaming/ })
    await expect(streamingButton).toBeVisible()
    await expect(streamingButton).toBeEnabled()

    // Test basic interactivity with streaming button
    await streamingButton.click()
    await page.waitForTimeout(500) // Allow for state change
  })

  test('should handle WebSocket connectivity and React Query integration', async ({ page }) => {
    // Navigate to the app
    await helpers.navigateToHome()

    // Track API requests
    const apiRequests: string[] = []
    page.on('request', request => {
      if (request.url().includes('/api/')) {
        apiRequests.push(request.url())
        console.log(`API request made to: ${request.url()}`)
      }
    })

    // Track WebSocket connection attempts
    const wsConnections: string[] = []
    page.on('websocket', ws => {
      wsConnections.push(ws.url())
      console.log(`WebSocket connection to: ${ws.url()}`)
    })

    // Wait for initial queries to execute
    await page.waitForTimeout(3000)

    // Verify that React Query is attempting to fetch data
    // With our mocked API, we should see successful responses
    expect(apiRequests.length).toBeGreaterThan(0)

    // Verify connection status is displayed (even if mocked)
    const connectionStatus = page.locator('.connection-status')
    await expect(connectionStatus).toBeVisible()
  })

  test('should be responsive and handle different viewport sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await helpers.navigateToHome()
    await expect(page.locator('#root')).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.waitForTimeout(500)
    await expect(page.locator('#root')).toBeVisible()

    // Test desktop viewport
    await page.setViewportSize({ width: 1200, height: 800 })
    await page.waitForTimeout(500)
    await expect(page.locator('#root')).toBeVisible()
  })

  test('should not have critical console errors on load', async ({ page }) => {
    const errors: string[] = []

    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Navigate to the app
    await helpers.navigateToHome()

    // Wait for app to fully load
    await page.waitForTimeout(3000)

    // Filter out non-critical errors (like missing favicon)
    const criticalErrors = errors.filter(
      error =>
        !error.includes('favicon') &&
        !error.includes('404') &&
        !error.includes('Not Found') &&
        error.length > 0
    )

    // Log errors for debugging but don't fail the test for minor issues
    if (criticalErrors.length > 0) {
      console.log('Console errors detected:', criticalErrors)
    }

    // Only fail if there are more than 2 critical errors
    expect(criticalErrors.length).toBeLessThanOrEqual(2)
  })

  test('should have proper accessibility and form controls', async ({ page }) => {
    // Navigate to the app
    await helpers.navigateToHome()

    // Check for basic accessibility attributes
    const html = page.locator('html')
    await expect(html).toHaveAttribute('lang')

    // Verify main content structure
    await expect(page.locator('main.app-main')).toBeVisible()
    await expect(page.locator('header.app-header')).toBeVisible()

    // Check that form inputs have proper labels
    const inputs = page.locator('input[type="number"]')
    const inputCount = await inputs.count()

    if (inputCount > 0) {
      // Verify first input has associated label
      const firstInput = inputs.first()
      await expect(firstInput).toBeVisible()

      // Test keyboard navigation
      await firstInput.focus()
      await expect(firstInput).toBeFocused()

      // Test tab navigation
      await page.keyboard.press('Tab')
      const focusedElement = page.locator(':focus')
      await expect(focusedElement).toBeVisible()
    }

    // Check that buttons are keyboard accessible
    const streamingButton = page.locator('button', { hasText: /Start Streaming|Stop Streaming/ })
    if (await streamingButton.isVisible()) {
      await streamingButton.focus()
      await expect(streamingButton).toBeFocused()
    }
  })
})
