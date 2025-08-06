import { Page, expect } from '@playwright/test'
import { testSelectors, testUrls, testApiResponses } from '../fixtures/testData'

/**
 * Common test utilities and page helpers for Haptic Generator
 */
export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Navigate to the application home page
   */
  async navigateToHome(): Promise<void> {
    await this.page.goto(testUrls.home)
    await this.waitForPageLoad()
  }

  /**
   * Wait for the page to fully load
   */
  async waitForPageLoad(): Promise<void> {
    await this.page.waitForLoadState('networkidle')
    await this.page.waitForSelector('body', { state: 'visible' })
  }

  /**
   * Wait for API response and verify status
   */
  async waitForApiResponse(url: string, timeout = 5000): Promise<void> {
    await this.page.waitForResponse(
      response => response.url().includes(url) && response.status() === 200,
      { timeout }
    )
  }

  /**
   * Mock API responses for testing
   */
  async mockApiResponse(url: string, response: object, status = 200): Promise<void> {
    await this.page.route(`**${url}`, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(response),
      })
    })
  }

  /**
   * Mock WebSocket connection for testing
   */
  async mockWebSocket(): Promise<void> {
    await this.page.addInitScript(() => {
      // Mock WebSocket class
      class MockWebSocket {
        public readyState = WebSocket.CONNECTING
        public onopen: ((event: Event) => void) | null = null
        public onmessage: ((event: MessageEvent) => void) | null = null
        public onclose: ((event: CloseEvent) => void) | null = null
        public onerror: ((event: Event) => void) | null = null

        constructor(public url: string) {
          // Simulate connection after a short delay
          setTimeout(() => {
            this.readyState = WebSocket.OPEN
            if (this.onopen) {
              this.onopen(new Event('open'))
            }
          }, 100)
        }

        send(data: string): void {
          console.log('WebSocket send:', data)
        }

        close(): void {
          this.readyState = WebSocket.CLOSED
          if (this.onclose) {
            this.onclose(new CloseEvent('close', { code: 1000, reason: 'Normal closure' }))
          }
        }

        // Add method to simulate receiving messages
        simulateMessage(data: any): void {
          if (this.onmessage && this.readyState === WebSocket.OPEN) {
            this.onmessage(new MessageEvent('message', { data: JSON.stringify(data) }))
          }
        }
      }

      // Replace global WebSocket
      ;(window as any).WebSocket = MockWebSocket
      ;(window as any).MockWebSocket = MockWebSocket
    })
  }

  /**
   * Simulate WebSocket message
   */
  async simulateWebSocketMessage(message: object): Promise<void> {
    await this.page.evaluate(msg => {
      // Find active WebSocket instance and simulate message
      const mockWs = (window as any).mockWebSocketInstance
      if (mockWs && mockWs.simulateMessage) {
        mockWs.simulateMessage(msg)
      }
    }, message)
  }

  /**
   * Mock API error response
   */
  async mockApiError(url: string, status = 500, errorMessage = 'Server error'): Promise<void> {
    await this.page.route(`**${url}`, route => {
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify({ error: errorMessage }),
      })
    })
  }

  /**
   * Mock API timeout
   */
  async mockApiTimeout(url: string, delay = 30000): Promise<void> {
    await this.page.route(`**${url}`, async route => {
      await new Promise(resolve => setTimeout(resolve, delay))
      route.fulfill({
        status: 408,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Request timeout' }),
      })
    })
  }

  /**
   * Take a screenshot with timestamp
   */
  async takeScreenshot(name: string): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    await this.page.screenshot({
      path: `playwright-test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true,
    })
  }

  /**
   * Check if element is visible and enabled
   */
  async expectElementReady(selector: string): Promise<void> {
    const element = this.page.locator(selector)
    await expect(element).toBeVisible()
    await expect(element).toBeEnabled()
  }

  /**
   * Fill input field and verify value
   */
  async fillAndVerifyInput(selector: string, value: string): Promise<void> {
    await this.page.fill(selector, value)
    await expect(this.page.locator(selector)).toHaveValue(value)
  }

  /**
   * Click button and wait for response
   */
  async clickAndWaitForResponse(buttonSelector: string, apiUrl?: string): Promise<void> {
    const button = this.page.locator(buttonSelector)
    await expect(button).toBeVisible()
    await expect(button).toBeEnabled()

    if (apiUrl) {
      const responsePromise = this.page.waitForResponse(`**${apiUrl}`)
      await button.click()
      await responsePromise
    } else {
      await button.click()
    }
  }

  /**
   * Wait for element to appear with custom timeout
   */
  async waitForElement(selector: string, timeout = 10000): Promise<void> {
    await this.page.waitForSelector(selector, { timeout })
  }

  /**
   * Check for console errors during test execution
   */
  setupConsoleErrorTracking(): void {
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        console.error(`Console error: ${msg.text()}`)
      }
    })
  }

  /**
   * Handle network errors and failed requests
   */
  setupNetworkErrorTracking(): void {
    this.page.on('requestfailed', request => {
      console.error(`Request failed: ${request.url()} - ${request.failure()?.errorText}`)
    })
  }

  /**
   * Wait for React Query to finish loading
   */
  async waitForReactQueryToLoad(timeout = 10000): Promise<void> {
    await this.page.waitForFunction(
      () => {
        // Check if any loading states are present
        const loadingElements = document.querySelectorAll('[class*="loading"], .loading-state')
        return loadingElements.length === 0
      },
      { timeout }
    )
  }

  /**
   * Wait for specific channel controls to be ready
   */
  async waitForChannelControls(channelIds: number[] = [0, 1, 2, 3]): Promise<void> {
    for (const channelId of channelIds) {
      await this.waitForElement(`[data-testid="channel-control-${channelId}"]`)
    }
  }

  /**
   * Wait for vector controls to be ready
   */
  async waitForVectorControls(deviceIds: number[] = [1, 2]): Promise<void> {
    for (const deviceId of deviceIds) {
      await this.waitForElement(`[data-testid="vector-control-${deviceId}"]`)
    }
  }

  /**
   * Verify error notifications
   */
  async expectErrorNotification(message?: string): Promise<void> {
    const errorNotification = this.page.locator(
      '.notification-error, [role="alert"][class*="error"]'
    )
    await expect(errorNotification).toBeVisible({ timeout: 5000 })

    if (message) {
      await expect(errorNotification).toContainText(message)
    }
  }

  /**
   * Verify success notifications
   */
  async expectSuccessNotification(message?: string): Promise<void> {
    const successNotification = this.page.locator(
      '.notification-success, [role="alert"][class*="success"]'
    )
    await expect(successNotification).toBeVisible({ timeout: 5000 })

    if (message) {
      await expect(successNotification).toContainText(message)
    }
  }

  /**
   * Simulate WebSocket connection failure
   */
  async mockWebSocketFailure(): Promise<void> {
    await this.page.evaluate(() => {
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
  }

  /**
   * Simulate network disconnection by routing all requests to fail
   */
  async simulateNetworkDisconnection(): Promise<void> {
    await this.page.route('**/*', route => {
      route.abort('internetdisconnected')
    })
  }

  /**
   * Restore network connection by removing all route mocks
   */
  async restoreNetworkConnection(): Promise<void> {
    await this.page.unroute('**/*')
  }

  /**
   * Mock API with retry logic - fails first N requests then succeeds
   */
  async mockApiWithRetries(
    url: string,
    failureCount: number,
    successResponse: object,
    errorStatus = 500,
    errorMessage = 'Internal server error'
  ): Promise<void> {
    let requestCount = 0

    await this.page.route(`**${url}`, async route => {
      requestCount++

      if (requestCount <= failureCount) {
        // Fail first N requests
        await route.fulfill({
          status: errorStatus,
          contentType: 'application/json',
          body: JSON.stringify({ error: errorMessage }),
        })
      } else {
        // Succeed on subsequent requests
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(successResponse),
        })
      }
    })
  }

  /**
   * Mock malformed API response
   */
  async mockMalformedApiResponse(url: string): Promise<void> {
    await this.page.route(`**${url}`, route => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: 'invalid json response',
      })
    })
  }

  /**
   * Send malformed WebSocket message
   */
  async sendMalformedWebSocketMessage(): Promise<void> {
    await this.page.evaluate(() => {
      const mockWs = (window as any).mockWebSocketInstance
      if (mockWs && mockWs.onmessage) {
        mockWs.onmessage(new MessageEvent('message', { data: 'invalid json' }))
      }
    })
  }

  /**
   * Test multiple error scenarios in sequence
   */
  async testErrorScenarios<T>(
    scenarios: Array<{
      description: string
      url: string
      status: number
      message: string
      expectedText: string
      triggerAction: () => Promise<void>
    }>,
    waitBetweenScenarios = 1000
  ): Promise<void> {
    for (const scenario of scenarios) {
      // Mock specific error
      await this.mockApiError(scenario.url, scenario.status, scenario.message)

      // Trigger the error
      await scenario.triggerAction()

      // Verify appropriate error message
      await this.expectErrorNotification(scenario.expectedText)

      // Wait before next test
      if (waitBetweenScenarios > 0) {
        await this.page.waitForTimeout(waitBetweenScenarios)
      }
    }
  }

  /**
   * Verify that error notifications don't overwhelm the UI
   */
  async expectLimitedErrorNotifications(maxErrorCount = 5): Promise<void> {
    const errorNotifications = this.page.locator('[class*="error"], [role="alert"][class*="error"]')
    const errorCount = await errorNotifications.count()

    // Should have some error indication but not overwhelm the UI
    expect(errorCount).toBeGreaterThan(0)
    expect(errorCount).toBeLessThan(maxErrorCount)
  }

  /**
   * Verify no error notifications are visible
   */
  async expectNoErrorNotifications(): Promise<void> {
    const errorElements = this.page.locator('[class*="error"], [role="alert"][class*="error"]')
    const visibleErrors = await errorElements.count()
    expect(visibleErrors).toBe(0)
  }
}

/**
 * Page Object Model for Haptic Control Panel
 */
export class HapticControlPage {
  private helpers: TestHelpers

  constructor(private page: Page) {
    this.helpers = new TestHelpers(page)
  }

  async navigateToApp(): Promise<void> {
    await this.helpers.navigateToHome()
    await this.waitForAppLoad()
  }

  async waitForAppLoad(): Promise<void> {
    // Wait for main app structure
    await this.helpers.waitForElement('.app-header')
    await this.helpers.waitForElement('.app-main')

    // Wait for control panel to load
    await this.helpers.waitForElement('.haptic-control-panel')

    // Wait for React Query to finish initial loading
    await this.helpers.waitForReactQueryToLoad()
  }

  async waitForControlPanelLoad(): Promise<void> {
    await this.helpers.waitForElement(testSelectors.panels.controlPanel)
    await this.helpers.waitForChannelControls()
    await this.helpers.waitForVectorControls()
  }

  async isControlPanelVisible(): Promise<boolean> {
    return await this.page.locator(testSelectors.panels.controlPanel).isVisible()
  }

  async isWaveformSectionVisible(): Promise<boolean> {
    return await this.page.locator(testSelectors.waveform.section).isVisible()
  }

  // Channel control methods
  async setChannelFrequency(channelId: number, value: number): Promise<void> {
    const channelControl = this.page.locator(testSelectors.channels.control(channelId))
    const frequencyInput = channelControl.locator(testSelectors.channels.frequencyInput)
    await frequencyInput.fill(String(value))
  }

  async setChannelAmplitude(channelId: number, value: number): Promise<void> {
    const channelControl = this.page.locator(testSelectors.channels.control(channelId))
    const amplitudeInput = channelControl.locator(testSelectors.channels.amplitudeInput)
    await amplitudeInput.fill(String(value))
  }

  async setChannelPhase(channelId: number, value: number): Promise<void> {
    const channelControl = this.page.locator(testSelectors.channels.control(channelId))
    const phaseInput = channelControl.locator(testSelectors.channels.phaseInput)
    await phaseInput.fill(String(value))
  }

  async toggleChannelPolarity(channelId: number): Promise<void> {
    const channelControl = this.page.locator(testSelectors.channels.control(channelId))
    const polarityCheckbox = channelControl.locator(testSelectors.channels.polarityCheckbox)
    await polarityCheckbox.click()
  }

  async getChannelValues(channelId: number): Promise<{
    frequency: number
    amplitude: number
    phase: number
    polarity: boolean
  }> {
    const channelControl = this.page.locator(testSelectors.channels.control(channelId))

    const frequency = parseFloat(
      await channelControl.locator(testSelectors.channels.frequencyInput).inputValue()
    )
    const amplitude = parseFloat(
      await channelControl.locator(testSelectors.channels.amplitudeInput).inputValue()
    )
    const phase = parseFloat(
      await channelControl.locator(testSelectors.channels.phaseInput).inputValue()
    )
    const polarity = await channelControl
      .locator(testSelectors.channels.polarityCheckbox)
      .isChecked()

    return { frequency, amplitude, phase, polarity }
  }

  // Vector control methods
  async setVectorAngle(deviceId: number, angle: number): Promise<void> {
    const vectorControl = this.page.locator(testSelectors.vector.control(deviceId))
    const angleInput = vectorControl.locator(testSelectors.vector.angleInput)
    await angleInput.fill(String(angle))
  }

  async setVectorMagnitude(deviceId: number, magnitude: number): Promise<void> {
    const vectorControl = this.page.locator(testSelectors.vector.control(deviceId))
    const magnitudeInput = vectorControl.locator(testSelectors.vector.magnitudeInput)
    await magnitudeInput.fill(String(magnitude))
  }

  async setVectorFrequency(deviceId: number, frequency: number): Promise<void> {
    const vectorControl = this.page.locator(testSelectors.vector.control(deviceId))
    const frequencyInput = vectorControl.locator(testSelectors.vector.frequencyInput)
    await frequencyInput.fill(String(frequency))
  }

  async applyVectorForce(deviceId: number): Promise<void> {
    const vectorControl = this.page.locator(testSelectors.vector.control(deviceId))
    const applyButton = vectorControl.locator(testSelectors.vector.applyButton)
    await applyButton.click()
  }

  async clearVectorForce(deviceId: number): Promise<void> {
    const vectorControl = this.page.locator(testSelectors.vector.control(deviceId))
    const clearButton = vectorControl.locator(testSelectors.vector.clearButton)
    await clearButton.click()
  }


  async getConnectionStatus(): Promise<string> {
    const statusElement = this.page.locator(testSelectors.streaming.status)
    return (await statusElement.textContent()) || ''
  }

  // Validation methods
  async expectChannelError(channelId: number, field?: string): Promise<void> {
    const channelControl = this.page.locator(testSelectors.channels.control(channelId))
    const errorElement = channelControl.locator('.error, [class*="error"], [aria-invalid="true"]')
    await expect(errorElement).toBeVisible({ timeout: 5000 })
  }

  async expectVectorError(deviceId: number): Promise<void> {
    const vectorControl = this.page.locator(testSelectors.vector.control(deviceId))
    const errorElement = vectorControl.locator('.error, [class*="error"], [aria-invalid="true"]')
    await expect(errorElement).toBeVisible({ timeout: 5000 })
  }

  async expectLoadingState(): Promise<void> {
    const loadingElements = this.page.locator(
      '[class*="loading"], .loading-state, button[disabled]'
    )
    await expect(loadingElements.first()).toBeVisible({ timeout: 5000 })
  }

  async expectNoLoadingState(): Promise<void> {
    await this.helpers.waitForReactQueryToLoad()
  }

  // Data consistency and error recovery methods
  
  /**
   * Set multiple channel parameters rapidly (for testing concurrent operations)
   */
  async setMultipleChannelParametersRapidly(
    channelId: number,
    parameters: { frequency?: number; amplitude?: number; phase?: number },
    intervalMs = 100
  ): Promise<void> {
    const actions = []
    if (parameters.frequency !== undefined) {
      actions.push(() => this.setChannelFrequency(channelId, parameters.frequency!))
    }
    if (parameters.amplitude !== undefined) {
      actions.push(() => this.setChannelAmplitude(channelId, parameters.amplitude!))
    }
    if (parameters.phase !== undefined) {
      actions.push(() => this.setChannelPhase(channelId, parameters.phase!))
    }

    for (const action of actions) {
      await action()
      await this.page.waitForTimeout(intervalMs)
    }
  }

  /**
   * Verify data consistency after error recovery
   */
  async verifyDataConsistency(
    channelId: number,
    expectedValues: { frequency?: number; amplitude?: number; phase?: number }
  ): Promise<void> {
    const actualValues = await this.getChannelValues(channelId)
    
    if (expectedValues.frequency !== undefined) {
      expect(actualValues.frequency).toBe(expectedValues.frequency)
    }
    if (expectedValues.amplitude !== undefined) {
      expect(actualValues.amplitude).toBe(expectedValues.amplitude)
    }
    if (expectedValues.phase !== undefined) {
      expect(actualValues.phase).toBe(expectedValues.phase)
    }
  }

  /**
   * Test API server recovery workflow
   */
  async testServerRecoveryWorkflow(
    channelId: number,
    initialValue: number,
    newValue: number,
    helpers: TestHelpers,
    apiUrl: string,
    apiResponse: object
  ): Promise<void> {
    // Set initial value
    await this.setChannelFrequency(channelId, initialValue)
    await this.page.waitForTimeout(500)

    // Verify initial value is set
    let values = await this.getChannelValues(channelId)
    expect(values.frequency).toBe(initialValue)

    // Mock API failure
    await helpers.mockApiError(apiUrl, 503, 'Service temporarily unavailable')

    // Try to update during failure
    await this.setChannelFrequency(channelId, newValue)

    // Verify error notification
    await helpers.expectErrorNotification('Service temporarily unavailable')

    // Verify optimistic update is shown in UI
    values = await this.getChannelValues(channelId)
    expect(values.frequency).toBe(newValue)

    // Mock recovery - server comes back online
    await helpers.mockApiResponse(apiUrl, apiResponse)

    // Try the update again
    await this.setChannelFrequency(channelId, newValue + 5)

    // Verify successful update (no error notification)
    await this.page.waitForTimeout(1000)
    await helpers.expectNoErrorNotifications()
  }


  /**
   * Trigger rapid parameter changes (for testing error handling under load)
   */
  async triggerRapidParameterChanges(
    channelId: number,
    changeCount: number,
    baseValue: number,
    intervalMs = 100
  ): Promise<void> {
    for (let i = 0; i < changeCount; i++) {
      await this.setChannelFrequency(channelId, baseValue + i)
      await this.page.waitForTimeout(intervalMs)
    }
  }
}
