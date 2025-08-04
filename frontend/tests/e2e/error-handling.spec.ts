import { test, expect } from '@playwright/test'
import { TestHelpers, HapticControlPage } from './utils/testHelpers'
import {
  testApiResponses,
  testHapticData,
  testUrls,
  testSelectors,
  testErrorScenarios,
  testWebSocketMessages,
} from './fixtures/testData'

test.describe('Error Handling and Recovery - Functional Tests', () => {
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

    // Mock initial successful API responses
    await helpers.mockApiResponse(testUrls.api.health, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.status, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.parameters, testApiResponses.parameters)
    await helpers.mockApiResponse(testUrls.api.streaming, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.vectorForce, testApiResponses.vectorForce)
  })

  test('should handle API server unavailable (503 errors)', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Mock server error for parameter updates
    await helpers.mockApiError(testUrls.api.parameters, 503, 'Service temporarily unavailable')

    // Try to update a channel parameter
    await hapticPage.setChannelFrequency(0, 75)

    // Verify error notification is shown
    await helpers.expectErrorNotification('Service temporarily unavailable')

    // Verify the input still shows the attempted value (optimistic updates)
    const values = await hapticPage.getChannelValues(0)
    expect(values.frequency).toBe(75)

    // Mock recovery - server comes back online
    await helpers.mockApiResponse(testUrls.api.parameters, testApiResponses.parameters)

    // Try the update again
    await hapticPage.setChannelFrequency(0, 80)

    // Verify successful update (no error notification)
    await page.waitForTimeout(1000)
    const errorElements = page.locator('[class*="error"], [role="alert"][class*="error"]')
    const visibleErrors = await errorElements.count()
    expect(visibleErrors).toBe(0)
  })

  test('should handle network timeouts gracefully', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Mock timeout for streaming API
    await helpers.mockApiTimeout(testUrls.api.streaming, 10000)

    // Try to start streaming
    await hapticPage.toggleStreaming()

    // Verify loading state is shown initially
    const streamingButton = page.locator(testSelectors.streaming.button)
    await expect(streamingButton).toHaveAttribute('disabled')

    // Wait for timeout to occur (should be less than test timeout)
    await page.waitForTimeout(5000)

    // Verify error notification for timeout
    await helpers.expectErrorNotification('timeout')

    // Verify button is enabled again after timeout
    await expect(streamingButton).not.toHaveAttribute('disabled')
  })

  test('should handle validation errors from API (400 responses)', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Mock validation error response
    await helpers.mockApiError(
      testUrls.api.parameters,
      400,
      'Invalid frequency value: must be between 0-120 Hz'
    )

    // Try to set an invalid frequency (this should trigger client-side validation first)
    await hapticPage.setChannelFrequency(0, 150)

    // Verify client-side validation error
    await hapticPage.expectChannelError(0)

    // If client-side validation is bypassed, API error should be shown
    await helpers.expectErrorNotification('Invalid frequency value')
  })

  test('should handle WebSocket connection failures', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Simulate WebSocket connection failure
    await page.evaluate(() => {
      // Mock WebSocket that fails to connect
      class FailingWebSocket {
        public readyState = WebSocket.CONNECTING
        public onopen: ((event: Event) => void) | null = null
        public onmessage: ((event: MessageEvent) => void) | null = null
        public onclose: ((event: CloseEvent) => void) | null = null
        public onerror: ((event: Event) => void) | null = null

        constructor(public url: string) {
          // Simulate connection failure after a short delay
          setTimeout(() => {
            this.readyState = WebSocket.CLOSED
            if (this.onerror) {
              this.onerror(new Event('error'))
            }
            if (this.onclose) {
              this.onclose(new CloseEvent('close', { code: 1006, reason: 'Connection failed' }))
            }
          }, 100)
        }

        send(data: string): void {
          throw new Error('WebSocket is not connected')
        }

        close(): void {
          this.readyState = WebSocket.CLOSED
        }
      }

      ;(window as any).WebSocket = FailingWebSocket
    })

    // Reload to trigger WebSocket connection attempt with failing mock
    await page.reload()
    await page.waitForTimeout(2000)

    // Verify connection status shows disconnected
    const connectionStatus = await hapticPage.getConnectionStatus()
    expect(connectionStatus.toLowerCase()).toContain('disconnect')

    // Verify that the app still functions for basic operations
    const controlPanel = page.locator(testSelectors.panels.controlPanel)
    await expect(controlPanel).toBeVisible()
  })

  test('should handle concurrent API failures and retries', async ({ page }) => {
    await hapticPage.navigateToApp()

    let requestCount = 0

    // Mock API that fails first few requests then succeeds
    await page.route(`**${testUrls.api.parameters}`, async route => {
      requestCount++

      if (requestCount <= 2) {
        // Fail first 2 requests
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        })
      } else {
        // Succeed on subsequent requests
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(testApiResponses.parameters),
        })
      }
    })

    // Make multiple rapid parameter changes
    await hapticPage.setChannelFrequency(0, 60)
    await hapticPage.setChannelAmplitude(0, 0.7)
    await hapticPage.setChannelPhase(0, 90)

    // Wait for retries to complete
    await page.waitForTimeout(3000)

    // Verify that errors were shown but eventually resolved
    // The app should handle this gracefully without breaking
    const values = await hapticPage.getChannelValues(0)
    expect(values.frequency).toBe(60)
    expect(values.amplitude).toBe(0.7)
    expect(values.phase).toBe(90)
  })

  test('should recover from temporary network disconnection', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Initial successful operation
    await hapticPage.setChannelFrequency(0, 50)
    await page.waitForTimeout(500)

    // Simulate network disconnection
    await page.route('**/*', route => {
      route.abort('internetdisconnected')
    })

    // Try operations during disconnection
    await hapticPage.setChannelFrequency(0, 75)

    // Verify error handling during disconnection
    await helpers.expectErrorNotification('network')

    // Restore network connection
    await page.unroute('**/*')
    await helpers.mockApiResponse(testUrls.api.parameters, testApiResponses.parameters)

    // Try operation after reconnection
    await hapticPage.setChannelFrequency(0, 80)

    // Verify successful operation after recovery
    await page.waitForTimeout(1000)
    const values = await hapticPage.getChannelValues(0)
    expect(values.frequency).toBe(80)
  })

  test('should handle malformed API responses', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Mock malformed JSON response
    await page.route(`**${testUrls.api.parameters}`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json response',
      })
    })

    // Try to update parameter
    await hapticPage.setChannelFrequency(0, 65)

    // Verify error handling for malformed response
    await helpers.expectErrorNotification()

    // Verify app doesn't crash
    const controlPanel = page.locator(testSelectors.panels.controlPanel)
    await expect(controlPanel).toBeVisible()
  })

  test('should handle WebSocket message parsing errors', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Send malformed WebSocket message
    await page.evaluate(() => {
      const mockWs = (window as any).mockWebSocketInstance
      if (mockWs && mockWs.onmessage) {
        mockWs.onmessage(new MessageEvent('message', { data: 'invalid json' }))
      }
    })

    // Wait for error handling
    await page.waitForTimeout(1000)

    // Verify app continues to function
    const controlPanel = page.locator(testSelectors.panels.controlPanel)
    await expect(controlPanel).toBeVisible()

    // Verify that subsequent valid messages still work
    await helpers.simulateWebSocketMessage(testWebSocketMessages.parametersUpdate)
    await page.waitForTimeout(500)
  })

  test('should handle rapid consecutive errors without overwhelming UI', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Mock API to always return errors
    await helpers.mockApiError(testUrls.api.parameters, 500, 'Server error')

    // Make rapid consecutive parameter changes
    for (let i = 0; i < 10; i++) {
      await hapticPage.setChannelFrequency(0, 50 + i)
      await page.waitForTimeout(100)
    }

    // Wait for all errors to be processed
    await page.waitForTimeout(2000)

    // Verify that error notifications don't stack up excessively
    const errorNotifications = page.locator('[class*="error"], [role="alert"][class*="error"]')
    const errorCount = await errorNotifications.count()

    // Should have some error indication but not overwhelm the UI
    expect(errorCount).toBeGreaterThan(0)
    expect(errorCount).toBeLessThan(5) // Reasonable limit for visible errors
  })

  test('should show appropriate error messages for different failure types', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Test different error scenarios
    const errorScenarios = [
      {
        url: testUrls.api.parameters,
        status: 401,
        message: 'Unauthorized access',
        expectedText: 'Unauthorized',
      },
      {
        url: testUrls.api.streaming,
        status: 403,
        message: 'Forbidden operation',
        expectedText: 'Forbidden',
      },
      {
        url: testUrls.api.vectorForce,
        status: 404,
        message: 'Endpoint not found',
        expectedText: 'not found',
      },
      {
        url: testUrls.api.parameters,
        status: 429,
        message: 'Too many requests',
        expectedText: 'Too many',
      },
    ]

    for (const scenario of errorScenarios) {
      // Mock specific error
      await helpers.mockApiError(scenario.url, scenario.status, scenario.message)

      // Trigger the error
      if (scenario.url.includes('parameters')) {
        await hapticPage.setChannelFrequency(0, Math.random() * 100)
      } else if (scenario.url.includes('streaming')) {
        await hapticPage.toggleStreaming()
      } else if (scenario.url.includes('vector')) {
        await hapticPage.applyVectorForce(1)
      }

      // Verify appropriate error message
      await helpers.expectErrorNotification(scenario.expectedText)

      // Wait before next test
      await page.waitForTimeout(1000)
    }
  })

  test('should maintain data consistency during error recovery', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Set initial values
    await hapticPage.setChannelFrequency(0, 60)
    await hapticPage.setChannelAmplitude(0, 0.5)
    await page.waitForTimeout(500)

    // Verify initial values are set
    let values = await hapticPage.getChannelValues(0)
    expect(values.frequency).toBe(60)
    expect(values.amplitude).toBe(0.5)

    // Mock temporary API failure
    await helpers.mockApiError(testUrls.api.parameters, 500, 'Temporary error')

    // Try to update during failure
    await hapticPage.setChannelFrequency(0, 80)

    // Verify error is shown but UI shows optimistic update
    await helpers.expectErrorNotification('Temporary error')
    values = await hapticPage.getChannelValues(0)
    expect(values.frequency).toBe(80) // Should show optimistic update

    // Restore API
    await helpers.mockApiResponse(testUrls.api.parameters, {
      channels: [
        { channelId: 0, frequency: 60, amplitude: 0.5, phase: 0, polarity: true }, // Server still has old value
        ...testApiResponses.parameters.channels.slice(1),
      ],
    })

    // Trigger data refresh/sync
    await page.reload()
    await hapticPage.waitForAppLoad()

    // Verify data consistency is restored from server
    values = await hapticPage.getChannelValues(0)
    expect(values.frequency).toBe(60) // Should revert to server value
    expect(values.amplitude).toBe(0.5)
  })

  test('should handle error recovery during streaming operations', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Start streaming successfully
    await helpers.mockApiResponse(testUrls.api.streaming, {
      ...testApiResponses.systemStatus,
      isStreaming: true,
    })

    await hapticPage.toggleStreaming()

    // Verify streaming started
    let isStreaming = await hapticPage.getStreamingStatus()
    expect(isStreaming).toBe(true)

    // Mock streaming error
    await helpers.mockApiError(testUrls.api.streaming, 503, 'Streaming service unavailable')

    // Try to stop streaming
    await hapticPage.toggleStreaming()

    // Verify error is handled
    await helpers.expectErrorNotification('Streaming service unavailable')

    // Verify streaming state remains consistent
    isStreaming = await hapticPage.getStreamingStatus()
    expect(isStreaming).toBe(true) // Should remain true since stop failed

    // Restore streaming API
    await helpers.mockApiResponse(testUrls.api.streaming, {
      ...testApiResponses.systemStatus,
      isStreaming: false,
    })

    // Try to stop streaming again
    await hapticPage.toggleStreaming()

    // Verify successful stop after recovery
    isStreaming = await hapticPage.getStreamingStatus()
    expect(isStreaming).toBe(false)
  })
})
