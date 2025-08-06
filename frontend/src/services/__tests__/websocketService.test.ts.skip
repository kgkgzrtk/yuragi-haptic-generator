import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest'
import { WebSocketService } from '../websocketService'

// Mock WebSocket implementation
class MockWebSocket implements WebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  CONNECTING = 0
  OPEN = 1
  CLOSING = 2
  CLOSED = 3

  readyState = WebSocket.CONNECTING
  url: string
  protocol?: string
  binaryType: BinaryType = 'blob'
  bufferedAmount = 0
  extensions = ''

  onopen: ((event: Event) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  private eventListeners: { [key: string]: Set<EventListener> } = {}

  constructor(url: string, protocols?: string | string[]) {
    this.url = url
    this.protocol = Array.isArray(protocols) ? protocols[0] : protocols

    // Simulate async connection
    setTimeout(() => {
      this.readyState = WebSocket.OPEN
      const event = new Event('open')
      this.onopen?.(event)
      this.dispatchEvent(event)
    }, 10)
  }

  send = vi.fn((data: string | ArrayBufferLike | Blob | ArrayBufferView): void => {
    if (this.readyState \!== WebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
  })

  close = vi.fn((code?: number, reason?: string): void => {
    this.readyState = WebSocket.CLOSING
    setTimeout(() => {
      this.readyState = WebSocket.CLOSED
      const event = new CloseEvent('close', { code: code || 1000, reason: reason || '' })
      this.onclose?.(event)
      this.dispatchEvent(event)
    }, 10)
  })

  addEventListener = vi.fn((type: string, listener: EventListener): void => {
    if (\!this.eventListeners[type]) {
      this.eventListeners[type] = new Set()
    }
    this.eventListeners[type].add(listener)
  })

  removeEventListener = vi.fn((type: string, listener: EventListener): void => {
    this.eventListeners[type]?.delete(listener)
  })

  dispatchEvent = vi.fn((event: Event): boolean => {
    const listeners = this.eventListeners[event.type]
    if (listeners) {
      listeners.forEach(listener => listener(event))
    }
    return true
  })

  // Helper methods for testing
  simulateMessage(data: any) {
    if (this.readyState === WebSocket.OPEN) {
      const event = new MessageEvent('message', { data: JSON.stringify(data) })
      this.onmessage?.(event)
      this.dispatchEvent(event)
    }
  }

  simulateError() {
    const event = new Event('error')
    this.onerror?.(event)
    this.dispatchEvent(event)
  }

  simulateClose(code: number = 1000, reason: string = '') {
    this.readyState = WebSocket.CLOSED
    const event = new CloseEvent('close', { code, reason })
    this.onclose?.(event)
    this.dispatchEvent(event)
  }
}

// Mock global WebSocket
const originalWebSocket = globalThis.WebSocket
beforeEach(() => {
  globalThis.WebSocket = MockWebSocket as any
})

afterEach(() => {
  globalThis.WebSocket = originalWebSocket
})

describe('WebSocketService', () => {
  let service: WebSocketService
  let mockWebSocket: MockWebSocket

  const defaultConfig = {
    url: 'ws://localhost:8000/ws',
    reconnectAttempts: 3,
    reconnectInterval: 1000,
    heartbeatInterval: 30000,
    messageQueueSize: 100,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.clearAllTimers()
    vi.useFakeTimers()

    service = new WebSocketService(defaultConfig)
    
    // Capture the WebSocket instance created by the service
    const WebSocketConstructor = globalThis.WebSocket as unknown as Mock
    WebSocketConstructor.mockImplementation((url, protocols) => {
      mockWebSocket = new MockWebSocket(url, protocols)
      return mockWebSocket
    })
  })

  afterEach(() => {
    service.disconnect()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  describe('Connection Management', () => {
    it('should establish WebSocket connection successfully', async () => {
      const mockOnConnect = vi.fn()
      service.onConnect(mockOnConnect)

      service.connect()
      
      // Fast-forward past connection delay
      await vi.advanceTimersByTimeAsync(20)

      expect(mockOnConnect).toHaveBeenCalledWith()
      expect(service.isConnected()).toBe(true)
    })

    it('should handle connection errors gracefully', async () => {
      const mockOnError = vi.fn()
      service.onError(mockOnError)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      mockWebSocket.simulateError()

      expect(mockOnError).toHaveBeenCalledWith(expect.any(Event))
      expect(service.isConnected()).toBe(false)
    })

    it('should track connection state correctly', async () => {
      expect(service.isConnected()).toBe(false)
      expect(service.isConnecting()).toBe(false)

      service.connect()
      expect(service.isConnecting()).toBe(true)

      await vi.advanceTimersByTimeAsync(20)
      expect(service.isConnected()).toBe(true)
      expect(service.isConnecting()).toBe(false)
    })

    it('should handle multiple connection attempts properly', () => {
      service.connect()
      service.connect() // Second call should be ignored
      service.connect() // Third call should be ignored

      // Should only create one WebSocket instance
      expect(globalThis.WebSocket).toHaveBeenCalledTimes(1)
    })

    it('should disconnect cleanly', async () => {
      const mockOnDisconnect = vi.fn()
      service.onDisconnect(mockOnDisconnect)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      service.disconnect()
      await vi.advanceTimersByTimeAsync(20)

      expect(mockWebSocket.close).toHaveBeenCalledWith(1000, 'Manual disconnect')
      expect(mockOnDisconnect).toHaveBeenCalledWith(expect.objectContaining({ code: 1000 }))
      expect(service.isConnected()).toBe(false)
    })

    it('should handle server-initiated disconnect', async () => {
      const mockOnDisconnect = vi.fn()
      service.onDisconnect(mockOnDisconnect)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      mockWebSocket.simulateClose(1001, 'Server going away')

      expect(mockOnDisconnect).toHaveBeenCalledWith(
        expect.objectContaining({ code: 1001, reason: 'Server going away' })
      )
    })
  })

  describe('Auto-reconnection Logic', () => {
    it('should attempt reconnection on unexpected disconnect', async () => {
      const mockOnReconnect = vi.fn()
      service.onReconnect(mockOnReconnect)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      // Simulate unexpected disconnect (not manual)
      mockWebSocket.simulateClose(1006, 'Connection lost')

      // Should schedule reconnection
      expect(service.isReconnecting()).toBe(true)

      // Fast-forward to reconnection
      await vi.advanceTimersByTimeAsync(defaultConfig.reconnectInterval + 20)

      expect(globalThis.WebSocket).toHaveBeenCalledTimes(2)
      expect(mockOnReconnect).toHaveBeenCalledWith(1)
    })

    it('should respect maximum reconnection attempts', async () => {
      const mockOnMaxReconnectAttemptsReached = vi.fn()
      service.onMaxReconnectAttemptsReached(mockOnMaxReconnectAttemptsReached)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      // Simulate multiple connection failures
      for (let i = 0; i < defaultConfig.reconnectAttempts; i++) {
        mockWebSocket.simulateClose(1006, 'Connection lost')
        await vi.advanceTimersByTimeAsync(defaultConfig.reconnectInterval + 20)
        
        if (i < defaultConfig.reconnectAttempts - 1) {
          // Mock the new connection failing
          const newMockWebSocket = new MockWebSocket(defaultConfig.url)
          globalThis.WebSocket = vi.fn().mockReturnValue(newMockWebSocket)
          newMockWebSocket.simulateError()
        }
      }

      expect(mockOnMaxReconnectAttemptsReached).toHaveBeenCalledWith(defaultConfig.reconnectAttempts)
      expect(service.isReconnecting()).toBe(false)
    })

    it('should use exponential backoff for reconnection delays', async () => {
      const reconnectConfig = { ...defaultConfig, exponentialBackoff: true, maxReconnectDelay: 30000 }
      service = new WebSocketService(reconnectConfig)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      const reconnectTimes: number[] = []
      const originalSetTimeout = globalThis.setTimeout
      
      globalThis.setTimeout = vi.fn((callback, delay) => {
        if (delay > 100) { // Filter out connection establishment delays
          reconnectTimes.push(delay)
        }
        return originalSetTimeout(callback, delay)
      }) as any

      // Simulate multiple reconnection attempts
      for (let i = 0; i < 3; i++) {
        mockWebSocket.simulateClose(1006, 'Connection lost')
        await vi.advanceTimersByTimeAsync(1000 + 20)
      }

      // Should use exponential backoff: 1000, 2000, 4000
      expect(reconnectTimes[0]).toBe(1000)
      expect(reconnectTimes[1]).toBe(2000)
      expect(reconnectTimes[2]).toBe(4000)
    })

    it('should reset reconnection counter on successful connection', async () => {
      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      // Fail once
      mockWebSocket.simulateClose(1006, 'Connection lost')
      await vi.advanceTimersByTimeAsync(defaultConfig.reconnectInterval + 20)

      // Successful reconnection
      expect(service.getReconnectAttempts()).toBe(1)

      // Disconnect and reconnect manually (should reset counter)
      service.disconnect()
      await vi.advanceTimersByTimeAsync(20)
      
      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      expect(service.getReconnectAttempts()).toBe(0)
    })

    it('should not reconnect on manual disconnect', async () => {
      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      service.disconnect()
      await vi.advanceTimersByTimeAsync(defaultConfig.reconnectInterval + 20)

      // Should not attempt reconnection
      expect(globalThis.WebSocket).toHaveBeenCalledTimes(1)
      expect(service.isReconnecting()).toBe(false)
    })
  })

  describe('Message Queuing Behavior', () => {
    it('should queue messages when not connected', () => {
      const message = { type: 'test', data: 'hello' }
      
      service.send(message)
      
      expect(service.getQueuedMessageCount()).toBe(1)
      expect(mockWebSocket?.send).not.toHaveBeenCalled()
    })

    it('should send queued messages on reconnection', async () => {
      const messages = [
        { type: 'test1', data: 'hello1' },
        { type: 'test2', data: 'hello2' },
        { type: 'test3', data: 'hello3' },
      ]

      // Queue messages while disconnected
      messages.forEach(msg => service.send(msg))
      expect(service.getQueuedMessageCount()).toBe(3)

      // Connect
      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      // All queued messages should be sent
      expect(mockWebSocket.send).toHaveBeenCalledTimes(3)
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(messages[0]))
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(messages[1]))
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify(messages[2]))
      expect(service.getQueuedMessageCount()).toBe(0)
    })

    it('should respect message queue size limit', () => {
      const smallQueueConfig = { ...defaultConfig, messageQueueSize: 2 }
      service = new WebSocketService(smallQueueConfig)

      service.send({ type: 'msg1' })
      service.send({ type: 'msg2' })
      service.send({ type: 'msg3' }) // Should replace oldest

      expect(service.getQueuedMessageCount()).toBe(2)

      service.connect()
      vi.advanceTimersByTime(20)

      // Should only send the last 2 messages
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'msg2' }))
      expect(mockWebSocket.send).toHaveBeenCalledWith(JSON.stringify({ type: 'msg3' }))
    })

    it('should prioritize messages by type', async () => {
      const priorityConfig = { 
        ...defaultConfig, 
        messagePriority: { 
          'control': 1, 
          'data': 2, 
          'status': 3 
        } 
      }
      service = new WebSocketService(priorityConfig)

      service.send({ type: 'status', data: 'status message' })
      service.send({ type: 'control', data: 'control message' })
      service.send({ type: 'data', data: 'data message' })

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      // Should send in priority order: control, data, status
      const calls = (mockWebSocket.send as Mock).mock.calls
      expect(JSON.parse(calls[0][0])).toEqual({ type: 'control', data: 'control message' })
      expect(JSON.parse(calls[1][0])).toEqual({ type: 'data', data: 'data message' })
      expect(JSON.parse(calls[2][0])).toEqual({ type: 'status', data: 'status message' })
    })

    it('should handle message serialization errors', () => {
      const circularObj = { a: {} as any }
      circularObj.a.b = circularObj // Circular reference

      const mockOnError = vi.fn()
      service.onError(mockOnError)

      service.connect()
      vi.advanceTimersByTime(20)

      service.send(circularObj)

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'serialization_error',
          message: expect.stringContaining('circular'),
        })
      )
    })
  })

  describe('Error Handling Scenarios', () => {
    it('should handle WebSocket construction errors', () => {
      globalThis.WebSocket = vi.fn().mockImplementation(() => {
        throw new Error('WebSocket construction failed')
      })

      const mockOnError = vi.fn()
      service.onError(mockOnError)

      service.connect()

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection_error',
          message: 'WebSocket construction failed',
        })
      )
    })

    it('should handle invalid message formats gracefully', async () => {
      const mockOnMessage = vi.fn()
      service.onMessage(mockOnMessage)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      // Simulate invalid JSON message
      const invalidEvent = new MessageEvent('message', { data: 'invalid json{' })
      mockWebSocket.onmessage?.(invalidEvent)

      // Should not call message handler for invalid messages
      expect(mockOnMessage).not.toHaveBeenCalled()
    })

    it('should handle network errors during message sending', async () => {
      const mockOnError = vi.fn()
      service.onError(mockOnError)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      // Mock send to throw error
      mockWebSocket.send.mockImplementation(() => {
        throw new Error('Network error')
      })

      service.send({ type: 'test', data: 'test' })

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'send_error',
          message: 'Network error',
        })
      )
    })

    it('should handle connection timeout', async () => {
      const timeoutConfig = { ...defaultConfig, connectionTimeout: 5000 }
      service = new WebSocketService(timeoutConfig)

      const mockOnError = vi.fn()
      service.onError(mockOnError)

      // Mock WebSocket that never connects
      globalThis.WebSocket = vi.fn().mockImplementation(() => {
        const ws = new MockWebSocket(defaultConfig.url)
        ws.readyState = WebSocket.CONNECTING
        // Don't simulate connection
        return ws
      })

      service.connect()
      await vi.advanceTimersByTimeAsync(timeoutConfig.connectionTimeout + 100)

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'connection_timeout',
          message: expect.stringContaining('5000ms'),
        })
      )
    })

    it('should handle heartbeat timeout', async () => {
      const heartbeatConfig = { ...defaultConfig, heartbeatInterval: 1000, heartbeatTimeout: 2000 }
      service = new WebSocketService(heartbeatConfig)

      const mockOnError = vi.fn()
      service.onError(mockOnError)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      // Don't respond to heartbeat
      await vi.advanceTimersByTimeAsync(heartbeatConfig.heartbeatInterval + heartbeatConfig.heartbeatTimeout + 100)

      expect(mockOnError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'heartbeat_timeout',
        })
      )
    })
  })

  describe('Message Types and Protocols', () => {
    it('should handle different message types correctly', async () => {
      const mockOnMessage = vi.fn()
      service.onMessage(mockOnMessage)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      const messages = [
        { type: 'parameters_update', data: { channels: [] } },
        { type: 'waveform_data', data: { samples: [] } },
        { type: 'status_update', data: { isActive: true } },
        { type: 'error', data: { message: 'Test error' } },
      ]

      messages.forEach(msg => {
        mockWebSocket.simulateMessage(msg)
      })

      expect(mockOnMessage).toHaveBeenCalledTimes(4)
      messages.forEach((msg, index) => {
        expect(mockOnMessage).toHaveBeenNthCalledWith(index + 1, msg)
      })
    })

    it('should handle binary message data', async () => {
      const mockOnMessage = vi.fn()
      service.onMessage(mockOnMessage)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      const binaryData = new ArrayBuffer(8)
      const view = new DataView(binaryData)
      view.setFloat64(0, 3.14159, true)

      const binaryEvent = new MessageEvent('message', { data: binaryData })
      mockWebSocket.onmessage?.(binaryEvent)

      expect(mockOnMessage).toHaveBeenCalledWith({
        type: 'binary_data',
        data: binaryData,
      })
    })

    it('should support message filtering by type', async () => {
      const mockStatusHandler = vi.fn()
      const mockWaveformHandler = vi.fn()

      service.onMessage(mockStatusHandler, 'status_update')
      service.onMessage(mockWaveformHandler, 'waveform_data')

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      mockWebSocket.simulateMessage({ type: 'status_update', data: { isActive: true } })
      mockWebSocket.simulateMessage({ type: 'waveform_data', data: { samples: [] } })
      mockWebSocket.simulateMessage({ type: 'parameters_update', data: { channels: [] } })

      expect(mockStatusHandler).toHaveBeenCalledTimes(1)
      expect(mockWaveformHandler).toHaveBeenCalledTimes(1)
    })

    it('should handle heartbeat messages automatically', async () => {
      const heartbeatConfig = { ...defaultConfig, heartbeatInterval: 1000 }
      service = new WebSocketService(heartbeatConfig)

      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      // Should send heartbeat
      await vi.advanceTimersByTimeAsync(heartbeatConfig.heartbeatInterval)

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: 'heartbeat', timestamp: expect.any(Number) })
      )

      // Respond with heartbeat
      mockWebSocket.simulateMessage({ type: 'heartbeat_response', timestamp: Date.now() })

      // Should continue heartbeat cycle
      await vi.advanceTimersByTimeAsync(heartbeatConfig.heartbeatInterval)
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2)
    })
  })

  describe('Performance and Resource Management', () => {
    it('should cleanup event listeners on disconnect', async () => {
      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      const removeEventListenerSpy = vi.spyOn(mockWebSocket, 'removeEventListener')

      service.disconnect()

      expect(removeEventListenerSpy).toHaveBeenCalledWith('open', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('close', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function))
      expect(removeEventListenerSpy).toHaveBeenCalledWith('error', expect.any(Function))
    })

    it('should handle high-frequency message sending efficiently', async () => {
      service.connect()
      await vi.advanceTimersByTimeAsync(20)

      const startTime = performance.now()
      
      // Send 1000 messages
      for (let i = 0; i < 1000; i++) {
        service.send({ type: 'test', id: i })
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Should handle high frequency without significant performance impact
      expect(duration).toBeLessThan(100) // Less than 100ms
      expect(mockWebSocket.send).toHaveBeenCalledTimes(1000)
    })

    it('should implement memory-efficient message queuing', () => {
      const largeConfig = { ...defaultConfig, messageQueueSize: 10000 }
      service = new WebSocketService(largeConfig)

      // Queue many messages
      for (let i = 0; i < 10000; i++) {
        service.send({ type: 'test', id: i, data: 'x'.repeat(100) })
      }

      expect(service.getQueuedMessageCount()).toBe(10000)

      // Memory usage should be reasonable (implementation dependent)
      const memoryUsage = process.memoryUsage?.()?.heapUsed || 0
      expect(memoryUsage).toBeLessThan(100 * 1024 * 1024) // Less than 100MB
    })

    it('should debounce rapid connection attempts', () => {
      // Multiple rapid connection calls
      for (let i = 0; i < 10; i++) {
        service.connect()
      }

      // Should only create one WebSocket instance
      expect(globalThis.WebSocket).toHaveBeenCalledTimes(1)
    })
  })

  describe('Configuration and Options', () => {
    it('should respect custom configuration options', () => {
      const customConfig = {
        url: 'wss://custom.example.com/ws',
        protocols: ['haptic-protocol-v1'],
        reconnectAttempts: 5,
        reconnectInterval: 2000,
        heartbeatInterval: 15000,
        messageQueueSize: 200,
        connectionTimeout: 10000,
      }

      service = new WebSocketService(customConfig)

      service.connect()

      expect(globalThis.WebSocket).toHaveBeenCalledWith(
        customConfig.url,
        customConfig.protocols
      )
    })

    it('should allow runtime configuration updates', () => {
      service.updateConfig({
        reconnectAttempts: 10,
        heartbeatInterval: 5000,
      })

      expect(service.getConfig()).toEqual(
        expect.objectContaining({
          reconnectAttempts: 10,
          heartbeatInterval: 5000,
        })
      )
    })

    it('should validate configuration parameters', () => {
      expect(() => {
        new WebSocketService({
          url: 'invalid-url',
          reconnectAttempts: -1,
          messageQueueSize: 0,
        })
      }).toThrow('Invalid WebSocket configuration')
    })
  })
})
