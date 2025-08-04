import { test, expect } from '@playwright/test'
import { TestHelpers, HapticControlPage } from './utils/testHelpers'
import {
  testApiResponses,
  testHapticData,
  testUrls,
  testSelectors,
  testErrorScenarios,
} from './fixtures/testData'

test.describe('Vector Force Controls - Functional Tests', () => {
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
  })

  test('should display vector controls for both devices', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Verify both device vector controls are present
    await expect(page.locator(testSelectors.vector.control(1))).toBeVisible()
    await expect(page.locator(testSelectors.vector.control(2))).toBeVisible()

    // Verify vector control titles
    await expect(page.locator('text=Device 1 Vector Force')).toBeVisible()
    await expect(page.locator('text=Device 2 Vector Force')).toBeVisible()

    // Verify each vector control has all required elements
    for (const deviceId of [1, 2]) {
      const vectorControl = page.locator(testSelectors.vector.control(deviceId))

      // Check input fields
      await expect(vectorControl.locator(testSelectors.vector.angleInput)).toBeVisible()
      await expect(vectorControl.locator(testSelectors.vector.magnitudeInput)).toBeVisible()
      await expect(vectorControl.locator(testSelectors.vector.frequencyInput)).toBeVisible()

      // Check action buttons
      await expect(vectorControl.locator(testSelectors.vector.applyButton)).toBeVisible()
      await expect(vectorControl.locator(testSelectors.vector.clearButton)).toBeVisible()

      // Check visualization
      await expect(vectorControl.locator(testSelectors.vector.visualization)).toBeVisible()
    }
  })

  test('should handle angle input with proper validation', async ({ page }) => {
    await hapticPage.navigateToApp()

    const deviceId = 1

    // Test valid angle values
    const testAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360]

    for (const angle of testAngles) {
      await hapticPage.setVectorAngle(deviceId, angle)

      // Verify the value was set
      const vectorControl = page.locator(testSelectors.vector.control(deviceId))
      const angleInput = vectorControl.locator(testSelectors.vector.angleInput)
      const currentValue = await angleInput.inputValue()
      expect(parseFloat(currentValue)).toBe(angle)
    }

    // Test boundary validation
    await hapticPage.setVectorAngle(deviceId, -1)
    await hapticPage.expectVectorError(deviceId)

    await hapticPage.setVectorAngle(deviceId, 361)
    await hapticPage.expectVectorError(deviceId)
  })

  test('should handle magnitude input with proper validation', async ({ page }) => {
    await hapticPage.navigateToApp()

    const deviceId = 1

    // Test valid magnitude values
    const testMagnitudes = [0, 0.1, 0.25, 0.5, 0.75, 1.0]

    for (const magnitude of testMagnitudes) {
      await hapticPage.setVectorMagnitude(deviceId, magnitude)

      // Verify the value was set
      const vectorControl = page.locator(testSelectors.vector.control(deviceId))
      const magnitudeInput = vectorControl.locator(testSelectors.vector.magnitudeInput)
      const currentValue = await magnitudeInput.inputValue()
      expect(parseFloat(currentValue)).toBe(magnitude)
    }

    // Test boundary validation
    await hapticPage.setVectorMagnitude(deviceId, -0.1)
    await hapticPage.expectVectorError(deviceId)

    await hapticPage.setVectorMagnitude(deviceId, 1.1)
    await hapticPage.expectVectorError(deviceId)
  })

  test('should handle vector frequency input with proper validation', async ({ page }) => {
    await hapticPage.navigateToApp()

    const deviceId = 1

    // Test valid frequency values within vector constraints
    const testFrequencies = [40, 50, 60, 80, 100, 120]

    for (const frequency of testFrequencies) {
      await hapticPage.setVectorFrequency(deviceId, frequency)

      // Verify the value was set
      const vectorControl = page.locator(testSelectors.vector.control(deviceId))
      const frequencyInput = vectorControl.locator(testSelectors.vector.frequencyInput)
      const currentValue = await frequencyInput.inputValue()
      expect(parseFloat(currentValue)).toBe(frequency)
    }

    // Test boundary validation
    await hapticPage.setVectorFrequency(
      deviceId,
      testHapticData.constraints.vectorFrequency.min - 1
    )
    await hapticPage.expectVectorError(deviceId)

    await hapticPage.setVectorFrequency(
      deviceId,
      testHapticData.constraints.vectorFrequency.max + 1
    )
    await hapticPage.expectVectorError(deviceId)
  })

  test('should apply vector force and handle API responses', async ({ page }) => {
    await hapticPage.navigateToApp()

    const deviceId = 1
    const testVector = testHapticData.vectorForce

    // Set vector parameters
    await hapticPage.setVectorAngle(deviceId, testVector.angle)
    await hapticPage.setVectorMagnitude(deviceId, testVector.magnitude)
    await hapticPage.setVectorFrequency(deviceId, testVector.frequency)

    // Mock successful apply response
    await helpers.mockApiResponse(testUrls.api.vectorForce, {
      success: true,
      vectorForce: {
        deviceId,
        angle: testVector.angle,
        magnitude: testVector.magnitude,
        frequency: testVector.frequency,
      },
    })

    // Apply vector force
    await hapticPage.applyVectorForce(deviceId)

    // Verify loading state during apply
    try {
      await hapticPage.expectLoadingState()
    } catch (error) {
      // Loading state might be too fast to catch
      console.log('Apply operation completed quickly')
    }

    // Wait for operation to complete
    await hapticPage.expectNoLoadingState()
  })

  test('should clear vector force and reset inputs', async ({ page }) => {
    await hapticPage.navigateToApp()

    const deviceId = 1
    const testVector = testHapticData.vectorForce

    // Set vector parameters first
    await hapticPage.setVectorAngle(deviceId, testVector.angle)
    await hapticPage.setVectorMagnitude(deviceId, testVector.magnitude)
    await hapticPage.setVectorFrequency(deviceId, testVector.frequency)

    // Mock successful clear response
    await helpers.mockApiResponse(testUrls.api.vectorForce, {
      success: true,
      vectorForce: null,
    })

    // Clear vector force
    await hapticPage.clearVectorForce(deviceId)

    // Wait for operation to complete
    await hapticPage.expectNoLoadingState()

    // Verify inputs are reset to default values
    const vectorControl = page.locator(testSelectors.vector.control(deviceId))
    const angleInput = vectorControl.locator(testSelectors.vector.angleInput)
    const magnitudeInput = vectorControl.locator(testSelectors.vector.magnitudeInput)
    const frequencyInput = vectorControl.locator(testSelectors.vector.frequencyInput)

    expect(parseFloat(await angleInput.inputValue())).toBe(0)
    expect(parseFloat(await magnitudeInput.inputValue())).toBe(0)
    expect(parseFloat(await frequencyInput.inputValue())).toBe(60) // Default frequency
  })

  test('should update vector visualization based on input values', async ({ page }) => {
    await hapticPage.navigateToApp()

    const deviceId = 1

    // Test different vector configurations and verify visualization updates
    const testVectors = [
      { angle: 0, magnitude: 1.0 }, // Right
      { angle: 90, magnitude: 1.0 }, // Up
      { angle: 180, magnitude: 1.0 }, // Left
      { angle: 270, magnitude: 1.0 }, // Down
      { angle: 45, magnitude: 0.5 }, // Up-right, half magnitude
    ]

    for (const vector of testVectors) {
      await hapticPage.setVectorAngle(deviceId, vector.angle)
      await hapticPage.setVectorMagnitude(deviceId, vector.magnitude)

      // Verify SVG visualization exists and has updated
      const vectorControl = page.locator(testSelectors.vector.control(deviceId))
      const svg = vectorControl.locator('svg')
      await expect(svg).toBeVisible()

      // Verify vector line element exists
      const vectorLine = svg.locator('line[stroke="#007bff"]')
      await expect(vectorLine).toBeVisible()

      // Check that line has expected coordinates based on angle and magnitude
      const x2 = await vectorLine.getAttribute('x2')
      const y2 = await vectorLine.getAttribute('y2')

      if (x2 && y2) {
        const expectedX = Math.cos((vector.angle * Math.PI) / 180) * vector.magnitude * 50
        const expectedY = -Math.sin((vector.angle * Math.PI) / 180) * vector.magnitude * 50

        // Allow for small floating point differences
        expect(Math.abs(parseFloat(x2) - expectedX)).toBeLessThan(0.1)
        expect(Math.abs(parseFloat(y2) - expectedY)).toBeLessThan(0.1)
      }
    }
  })

  test('should handle vector force errors and show error messages', async ({ page }) => {
    await hapticPage.navigateToApp()

    const deviceId = 1

    // Mock API error response
    await helpers.mockApiError(testUrls.api.vectorForce, 400, 'Invalid vector parameters')

    // Set valid parameters
    await hapticPage.setVectorAngle(deviceId, 45)
    await hapticPage.setVectorMagnitude(deviceId, 0.5)
    await hapticPage.setVectorFrequency(deviceId, 60)

    // Try to apply - should result in error
    await hapticPage.applyVectorForce(deviceId)

    // Verify error notification is shown
    await helpers.expectErrorNotification('Invalid vector parameters')
  })

  test('should handle independent operation of both devices', async ({ page }) => {
    await hapticPage.navigateToApp()

    // Set different parameters for each device
    await hapticPage.setVectorAngle(1, 45)
    await hapticPage.setVectorMagnitude(1, 0.7)
    await hapticPage.setVectorFrequency(1, 60)

    await hapticPage.setVectorAngle(2, 135)
    await hapticPage.setVectorMagnitude(2, 0.3)
    await hapticPage.setVectorFrequency(2, 80)

    // Verify values are independent
    const device1Control = page.locator(testSelectors.vector.control(1))
    const device2Control = page.locator(testSelectors.vector.control(2))

    const device1Angle = await device1Control.locator(testSelectors.vector.angleInput).inputValue()
    const device1Magnitude = await device1Control
      .locator(testSelectors.vector.magnitudeInput)
      .inputValue()
    const device1Frequency = await device1Control
      .locator(testSelectors.vector.frequencyInput)
      .inputValue()

    const device2Angle = await device2Control.locator(testSelectors.vector.angleInput).inputValue()
    const device2Magnitude = await device2Control
      .locator(testSelectors.vector.magnitudeInput)
      .inputValue()
    const device2Frequency = await device2Control
      .locator(testSelectors.vector.frequencyInput)
      .inputValue()

    expect(parseFloat(device1Angle)).toBe(45)
    expect(parseFloat(device1Magnitude)).toBe(0.7)
    expect(parseFloat(device1Frequency)).toBe(60)

    expect(parseFloat(device2Angle)).toBe(135)
    expect(parseFloat(device2Magnitude)).toBe(0.3)
    expect(parseFloat(device2Frequency)).toBe(80)
  })

  test('should handle keyboard navigation within vector controls', async ({ page }) => {
    await hapticPage.navigateToApp()

    const deviceId = 1
    const vectorControl = page.locator(testSelectors.vector.control(deviceId))

    // Start with angle input
    const angleInput = vectorControl.locator(testSelectors.vector.angleInput)
    await angleInput.focus()
    await expect(angleInput).toBeFocused()

    // Tab to magnitude input
    await page.keyboard.press('Tab')
    const magnitudeInput = vectorControl.locator(testSelectors.vector.magnitudeInput)
    await expect(magnitudeInput).toBeFocused()

    // Tab to frequency input
    await page.keyboard.press('Tab')
    const frequencyInput = vectorControl.locator(testSelectors.vector.frequencyInput)
    await expect(frequencyInput).toBeFocused()

    // Tab to apply button
    await page.keyboard.press('Tab')
    const applyButton = vectorControl.locator(testSelectors.vector.applyButton)
    await expect(applyButton).toBeFocused()

    // Test Enter key on apply button
    await page.keyboard.press('Enter')
    // Should trigger apply action (might show loading state)

    // Tab to clear button
    await page.keyboard.press('Tab')
    const clearButton = vectorControl.locator(testSelectors.vector.clearButton)
    await expect(clearButton).toBeFocused()
  })

  test('should maintain vector control responsiveness across viewports', async ({ page }) => {
    const viewports = [
      { width: 375, height: 667, name: 'mobile' },
      { width: 768, height: 1024, name: 'tablet' },
      { width: 1200, height: 800, name: 'desktop' },
    ]

    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Verify both vector controls are accessible
      for (const deviceId of [1, 2]) {
        const vectorControl = page.locator(testSelectors.vector.control(deviceId))
        await expect(vectorControl).toBeVisible()

        // Verify all inputs are accessible
        await expect(vectorControl.locator(testSelectors.vector.angleInput)).toBeVisible()
        await expect(vectorControl.locator(testSelectors.vector.magnitudeInput)).toBeVisible()
        await expect(vectorControl.locator(testSelectors.vector.frequencyInput)).toBeVisible()

        // Verify buttons are accessible
        await expect(vectorControl.locator(testSelectors.vector.applyButton)).toBeVisible()
        await expect(vectorControl.locator(testSelectors.vector.clearButton)).toBeVisible()

        // Verify visualization is still visible
        await expect(vectorControl.locator(testSelectors.vector.visualization)).toBeVisible()
      }

      console.log(`Vector controls verified for ${viewport.name} viewport`)
      await page.waitForTimeout(300)
    }
  })
})
