/**
 * React Query hooks for health check and system status
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHapticStore } from '@/contexts/hapticStore'
import { queryKeys, queryDefaults } from '@/lib/queryClient'
import { HapticService } from '@/services/hapticService'
import type { IStatusResponse } from '@/types/hapticTypes'
import { logger } from '@/utils/logger'

/**
 * Hook for health check queries
 * Monitors system health and connection status
 */
export const useHealthQuery = () => {
  const setConnection = useHapticStore(state => state.setConnection)

  return useQuery({
    queryKey: queryKeys.health(),
    queryFn: async () => {
      try {
        const result = await HapticService.checkHealth()
        // Update connection status on successful health check
        setConnection(true)
        return result
      } catch (error) {
        // Update connection status on failed health check
        setConnection(false, error instanceof Error ? error.message : 'Health check failed')
        throw error
      }
    },
    ...queryDefaults.health,
    // Enable background refetch for continuous health monitoring
    refetchInterval: queryDefaults.health.refetchInterval,
    refetchIntervalInBackground: true,
    // Custom error handling for health checks
    retry: (failureCount, error: any) => {
      // Don't retry if it's a network error (likely server down)
      if (error?.code === 'NETWORK_ERROR' || error?.code === 'ECONNREFUSED') {
        return false
      }
      return failureCount < 3
    },
    onError: (error: any) => {
      logger.warn('Health check failed', { error: error instanceof Error ? error.message : error })
      setConnection(false, error.message || 'Connection lost')
    },
    onSuccess: () => {
      setConnection(true)
    },
  })
}

/**
 * Hook for streaming status queries
 * Monitors real-time streaming status with high frequency updates
 */
export const useStreamingStatusQuery = () => {
  const setStatus = useHapticStore(state => state.setStatus)
  const setStreaming = useHapticStore(state => state.setStreaming)

  return useQuery({
    queryKey: queryKeys.streaming(),
    queryFn: async (): Promise<IStatusResponse> => {
      const result = await HapticService.getStreamingStatus()

      // Automatically sync with Zustand store
      setStatus(result)
      setStreaming(result.isStreaming)

      return result
    },
    ...queryDefaults.realTime,
    // Only refetch when streaming is active or we need to check status
    refetchInterval: data => {
      // With WebSocket connection, we don't need frequent polling
      const connectionState = useHapticStore.getState().connection

      // If WebSocket is connected, reduce polling frequency
      if (connectionState.isConnected) {
        return 30000 // 30 seconds - just for health check
      }

      // If streaming is active but no WebSocket, check more frequently
      if (data?.isStreaming) {
        return 3000 // 3 seconds when streaming without WebSocket
      }

      // Default idle interval
      return 10000 // 10 seconds when idle
    },
    onError: (error: any) => {
      logger.error('Failed to fetch streaming status', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
      // Don't update connection status here since health check handles that
    },
  })
}

/**
 * Hook for general system status
 * Combines health and streaming status for comprehensive system monitoring
 */
export const useSystemStatusQuery = () => {
  const healthQuery = useHealthQuery()
  const streamingQuery = useStreamingStatusQuery()

  return {
    // Combined loading state
    isLoading: healthQuery.isLoading || streamingQuery.isLoading,

    // Combined error state
    error: healthQuery.error || streamingQuery.error,

    // System is healthy if health check passes
    isHealthy: healthQuery.isSuccess && !healthQuery.error,

    // Connection status from health check
    isConnected: healthQuery.isSuccess,

    // Streaming status from streaming query
    streamingStatus: streamingQuery.data,
    isStreaming: streamingQuery.data?.isStreaming ?? false,

    // Raw query objects for advanced usage
    healthQuery,
    streamingQuery,

    // Refetch functions
    refetchHealth: healthQuery.refetch,
    refetchStreaming: streamingQuery.refetch,
    refetchAll: () => Promise.all([healthQuery.refetch(), streamingQuery.refetch()]),
  }
}

/**
 * Hook for manual health check
 * Useful for user-triggered health checks
 */
export const useManualHealthCheck = () => {
  const queryClient = useQueryClient()
  const setConnection = useHapticStore(state => state.setConnection)

  const performHealthCheck = async () => {
    try {
      setConnection(true, null) // Clear any previous errors

      // Force refetch health data
      const result = await queryClient.refetchQueries({
        queryKey: queryKeys.health(),
      })

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Health check failed'
      setConnection(false, errorMessage)
      throw error
    }
  }

  return {
    performHealthCheck,
    isLoading: false, // Could add loading state if needed
  }
}
