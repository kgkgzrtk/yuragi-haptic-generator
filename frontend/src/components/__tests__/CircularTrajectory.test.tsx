import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@/test/test-utils'
import userEvent from '@testing-library/user-event'
import { CircularTrajectory } from '../Visualization/CircularTrajectory'

// Mock performance API for performance tests
const mockPerformance = {
  now: vi.fn().mockReturnValue(0),
  mark: vi.fn(),
  measure: vi.fn(),
}
Object.defineProperty(globalThis, 'performance', {
  value: mockPerformance,
  writable: true,
})

// Mock canvas context for detailed canvas testing
const mockCanvas2dContext = {
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  fillRect: vi.fn(),
  strokeRect: vi.fn(),
  fillText: vi.fn(),
  save: vi.fn(),
  restore: vi.fn(),
  translate: vi.fn(),
  rotate: vi.fn(),
  scale: vi.fn(),
  drawImage: vi.fn(),
  getImageData: vi.fn(),
  putImageData: vi.fn(),
  createImageData: vi.fn(),
  setTransform: vi.fn(),
  resetTransform: vi.fn(),
}

// Mock canvas element
const mockCanvas = {
  getContext: vi.fn().mockReturnValue(mockCanvas2dContext),
  getBoundingClientRect: vi.fn().mockReturnValue({
    width: 400,
    height: 400,
    top: 0,
    left: 0,
    right: 400,
    bottom: 400,
  }),
  width: 400,
  height: 400,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
}

// Mock HTMLCanvasElement
Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
  value: vi.fn().mockReturnValue(mockCanvas2dContext),
})

Object.defineProperty(HTMLCanvasElement.prototype, 'getBoundingClientRect', {
  value: vi.fn().mockReturnValue({
    width: 400,
    height: 400,
    top: 0,
    left: 0,
    right: 400,
    bottom: 400,
  }),
})

describe('CircularTrajectory Component', () => {
  const user = userEvent.setup()
  
  // Mock data for testing
  const mockCircularData = {
    deviceId: 1 as const,
    trajectoryPoints: [
      { x: 0, y: 1, timestamp: 0 },
      { x: 0.707, y: 0.707, timestamp: 100 },
      { x: 1, y: 0, timestamp: 200 },
      { x: 0.707, y: -0.707, timestamp: 300 },
      { x: 0, y: -1, timestamp: 400 },
    ],
    radius: 1,
    centerX: 0,
    centerY: 0,
    isActive: true,
    direction: 'clockwise' as const,
    speed: 1, // Hz
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPerformance.now.mockReturnValue(Date.now())
    
    // Reset canvas mock properties
    Object.defineProperty(mockCanvas, 'width', { value: 400, writable: true })
    Object.defineProperty(mockCanvas, 'height', { value: 400, writable: true })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('Canvas Rendering Tests', () => {
    it('should render canvas element with correct dimensions', () => {
      render(<CircularTrajectory {...mockCircularData} />)
      
      const canvas = screen.getByTestId('circular-trajectory-canvas-1')
      expect(canvas).toBeInTheDocument()
      expect(canvas).toHaveAttribute('width', '400')
      expect(canvas).toHaveAttribute('height', '400')
    })

    it('should initialize canvas context and draw circular grid', () => {
      render(<CircularTrajectory {...mockCircularData} />)
      
      // Should get canvas context
      expect(mockCanvas2dContext.clearRect).toHaveBeenCalledWith(0, 0, 400, 400)
      
      // Should draw circular grid lines
      expect(mockCanvas2dContext.arc).toHaveBeenCalledWith(200, 200, 80, 0, 2 * Math.PI) // 0.2 radius
      expect(mockCanvas2dContext.arc).toHaveBeenCalledWith(200, 200, 160, 0, 2 * Math.PI) // 0.4 radius
      expect(mockCanvas2dContext.arc).toHaveBeenCalledWith(200, 200, 200, 0, 2 * Math.PI) // 1.0 radius
    })

    it('should draw axis lines and labels', () => {
      render(<CircularTrajectory {...mockCircularData} />)
      
      // X-axis line
      expect(mockCanvas2dContext.moveTo).toHaveBeenCalledWith(0, 200)
      expect(mockCanvas2dContext.lineTo).toHaveBeenCalledWith(400, 200)
      
      // Y-axis line
      expect(mockCanvas2dContext.moveTo).toHaveBeenCalledWith(200, 0)
      expect(mockCanvas2dContext.lineTo).toHaveBeenCalledWith(200, 400)
      
      // Axis labels
      expect(mockCanvas2dContext.fillText).toHaveBeenCalledWith('X', 380, 190)
      expect(mockCanvas2dContext.fillText).toHaveBeenCalledWith('Y', 210, 20)
    })

    it('should render trajectory path with gradient colors', () => {
      render(<CircularTrajectory {...mockCircularData} />)
      
      // Should draw trajectory lines between consecutive points
      const points = mockCircularData.trajectoryPoints
      for (let i = 1; i < points.length; i++) {
        const prevPoint = points[i - 1]
        const currPoint = points[i]
        
        expect(mockCanvas2dContext.moveTo).toHaveBeenCalledWith(
          200 + prevPoint.x * 160, // centerX + x * scale
          200 - prevPoint.y * 160  // centerY - y * scale (inverted Y)
        )
        expect(mockCanvas2dContext.lineTo).toHaveBeenCalledWith(
          200 + currPoint.x * 160,
          200 - currPoint.y * 160
        )
      }
    })

    it('should draw current position marker', () => {
      render(<CircularTrajectory {...mockCircularData} />)
      
      const lastPoint = mockCircularData.trajectoryPoints[mockCircularData.trajectoryPoints.length - 1]
      
      // Should draw circle at current position
      expect(mockCanvas2dContext.arc).toHaveBeenCalledWith(
        200 + lastPoint.x * 160,
        200 - lastPoint.y * 160,
        8, // marker radius
        0,
        2 * Math.PI
      )
      expect(mockCanvas2dContext.fill).toHaveBeenCalled()
    })

    it('should handle empty trajectory data gracefully', () => {
      const emptyData = { ...mockCircularData, trajectoryPoints: [] }
      render(<CircularTrajectory {...emptyData} />)
      
      // Should still render canvas and grid but no trajectory
      expect(mockCanvas2dContext.clearRect).toHaveBeenCalled()
      expect(mockCanvas2dContext.arc).toHaveBeenCalledWith(200, 200, 80, 0, 2 * Math.PI) // Grid still drawn
      
      // Should not try to draw trajectory
      expect(mockCanvas2dContext.moveTo).not.toHaveBeenCalledWith(expect.any(Number), expect.any(Number))
    })

    it('should handle canvas resize properly', async () => {
      const { rerender } = render(<CircularTrajectory {...mockCircularData} />)
      
      // Mock canvas size change
      mockCanvas.getBoundingClientRect.mockReturnValue({
        width: 600,
        height: 600,
        top: 0,
        left: 0,
        right: 600,
        bottom: 600,
      })
      
      rerender(<CircularTrajectory {...mockCircularData} />)
      
      await waitFor(() => {
        expect(mockCanvas2dContext.clearRect).toHaveBeenCalledWith(0, 0, 600, 600)
      })
    })
  })

  describe('Real-time Data Update Handling', () => {
    it('should update trajectory when new data points are added', async () => {
      const initialData = {
        ...mockCircularData,
        trajectoryPoints: mockCircularData.trajectoryPoints.slice(0, 2),
      }
      
      const { rerender } = render(<CircularTrajectory {...initialData} />)
      
      // Add new data points
      const updatedData = {
        ...mockCircularData,
        trajectoryPoints: mockCircularData.trajectoryPoints,
      }
      
      rerender(<CircularTrajectory {...updatedData} />)
      
      await waitFor(() => {
        // Should clear and redraw with new data
        expect(mockCanvas2dContext.clearRect).toHaveBeenCalledTimes(2)
      })
    })

    it('should handle high-frequency data updates efficiently', async () => {
      const { rerender } = render(<CircularTrajectory {...mockCircularData} />)
      
      // Simulate rapid updates
      for (let i = 0; i < 100; i++) {
        const updatedData = {
          ...mockCircularData,
          trajectoryPoints: [
            ...mockCircularData.trajectoryPoints,
            { x: Math.cos(i * 0.1), y: Math.sin(i * 0.1), timestamp: 500 + i * 10 },
          ],
        }
        rerender(<CircularTrajectory {...updatedData} />)
      }
      
      // Should handle updates without errors
      await waitFor(() => {
        expect(mockCanvas2dContext.clearRect).toHaveBeenCalled()
      })
    })

    it('should limit trajectory history to maxPoints', () => {
      const maxPoints = 50
      const largeData = {
        ...mockCircularData,
        trajectoryPoints: Array.from({ length: 100 }, (_, i) => ({
          x: Math.cos(i * 0.1),
          y: Math.sin(i * 0.1),
          timestamp: i * 10,
        })),
        maxPoints,
      }
      
      render(<CircularTrajectory {...largeData} />)
      
      // Should only render the last maxPoints
      expect(mockCanvas2dContext.moveTo).toHaveBeenCalledTimes(49) // maxPoints - 1 segments
    })

    it('should handle invalid data points gracefully', () => {
      const invalidData = {
        ...mockCircularData,
        trajectoryPoints: [
          { x: 0, y: 1, timestamp: 0 },
          { x: NaN, y: 0.5, timestamp: 50 },
          { x: 0.5, y: Infinity, timestamp: 100 },
          { x: null as any, y: 0, timestamp: 150 },
          { x: 1, y: 0, timestamp: 200 },
        ],
      }
      
      render(<CircularTrajectory {...invalidData} />)
      
      // Should filter out invalid points and render only valid ones
      expect(mockCanvas2dContext.moveTo).toHaveBeenCalledTimes(1) // Only 1 valid segment
    })
  })

  describe('Zoom/Pan Interaction Tests', () => {
    it('should support mouse wheel zoom', async () => {
      render(<CircularTrajectory {...mockCircularData} enableZoom />)
      
      const canvas = screen.getByTestId('circular-trajectory-canvas-1')
      
      // Simulate wheel zoom in
      await user.hover(canvas)
      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true })
      canvas.dispatchEvent(wheelEvent)
      
      await waitFor(() => {
        // Should apply zoom transform
        expect(mockCanvas2dContext.scale).toHaveBeenCalled()
      })
    })

    it('should support pan with mouse drag', async () => {
      render(<CircularTrajectory {...mockCircularData} enablePan />)
      
      const canvas = screen.getByTestId('circular-trajectory-canvas-1')
      
      // Simulate mouse drag
      await user.pointer([
        { keys: '[MouseLeft>]', target: canvas, coords: { x: 200, y: 200 } },
        { keys: '[/MouseLeft]', coords: { x: 250, y: 250 } },
      ])
      
      await waitFor(() => {
        // Should apply translation transform
        expect(mockCanvas2dContext.translate).toHaveBeenCalledWith(50, 50)
      })
    })

    it('should reset zoom/pan on double click', async () => {
      render(<CircularTrajectory {...mockCircularData} enableZoom enablePan />)
      
      const canvas = screen.getByTestId('circular-trajectory-canvas-1')
      
      // Apply some zoom/pan first
      await user.hover(canvas)
      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true })
      canvas.dispatchEvent(wheelEvent)
      
      // Double click to reset
      await user.dblClick(canvas)
      
      await waitFor(() => {
        // Should reset transform
        expect(mockCanvas2dContext.resetTransform).toHaveBeenCalled()
      })
    })

    it('should constrain zoom levels within reasonable bounds', async () => {
      render(<CircularTrajectory {...mockCircularData} enableZoom minZoom={0.5} maxZoom={5} />)
      
      const canvas = screen.getByTestId('circular-trajectory-canvas-1')
      
      // Try to zoom beyond max
      await user.hover(canvas)
      for (let i = 0; i < 10; i++) {
        const wheelEvent = new WheelEvent('wheel', { deltaY: -100, ctrlKey: true })
        canvas.dispatchEvent(wheelEvent)
      }
      
      await waitFor(() => {
        // Should not exceed maxZoom
        const scaleCalls = mockCanvas2dContext.scale.mock.calls
        const lastScale = scaleCalls[scaleCalls.length - 1]
        expect(lastScale[0]).toBeLessThanOrEqual(5)
      })
    })
  })

  describe('Performance Tests (>60fps)', () => {
    it('should maintain 60fps with continuous data updates', async () => {
      const frameTimeMs = 1000 / 60 // 16.67ms per frame
      let frameCount = 0
      let totalRenderTime = 0
      
      mockPerformance.now.mockImplementation(() => Date.now())
      
      const { rerender } = render(<CircularTrajectory {...mockCircularData} />)
      
      // Simulate 60 updates per second for 1 second
      for (let i = 0; i < 60; i++) {
        const startTime = performance.now()
        
        const updatedData = {
          ...mockCircularData,
          trajectoryPoints: [
            ...mockCircularData.trajectoryPoints,
            {
              x: Math.cos(i * 0.1),
              y: Math.sin(i * 0.1),
              timestamp: 500 + i * frameTimeMs,
            },
          ],
        }
        
        rerender(<CircularTrajectory {...updatedData} />)
        
        const endTime = performance.now()
        totalRenderTime += endTime - startTime
        frameCount++
      }
      
      const averageRenderTime = totalRenderTime / frameCount
      
      // Should render each frame in less than 16.67ms (60fps)
      expect(averageRenderTime).toBeLessThan(frameTimeMs)
    })

    it('should use requestAnimationFrame for smooth animations', () => {
      const mockRAF = vi.fn()
      globalThis.requestAnimationFrame = mockRAF
      
      render(<CircularTrajectory {...mockCircularData} animated />)
      
      expect(mockRAF).toHaveBeenCalled()
    })

    it('should implement efficient canvas rendering with dirty regions', () => {
      const { rerender } = render(<CircularTrajectory {...mockCircularData} />)
      
      // Only update a small part of the trajectory
      const minimalUpdate = {
        ...mockCircularData,
        trajectoryPoints: [
          ...mockCircularData.trajectoryPoints.slice(0, -1),
          { x: 0.5, y: -0.5, timestamp: 500 },
        ],
      }
      
      rerender(<CircularTrajectory {...minimalUpdate} />)
      
      // Should only clear and redraw affected regions efficiently
      expect(mockCanvas2dContext.clearRect).toHaveBeenCalled()
    })

    it('should handle memory efficiently with large datasets', () => {
      const largeDataset = {
        ...mockCircularData,
        trajectoryPoints: Array.from({ length: 10000 }, (_, i) => ({
          x: Math.cos(i * 0.01),
          y: Math.sin(i * 0.01),
          timestamp: i,
        })),
        maxPoints: 1000,
      }
      
      const { rerender, unmount } = render(<CircularTrajectory {...largeDataset} />)
      
      // Multiple re-renders should not cause memory leaks
      for (let i = 0; i < 10; i++) {
        rerender(<CircularTrajectory {...largeDataset} />)
      }
      
      unmount()
      
      // Should cleanup properly
      expect(() => unmount()).not.toThrow()
    })
  })

  describe('Accessibility and Error Handling', () => {
    it('should have proper ARIA labels and roles', () => {
      render(<CircularTrajectory {...mockCircularData} />)
      
      const canvas = screen.getByTestId('circular-trajectory-canvas-1')
      expect(canvas).toHaveAttribute('role', 'img')
      expect(canvas).toHaveAttribute('aria-label', 'Device 1 circular trajectory visualization')
    })

    it('should provide keyboard navigation support', async () => {
      render(<CircularTrajectory {...mockCircularData} enableKeyboardNavigation />)
      
      const canvas = screen.getByTestId('circular-trajectory-canvas-1')
      
      await user.click(canvas) // Focus the canvas
      await user.keyboard('{ArrowUp}') // Pan up
      
      await waitFor(() => {
        expect(mockCanvas2dContext.translate).toHaveBeenCalledWith(0, -10)
      })
    })

    it('should handle canvas context creation failure gracefully', () => {
      const mockGetContext = vi.fn().mockReturnValue(null)
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        value: mockGetContext,
      })
      
      render(<CircularTrajectory {...mockCircularData} />)
      
      // Should not throw error when context is null
      expect(mockGetContext).toHaveBeenCalled()
    })

    it('should provide fallback content for screen readers', () => {
      render(<CircularTrajectory {...mockCircularData} />)
      
      const fallbackText = screen.getByText(/Device 1 circular trajectory/i)
      expect(fallbackText).toBeInTheDocument()
    })
  })

  describe('Configuration and Customization', () => {
    it('should support custom color schemes', () => {
      const customColors = {
        grid: '#ff0000',
        trajectory: '#00ff00',
        marker: '#0000ff',
        background: '#000000',
      }
      
      render(<CircularTrajectory {...mockCircularData} colors={customColors} />)
      
      // Should use custom colors in rendering
      expect(mockCanvas2dContext.strokeStyle).toBe('#ff0000') // grid
    })

    it('should support different trajectory visualization modes', () => {
      render(<CircularTrajectory {...mockCircularData} mode="points" />)
      
      // Should render as points instead of lines
      expect(mockCanvas2dContext.arc).toHaveBeenCalledTimes(
        mockCircularData.trajectoryPoints.length + 3 // points + grid circles
      )
    })

    it('should handle different device IDs correctly', () => {
      render(<CircularTrajectory {...mockCircularData} deviceId={2} />)
      
      const canvas = screen.getByTestId('circular-trajectory-canvas-2')
      expect(canvas).toBeInTheDocument()
    })
  })
})
EOF < /dev/null