import { vi } from 'vitest'

/**
 * Comprehensive WebSocket mocking utilities for testing
 */

export interface MockWebSocketMessage {
  type: string
  data?: any
  timestamp?: number
}

export interface MockWebSocketOptions {
  url?: string
  protocols?: string | string[]
  autoConnect?: boolean
  connectionDelay?: number
  maxReconnectAttempts?: number
  reconnectDelay?: number
  messageDelay?: number
  simulateErrors?: boolean
  errorRate?: number
}

export class MockWebSocket implements WebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3

  readonly CONNECTING = 0
  readonly OPEN = 1
  readonly CLOSING = 2
  readonly CLOSED = 3

  public readyState: number = WebSocket.CONNECTING
  public readonly url: string
  public readonly protocol: string
  public binaryType: BinaryType = 'blob'
  public bufferedAmount: number = 0
  public extensions: string = ''

  public onopen: ((event: Event) => void) | null = null
  public onclose: ((event: CloseEvent) => void) | null = null
  public onmessage: ((event: MessageEvent) => void) | null = null
  public onerror: ((event: Event) => void) | null = null

  private eventListeners: Map<string, Set<EventListener>> = new Map()
  private messageQueue: MockWebSocketMessage[] = []
  private sentMessages: any[] = []
  private connectionTimeout?: NodeJS.Timeout
  private options: MockWebSocketOptions
  private isDestroyed = false

  constructor(url: string, protocols?: string | string[], options: MockWebSocketOptions = {}) {
    this.url = url
    this.protocol = Array.isArray(protocols) ? protocols[0] || '' : protocols || ''
    this.options = {
      autoConnect: true,
      connectionDelay: 10,
      maxReconnectAttempts: 3,
      reconnectDelay: 1000,
      messageDelay: 0,
      simulateErrors: false,
      errorRate: 0.1,
      ...options,
    }

    if (this.options.autoConnect) {
      this.scheduleConnection()
    }
  }

  private scheduleConnection(): void {
    if (this.isDestroyed) return

    this.connectionTimeout = setTimeout(() => {
      if (this.isDestroyed) return
      
      if (this.options.simulateErrors && Math.random() < this.options.errorRate\!) {
        this.simulateConnectionError()
      } else {
        this.simulateConnectionSuccess()
      }
    }, this.options.connectionDelay)
  }

  private simulateConnectionSuccess(): void {
    if (this.isDestroyed) return
    
    this.readyState = WebSocket.OPEN
    const event = new Event('open')
    this.onopen?.(event)
    this.dispatchEvent(event)
    
    // Send any queued messages
    this.flushMessageQueue()
  }

  private simulateConnectionError(): void {
    if (this.isDestroyed) return
    
    this.readyState = WebSocket.CLOSED
    const event = new Event('error')
    this.onerror?.(event)
    this.dispatchEvent(event)
    
    const closeEvent = new CloseEvent('close', { 
      code: 1006, 
      reason: 'Connection failed',
      wasClean: false,
    })
    this.onclose?.(closeEvent)
    this.dispatchEvent(closeEvent)
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift()\!
      this.sendToClient(message)
    }
  }

  private sendToClient(message: MockWebSocketMessage): void {
    if (this.readyState \!== WebSocket.OPEN || this.isDestroyed) return

    const delay = this.options.messageDelay || 0
    const sendMessage = () => {
      if (this.isDestroyed) return
      
      const event = new MessageEvent('message', {
        data: JSON.stringify(message),
        origin: this.url,
        lastEventId: '',
        source: null,
        ports: [],
      })
      
      this.onmessage?.(event)
      this.dispatchEvent(event)
    }

    if (delay > 0) {
      setTimeout(sendMessage, delay)
    } else {
      sendMessage()
    }
  }

  // WebSocket interface methods
  send = vi.fn((data: string | ArrayBufferLike | Blob | ArrayBufferView): void => {
    if (this.readyState \!== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }

    if (this.options.simulateErrors && Math.random() < this.options.errorRate\!) {
      throw new Error('Simulated network error')
    }

    let parsedData
    try {
      parsedData = typeof data === 'string' ? JSON.parse(data) : data
    } catch {
      parsedData = data
    }

    this.sentMessages.push(parsedData)
  })

  close = vi.fn((code: number = 1000, reason: string = ''): void => {
    if (this.readyState === WebSocket.CLOSED || this.readyState === WebSocket.CLOSING) {
      return
    }

    this.readyState = WebSocket.CLOSING

    setTimeout(() => {
      if (this.isDestroyed) return
      
      this.readyState = WebSocket.CLOSED
      const event = new CloseEvent('close', {
        code,
        reason,
        wasClean: code === 1000,
      })
      this.onclose?.(event)
      this.dispatchEvent(event)
    }, 10)
  })

  addEventListener = vi.fn((type: string, listener: EventListener): void => {
    if (\!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set())
    }
    this.eventListeners.get(type)\!.add(listener)
  })

  removeEventListener = vi.fn((type: string, listener: EventListener): void => {
    this.eventListeners.get(type)?.delete(listener)
  })

  dispatchEvent = vi.fn((event: Event): boolean => {
    const listeners = this.eventListeners.get(event.type)
    if (listeners) {
      listeners.forEach(listener => listener(event))
    }
    return true
  })

  // Test helper methods
  simulateMessage(message: MockWebSocketMessage): void {
    if (this.readyState === WebSocket.OPEN) {
      this.sendToClient({ ...message, timestamp: Date.now() })
    } else {
      this.messageQueue.push({ ...message, timestamp: Date.now() })
    }
  }

  simulateError(errorMessage: string = 'Simulated error'): void {
    const event = new ErrorEvent('error', { message: errorMessage })
    this.onerror?.(event as any)
    this.dispatchEvent(event)
  }

  simulateClose(code: number = 1000, reason: string = '', wasClean: boolean = true): void {
    this.readyState = WebSocket.CLOSED
    const event = new CloseEvent('close', { code, reason, wasClean })
    this.onclose?.(event)
    this.dispatchEvent(event)
  }

  forceConnection(): void {
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
    }
    this.simulateConnectionSuccess()
  }

  getSentMessages(): any[] {
    return [...this.sentMessages]
  }

  getLastSentMessage(): any {
    return this.sentMessages[this.sentMessages.length - 1]
  }

  clearSentMessages(): void {
    this.sentMessages.length = 0
  }

  getQueuedMessages(): MockWebSocketMessage[] {
    return [...this.messageQueue]
  }

  clearMessageQueue(): void {
    this.messageQueue.length = 0
  }

  destroy(): void {
    this.isDestroyed = true
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout)
    }
    this.close(1001, 'Going away')
  }
}

/**
 * WebSocket service mock factory
 */
export class WebSocketServiceMock {
  private mockInstances: Map<string, MockWebSocket> = new Map()
  private messageHandlers: Map<string, Set<(message: any) => void>> = new Map()

  createMockWebSocket(url: string, protocols?: string | string[], options?: MockWebSocketOptions): MockWebSocket {
    const mock = new MockWebSocket(url, protocols, options)
    this.mockInstances.set(url, mock)
    return mock
  }

  getMockByUrl(url: string): MockWebSocket | undefined {
    return this.mockInstances.get(url)
  }

  getAllMocks(): MockWebSocket[] {
    return Array.from(this.mockInstances.values())
  }

  destroyAll(): void {
    this.mockInstances.forEach(mock => mock.destroy())
    this.mockInstances.clear()
    this.messageHandlers.clear()
  }

  broadcastMessage(message: MockWebSocketMessage): void {
    this.mockInstances.forEach(mock => {
      mock.simulateMessage(message)
    })
  }

  simulateNetworkPartition(durationMs: number): void {
    this.mockInstances.forEach(mock => {
      mock.simulateClose(1006, 'Network partition')
    })

    setTimeout(() => {
      this.mockInstances.forEach(mock => {
        mock.forceConnection()
      })
    }, durationMs)
  }

  onMessage(type: string, handler: (message: any) => void): void {
    if (\!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set())
    }
    this.messageHandlers.get(type)\!.add(handler)
  }

  offMessage(type: string, handler: (message: any) => void): void {
    this.messageHandlers.get(type)?.delete(handler)
  }
}

/**
 * Global WebSocket mock setup
 */
export function setupGlobalWebSocketMock(defaultOptions?: MockWebSocketOptions): WebSocketServiceMock {
  const serviceMock = new WebSocketServiceMock()
  const originalWebSocket = globalThis.WebSocket

  globalThis.WebSocket = vi.fn().mockImplementation((url: string, protocols?: string | string[]) => {
    return serviceMock.createMockWebSocket(url, protocols, defaultOptions)
  }) as any

  // Add static properties
  Object.defineProperty(globalThis.WebSocket, 'CONNECTING', { value: 0 })
  Object.defineProperty(globalThis.WebSocket, 'OPEN', { value: 1 })
  Object.defineProperty(globalThis.WebSocket, 'CLOSING', { value: 2 })
  Object.defineProperty(globalThis.WebSocket, 'CLOSED', { value: 3 })

  return serviceMock
}

/**
 * Restore original WebSocket
 */
export function restoreWebSocket(): void {
  vi.restoreAllMocks()
}

/**
 * Predefined message types for haptic system testing
 */
export const hapticMessageTypes = {
  parametersUpdate: (channels: any[]) => ({
    type: 'parameters_update',
    data: { channels },
  }),

  waveformData: (samples: number[], deviceId: number = 1) => ({
    type: 'waveform_data',
    data: { samples, deviceId },
  }),

  statusUpdate: (status: { isActive: boolean; isStreaming?: boolean }) => ({
    type: 'status_update',
    data: status,
  }),

  error: (message: string, code?: string) => ({
    type: 'error',
    data: { message, code },
  }),

  heartbeat: () => ({
    type: 'heartbeat',
    data: { timestamp: Date.now() },
  }),

  heartbeatResponse: () => ({
    type: 'heartbeat_response',
    data: { timestamp: Date.now() },
  }),

  massagePatternUpdate: (pattern: any) => ({
    type: 'massage_pattern_update',
    data: pattern,
  }),

  circularTrajectoryData: (points: Array<{ x: number; y: number; timestamp: number }>) => ({
    type: 'circular_trajectory_data',
    data: { points },
  }),
}

/**
 * Common WebSocket test scenarios
 */
export const webSocketTestScenarios = {
  /**
   * Simulate connection instability
   */
  unstableConnection: (mock: MockWebSocket, disconnectInterval: number = 5000) => {
    const interval = setInterval(() => {
      if (mock.readyState === WebSocket.OPEN) {
        mock.simulateClose(1006, 'Connection unstable')
        setTimeout(() => mock.forceConnection(), 1000)
      }
    }, disconnectInterval)

    return () => clearInterval(interval)
  },

  /**
   * Simulate high message throughput
   */
  highThroughput: (mock: MockWebSocket, messagesPerSecond: number, durationMs: number) => {
    const interval = 1000 / messagesPerSecond
    let messageCount = 0
    const maxMessages = Math.floor(durationMs / interval)

    const timer = setInterval(() => {
      if (messageCount >= maxMessages) {
        clearInterval(timer)
        return
      }

      mock.simulateMessage({
        type: 'high_throughput_test',
        data: { messageId: messageCount, timestamp: Date.now() },
      })
      messageCount++
    }, interval)

    return () => clearInterval(timer)
  },

  /**
   * Simulate gradual network degradation
   */
  networkDegradation: (mock: MockWebSocket, degradationSteps: number = 5) => {
    let currentDelay = 0
    let step = 0

    const interval = setInterval(() => {
      if (step >= degradationSteps) {
        clearInterval(interval)
        mock.simulateClose(1006, 'Network timeout')
        return
      }

      currentDelay += 100
      mock.simulateMessage({
        type: 'network_test',
        data: { step, delay: currentDelay },
      })
      step++
    }, 1000)

    return () => clearInterval(interval)
  },
}

export default {
  MockWebSocket,
  WebSocketServiceMock,
  setupGlobalWebSocketMock,
  restoreWebSocket,
  hapticMessageTypes,
  webSocketTestScenarios,
}
