/**
 * React Query client configuration optimized for haptic system requirements
 */
import { QueryClient } from '@tanstack/react-query'

// Query key factory for consistent cache key management
export const queryKeys = {
  all: ['haptic'] as const,
  health: () => [...queryKeys.all, 'health'] as const,
  parameters: () => [...queryKeys.all, 'parameters'] as const,
  parametersByChannel: (channelId: number) => [...queryKeys.parameters(), channelId] as const,
  status: () => [...queryKeys.all, 'status'] as const,
  streaming: () => [...queryKeys.all, 'streaming'] as const,
  waveform: () => [...queryKeys.all, 'waveform'] as const,
  waveformData: (duration: number, sampleRate: number) =>
    [...queryKeys.waveform(), duration, sampleRate] as const,
  vectorForce: () => [...queryKeys.all, 'vector-force'] as const,
  vectorForceByDevice: (deviceId: number) => [...queryKeys.vectorForce(), deviceId] as const,
  device: () => [...queryKeys.all, 'device'] as const,
}

// Default query options for different types of queries
const queryDefaults = {
  // Real-time status queries - frequent updates needed
  realTime: {
    staleTime: 1000, // 1 second
    gcTime: 5 * 60 * 1000, // 5 minutes (formerly cacheTime)
    refetchInterval: 2000, // 2 seconds
    refetchIntervalInBackground: true,
    retry: 3,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  },

  // Parameter queries - moderate update frequency
  parameters: {
    staleTime: 5000, // 5 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 5000),
  },

  // Waveform data - high frequency, short cache
  waveform: {
    staleTime: 500, // 0.5 seconds
    gcTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 100, // 100ms for real-time visualization
    refetchIntervalInBackground: true,
    retry: 1,
    retryDelay: 100,
  },

  // Health check - infrequent but important
  health: {
    staleTime: 30000, // 30 seconds
    gcTime: 60 * 60 * 1000, // 1 hour
    refetchInterval: 30000, // 30 seconds
    retry: 5,
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
  },

  // Default settings for general queries
  default: {
    staleTime: 5000, // 5 seconds
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: true,
    retry: 2,
    retryDelay: (attemptIndex: number) => Math.min(500 * 2 ** attemptIndex, 5000),
  },
}

// Create optimized query client for haptic system
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Global defaults
      staleTime: 5000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Network mode configuration for offline support
      networkMode: 'online',
    },
    mutations: {
      // Global mutation defaults
      retry: 1,
      retryDelay: 1000,
      networkMode: 'online',

      // Global error handling for mutations
      onError: (error: any) => {
        console.error('Mutation error:', error)
        // TODO: Integrate with toast notification system
      },
    },
  },
})

// Export query defaults for use in custom hooks
export { queryDefaults }

// Utility function to invalidate related queries
export const invalidateHapticQueries = {
  all: () => queryClient.invalidateQueries({ queryKey: queryKeys.all }),
  parameters: () => queryClient.invalidateQueries({ queryKey: queryKeys.parameters() }),
  status: () => queryClient.invalidateQueries({ queryKey: queryKeys.status() }),
  streaming: () => queryClient.invalidateQueries({ queryKey: queryKeys.streaming() }),
  waveform: () => queryClient.invalidateQueries({ queryKey: queryKeys.waveform() }),
  vectorForce: () => queryClient.invalidateQueries({ queryKey: queryKeys.vectorForce() }),
}

// Background sync for critical real-time data
export const startBackgroundSync = () => {
  // Prefetch critical data in the background
  const prefetchCriticalData = async () => {
    await Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: queryKeys.health(),
        staleTime: queryDefaults.health.staleTime,
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.status(),
        staleTime: queryDefaults.realTime.staleTime,
      }),
    ])
  }

  // Initial prefetch
  prefetchCriticalData()

  // Set up periodic prefetch for critical data
  const interval = setInterval(prefetchCriticalData, 30000) // Every 30 seconds

  return () => clearInterval(interval)
}
