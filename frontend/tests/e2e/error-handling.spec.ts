import { test, expect } from '@playwright/test'
import { TestHelpers, HapticControlPage } from './utils/testHelpers'
import {
  testApiResponses,
  testHapticData,
  testUrls,
  testSelectors,
  testErrorScenarios,
  testWebSocketMessages,
  testParameterSets,
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

    // Use extracted helper for server recovery workflow
    await hapticPage.testServerRecoveryWorkflow(
      0, // channelId
      60, // initial value (from default)
      75, // new value to test
      helpers,
      testUrls.api.parameters,
      testApiResponses.parameters
    )
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

    // Use extracted helper for WebSocket failure simulation
    await helpers.mockWebSocketFailure()

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

    // Use extracted helper for API retry simulation
    const retryScenario = testErrorScenarios.retryScenarios.failTwiceThenSucceed
    await helpers.mockApiWithRetries(
      testUrls.api.parameters,
      retryScenario.failureCount,
      testApiResponses.parameters,
      retryScenario.errorStatus,
      retryScenario.errorMessage
    )

    // Use extracted helper for rapid parameter changes
    await hapticPage.setMultipleChannelParametersRapidly(0, {
      frequency: 60,
      amplitude: 0.7,
      phase: 90,
    })

    // Wait for retries to complete
    await page.waitForTimeout(3000)

    // Verify data consistency after retry completion
    await hapticPage.verifyDataConsistency(0, {
      frequency: 60,
      amplitude: 0.7,
      phase: 90,
    })
  })

  test('should recover from temporary network disconnection', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Initial successful operation
    await hapticPage.setChannelFrequency(0, 50)
    await page.waitForTimeout(500)

    // Use extracted helper for network disconnection simulation
    await helpers.simulateNetworkDisconnection()

    // Try operations during disconnection
    await hapticPage.setChannelFrequency(0, 75)

    // Verify error handling during disconnection
    await helpers.expectErrorNotification('network')

    // Use extracted helper to restore network connection
    await helpers.restoreNetworkConnection()
    await helpers.mockApiResponse(testUrls.api.parameters, testApiResponses.parameters)

    // Try operation after reconnection
    await hapticPage.setChannelFrequency(0, 80)

    // Verify successful operation after recovery
    await page.waitForTimeout(1000)
    await hapticPage.verifyDataConsistency(0, { frequency: 80 })
  })

  test('should handle malformed API responses', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Use extracted helper for malformed API response
    await helpers.mockMalformedApiResponse(testUrls.api.parameters)

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

    // Use extracted helper for malformed WebSocket message
    await helpers.sendMalformedWebSocketMessage()

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

    // Use extracted helper for rapid parameter changes
    await hapticPage.triggerRapidParameterChanges(0, 10, 50, 100)

    // Wait for all errors to be processed
    await page.waitForTimeout(2000)

    // Use extracted helper to verify limited error notifications
    await helpers.expectLimitedErrorNotifications(5)
  })

  test('should show appropriate error messages for different failure types', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Use extracted helper with predefined error scenarios
    const scenarios = testErrorScenarios.httpErrorScenarios.map(scenario => {
      const fullUrl = testUrls.api[scenario.url.split('/')[2] as keyof typeof testUrls.api]
      return {
        ...scenario,
        url: fullUrl,
        triggerAction: async () => {
          if (scenario.url.indexOf('parameters') !== -1) {
            await hapticPage.setChannelFrequency(0, Math.random() * 100)
          } else if (scenario.url.indexOf('streaming') !== -1) {
            await hapticPage.toggleStreaming()
          } else if (scenario.url.indexOf('vector') !== -1) {
            await hapticPage.applyVectorForce(1)
          }
        },
      }
    })

    await helpers.testErrorScenarios(scenarios)
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

    // Use extracted helper for streaming error recovery workflow
    await hapticPage.testStreamingErrorRecovery(
      helpers,
      testUrls.api.streaming,
      testApiResponses.systemStatus
    )
  })
})
