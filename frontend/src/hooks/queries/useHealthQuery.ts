/**
 * React Query hooks for health check and system status
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useHapticStore } from '@/contexts/hapticStore'
import { queryKeys, queryDefaults } from '@/lib/queryClient'
import { HapticService } from '@/services/hapticService'

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
    retry: (failureCount, error: Error) => {
      // Don't retry if it's a network error (likely server down)
      if ('code' in error && (error.code === 'NETWORK_ERROR' || error.code === 'ECONNREFUSED')) {
        return false
      }
      return failureCount < 3
    },
  })
}


/**
 * Hook for general system status
 * Monitors system health and connection status
 */
export const useSystemStatusQuery = () => {
  const healthQuery = useHealthQuery()

  return {
    // Loading state
    isLoading: healthQuery.isLoading,

    // Error state
    error: healthQuery.error,

    // System is healthy if health check passes
    isHealthy: healthQuery.isSuccess && !healthQuery.error,

    // Connection status from health check
    isConnected: healthQuery.isSuccess,

    // Raw query objects for advanced usage
    healthQuery,

    // Refetch functions
    refetchHealth: healthQuery.refetch,
    refetchAll: () => healthQuery.refetch(),
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
