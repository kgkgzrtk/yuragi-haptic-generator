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

export { MockWebSocket, setupWebSocketMock, websocketTestHelpers } from './websocket'

// Common mock setups for different testing scenarios
export const setupAllMocks = () => {
  const chartMocks = setupChartJSMocks()
  const webSocketMocks = setupWebSocketMock()

  return {
    chart: chartMocks,
    webSocket: webSocketMocks,
  }
}

// Clean up all mocks
export const cleanupAllMocks = () => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
  vi.resetAllMocks()
}
