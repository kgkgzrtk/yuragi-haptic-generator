// Re-export all mocks for easy importing in tests

export {
  mockHapticService,
  mockParametersResponse,
  mockStatusResponse,
  mockWaveformData,
  mockVectorForce,
  mockApiResponses,
  setupMockScenarios,
} from './hapticService'

export { mockChart, MockChart, mockChartJS, mockReactChartJS2, setupChartJSMocks } from './chartjs'

// Common mock setups for different testing scenarios
export const setupAllMocks = () => {
  const chartMocks = setupChartJSMocks()

  return {
    chart: chartMocks,
  }
}

// Clean up all mocks
export const cleanupAllMocks = () => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.resetAllMocks()
}

// Export WebSocket mocking utilities
export {
  MockWebSocket,
  WebSocketServiceMock,
  setupGlobalWebSocketMock,
  restoreWebSocket,
  hapticMessageTypes,
  webSocketTestScenarios,
} from './websocketMocks'

// Export performance utilities (not a mock but commonly used with mocks)
export * from '../performanceUtils'

// Enhanced mock setup for massage functionality
export const setupMassageMocks = () => {
  const chartMocks = setupChartJSMocks()
  const webSocketMock = setupGlobalWebSocketMock({
    autoConnect: true,
    connectionDelay: 10,
    messageDelay: 5,
  })

  return {
    chart: chartMocks,
    webSocket: webSocketMock,
  }
}

// Cleanup all enhanced mocks
export const cleanupMassageMocks = () => {
  cleanupAllMocks()
  restoreWebSocket()
}

// Common test scenarios for massage functionality
export const massageTestScenarios = {
  // Simulate realistic massage pattern playback
  massagePatternPlayback: (webSocketMock: WebSocketServiceMock) => {
    const patterns = [
      { id: 'gentle', duration: 60000, intensity: 0.3 },
      { id: 'medium', duration: 120000, intensity: 0.6 },
      { id: 'strong', duration: 180000, intensity: 0.9 },
    ]

    return {
      startPattern: (patternId: string) => {
        const pattern = patterns.find(p => p.id === patternId)
        if (pattern) {
          webSocketMock.broadcastMessage(hapticMessageTypes.massagePatternUpdate(pattern))
        }
      },
      
      simulateProgress: (elapsedTime: number, totalTime: number) => {
        const progress = Math.min(elapsedTime / totalTime, 1)
        webSocketMock.broadcastMessage({
          type: 'pattern_progress',
          data: { elapsedTime, totalTime, progress },
        })
      },
    }
  },

  // Simulate circular trajectory data stream
  circularTrajectoryStream: (webSocketMock: WebSocketServiceMock, radius: number = 0.5, frequency: number = 1) => {
    let angle = 0
    
    return setInterval(() => {
      const x = Math.cos(angle) * radius
      const y = Math.sin(angle) * radius
      
      webSocketMock.broadcastMessage(hapticMessageTypes.circularTrajectoryData([
        { x, y, timestamp: Date.now() }
      ]))
      
      angle += frequency * 0.1 // Increment based on frequency
      if (angle >= 2 * Math.PI) angle = 0
    }, 16) // ~60fps
  },
}