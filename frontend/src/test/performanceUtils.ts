import { vi } from 'vitest'

/**
 * Performance measurement utilities for testing
 */

export interface PerformanceMetrics {
  executionTime: number
  memoryUsage?: {
    heapUsed: number
    heapTotal: number
    external: number
  }
  frameRate?: number
  renderCount?: number
}

export class PerformanceMeasurement {
  private startTime: number = 0
  private endTime: number = 0
  private frameCount: number = 0
  private renderCount: number = 0
  private frameStartTime: number = 0
  private initialMemory?: NodeJS.MemoryUsage

  constructor() {
    this.reset()
  }

  start(): void {
    this.startTime = performance.now()
    this.initialMemory = process.memoryUsage?.() || undefined
    this.frameCount = 0
    this.renderCount = 0
    this.frameStartTime = this.startTime
  }

  end(): PerformanceMetrics {
    this.endTime = performance.now()
    const executionTime = this.endTime - this.startTime
    
    const finalMemory = process.memoryUsage?.()
    let memoryUsage
    
    if (this.initialMemory && finalMemory) {
      memoryUsage = {
        heapUsed: finalMemory.heapUsed - this.initialMemory.heapUsed,
        heapTotal: finalMemory.heapTotal - this.initialMemory.heapTotal,
        external: finalMemory.external - this.initialMemory.external,
      }
    }

    const frameRate = this.frameCount > 0 ? (this.frameCount * 1000) / executionTime : 0

    return {
      executionTime,
      memoryUsage,
      frameRate,
      renderCount: this.renderCount,
    }
  }

  markFrame(): void {
    this.frameCount++
  }

  markRender(): void {
    this.renderCount++
  }

  reset(): void {
    this.startTime = 0
    this.endTime = 0
    this.frameCount = 0
    this.renderCount = 0
    this.frameStartTime = 0
    this.initialMemory = undefined
  }

  getCurrentFrameRate(): number {
    const now = performance.now()
    const elapsed = now - this.frameStartTime
    return elapsed > 0 ? (this.frameCount * 1000) / elapsed : 0
  }
}

/**
 * Test utility for measuring component render performance
 */
export function measureRenderPerformance<T>(
  renderFunction: () => T,
  iterations: number = 100
): PerformanceMetrics & { averageRenderTime: number } {
  const measurement = new PerformanceMeasurement()
  const renderTimes: number[] = []

  measurement.start()

  for (let i = 0; i < iterations; i++) {
    const renderStart = performance.now()
    renderFunction()
    const renderEnd = performance.now()
    
    renderTimes.push(renderEnd - renderStart)
    measurement.markRender()
  }

  const metrics = measurement.end()
  const averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length

  return {
    ...metrics,
    averageRenderTime,
  }
}

/**
 * Test utility for measuring animation performance (60fps target)
 */
export function measureAnimationPerformance(
  animationCallback: (time: number, frameIndex: number) => void,
  durationMs: number = 1000
): PerformanceMetrics & { droppedFrames: number; averageFrameTime: number } {
  const measurement = new PerformanceMeasurement()
  const targetFrameRate = 60
  const frameInterval = 1000 / targetFrameRate
  const totalFrames = Math.floor(durationMs / frameInterval)
  
  const frameTimes: number[] = []
  let droppedFrames = 0

  measurement.start()

  for (let i = 0; i < totalFrames; i++) {
    const frameStart = performance.now()
    const time = i * frameInterval
    
    try {
      animationCallback(time, i)
      measurement.markFrame()
    } catch (error) {
      // Count as dropped frame
      droppedFrames++
    }

    const frameEnd = performance.now()
    const frameTime = frameEnd - frameStart
    frameTimes.push(frameTime)

    // Check if frame exceeded budget
    if (frameTime > frameInterval) {
      droppedFrames++
    }
  }

  const metrics = measurement.end()
  const averageFrameTime = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length

  return {
    ...metrics,
    droppedFrames,
    averageFrameTime,
  }
}

/**
 * Test utility for stress testing with increasing load
 */
export function measureStressPerformance<T>(
  testFunction: (loadFactor: number) => T,
  maxLoad: number = 1000,
  steps: number = 10
): Array<{ load: number; metrics: PerformanceMetrics }> {
  const results: Array<{ load: number; metrics: PerformanceMetrics }> = []
  
  for (let i = 1; i <= steps; i++) {
    const load = Math.floor((i / steps) * maxLoad)
    const measurement = new PerformanceMeasurement()
    
    measurement.start()
    
    try {
      testFunction(load)
    } catch (error) {
      console.warn(`Stress test failed at load ${load}:`, error)
    }
    
    const metrics = measurement.end()
    results.push({ load, metrics })
  }

  return results
}

/**
 * Performance assertion helpers
 */
export const performanceAssertions = {
  /**
   * Assert that execution time is within acceptable range
   */
  expectExecutionTime(metrics: PerformanceMetrics, maxTimeMs: number): void {
    expect(metrics.executionTime).toBeLessThan(maxTimeMs)
  },

  /**
   * Assert that frame rate meets minimum requirement
   */
  expectFrameRate(metrics: PerformanceMetrics, minFps: number): void {
    if (metrics.frameRate \!== undefined) {
      expect(metrics.frameRate).toBeGreaterThanOrEqual(minFps)
    }
  },

  /**
   * Assert that memory usage is within acceptable range
   */
  expectMemoryUsage(metrics: PerformanceMetrics, maxMemoryMB: number): void {
    if (metrics.memoryUsage?.heapUsed \!== undefined) {
      const memoryMB = metrics.memoryUsage.heapUsed / (1024 * 1024)
      expect(memoryMB).toBeLessThan(maxMemoryMB)
    }
  },

  /**
   * Assert that render count is reasonable
   */
  expectRenderCount(metrics: PerformanceMetrics, maxRenders: number): void {
    if (metrics.renderCount \!== undefined) {
      expect(metrics.renderCount).toBeLessThanOrEqual(maxRenders)
    }
  },
}

/**
 * Mock high-resolution timer for consistent testing
 */
export function createMockPerformanceTimer() {
  let currentTime = 0
  
  const mockPerformance = {
    now: vi.fn(() => currentTime),
    mark: vi.fn(),
    measure: vi.fn(),
    setTime: (time: number) => {
      currentTime = time
    },
    advanceTime: (deltaMs: number) => {
      currentTime += deltaMs
    },
  }

  Object.defineProperty(globalThis, 'performance', {
    value: mockPerformance,
    writable: true,
  })

  return mockPerformance
}

/**
 * Canvas performance testing utilities
 */
export const canvasPerformanceUtils = {
  /**
   * Measure canvas drawing operations performance
   */
  measureDrawingPerformance(
    canvas: HTMLCanvasElement,
    drawingFunction: (ctx: CanvasRenderingContext2D) => void,
    iterations: number = 100
  ): PerformanceMetrics {
    const ctx = canvas.getContext('2d')\!
    const measurement = new PerformanceMeasurement()
    
    measurement.start()
    
    for (let i = 0; i < iterations; i++) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      drawingFunction(ctx)
      measurement.markRender()
    }
    
    return measurement.end()
  },

  /**
   * Create mock canvas with performance tracking
   */
  createMockCanvasWithTracking() {
    const operations: string[] = []
    
    const mockContext = {
      clearRect: vi.fn((...args) => operations.push('clearRect')),
      beginPath: vi.fn((...args) => operations.push('beginPath')),
      moveTo: vi.fn((...args) => operations.push('moveTo')),
      lineTo: vi.fn((...args) => operations.push('lineTo')),
      arc: vi.fn((...args) => operations.push('arc')),
      stroke: vi.fn((...args) => operations.push('stroke')),
      fill: vi.fn((...args) => operations.push('fill')),
      fillRect: vi.fn((...args) => operations.push('fillRect')),
      strokeRect: vi.fn((...args) => operations.push('strokeRect')),
      fillText: vi.fn((...args) => operations.push('fillText')),
      save: vi.fn((...args) => operations.push('save')),
      restore: vi.fn((...args) => operations.push('restore')),
      translate: vi.fn((...args) => operations.push('translate')),
      rotate: vi.fn((...args) => operations.push('rotate')),
      scale: vi.fn((...args) => operations.push('scale')),
      getOperations: () => [...operations],
      clearOperations: () => operations.length = 0,
    }

    const mockCanvas = {
      getContext: vi.fn(() => mockContext),
      getBoundingClientRect: vi.fn(() => ({
        width: 400,
        height: 400,
        top: 0,
        left: 0,
        right: 400,
        bottom: 400,
      })),
      width: 400,
      height: 400,
    }

    return { mockCanvas, mockContext }
  },
}

/**
 * WebSocket performance testing utilities
 */
export const webSocketPerformanceUtils = {
  /**
   * Measure WebSocket message throughput
   */
  measureMessageThroughput(
    mockWebSocket: any,
    messageCount: number,
    messageSize: number = 1024
  ): PerformanceMetrics {
    const measurement = new PerformanceMeasurement()
    const message = 'x'.repeat(messageSize)
    
    measurement.start()
    
    for (let i = 0; i < messageCount; i++) {
      try {
        mockWebSocket.send(JSON.stringify({ id: i, data: message }))
      } catch (error) {
        // Count as failed send
      }
    }
    
    return measurement.end()
  },

  /**
   * Simulate network latency in WebSocket mock
   */
  addLatencyToWebSocketMock(mockWebSocket: any, latencyMs: number) {
    const originalSend = mockWebSocket.send
    
    mockWebSocket.send = vi.fn(async (data: string) => {
      await new Promise(resolve => setTimeout(resolve, latencyMs))
      return originalSend.call(mockWebSocket, data)
    })
    
    const originalOnMessage = mockWebSocket.onmessage
    
    mockWebSocket.simulateMessage = (data: any) => {
      setTimeout(() => {
        const event = new MessageEvent('message', { data: JSON.stringify(data) })
        originalOnMessage?.(event)
      }, latencyMs)
    }
  },
}

/**
 * State management performance utilities
 */
export const statePerformanceUtils = {
  /**
   * Measure state update performance
   */
  measureStateUpdates<T>(
    stateUpdater: () => T,
    updateCount: number
  ): PerformanceMetrics {
    const measurement = new PerformanceMeasurement()
    
    measurement.start()
    
    for (let i = 0; i < updateCount; i++) {
      stateUpdater()
      measurement.markRender()
    }
    
    return measurement.end()
  },

  /**
   * Measure state selector performance
   */
  measureStateSelectors<T>(
    selector: () => T,
    selectionCount: number
  ): PerformanceMetrics {
    const measurement = new PerformanceMeasurement()
    
    measurement.start()
    
    for (let i = 0; i < selectionCount; i++) {
      selector()
    }
    
    return measurement.end()
  },
}

export default {
  PerformanceMeasurement,
  measureRenderPerformance,
  measureAnimationPerformance,
  measureStressPerformance,
  performanceAssertions,
  createMockPerformanceTimer,
  canvasPerformanceUtils,
  webSocketPerformanceUtils,
  statePerformanceUtils,
}
