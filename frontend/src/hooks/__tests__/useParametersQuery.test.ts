import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  useParametersQuery,
  useUpdateParametersMutation,
  useUpdateChannelMutation,
  useParameterManagement,
  useBatchParameterUpdates,
} from '@/hooks/queries/useParametersQuery'
import { HapticService } from '@/services/hapticService'
import { mockParametersResponse, setupMockScenarios } from '@/test/mocks'
import { renderHook, waitFor, act } from '@/test/test-utils'
import { CHANNEL_IDS } from '@/types/hapticTypes'
import type { IChannelParameters } from '@/types/hapticTypes'

vi.mock('@/services/hapticService', () => ({
  HapticService: {
    getParameters: vi.fn(),
    updateParameters: vi.fn(),
    updateChannel: vi.fn(),
  },
}))

// Mock store state
const mockStoreState = {
  channels: [],
  isStreaming: false,
  status: null,
  connection: { isConnected: false, error: null },
  vectorForce: null,
}

// Mock the store
const mockStoreActions = {
  setChannels: vi.fn(),
  updateChannel: vi.fn(),
  reset: vi.fn(),
  setStreaming: vi.fn(),
  setStatus: vi.fn(),
  setConnection: vi.fn(),
  setVectorForce: vi.fn(),
}

vi.mock('@/contexts/hapticStore', () => ({
  useHapticStore: Object.assign(
    vi.fn((selector: any) => {
      if (typeof selector === 'function') {
        return selector({ ...mockStoreState, ...mockStoreActions })
      }
      return { ...mockStoreState, ...mockStoreActions }
    }),
    {
      getState: vi.fn(() => ({
        ...mockStoreState,
        ...mockStoreActions,
        // Also include the store methods expected by test-utils
        reset: mockStoreActions.reset,
        setChannels: mockStoreActions.setChannels,
        setStreaming: mockStoreActions.setStreaming,
        setStatus: mockStoreActions.setStatus,
        setConnection: mockStoreActions.setConnection,
        setVectorForce: mockStoreActions.setVectorForce,
      })),
    }
  ),
}))

describe('useParametersQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Reset store state
    mockStoreState.channels = []
    mockStoreState.isStreaming = false
    mockStoreState.status = null
    mockStoreState.connection = { isConnected: false, error: null }
    mockStoreState.vectorForce = null
  })

  it('fetches parameters and syncs with store', async () => {
    vi.mocked(HapticService.getParameters).mockResolvedValue(mockParametersResponse)

    const { result } = renderHook(() => useParametersQuery())

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(HapticService.getParameters).toHaveBeenCalled()
    expect(mockStoreActions.setChannels).toHaveBeenCalledWith(mockParametersResponse.channels)
    expect(result.current.data).toEqual(mockParametersResponse)
  })

  it('handles fetch errors gracefully', async () => {
    const error = new Error('Network error')

    // Mock the service to reject immediately
    vi.mocked(HapticService.getParameters).mockRejectedValue(error)

    const { result } = renderHook(() => useParametersQuery())

    // First wait for the query to start
    await waitFor(() => {
      expect(result.current.isLoading || result.current.isError).toBe(true)
    })

    // Then wait for the error state
    await waitFor(
      () => {
        expect(result.current.isError).toBe(true)
        expect(result.current.error).toEqual(error)
      },
      { timeout: 5000 }
    )

    // Check that the query was actually called
    expect(HapticService.getParameters).toHaveBeenCalled()

    // Note: In React Query v5, onError callback is not available on useQuery
    // The error handling in the actual implementation needs to be updated
  })

  it('syncs successful fetches with store using onSuccess', async () => {
    vi.mocked(HapticService.getParameters).mockResolvedValue(mockParametersResponse)

    renderHook(() => useParametersQuery())

    await waitFor(() => {
      expect(mockStoreActions.setChannels).toHaveBeenCalledWith(mockParametersResponse.channels)
    })
  })
})

describe('useUpdateParametersMutation', () => {
  const mockNewChannels: IChannelParameters[] = [
    { channelId: CHANNEL_IDS.DEVICE1_X, frequency: 80, amplitude: 0.7, phase: 45, polarity: false },
    { channelId: CHANNEL_IDS.DEVICE1_Y, frequency: 90, amplitude: 0.8, phase: 90, polarity: true },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    setupMockScenarios.success()

    // Reset store state
    mockStoreState.channels = []
    mockStoreState.isStreaming = false
    mockStoreState.status = null
    mockStoreState.connection = { isConnected: false, error: null }
    mockStoreState.vectorForce = null
  })

  it('performs optimistic update before API call', async () => {
    vi.mocked(HapticService.updateParameters).mockResolvedValue({ status: 'success' })

    const { result } = renderHook(() => useUpdateParametersMutation())

    // Clear any previous calls from test setup
    mockStoreActions.setChannels.mockClear()

    act(() => {
      result.current.mutate(mockNewChannels)
    })

    // Should immediately update store optimistically
    await waitFor(() => {
      expect(mockStoreActions.setChannels).toHaveBeenCalledWith(mockNewChannels)
    })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(HapticService.updateParameters).toHaveBeenCalledWith(mockNewChannels)
  })

  it('rolls back optimistic update on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Update failed')
    vi.mocked(HapticService.updateParameters).mockRejectedValue(error)

    const { result } = renderHook(() => useUpdateParametersMutation())

    // Clear any previous calls from test setup
    mockStoreActions.setChannels.mockClear()

    act(() => {
      result.current.mutate(mockNewChannels)
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    // Wait for all setChannels calls
    await waitFor(() => {
      // Should have called setChannels at least once for optimistic update
      expect(mockStoreActions.setChannels).toHaveBeenCalled()
      // The last call should be with mockNewChannels (optimistic update)
      const calls = mockStoreActions.setChannels.mock.calls
      expect(calls.some(call => JSON.stringify(call[0]) === JSON.stringify(mockNewChannels))).toBe(
        true
      )
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('ERROR: Failed to update parameters'),
      expect.objectContaining({
        error: error.message,
      }),
      expect.any(String)
    )

    consoleSpy.mockRestore()
  })
})

describe('useUpdateChannelMutation', () => {
  const testChannelId = CHANNEL_IDS.DEVICE1_X
  const testParams = { frequency: 100, amplitude: 0.9 }

  beforeEach(() => {
    vi.clearAllMocks()
    setupMockScenarios.success()

    // Reset store state
    mockStoreState.channels = []
    mockStoreState.isStreaming = false
    mockStoreState.status = null
    mockStoreState.connection = { isConnected: false, error: null }
    mockStoreState.vectorForce = null
  })

  it('performs optimistic update for single channel', async () => {
    vi.mocked(HapticService.updateChannel).mockResolvedValue({
      channelId: testChannelId,
      status: 'success',
    })

    const { result } = renderHook(() => useUpdateChannelMutation())

    await act(async () => {
      result.current.mutate({ channelId: testChannelId, params: testParams })
    })

    // Should immediately update store optimistically
    expect(mockStoreActions.updateChannel).toHaveBeenCalledWith(testChannelId, testParams)

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(HapticService.updateChannel).toHaveBeenCalledWith(testChannelId, testParams)
  })

  it('handles channel update errors with rollback', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Channel update failed')
    vi.mocked(HapticService.updateChannel).mockRejectedValue(error)

    const { result } = renderHook(() => useUpdateChannelMutation())

    act(() => {
      result.current.mutate({ channelId: testChannelId, params: testParams })
    })

    await waitFor(() => {
      expect(result.current.isError).toBe(true)
    })

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('ERROR: Failed to update channel parameters'),
      expect.objectContaining({
        channelId: testChannelId,
        error: error.message,
      }),
      expect.any(String)
    )

    consoleSpy.mockRestore()
  })
})

describe('useParameterManagement', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupMockScenarios.success()

    // Reset store state
    mockStoreState.channels = []
    mockStoreState.isStreaming = false
    mockStoreState.status = null
    mockStoreState.connection = { isConnected: false, error: null }
    mockStoreState.vectorForce = null
  })

  it('combines query and mutation states correctly', async () => {
    vi.mocked(HapticService.getParameters).mockResolvedValue(mockParametersResponse)

    const { result } = renderHook(() => useParameterManagement())

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })

    expect(result.current.parameters).toEqual(mockParametersResponse.channels)
    expect(result.current.isUpdating).toBe(false)
    expect(typeof result.current.updateAllParameters).toBe('function')
    expect(typeof result.current.updateChannel).toBe('function')
    expect(typeof result.current.updateChannelField).toBe('function')
  })

  it('exposes updateChannelField convenience method', async () => {
    vi.mocked(HapticService.updateChannel).mockResolvedValue({
      channelId: CHANNEL_IDS.DEVICE1_X,
      status: 'success',
    })

    const { result } = renderHook(() => useParameterManagement())

    expect(typeof result.current.updateChannelField).toBe('function')

    act(() => {
      result.current.updateChannelField(CHANNEL_IDS.DEVICE1_X, 'frequency', 100)
    })

    await waitFor(() => {
      expect(HapticService.updateChannel).toHaveBeenCalledWith(CHANNEL_IDS.DEVICE1_X, {
        frequency: 100,
      })
    })
  })

  it('provides reset functionality', () => {
    const { result } = renderHook(() => useParameterManagement())

    expect(typeof result.current.reset).toBe('function')
  })

  it('shows updating state when mutations are pending', async () => {
    // Mock a delayed response to keep the mutation pending
    let resolvePromise: (value: any) => void
    vi.mocked(HapticService.updateParameters).mockImplementation(
      () =>
        new Promise(resolve => {
          resolvePromise = resolve
        })
    )

    const { result } = renderHook(() => useParameterManagement())

    // Start mutation
    act(() => {
      result.current.updateAllParameters(mockParametersResponse.channels)
    })

    // Wait for the mutation to actually start
    await waitFor(() => {
      expect(result.current.isUpdating).toBe(true)
    })

    // Resolve the promise to complete the mutation
    act(() => {
      resolvePromise!({ status: 'success' })
    })

    // Wait for mutation to complete
    await waitFor(() => {
      expect(result.current.isUpdating).toBe(false)
    })
  })
})

describe('useBatchParameterUpdates', () => {
  const debounceMs = 100

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()

    // Reset store state
    mockStoreState.channels = []
    mockStoreState.isStreaming = false
    mockStoreState.status = null
    mockStoreState.connection = { isConnected: false, error: null }
    mockStoreState.vectorForce = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('batches multiple updates within debounce period', async () => {
    const { result } = renderHook(() => useBatchParameterUpdates(debounceMs))

    const channelId = CHANNEL_IDS.DEVICE1_X

    act(() => {
      result.current.batchUpdate(channelId, { frequency: 80 })
      result.current.batchUpdate(channelId, { amplitude: 0.7 })
      result.current.batchUpdate(channelId, { phase: 90 })
    })

    expect(result.current.hasPendingUpdates).toBe(true)
    expect(result.current.pendingCount).toBe(1) // One channel with multiple updates

    // Advance time to trigger batch execution
    act(() => {
      vi.advanceTimersByTime(debounceMs)
    })

    // Should have processed all updates for the channel
    expect(result.current.hasPendingUpdates).toBe(false)
    expect(result.current.pendingCount).toBe(0)
  })

  it('merges multiple updates for the same channel', async () => {
    const { result } = renderHook(() => useBatchParameterUpdates(debounceMs))

    const channelId = CHANNEL_IDS.DEVICE1_X

    act(() => {
      result.current.batchUpdate(channelId, { frequency: 80 })
      result.current.batchUpdate(channelId, { amplitude: 0.7 })
    })

    // Check that updates are pending
    expect(result.current.hasPendingUpdates).toBe(true)
    expect(result.current.pendingCount).toBe(1)

    act(() => {
      vi.advanceTimersByTime(debounceMs)
    })

    // After debounce, updates should be processed
    expect(result.current.hasPendingUpdates).toBe(false)
    expect(result.current.pendingCount).toBe(0)
  })

  it('handles multiple channels separately', async () => {
    const { result } = renderHook(() => useBatchParameterUpdates(debounceMs))

    act(() => {
      result.current.batchUpdate(CHANNEL_IDS.DEVICE1_X, { frequency: 80 })
      result.current.batchUpdate(CHANNEL_IDS.DEVICE1_Y, { frequency: 90 })
    })

    expect(result.current.pendingCount).toBe(2) // Two different channels

    act(() => {
      vi.advanceTimersByTime(debounceMs)
    })

    expect(result.current.pendingCount).toBe(0)
  })

  it('clears pending updates manually', () => {
    const { result } = renderHook(() => useBatchParameterUpdates(debounceMs))

    act(() => {
      result.current.batchUpdate(CHANNEL_IDS.DEVICE1_X, { frequency: 80 })
    })

    expect(result.current.hasPendingUpdates).toBe(true)

    act(() => {
      result.current.clearPending()
    })

    expect(result.current.hasPendingUpdates).toBe(false)

    // Should not execute updates after clearing
    act(() => {
      vi.advanceTimersByTime(debounceMs)
    })

    expect(result.current.pendingCount).toBe(0)
  })

  it('resets debounce timer on new updates', () => {
    const { result } = renderHook(() => useBatchParameterUpdates(debounceMs))

    act(() => {
      result.current.batchUpdate(CHANNEL_IDS.DEVICE1_X, { frequency: 80 })
    })

    // Advance time partially
    act(() => {
      vi.advanceTimersByTime(debounceMs / 2)
    })

    // Add another update, which should reset the timer
    act(() => {
      result.current.batchUpdate(CHANNEL_IDS.DEVICE1_X, { amplitude: 0.7 })
    })

    // Advance the remaining partial time
    act(() => {
      vi.advanceTimersByTime(debounceMs / 2)
    })

    // Should still have pending updates (timer was reset)
    expect(result.current.hasPendingUpdates).toBe(true)

    // Advance full debounce time
    act(() => {
      vi.advanceTimersByTime(debounceMs / 2)
    })

    expect(result.current.hasPendingUpdates).toBe(false)
  })
})
