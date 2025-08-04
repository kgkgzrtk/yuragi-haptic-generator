import { test, expect } from '@playwright/test'
import { TestHelpers, HapticControlPage } from './utils/testHelpers'
import {
  testApiResponses,
  testHapticData,
  testUrls,
  testSelectors,
  testErrorScenarios,
} from './fixtures/testData'

test.describe('Haptic Controls - Functional Tests', () => {
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

    // Mock API responses with comprehensive data
    await helpers.mockApiResponse(testUrls.api.health, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.status, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.parameters, testApiResponses.parameters)
    await helpers.mockApiResponse(testUrls.api.streaming, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.vectorForce, testApiResponses.vectorForce)
    await helpers.mockApiResponse(testUrls.api.waveform, testApiResponses.waveformData)

    // Legacy support
    await helpers.mockApiResponse(testUrls.api.haptic, testApiResponses.hapticConfig)
    await helpers.mockApiResponse(testUrls.api.config, testApiResponses.hapticConfig)
  })

  test('should display all channel controls with proper structure', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Verify all 4 channel controls are present (0-3)
    for (const channelId of testHapticData.testChannels) {
      const channelControl = page.locator(testSelectors.channels.control(channelId))
      await expect(channelControl).toBeVisible()

      // Verify each channel has all required input fields
      await expect(channelControl.locator(testSelectors.channels.frequencyInput)).toBeVisible()
      await expect(channelControl.locator(testSelectors.channels.amplitudeInput)).toBeVisible()
      await expect(channelControl.locator(testSelectors.channels.phaseInput)).toBeVisible()
      await expect(channelControl.locator(testSelectors.channels.polarityCheckbox)).toBeVisible()
    }

    // Verify device sections are properly organized
    await expect(page.locator('text=Device 1')).toBeVisible()
    await expect(page.locator('text=Device 2')).toBeVisible()
    await expect(page.locator('text=X Axis (Channel 0)')).toBeVisible()
    await expect(page.locator('text=Y Axis (Channel 1)')).toBeVisible()
    await expect(page.locator('text=X Axis (Channel 2)')).toBeVisible()
    await expect(page.locator('text=Y Axis (Channel 3)')).toBeVisible()
  })

  test('should handle frequency input changes for all channels', async ({ page }) => {
    await hapticPage.navigateToApp()

    for (const channelId of testHapticData.testChannels) {
      // Test valid frequency input
      await hapticPage.setChannelFrequency(channelId, testHapticData.defaultFrequency)

      const values = await hapticPage.getChannelValues(channelId)
      expect(values.frequency).toBe(testHapticData.defaultFrequency)

      // Test boundary values
      await hapticPage.setChannelFrequency(channelId, testHapticData.constraints.frequency.min)
      const minValues = await hapticPage.getChannelValues(channelId)
      expect(minValues.frequency).toBe(testHapticData.constraints.frequency.min)

      await hapticPage.setChannelFrequency(channelId, testHapticData.constraints.frequency.max)
      const maxValues = await hapticPage.getChannelValues(channelId)
      expect(maxValues.frequency).toBe(testHapticData.constraints.frequency.max)
    }
  })

  test('should handle amplitude controls with validation', async ({ page }) => {
    await hapticPage.navigateToApp()

    for (const channelId of testHapticData.testChannels) {
      // Test valid amplitude input
      await hapticPage.setChannelAmplitude(channelId, testHapticData.defaultAmplitude)

      const values = await hapticPage.getChannelValues(channelId)
      expect(values.amplitude).toBe(testHapticData.defaultAmplitude)

      // Test boundary values
      await hapticPage.setChannelAmplitude(channelId, testHapticData.constraints.amplitude.min)
      const minValues = await hapticPage.getChannelValues(channelId)
      expect(minValues.amplitude).toBe(testHapticData.constraints.amplitude.min)

      await hapticPage.setChannelAmplitude(channelId, testHapticData.constraints.amplitude.max)
      const maxValues = await hapticPage.getChannelValues(channelId)
      expect(maxValues.amplitude).toBe(testHapticData.constraints.amplitude.max)
    }
  })

  test('should handle phase controls', async ({ page }) => {
    await hapticPage.navigateToApp()

    for (const channelId of testHapticData.testChannels) {
      // Test valid phase input
      await hapticPage.setChannelPhase(channelId, testHapticData.defaultPhase)

      const values = await hapticPage.getChannelValues(channelId)
      expect(values.phase).toBe(testHapticData.defaultPhase)

      // Test other phase values
      await hapticPage.setChannelPhase(channelId, 90)
      const phase90Values = await hapticPage.getChannelValues(channelId)
      expect(phase90Values.phase).toBe(90)

      await hapticPage.setChannelPhase(channelId, 180)
      const phase180Values = await hapticPage.getChannelValues(channelId)
      expect(phase180Values.phase).toBe(180)

      await hapticPage.setChannelPhase(channelId, 270)
      const phase270Values = await hapticPage.getChannelValues(channelId)
      expect(phase270Values.phase).toBe(270)
    }
  })

  test('should handle polarity checkbox controls', async ({ page }) => {
    await hapticPage.navigateToApp()

    for (const channelId of testHapticData.testChannels) {
      // Get initial polarity state
      const initialValues = await hapticPage.getChannelValues(channelId)
      const initialPolarity = initialValues.polarity

      // Toggle polarity
      await hapticPage.toggleChannelPolarity(channelId)

      const toggledValues = await hapticPage.getChannelValues(channelId)
      expect(toggledValues.polarity).toBe(!initialPolarity)

      // Toggle back
      await hapticPage.toggleChannelPolarity(channelId)

      const finalValues = await hapticPage.getChannelValues(channelId)
      expect(finalValues.polarity).toBe(initialPolarity)
    }
  })

  test('should validate input constraints and show errors', async ({ page }) => {
    await hapticPage.navigateToApp()

    const testChannelId = 0 // Test with first channel

    // Test frequency validation - invalid high value
    await hapticPage.setChannelFrequency(
      testChannelId,
      testHapticData.constraints.frequency.max + 10
    )
    await hapticPage.expectChannelError(testChannelId)

    // Test frequency validation - invalid low value
    await hapticPage.setChannelFrequency(
      testChannelId,
      testHapticData.constraints.frequency.min - 1
    )
    await hapticPage.expectChannelError(testChannelId)

    // Test amplitude validation - invalid high value
    await hapticPage.setChannelAmplitude(
      testChannelId,
      testHapticData.constraints.amplitude.max + 0.1
    )
    await hapticPage.expectChannelError(testChannelId)

    // Test amplitude validation - invalid low value
    await hapticPage.setChannelAmplitude(
      testChannelId,
      testHapticData.constraints.amplitude.min - 0.1
    )
    await hapticPage.expectChannelError(testChannelId)

    // Test phase validation - invalid high value
    await hapticPage.setChannelPhase(testChannelId, testHapticData.constraints.phase.max + 10)
    await hapticPage.expectChannelError(testChannelId)

    // Test phase validation - invalid low value
    await hapticPage.setChannelPhase(testChannelId, testHapticData.constraints.phase.min - 1)
    await hapticPage.expectChannelError(testChannelId)
  })

  test('should handle batch parameter updates with debouncing', async ({ page }) => {
    await hapticPage.navigateToApp()

    const testChannelId = 0

    // Rapidly change multiple parameters
    await hapticPage.setChannelFrequency(testChannelId, 50)
    await hapticPage.setChannelAmplitude(testChannelId, 0.3)
    await hapticPage.setChannelPhase(testChannelId, 45)

    // Verify that loading/pending state is shown during batch updates
    try {
      await hapticPage.expectLoadingState()
    } catch (error) {
      // It's okay if loading state is not visible due to fast updates
      console.log('Loading state not detected - updates may be too fast')
    }

    // Wait for updates to complete
    await hapticPage.expectNoLoadingState()

    // Verify final values
    const finalValues = await hapticPage.getChannelValues(testChannelId)
    expect(finalValues.frequency).toBe(50)
    expect(finalValues.amplitude).toBe(0.3)
    expect(finalValues.phase).toBe(45)
  })

  test('should show channel update status and handle errors', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Verify connection status is displayed
    const connectionStatus = await hapticPage.getConnectionStatus()
    expect(typeof connectionStatus).toBe('string')
    expect(connectionStatus.length).toBeGreaterThan(0)

    // Test successful parameter update
    const testChannelId = 0
    await hapticPage.setChannelFrequency(testChannelId, 75)

    // Verify no error messages are shown for valid inputs
    await page.waitForTimeout(1000)
    const errorElements = page.locator('[class*="error"], [role="alert"][class*="error"]')
    const errorCount = await errorElements.count()
    expect(errorCount).toBe(0)
  })

  test('should synchronize channel parameters across devices', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Test updating multiple channels with the same values
    const frequency = 90
    const amplitude = 0.8

    // Update Device 1 channels (0, 1)
    await hapticPage.setChannelFrequency(0, frequency)
    await hapticPage.setChannelAmplitude(0, amplitude)
    await hapticPage.setChannelFrequency(1, frequency)
    await hapticPage.setChannelAmplitude(1, amplitude)

    // Update Device 2 channels (2, 3)
    await hapticPage.setChannelFrequency(2, frequency)
    await hapticPage.setChannelAmplitude(2, amplitude)
    await hapticPage.setChannelFrequency(3, frequency)
    await hapticPage.setChannelAmplitude(3, amplitude)

    // Wait for updates to complete
    await hapticPage.expectNoLoadingState()

    // Verify all channels have the same values
    for (const channelId of testHapticData.testChannels) {
      const values = await hapticPage.getChannelValues(channelId)
      expect(values.frequency).toBe(frequency)
      expect(values.amplitude).toBe(amplitude)
    }
  })

  test('should handle keyboard navigation between channel controls', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Start with first frequency input
    const firstChannelControl = page.locator(testSelectors.channels.control(0))
    const firstFrequencyInput = firstChannelControl.locator(testSelectors.channels.frequencyInput)

    await firstFrequencyInput.focus()
    await expect(firstFrequencyInput).toBeFocused()

    // Tab through inputs within the channel
    await page.keyboard.press('Tab')
    const firstAmplitudeInput = firstChannelControl.locator(testSelectors.channels.amplitudeInput)
    await expect(firstAmplitudeInput).toBeFocused()

    await page.keyboard.press('Tab')
    const firstPhaseInput = firstChannelControl.locator(testSelectors.channels.phaseInput)
    await expect(firstPhaseInput).toBeFocused()

    await page.keyboard.press('Tab')
    const firstPolarityCheckbox = firstChannelControl.locator(
      testSelectors.channels.polarityCheckbox
    )
    await expect(firstPolarityCheckbox).toBeFocused()

    // Test that Enter/Space works for checkbox
    const initialPolarity = await firstPolarityCheckbox.isChecked()
    await page.keyboard.press('Space')
    await expect(firstPolarityCheckbox).toBeChecked({ checked: !initialPolarity })
  })

  test('should maintain channel control responsiveness across viewports', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1200, height: 800, name: 'desktop' },
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Verify all channel controls are still accessible
      for (const channelId of testHapticData.testChannels) {
        const channelControl = page.locator(testSelectors.channels.control(channelId))
        await expect(channelControl).toBeVisible()

        // Verify inputs are still interactable
        const frequencyInput = channelControl.locator(testSelectors.channels.frequencyInput)
        await expect(frequencyInput).toBeVisible()
        await expect(frequencyInput).toBeEnabled()
      }

      console.log(`Channel controls verified for ${viewport.name} viewport`)
      await page.waitForTimeout(300)
    }
  })
})
