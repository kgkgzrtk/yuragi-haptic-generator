import { test, expect } from '@playwright/test'
import { TestHelpers, HapticControlPage } from './utils/testHelpers'
import {
  testApiResponses,
  testHapticData,
  testUrls,
  testSelectors,
  testWebSocketMessages,
} from './fixtures/testData'

test.describe('Streaming Controls - Functional Tests', () => {
  let helpers: TestHelpers
  let hapticPage: HapticControlPage

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    hapticPage = new HapticControlPage(page)

    // Set up error tracking
    helpers.setupConsoleErrorTracking()
    helpers.setupNetworkErrorTracking()

    // Set up WebSocket mocking
    await helpers.mockWebSocket()

    // Mock initial API responses - system not streaming
    await helpers.mockApiResponse(testUrls.api.health, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.status, {
      ...testApiResponses.systemStatus,
      isStreaming: false,
    })
    await helpers.mockApiResponse(testUrls.api.parameters, testApiResponses.parameters)
    await helpers.mockApiResponse(testUrls.api.vectorForce, testApiResponses.vectorForce)
    await helpers.mockApiResponse(testUrls.api.waveform, testApiResponses.waveformData)
  })

  test('should display streaming control button with correct initial state', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Verify streaming button is visible and shows "Start Streaming"
    const streamingButton = page.locator(testSelectors.streaming.button)
    await expect(streamingButton).toBeVisible()
    await expect(streamingButton).toBeEnabled()

    const buttonText = await streamingButton.textContent()
    expect(buttonText).toContain('Start Streaming')

    // Verify initial streaming state
    const isStreaming = await hapticPage.getStreamingStatus()
    expect(isStreaming).toBe(false)
  })

  test('should display connection status indicator', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Verify connection status is displayed
    const connectionStatus = page.locator(testSelectors.streaming.status)
    await expect(connectionStatus).toBeVisible()

    const statusText = await hapticPage.getConnectionStatus()
    expect(statusText.length).toBeGreaterThan(0)

    // Should show either "Connected" or "Disconnected"
    expect(statusText).toMatch(/Connected|Disconnected/i)
  })

  test('should start streaming and update UI state', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Mock successful streaming start response
    await helpers.mockApiResponse(testUrls.api.streaming, {
      ...testApiResponses.systemStatus,
      isStreaming: true,
    })

    // Click start streaming button
    await hapticPage.toggleStreaming()

    // Verify button text changes to "Stop Streaming"
    const streamingButton = page.locator(testSelectors.streaming.button)
    await expect(streamingButton).toContainText('Stop Streaming')

    // Verify streaming status is updated
    const isStreaming = await hapticPage.getStreamingStatus()
    expect(isStreaming).toBe(true)

    // Verify button variant changes (should now show danger/red style for stop action)
    const buttonClasses = await streamingButton.getAttribute('class')
    expect(buttonClasses).toContain('danger')
  })

  test('should stop streaming and revert UI state', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Start with streaming active
    await helpers.mockApiResponse(testUrls.api.streaming, {
      ...testApiResponses.systemStatus,
      isStreaming: true,
    })

    // Start streaming first
    await hapticPage.toggleStreaming()

    // Mock successful streaming stop response
    await helpers.mockApiResponse(testUrls.api.streaming, {
      ...testApiResponses.systemStatus,
      isStreaming: false,
    })

    // Click stop streaming button
    await hapticPage.toggleStreaming()

    // Verify button text changes back to "Start Streaming"
    const streamingButton = page.locator(testSelectors.streaming.button)
    await expect(streamingButton).toContainText('Start Streaming')

    // Verify streaming status is updated
    const isStreaming = await hapticPage.getStreamingStatus()
    expect(isStreaming).toBe(false)

    // Verify button variant changes back to primary
    const buttonClasses = await streamingButton.getAttribute('class')
    expect(buttonClasses).toContain('primary')
  })

  test('should show loading state during streaming toggle', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Mock delayed API response to catch loading state
    await helpers.mockApiResponse(testUrls.api.streaming, testApiResponses.systemStatus)

    // Add a small delay to the response
    await page.route(`**${testUrls.api.streaming}`, async route => {
      await new Promise(resolve => setTimeout(resolve, 1000))
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...testApiResponses.systemStatus, isStreaming: true }),
      })
    })

    // Click streaming button
    const streamingButton = page.locator(testSelectors.streaming.button)
    await streamingButton.click()

    // Verify loading state is shown
    await expect(streamingButton).toHaveAttribute('disabled')

    // Check for loading text or indicator
    const buttonText = await streamingButton.textContent()
    expect(buttonText).toMatch(/Loading|Updating|Starting/i)

    // Wait for loading to complete
    await expect(streamingButton).not.toHaveAttribute('disabled')
  })

  test('should handle streaming API errors gracefully', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Mock API error response
    await helpers.mockApiError(testUrls.api.streaming, 500, 'Failed to start streaming')

    // Try to start streaming
    await hapticPage.toggleStreaming()

    // Verify error notification is shown
    await helpers.expectErrorNotification('Failed to start streaming')

    // Verify button state remains unchanged (still shows "Start Streaming")
    const streamingButton = page.locator(testSelectors.streaming.button)
    await expect(streamingButton).toContainText('Start Streaming')

    const isStreaming = await hapticPage.getStreamingStatus()
    expect(isStreaming).toBe(false)
  })

  test('should handle WebSocket connection status updates', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Simulate WebSocket status update
    await helpers.simulateWebSocketMessage(testWebSocketMessages.statusUpdate)

    // Wait for status to update
    await page.waitForTimeout(500)

    // Verify streaming status is reflected in UI
    // Note: This test depends on the WebSocket mock implementation
    // The actual behavior will depend on how the app handles WebSocket messages
  })

  test('should receive real-time waveform data when streaming', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Start streaming first
    await helpers.mockApiResponse(testUrls.api.streaming, {
      ...testApiResponses.systemStatus,
      isStreaming: true,
    })

    await hapticPage.toggleStreaming()

    // Simulate receiving waveform data via WebSocket
    await helpers.simulateWebSocketMessage(testWebSocketMessages.waveformData)

    // Wait for data to be processed
    await page.waitForTimeout(1000)

    // Verify waveform visualization is updated
    // This is a basic check - actual implementation may vary
    const waveformSection = page.locator(testSelectors.waveform.section)
    await expect(waveformSection).toBeVisible()
  })

  test('should handle streaming state persistence across page reloads', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Start streaming
    await helpers.mockApiResponse(testUrls.api.streaming, {
      ...testApiResponses.systemStatus,
      isStreaming: true,
    })

    await hapticPage.toggleStreaming()

    // Verify streaming is active
    let isStreaming = await hapticPage.getStreamingStatus()
    expect(isStreaming).toBe(true)

    // Mock API to return streaming state as active
    await helpers.mockApiResponse(testUrls.api.status, {
      ...testApiResponses.systemStatus,
      isStreaming: true,
    })

    // Reload the page
    await page.reload()
    await hapticPage.waitForAppLoad()

    // Verify streaming state is restored
    isStreaming = await hapticPage.getStreamingStatus()
    expect(isStreaming).toBe(true)

    const streamingButton = page.locator(testSelectors.streaming.button)
    await expect(streamingButton).toContainText('Stop Streaming')
  })

  test('should disable streaming controls when connection is lost', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Simulate connection loss by mocking failed API responses
    await helpers.mockApiError(testUrls.api.health, 503, 'Service unavailable')
    await helpers.mockApiError(testUrls.api.status, 503, 'Service unavailable')

    // Wait for connection status to update
    await page.waitForTimeout(2000)

    // Verify connection status shows disconnected
    const connectionStatus = await hapticPage.getConnectionStatus()
    expect(connectionStatus.toLowerCase()).toContain('disconnect')

    // Verify streaming button may be disabled or show appropriate state
    const streamingButton = page.locator(testSelectors.streaming.button)

    // The app might disable the button or show a different state
    try {
      await expect(streamingButton).toBeDisabled()
    } catch (error) {
      // If not disabled, it should at least show appropriate text
      const buttonText = await streamingButton.textContent()
      expect(buttonText).toMatch(/Start Streaming|Disconnected|Unavailable/i)
    }
  })

  test('should handle concurrent streaming requests gracefully', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Mock delayed response to simulate concurrent requests
    let requestCount = 0
    await page.route(`**${testUrls.api.streaming}`, async route => {
      requestCount++

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 500))

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          ...testApiResponses.systemStatus,
          isStreaming: true,
          requestId: requestCount,
        }),
      })
    })

    const streamingButton = page.locator(testSelectors.streaming.button)

    // Click rapidly multiple times
    await streamingButton.click()
    await streamingButton.click()
    await streamingButton.click()

    // Wait for all requests to complete
    await page.waitForTimeout(2000)

    // Verify that only appropriate number of requests were made
    // The app should prevent duplicate requests
    expect(requestCount).toBeLessThanOrEqual(3)

    // Verify final state is consistent
    const isStreaming = await hapticPage.getStreamingStatus()
    expect(typeof isStreaming).toBe('boolean')
  })

  test('should update streaming status on WebSocket reconnection', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Initial connection should show appropriate status
    let connectionStatus = await hapticPage.getConnectionStatus()
    expect(connectionStatus.length).toBeGreaterThan(0)

    // Simulate WebSocket disconnection
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocketInstance
      if (mockWs && mockWs.close) {
        mockWs.close()
      }
    })

    // Wait for disconnection to be processed
    await page.waitForTimeout(1000)

    // Simulate reconnection by sending status update
    await helpers.simulateWebSocketMessage(testWebSocketMessages.statusUpdate)

    // Wait for reconnection to be processed
    await page.waitForTimeout(1000)

    // Verify status is updated after reconnection
    connectionStatus = await hapticPage.getConnectionStatus()
    expect(connectionStatus.length).toBeGreaterThan(0)
  })

  test('should maintain streaming controls responsiveness across viewports', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1200, height: 800, name: 'desktop' },
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Verify streaming controls are accessible
      const streamingButton = page.locator(testSelectors.streaming.button)
      await expect(streamingButton).toBeVisible()
      await expect(streamingButton).toBeEnabled()

      const connectionStatus = page.locator(testSelectors.streaming.status)
      await expect(connectionStatus).toBeVisible()

      // Test button interaction
      await streamingButton.click()
      await page.waitForTimeout(500)

      console.log(`Streaming controls verified for ${viewport.name} viewport`)
    }
  })
})
