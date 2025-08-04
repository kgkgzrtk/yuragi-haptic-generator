import type { IWSMessage } from '@/types/hapticTypes'
import { WSMessageType } from '@/types/hapticTypes'

// Mock WebSocket implementation for testing
export class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  CONNECTING = 0
  OPEN = 1
  CLOSING = 2
  CLOSED = 3

  url: string
  readyState: number = MockWebSocket.CONNECTING
  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  private eventListeners: { [key: string]: ((event: any) => void)[] } = {}

  constructor(url: string) {
    this.url = url

    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      this.triggerEvent('open', new Event('open'))
    }, 0)
  }

  send = vi.fn((_data: string) => {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    // Could emit a mock response here if needed
  })

  close = vi.fn((code?: number, reason?: string) => {
    this.readyState = MockWebSocket.CLOSING
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED
      const closeEvent = new CloseEvent('close', { code: code || 1000, reason: reason || '' })
      this.triggerEvent('close', closeEvent)
    }, 0)
  })

  addEventListener = vi.fn((type: string, listener: (event: any) => void) => {
    if (!this.eventListeners[type]) {
      this.eventListeners[type] = []
    }
    this.eventListeners[type].push(listener)
  })

  removeEventListener = vi.fn((type: string, listener: (event: any) => void) => {
    if (this.eventListeners[type]) {
      const index = this.eventListeners[type].indexOf(listener)
      if (index > -1) {
        this.eventListeners[type].splice(index, 1)
      }
    }
  })

  // Test utilities
  triggerEvent(type: string, event: any) {
    // Call direct event handler
    switch (type) {
      case 'open':
        this.onopen?.(event)
        break
      case 'close':
        this.onclose?.(event)
        break
      case 'message':
        this.onmessage?.(event)
        break
      case 'error':
        this.onerror?.(event)
        break
    }

    // Call addEventListener listeners
    if (this.eventListeners[type]) {
      this.eventListeners[type].forEach(listener => listener(event))
    }
  }

  triggerMessage(message: IWSMessage) {
    const messageEvent = new MessageEvent('message', {
      data: JSON.stringify(message),
    })
    this.triggerEvent('message', messageEvent)
  }

  triggerError(_error?: string) {
    const errorEvent = new Event('error')
    this.triggerEvent('error', errorEvent)
  }

  triggerClose(code: number = 1000, reason: string = '') {
    this.readyState = MockWebSocket.CLOSED
    const closeEvent = new CloseEvent('close', { code, reason })
    this.triggerEvent('close', closeEvent)
  }

  // Helper methods for common test scenarios
  simulateConnection() {
    this.readyState = MockWebSocket.OPEN
    this.triggerEvent('open', new Event('open'))
  }

  simulateDisconnection(code: number = 1000, reason: string = '') {
    this.readyState = MockWebSocket.CLOSED
    this.triggerEvent('close', new CloseEvent('close', { code, reason }))
  }

  simulateError() {
    this.triggerEvent('error', new Event('error'))
  }

  simulateParametersUpdate(channels: any) {
    this.triggerMessage({
      type: WSMessageType.PARAMETERS_UPDATE,
      data: channels,
      timestamp: new Date().toISOString(),
    })
  }

  simulateStatusUpdate(status: any) {
    this.triggerMessage({
      type: WSMessageType.STATUS_UPDATE,
      data: status,
      timestamp: new Date().toISOString(),
    })
  }

  simulateWaveformData(waveformData: any) {
    this.triggerMessage({
      type: WSMessageType.WAVEFORM_DATA,
      data: waveformData,
      timestamp: new Date().toISOString(),
    })
  }

  simulateErrorMessage(error: string) {
    this.triggerMessage({
      type: WSMessageType.ERROR,
      data: error,
      timestamp: new Date().toISOString(),
    })
  }
}

// Global WebSocket mock setup
export const setupWebSocketMock = () => {
  const instances: MockWebSocket[] = []

  global.WebSocket = vi.fn().mockImplementation((url: string) => {
    const instance = new MockWebSocket(url)
    instances.push(instance)
    return instance
  }) as any

  // Add static constants to the mock constructor
  Object.assign(global.WebSocket, {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
  })

  return {
    instances,
    getLastInstance: () => instances[instances.length - 1],
    getAllInstances: () => instances,
    clearInstances: () => (instances.length = 0),
  }
}

// WebSocket test helpers
export const websocketTestHelpers = {
  createMockMessage: (type: WSMessageType, data: any): IWSMessage => ({
    type,
    data,
    timestamp: new Date().toISOString(),
  }),

  createParametersUpdateMessage: (channels: any) =>
    websocketTestHelpers.createMockMessage(WSMessageType.PARAMETERS_UPDATE, channels),

  createStatusUpdateMessage: (status: any) =>
    websocketTestHelpers.createMockMessage(WSMessageType.STATUS_UPDATE, status),

  createWaveformDataMessage: (waveformData: any) =>
    websocketTestHelpers.createMockMessage(WSMessageType.WAVEFORM_DATA, waveformData),

  createErrorMessage: (error: string) =>
    websocketTestHelpers.createMockMessage(WSMessageType.ERROR, error),
}

export default MockWebSocket
