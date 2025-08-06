/**
 * React Query hooks for streaming control with proper state synchronization
 */
import { useCallback, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useHapticStore } from '@/contexts/hapticStore'
import { notificationManager } from '@/hooks/useErrorHandler'
import { queryKeys, invalidateHapticQueries } from '@/lib/queryClient'
import { HapticService } from '@/services/hapticService'
import { logger } from '@/utils/logger'

/**
 * Hook for starting streaming with optimistic updates
 */
export const useStartStreamingMutation = () => {
  const queryClient = useQueryClient()
  const setStreaming = useHapticStore(state => state.setStreaming)
  const setStatus = useHapticStore(state => state.setStatus)

  return useMutation({
    mutationFn: async () => {
      return await HapticService.startStreaming()
    },

    // Optimistic update
    onMutate: async () => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: queryKeys.streaming() })

      // Snapshot previous state
      const previousStreamingState = useHapticStore.getState().isStreaming
      const previousStatus = useHapticStore.getState().status

      // Optimistically update state
      setStreaming(true)

      return { previousStreamingState, previousStatus }
    },

    onError: (error: any, _variables, context) => {
      // Rollback optimistic update
      if (context) {
        setStreaming(context.previousStreamingState)
        if (context.previousStatus) {
          setStatus(context.previousStatus)
        }
      }

      logger.error('Failed to start streaming', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)

      // Show user-friendly error notification
      let errorMessage = 'Failed to start streaming'

      if (error?.response?.data?.detail) {
        const detail = error.response.data.detail
        if (detail.includes('Invalid number of channels')) {
          errorMessage = 'Audio device error: No compatible audio device found. Please connect a 4-channel audio device.'
        } else {
          errorMessage = detail
        }
      } else if (error?.message) {
        errorMessage = error.message
      }

      notificationManager.addNotification({
        title: 'Streaming Error',
        message: errorMessage,
        type: 'error',
        duration: 7000,
        action: {
          label: 'Check Device',
          handler: () => window.location.reload()
        }
      })
    },

    onSuccess: data => {
      // Update streaming state with server response
      setStreaming(data.isStreaming)

      // Invalidate related queries
      invalidateHapticQueries.streaming()
      invalidateHapticQueries.status()
      invalidateHapticQueries.waveform()
    },

    onSettled: () => {
      // Always refetch streaming status after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.streaming() })
    },
  })
}

/**
 * Hook for stopping streaming with optimistic updates
 */
export const useStopStreamingMutation = () => {
  const queryClient = useQueryClient()
  const setStreaming = useHapticStore(state => state.setStreaming)
  const setStatus = useHapticStore(state => state.setStatus)

  return useMutation({
    mutationFn: async () => {
      return await HapticService.stopStreaming()
    },

    // Optimistic update
    onMutate: async () => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: queryKeys.streaming() })

      // Snapshot previous state
      const previousStreamingState = useHapticStore.getState().isStreaming
      const previousStatus = useHapticStore.getState().status

      // Optimistically update state
      setStreaming(false)

      return { previousStreamingState, previousStatus }
    },

    onError: (error: any, _variables, context) => {
      // Rollback optimistic update
      if (context) {
        setStreaming(context.previousStreamingState)
        if (context.previousStatus) {
          setStatus(context.previousStatus)
        }
      }

      logger.error('Failed to stop streaming', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
    },

    onSuccess: data => {
      // Update streaming state with server response
      setStreaming(data.isStreaming)

      // Invalidate related queries
      invalidateHapticQueries.streaming()
      invalidateHapticQueries.status()
      // Don't invalidate waveform queries when stopping - let them naturally stop
    },

    onSettled: () => {
      // Always refetch streaming status after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.streaming() })
    },
  })
}

/**
 * Hook for toggling streaming state
 */
export const useToggleStreamingMutation = () => {
  const startStreamingMutation = useStartStreamingMutation()
  const stopStreamingMutation = useStopStreamingMutation()
  const isStreaming = useHapticStore(state => state.isStreaming)
  const isTogglingRef = useRef(false)

  const toggleStreaming = useCallback(async () => {
    // Prevent multiple simultaneous toggles
    if (isTogglingRef.current) {
      logger.warn('Toggle already in progress, ignoring request')
      return
    }

    isTogglingRef.current = true

    try {
      if (isStreaming) {
        const result = await stopStreamingMutation.mutateAsync()
        return result
      } else {
        const result = await startStreamingMutation.mutateAsync()
        return result
      }
    } catch (error) {
      logger.error('Failed to toggle streaming', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
      throw error
    } finally {
      // Add a small delay before allowing next toggle to prevent chattering
      setTimeout(() => {
        isTogglingRef.current = false
      }, 300)
    }
  }, [isStreaming, startStreamingMutation, stopStreamingMutation])

  return {
    toggleStreaming,
    isToggling: startStreamingMutation.isPending || stopStreamingMutation.isPending || isTogglingRef.current,
    error: startStreamingMutation.error || stopStreamingMutation.error,

    // Individual mutation objects for advanced usage
    startMutation: startStreamingMutation,
    stopMutation: stopStreamingMutation,

    // Reset errors
    reset: () => {
      startStreamingMutation.reset()
      stopStreamingMutation.reset()
    },
  }
}

/**
 * Hook for emergency stop functionality
 */
export const useEmergencyStopMutation = () => {
  const _queryClient = useQueryClient()
  const setStreaming = useHapticStore(state => state.setStreaming)
  const _setStatus = useHapticStore(state => state.setStatus)

  return useMutation({
    mutationFn: async () => {
      // Emergency stop - immediate local state update, then API call
      setStreaming(false)

      try {
        return await HapticService.stopStreaming()
      } catch (error) {
        // Even if API fails, we've stopped locally
        logger.warn('Emergency stop API call failed, but local state updated', { error: error instanceof Error ? error.message : error })
        return { status: 'emergency_stop_local', isStreaming: false }
      }
    },

    // No optimistic update needed - we already updated in mutationFn
    onSuccess: _data => {
      // Ensure state is consistent with server
      setStreaming(false)

      // Invalidate all related queries
      invalidateHapticQueries.all()
    },

    onError: (error: any) => {
      // Even on error, ensure streaming is stopped locally
      setStreaming(false)
      logger.error('Emergency stop failed', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
    },
  })
}

/**
 * Hook for streaming state management with automatic recovery
 */
export const useStreamingStateManager = () => {
  const _queryClient = useQueryClient()
  const isStreaming = useHapticStore(state => state.isStreaming)
  const connection = useHapticStore(state => state.connection)
  const setStreaming = useHapticStore(state => state.setStreaming)

  const startMutation = useStartStreamingMutation()
  const stopMutation = useStopStreamingMutation()
  const toggleMutation = useToggleStreamingMutation()
  const emergencyStopMutation = useEmergencyStopMutation()

  // Auto-recovery when connection is restored
  const handleConnectionRestore = useCallback(async () => {
    if (connection.isConnected && isStreaming) {
      try {
        // Verify streaming state with server
        const status = await HapticService.getStreamingStatus()

        if (status.isStreaming !== isStreaming) {
          // State mismatch - sync with server
          setStreaming(status.isStreaming)

          // If we think we're streaming but server says we're not, restart
          if (isStreaming && !status.isStreaming) {
            await startMutation.mutateAsync()
          }
        }
      } catch (error) {
        logger.error('Failed to sync streaming state after connection restore', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
      }
    }
  }, [connection.isConnected, isStreaming, setStreaming, startMutation])

  return {
    // Current state
    isStreaming,
    isConnected: connection.isConnected,
    connectionError: connection.error,

    // Actions
    startStreaming: startMutation.mutate,
    stopStreaming: stopMutation.mutate,
    toggleStreaming: toggleMutation.toggleStreaming,
    emergencyStop: emergencyStopMutation.mutate,

    // Async actions
    startStreamingAsync: startMutation.mutateAsync,
    stopStreamingAsync: stopMutation.mutateAsync,
    toggleStreamingAsync: toggleMutation.toggleStreaming,
    emergencyStopAsync: emergencyStopMutation.mutateAsync,

    // State management
    handleConnectionRestore,

    // Status
    isLoading: startMutation.isPending || stopMutation.isPending || emergencyStopMutation.isPending,
    isToggling: toggleMutation.isToggling,
    error: startMutation.error || stopMutation.error || emergencyStopMutation.error,

    // Reset
    reset: () => {
      startMutation.reset()
      stopMutation.reset()
      toggleMutation.reset()
      emergencyStopMutation.reset()
    },
  }
}

/**
 * Hook for streaming session management with timeout
 */
export const useStreamingSession = (timeoutMs: number = 300000) => {
  // 5 minutes default
  const streamingManager = useStreamingStateManager()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const startSession = useCallback(async () => {
    try {
      await streamingManager.startStreamingAsync()

      // Set timeout for automatic stop
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      timeoutRef.current = setTimeout(() => {
        streamingManager.stopStreaming()
        logger.info('Streaming session timed out', { timeoutSeconds: timeoutMs / 1000 })
      }, timeoutMs)
    } catch (error) {
      logger.error('Failed to start streaming session', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
      throw error
    }
  }, [streamingManager, timeoutMs])

  const endSession = useCallback(async () => {
    try {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      await streamingManager.stopStreamingAsync()
    } catch (error) {
      logger.error('Failed to end streaming session', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
      throw error
    }
  }, [streamingManager])

  const extendSession = useCallback(() => {
    if (timeoutRef.current && streamingManager.isStreaming) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        streamingManager.stopStreaming()
        logger.info('Extended streaming session timed out')
      }, timeoutMs)
    }
  }, [streamingManager, timeoutMs])

  return {
    ...streamingManager,
    startSession,
    endSession,
    extendSession,
    hasActiveTimeout: !!timeoutRef.current,
  }
}
