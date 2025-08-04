import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { MockWebSocket, setupWebSocketMock, websocketTestHelpers } from '@/test/mocks'
import { renderHook, act, waitFor } from '@/test/test-utils'
import { useWebSocket } from '../useWebSocket'

// Mock the store
const mockStoreActions = {
  setConnection: vi.fn(),
  setChannels: vi.fn(),
  setStatus: vi.fn(),
  reset: vi.fn(),
  setStreaming: vi.fn(),
  setVectorForce: vi.fn(),
}

vi.mock('@/contexts/hapticStore', () => ({
  useHapticStore: Object.assign(
    vi.fn((selector: any) => {
      if (typeof selector === 'function') {
        return selector(mockStoreActions)
      }
      return mockStoreActions
    }),
    {
      getState: vi.fn(() => mockStoreActions),
    }
  ),
}))

// Mock timers
vi.useFakeTimers()

describe('useWebSocket', () => {
  let mockWebSocketControls: ReturnType<typeof setupWebSocketMock>
  let mockStore: {
    setConnection: vi.Mock
    setChannels: vi.Mock
    setStatus: vi.Mock
  }

  const testUrl = 'ws://localhost:8000/ws'
  const defaultOptions = {
    url: testUrl,
    reconnectInterval: 1000,
    maxReconnectAttempts: 3,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockWebSocketControls = setupWebSocketMock()

    // Use the globally mocked store actions
    mockStore = mockStoreActions
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
    vi.useFakeTimers()
  })

  describe('Connection Management', () => {
    it('establishes WebSocket connection on mount', () => {
      renderHook(() => useWebSocket(defaultOptions))

      expect(global.WebSocket).toHaveBeenCalledWith(testUrl)
      expect(mockWebSocketControls.instances).toHaveLength(1)
    })

    it('sets connection status to true when WebSocket opens', async () => {
      renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()
      act(() => {
        mockWS.simulateConnection()
      })

      expect(mockStore.setConnection).toHaveBeenCalledWith(true)
    })

    it('sets connection status to false when WebSocket closes', async () => {
      renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()

      // First connect
      act(() => {
        mockWS.simulateConnection()
      })

      // Then disconnect
      act(() => {
        mockWS.simulateDisconnection()
      })

      expect(mockStore.setConnection).toHaveBeenCalledWith(false)
    })

    it('cleans up WebSocket connection on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()
      const closeSpy = vi.spyOn(mockWS, 'close')

      unmount()

      expect(closeSpy).toHaveBeenCalled()
    })
  })

  describe('Message Handling', () => {
    it('handles PARAMETERS_UPDATE messages correctly', async () => {
      renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()
      const mockChannels = [
        { channelId: 0, frequency: 60, amplitude: 0.5, phase: 0, polarity: true },
      ]

      act(() => {
        mockWS.simulateParametersUpdate(mockChannels)
      })

      expect(mockStore.setChannels).toHaveBeenCalledWith(mockChannels)
    })

    it('handles STATUS_UPDATE messages correctly', async () => {
      renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()
      const mockStatus = {
        isStreaming: true,
        sampleRate: 44100,
        blockSize: 512,
        latencyMs: 12.5,
      }

      act(() => {
        mockWS.simulateStatusUpdate(mockStatus)
      })

      expect(mockStore.setStatus).toHaveBeenCalledWith(mockStatus)
    })

    it('logs error messages to console', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()

      act(() => {
        mockWS.simulateErrorMessage('Test error message')
      })

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket error:', 'Test error message')

      consoleSpy.mockRestore()
    })

    it('logs warning for unknown message types', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()

      act(() => {
        mockWS.triggerMessage({
          type: 'UNKNOWN_TYPE' as any,
          data: 'test data',
          timestamp: new Date().toISOString(),
        })
      })

      expect(consoleSpy).toHaveBeenCalledWith('Unknown message type:', 'UNKNOWN_TYPE')

      consoleSpy.mockRestore()
    })

    it('handles malformed JSON messages gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()

      act(() => {
        // Trigger a message with invalid JSON
        const messageEvent = new MessageEvent('message', {
          data: 'invalid json',
        })
        mockWS.triggerEvent('message', messageEvent)
      })

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to parse WebSocket message:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('Reconnection Logic', () => {
    it('attempts to reconnect when connection is lost', async () => {
      renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()

      // Simulate connection and then disconnection
      act(() => {
        mockWS.simulateConnection()
      })

      act(() => {
        mockWS.simulateDisconnection(1006, 'Connection lost') // Abnormal closure
      })

      // Advance time to trigger reconnection
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      // Should create a new WebSocket instance
      expect(global.WebSocket).toHaveBeenCalledTimes(2)
    })

    it.skip('stops reconnecting after max attempts reached', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      // Mock WebSocket to always fail on creation after initial success
      let createCount = 0
      const originalWebSocket = global.WebSocket
      global.WebSocket = vi.fn((url: string) => {
        createCount++
        if (createCount > 1) {
          // Fail subsequent connections
          const ws = new MockWebSocket(url)
          // Immediately close with error
          setTimeout(() => {
            ws.readyState = MockWebSocket.CLOSED
            ws.triggerClose(1006)
          }, 0)
          return ws
        }
        // First connection succeeds
        return new MockWebSocket(url)
      }) as any

      renderHook(() => useWebSocket({ ...defaultOptions, maxReconnectAttempts: 3 }))

      // Wait for initial connection
      await waitFor(() => {
        expect(mockStore.setConnection).toHaveBeenCalledWith(true)
      })

      const mockWS = mockWebSocketControls.getLastInstance()
      mockStore.setConnection.mockClear()

      // Trigger disconnection to start reconnection attempts
      act(() => {
        mockWS.simulateDisconnection(1006)
      })

      // Wait for all reconnection attempts to fail
      for (let i = 0; i < 3; i++) {
        act(() => {
          vi.advanceTimersByTime(1000)
        })
      }

      // After max attempts, should see the message
      await waitFor(() => {
        const calls = mockStore.setConnection.mock.calls
        const hasMaxAttemptsMessage = calls.some(
          call => call[0] === false && call[1] === 'Max reconnection attempts reached'
        )
        expect(hasMaxAttemptsMessage).toBe(true)
      })

      global.WebSocket = originalWebSocket
      consoleSpy.mockRestore()
    })

    it('resets reconnection attempts on successful connection', async () => {
      renderHook(() => useWebSocket(defaultOptions))

      let mockWS = mockWebSocketControls.getLastInstance()

      // First connection
      act(() => {
        mockWS.simulateConnection()
      })

      // First disconnection
      act(() => {
        mockWS.simulateDisconnection(1006) // Abnormal closure
      })

      // Reconnect attempt
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      mockWS = mockWebSocketControls.getLastInstance()

      // Successful reconnection
      act(() => {
        mockWS.simulateConnection()
      })

      // Another disconnection
      act(() => {
        mockWS.simulateDisconnection(1006) // Abnormal closure
      })

      // Should still attempt to reconnect (attempts were reset)
      act(() => {
        vi.advanceTimersByTime(1000)
      })

      expect(global.WebSocket).toHaveBeenCalledTimes(3) // Initial + first reconnect + second reconnect
    })

    it('uses custom reconnection interval', async () => {
      const customInterval = 2000
      renderHook(() =>
        useWebSocket({
          ...defaultOptions,
          reconnectInterval: customInterval,
        })
      )

      const mockWS = mockWebSocketControls.getLastInstance()

      act(() => {
        mockWS.simulateConnection()
        mockWS.simulateDisconnection(1006) // Abnormal closure
      })

      // Should not reconnect before the custom interval
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(global.WebSocket).toHaveBeenCalledTimes(1)

      // Should reconnect after the custom interval
      act(() => {
        vi.advanceTimersByTime(1000)
      })
      expect(global.WebSocket).toHaveBeenCalledTimes(2)
    })
  })

  describe('Hook Return Values', () => {
    it('returns sendMessage function', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      expect(typeof result.current.sendMessage).toBe('function')
    })

    it('returns disconnect function', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      expect(typeof result.current.disconnect).toBe('function')
    })

    it('returns reconnect function', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      expect(typeof result.current.reconnect).toBe('function')
    })
  })

  describe('Message Sending', () => {
    it('sends messages when connection is open', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()
      const sendSpy = vi.spyOn(mockWS, 'send')

      // Simulate open connection
      act(() => {
        mockWS.simulateConnection()
      })

      const testMessage = websocketTestHelpers.createParametersUpdateMessage([])

      act(() => {
        result.current.sendMessage(testMessage)
      })

      expect(sendSpy).toHaveBeenCalledWith(JSON.stringify(testMessage))
    })

    it('logs warning when trying to send message on closed connection', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { result } = renderHook(() => useWebSocket(defaultOptions))

      const testMessage = websocketTestHelpers.createParametersUpdateMessage([])

      act(() => {
        result.current.sendMessage(testMessage)
      })

      expect(consoleSpy).toHaveBeenCalledWith('WebSocket is not connected')

      consoleSpy.mockRestore()
    })
  })

  describe('Manual Disconnect and Reconnect', () => {
    it('manually disconnects WebSocket', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()
      const closeSpy = vi.spyOn(mockWS, 'close')

      act(() => {
        result.current.disconnect()
      })

      expect(closeSpy).toHaveBeenCalled()
      expect(mockStore.setConnection).toHaveBeenCalledWith(false)
    })

    it('manually reconnects WebSocket', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      // Disconnect first
      act(() => {
        result.current.disconnect()
      })

      // Then reconnect
      act(() => {
        result.current.reconnect()
      })

      expect(global.WebSocket).toHaveBeenCalledTimes(2)
    })

    it('does not create duplicate connections when already connecting', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      // Try to reconnect while already connecting
      act(() => {
        result.current.reconnect()
      })

      // Should not create additional WebSocket instance
      expect(global.WebSocket).toHaveBeenCalledTimes(1)
    })
  })

  describe('Error Handling', () => {
    it('handles WebSocket errors', () => {
      renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()

      act(() => {
        mockWS.simulateError()
      })

      expect(mockStore.setConnection).toHaveBeenCalledWith(false, 'Connection error')
    })

    it.skip('handles WebSocket creation failures', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Clear existing mock
      mockWebSocketControls.clearInstances()

      // Mock WebSocket constructor to throw synchronously
      const originalWebSocket = global.WebSocket
      let createAttempted = false
      global.WebSocket = vi.fn(() => {
        createAttempted = true
        throw new Error('Failed to create WebSocket')
      }) as any

      // Render the hook
      renderHook(() => useWebSocket(defaultOptions))

      // Check that WebSocket creation was attempted
      expect(createAttempted).toBe(true)

      // Check that error was handled
      expect(consoleSpy).toHaveBeenCalledWith('Failed to create WebSocket:', expect.any(Error))

      expect(mockStore.setConnection).toHaveBeenCalledWith(false, 'Failed to connect')

      // Restore original mock
      global.WebSocket = originalWebSocket
      consoleSpy.mockRestore()
    })
  })

  describe('Memory Leaks Prevention', () => {
    it('clears reconnection timeout on unmount', () => {
      const { unmount } = renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()

      // Simulate disconnection to start reconnection timer
      act(() => {
        mockWS.simulateConnection()
        mockWS.simulateDisconnection()
      })

      // Unmount before reconnection timeout
      unmount()

      // Advance time past reconnection interval
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // Should not create new WebSocket instance after unmount
      expect(global.WebSocket).toHaveBeenCalledTimes(1)
    })

    it('clears reconnection timeout on manual disconnect', () => {
      const { result } = renderHook(() => useWebSocket(defaultOptions))

      const mockWS = mockWebSocketControls.getLastInstance()

      // Simulate disconnection to start reconnection timer
      act(() => {
        mockWS.simulateConnection()
        mockWS.simulateDisconnection()
      })

      // Manual disconnect before reconnection timeout
      act(() => {
        result.current.disconnect()
      })

      // Advance time past reconnection interval
      act(() => {
        vi.advanceTimersByTime(2000)
      })

      // Should not create additional WebSocket instance
      expect(global.WebSocket).toHaveBeenCalledTimes(1)
    })
  })
})
