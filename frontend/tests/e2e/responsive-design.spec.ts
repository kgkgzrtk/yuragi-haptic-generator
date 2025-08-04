import { test, expect } from '@playwright/test'
import { TestHelpers, HapticControlPage } from './utils/testHelpers'
import { testApiResponses, testHapticData, testUrls, testSelectors } from './fixtures/testData'

test.describe('Responsive Design - Mobile and Tablet Tests', () => {
  let helpers: TestHelpers
  let hapticPage: HapticControlPage

  // Define viewport configurations for testing
  const viewports = [
    { width: 320, height: 568, name: 'iPhone SE' },
    { width: 375, height: 667, name: 'iPhone 8' },
    { width: 414, height: 896, name: 'iPhone 11 Pro Max' },
    { width: 768, height: 1024, name: 'iPad Portrait' },
    { width: 1024, height: 768, name: 'iPad Landscape' },
    { width: 1200, height: 800, name: 'Desktop' },
    { width: 1920, height: 1080, name: 'Full HD Desktop' },
  ]

  test.beforeEach(async ({ page }) => {
    helpers = new TestHelpers(page)
    hapticPage = new HapticControlPage(page)

    // Set up error tracking
    helpers.setupConsoleErrorTracking()
    helpers.setupNetworkErrorTracking()

    // Set up WebSocket mocking
    await helpers.mockWebSocket()

    // Mock API responses
    await helpers.mockApiResponse(testUrls.api.health, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.status, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.parameters, testApiResponses.parameters)
    await helpers.mockApiResponse(testUrls.api.streaming, testApiResponses.systemStatus)
    await helpers.mockApiResponse(testUrls.api.vectorForce, testApiResponses.vectorForce)
  })

  test('should display app header responsively across all viewports', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Verify header is visible and functional
      const header = page.locator(testSelectors.app.header)
      await expect(header).toBeVisible()

      // Verify title is visible (might be abbreviated on small screens)
      const title = page.locator(testSelectors.app.title)
      await expect(title).toBeVisible()

      // Verify streaming controls are accessible
      const streamingButton = page.locator(testSelectors.streaming.button)
      await expect(streamingButton).toBeVisible()
      await expect(streamingButton).toBeEnabled()

      // Verify connection status is visible
      const connectionStatus = page.locator(testSelectors.streaming.status)
      await expect(connectionStatus).toBeVisible()

      console.log(`Header verified for ${viewport.name} (${viewport.width}x${viewport.height})`)
      await page.waitForTimeout(200)
    }
  })

  test('should maintain control panel layout across viewports', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Verify main control panel is visible
      const controlPanel = page.locator(testSelectors.panels.controlPanel)
      await expect(controlPanel).toBeVisible()

      // Verify device sections are accessible
      const deviceSections = page.locator(testSelectors.panels.deviceSection)
      const deviceCount = await deviceSections.count()
      expect(deviceCount).toBe(2) // Should have Device 1 and Device 2

      // On smaller screens, sections might stack vertically
      // Verify all sections are still visible
      for (let i = 0; i < deviceCount; i++) {
        await expect(deviceSections.nth(i)).toBeVisible()
      }

      console.log(`Control panel layout verified for ${viewport.name}`)
      await page.waitForTimeout(200)
    }
  })

  test('should keep channel controls accessible on mobile devices', async ({ page }) => {
    // Test specifically on mobile viewports
    const mobileViewports = viewports.filter(v => v.width <= 414)

    for (const viewport of mobileViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Verify all channel controls are accessible
      for (const channelId of testHapticData.testChannels) {
        const channelControl = page.locator(testSelectors.channels.control(channelId))
        await expect(channelControl).toBeVisible()

        // Verify inputs are large enough to interact with on mobile
        const frequencyInput = channelControl.locator(testSelectors.channels.frequencyInput)
        const amplitudeInput = channelControl.locator(testSelectors.channels.amplitudeInput)
        const phaseInput = channelControl.locator(testSelectors.channels.phaseInput)

        await expect(frequencyInput).toBeVisible()
        await expect(amplitudeInput).toBeVisible()
        await expect(phaseInput).toBeVisible()

        // Test touch interaction
        await frequencyInput.tap()
        await expect(frequencyInput).toBeFocused()

        // Clear focus for next test
        await page.keyboard.press('Escape')
      }

      console.log(`Channel controls verified for mobile ${viewport.name}`)
      await page.waitForTimeout(200)
    }
  })

  test('should handle vector control visualization on different screen sizes', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Verify vector controls for both devices
      for (const deviceId of [1, 2]) {
        const vectorControl = page.locator(testSelectors.vector.control(deviceId))
        await expect(vectorControl).toBeVisible()

        // Verify SVG visualization is present and sized appropriately
        const svg = vectorControl.locator(testSelectors.vector.visualization)
        await expect(svg).toBeVisible()

        // Get SVG dimensions
        const svgBox = await svg.boundingBox()
        expect(svgBox).not.toBeNull()

        if (svgBox) {
          // SVG should have reasonable size for the viewport
          expect(svgBox.width).toBeGreaterThan(60) // Minimum usable size
          expect(svgBox.height).toBeGreaterThan(60)

          // On mobile, might be smaller but still usable
          if (viewport.width <= 414) {
            expect(svgBox.width).toBeLessThan(viewport.width * 0.8)
          }
        }

        // Verify input controls are accessible
        const angleInput = vectorControl.locator(testSelectors.vector.angleInput)
        const magnitudeInput = vectorControl.locator(testSelectors.vector.magnitudeInput)

        await expect(angleInput).toBeVisible()
        await expect(magnitudeInput).toBeVisible()
      }

      console.log(`Vector controls verified for ${viewport.name}`)
      await page.waitForTimeout(200)
    }
  })

  test('should maintain waveform visualization responsiveness', async ({ page }) => {
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Verify waveform section is accessible
      const waveformSection = page.locator(testSelectors.waveform.section)
      await expect(waveformSection).toBeVisible()

      // Verify waveform grid adapts to screen size
      const waveformGrid = page.locator(testSelectors.waveform.grid)
      await expect(waveformGrid).toBeVisible()

      // Count visible waveform containers
      const waveformContainers = page.locator(testSelectors.waveform.container)
      const containerCount = await waveformContainers.count()
      expect(containerCount).toBe(4) // Should have 4 channels

      // On smaller screens, containers might stack differently
      // But all should still be visible
      for (let i = 0; i < containerCount; i++) {
        await expect(waveformContainers.nth(i)).toBeVisible()
      }

      // Check if charts would render (canvases might load asynchronously)
      try {
        const canvases = page.locator(testSelectors.waveform.canvas)
        const canvasCount = await canvases.count()
        if (canvasCount > 0) {
          console.log(`Found ${canvasCount} chart canvases for ${viewport.name}`)
        }
      } catch (error) {
        console.log(`Charts may not be loaded yet for ${viewport.name}`)
      }

      console.log(`Waveform visualization verified for ${viewport.name}`)
      await page.waitForTimeout(200)
    }
  })

  test('should handle touch interactions on mobile devices', async ({ page }) => {
    // Test on mobile viewports only
    const mobileViewports = viewports.filter(v => v.width <= 414)

    for (const viewport of mobileViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Test channel control touch interactions
      const channelControl = page.locator(testSelectors.channels.control(0))
      const frequencyInput = channelControl.locator(testSelectors.channels.frequencyInput)

      // Test tap to focus
      await frequencyInput.tap()
      await expect(frequencyInput).toBeFocused()

      // Test input with virtual keyboard
      await frequencyInput.fill('75')
      expect(await frequencyInput.inputValue()).toBe('75')

      // Test checkbox tap
      const polarityCheckbox = channelControl.locator(testSelectors.channels.polarityCheckbox)
      const initialChecked = await polarityCheckbox.isChecked()
      await polarityCheckbox.tap()
      expect(await polarityCheckbox.isChecked()).toBe(!initialChecked)

      // Test button tap
      const streamingButton = page.locator(testSelectors.streaming.button)
      await streamingButton.tap()

      // Wait for any state changes
      await page.waitForTimeout(500)

      console.log(`Touch interactions verified for ${viewport.name}`)
    }
  })

  test('should handle keyboard navigation on different screen sizes', async ({ page }) => {
    // Test on a representative set of viewports
    const testViewports = [
      viewports.find(v => v.name === 'iPhone 8')!,
      viewports.find(v => v.name === 'iPad Portrait')!,
      viewports.find(v => v.name === 'Desktop')!,
    ]

    for (const viewport of testViewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      await hapticPage.navigateToApp()

      // Start with first channel frequency input
      const firstChannelControl = page.locator(testSelectors.channels.control(0))
      const firstInput = firstChannelControl.locator(testSelectors.channels.frequencyInput)

      await firstInput.focus()
      await expect(firstInput).toBeFocused()

      // Tab through several inputs
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab')

        // Verify focus moves to a visible element
        const focusedElement = page.locator(':focus')
        await expect(focusedElement).toBeVisible()
      }

      // Test that Tab navigation doesn't get lost off-screen on mobile
      if (viewport.width <= 414) {
        const focusedElement = page.locator(':focus')
        const elementBox = await focusedElement.boundingBox()

        if (elementBox) {
          // Focused element should be within viewport bounds
          expect(elementBox.x).toBeGreaterThanOrEqual(-10) // Allow small margin
          expect(elementBox.y).toBeGreaterThanOrEqual(-10)
          expect(elementBox.x + elementBox.width).toBeLessThanOrEqual(viewport.width + 10)
        }
      }

      console.log(`Keyboard navigation verified for ${viewport.name}`)
      await page.waitForTimeout(200)
    }
  })

  test('should maintain accessibility on mobile devices', async ({ page }) => {
    // Test on mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await hapticPage.navigateToApp()

    // Verify semantic structure is maintained
    const main = page.locator('main')
    await expect(main).toBeVisible()

    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Verify form labels are associated with inputs
    const inputs = page.locator('input[type="number"]')
    const inputCount = await inputs.count()

    for (let i = 0; i < Math.min(inputCount, 4); i++) {
      const input = inputs.nth(i)

      // Check for label association (various methods)
      const hasLabel = await input.evaluate(el => {
        const inputEl = el as HTMLInputElement
        // Check for associated label
        if (inputEl.labels && inputEl.labels.length > 0) return true

        // Check for aria-label
        if (inputEl.getAttribute('aria-label')) return true

        // Check for aria-labelledby
        if (inputEl.getAttribute('aria-labelledby')) return true

        // Check for parent label
        const parentLabel = inputEl.closest('label')
        if (parentLabel) return true

        return false
      })

      expect(hasLabel).toBe(true)
    }

    // Verify color contrast is maintained (basic check)
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()

    if (buttonCount > 0) {
      const firstButton = buttons.first()
      const styles = await firstButton.evaluate(el => {
        const computed = window.getComputedStyle(el)
        return {
          backgroundColor: computed.backgroundColor,
          color: computed.color,
          fontSize: computed.fontSize,
        }
      })

      // Basic accessibility checks
      expect(styles.fontSize).not.toBe('') // Should have explicit font size
      expect(styles.color).not.toBe(styles.backgroundColor) // Different colors
    }
  })

  test('should handle orientation changes on mobile devices', async ({ page }) => {
    // Test orientation change from portrait to landscape
    const mobileViewport = { width: 375, height: 667 }
    const landscapeViewport = { width: 667, height: 375 }

    // Start in portrait
    await page.setViewportSize(mobileViewport)
    await hapticPage.navigateToApp()

    // Verify app works in portrait
    const controlPanel = page.locator(testSelectors.panels.controlPanel)
    await expect(controlPanel).toBeVisible()

    // Change to landscape
    await page.setViewportSize(landscapeViewport)
    await page.waitForTimeout(500) // Allow layout to adjust

    // Verify app still works in landscape
    await expect(controlPanel).toBeVisible()

    // Verify controls are still accessible
    const streamingButton = page.locator(testSelectors.streaming.button)
    await expect(streamingButton).toBeVisible()
    await expect(streamingButton).toBeEnabled()

    // Test interaction in landscape
    await streamingButton.tap()
    await page.waitForTimeout(500)

    console.log('Orientation change handling verified')
  })

  test('should handle zoom levels appropriately', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await hapticPage.navigateToApp()

    // Test different zoom levels (simulated with meta viewport)
    const zoomLevels = [0.5, 0.75, 1.0, 1.25, 1.5]

    for (const zoom of zoomLevels) {
      // Simulate zoom by adjusting the viewport meta tag
      await page.evaluate(zoomLevel => {
        const viewport = document.querySelector('meta[name="viewport"]')
        if (viewport) {
          viewport.setAttribute(
            'content',
            `width=device-width, initial-scale=${zoomLevel}, user-scalable=yes`
          )
        }
      }, zoom)

      await page.waitForTimeout(300)

      // Verify essential elements are still accessible
      const controlPanel = page.locator(testSelectors.panels.controlPanel)
      await expect(controlPanel).toBeVisible()

      const streamingButton = page.locator(testSelectors.streaming.button)
      await expect(streamingButton).toBeVisible()

      // At extreme zoom levels, check that elements don't break layout
      if (zoom >= 1.5) {
        // Verify no horizontal scrolling issues
        const body = page.locator('body')
        const bodyWidth = await body.evaluate(el => el.scrollWidth)
        const viewportWidth = await page.evaluate(() => window.innerWidth)

        // Allow some tolerance for zoom-related layout adjustments
        expect(bodyWidth).toBeLessThanOrEqual(viewportWidth * 1.1)
      }

      console.log(`Zoom level ${zoom} verified`)
    }
  })
})
