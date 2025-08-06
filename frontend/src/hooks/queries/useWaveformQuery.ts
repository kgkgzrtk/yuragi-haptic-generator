/**
 * React Query hooks for waveform data fetching with real-time caching
 */
import { useEffect, useRef } from 'react'
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query'
import { useHapticStore } from '@/contexts/hapticStore'
import { queryKeys, queryDefaults } from '@/lib/queryClient'
import { HapticService } from '@/services/hapticService'
import type { IWaveformData } from '@/types/hapticTypes'

interface WaveformQueryParams {
  duration?: number
  sampleRate?: number
  enabled?: boolean
  channelId?: number
  realTime?: boolean
}

/**
 * Hook for fetching waveform data with configurable parameters
 */
export const useWaveformQuery = ({
  duration = 0.1,
  sampleRate = 44100,
  enabled = true,
  realTime = false,
}: WaveformQueryParams = {}) => {

  return useQuery({
    queryKey: queryKeys.waveformData(duration, sampleRate),
    queryFn: async (): Promise<IWaveformData> => {
      return await HapticService.getWaveformData(duration, sampleRate)
    },

    // Use waveform-specific defaults for high-frequency updates
    ...queryDefaults.waveform,

    // Enable query based on enabled flag
    enabled: enabled,

    // Adjust refetch interval based on real-time needs
    refetchInterval: realTime ? 50 : queryDefaults.waveform.refetchInterval, // 50ms for real-time, 100ms default

    // Keep refetching in background for continuous data
    refetchIntervalInBackground: true,

    // Don't show loading state for subsequent fetches (streaming data)
    notifyOnChangeProps: ['data', 'error'],


    // Structure query for efficient updates
    structuralSharing: false, // Disable for better performance with high-frequency updates
  })
}

/**
 * Hook for infinite waveform data queries (for historical data viewing)
 */
export const useInfiniteWaveformQuery = ({
  duration = 0.1,
  sampleRate = 44100,
  enabled = true,
}: WaveformQueryParams = {}) => {
  return useInfiniteQuery({
    queryKey: [...queryKeys.waveformData(duration, sampleRate), 'infinite'],
    queryFn: async ({ pageParam = 0 }): Promise<IWaveformData & { nextCursor?: number }> => {
      const data = await HapticService.getWaveformData(duration, sampleRate)
      return {
        ...data,
        nextCursor: pageParam + 1,
      }
    },

    initialPageParam: 0,
    getNextPageParam: lastPage => lastPage.nextCursor,

    enabled,

    // Less frequent updates for historical data
    staleTime: 5000,
    gcTime: 30000,

  })
}

/**
 * Hook for channel-specific waveform data
 */
export const useChannelWaveformQuery = (channelId: number, params: WaveformQueryParams = {}) => {
  const baseQuery = useWaveformQuery(params)

  // Extract data for specific channel
  const channelWaveformData = baseQuery.data?.channels.find(
    channel => channel.channelId === channelId
  )

  return {
    ...baseQuery,
    channelData: channelWaveformData,
    hasChannelData: !!channelWaveformData,
  }
}

/**
 * Hook for real-time waveform streaming with buffer management
 */
export const useRealTimeWaveformStream = ({
  duration = 0.1,
  sampleRate = 44100,
  bufferSize = 100,
  channelId,
}: WaveformQueryParams & { bufferSize?: number } = {}) => {
  const dataBuffer = useRef<IWaveformData[]>([])

  const query = useQuery({
    queryKey: [...queryKeys.waveformData(duration, sampleRate), 'stream', channelId],
    queryFn: async (): Promise<IWaveformData> => {
      return await HapticService.getWaveformData(duration, sampleRate)
    },

    enabled: true,
    refetchInterval: 50, // Very high frequency for real-time
    refetchIntervalInBackground: true,

    // Minimal cache time for streaming data
    staleTime: 0,
    gcTime: 1000,
  })

  // Update buffer when data changes
  useEffect(() => {
    if (query.data) {
      // Add to buffer
      dataBuffer.current.push(query.data)

      // Maintain buffer size
      if (dataBuffer.current.length > bufferSize) {
        dataBuffer.current = dataBuffer.current.slice(-bufferSize)
      }
    }
  }, [query.data, bufferSize])

  // Get channel-specific data from buffer
  const getChannelBuffer = (targetChannelId: number) => {
    return dataBuffer.current
      .map(waveform => waveform.channels.find(ch => ch.channelId === targetChannelId))
      .filter(Boolean)
  }

  // Get latest data points for all channels
  const getLatestChannelData = () => {
    const latest = dataBuffer.current[dataBuffer.current.length - 1]
    return latest?.channels || []
  }

  return {
    ...query,
    buffer: dataBuffer.current,
    bufferLength: dataBuffer.current.length,
    getChannelBuffer,
    getLatestChannelData,
    clearBuffer: () => {
      dataBuffer.current = []
    },

    // Channel-specific access if channelId provided
    ...(channelId !== undefined && {
      channelBuffer: getChannelBuffer(channelId),
      latestChannelData: getLatestChannelData().find(ch => ch.channelId === channelId),
    }),
  }
}

/**
 * Hook for managing multiple waveform queries for all channels
 */
export const useMultiChannelWaveformQuery = (params: WaveformQueryParams = {}) => {
  const channels = useHapticStore(state => state.channels)

  // Create queries for each channel at hook level to avoid calling hooks in loops
  const device1XQuery = useChannelWaveformQuery(0, {
    ...params,
    enabled: params.enabled !== false,
  })
  const device1YQuery = useChannelWaveformQuery(1, {
    ...params,
    enabled: params.enabled !== false,
  })
  const device2XQuery = useChannelWaveformQuery(2, {
    ...params,
    enabled: params.enabled !== false,
  })
  const device2YQuery = useChannelWaveformQuery(3, {
    ...params,
    enabled: params.enabled !== false,
  })

  // Map queries to channel data
  const channelQueries = [
    { channelId: 0, query: device1XQuery },
    { channelId: 1, query: device1YQuery },
    { channelId: 2, query: device2XQuery },
    { channelId: 3, query: device2YQuery },
  ].filter(item => channels.some(channel => channel.channelId === item.channelId))

  // Aggregate states
  const isLoading = channelQueries.some(cq => cq.query.isLoading)
  const hasError = channelQueries.some(cq => cq.query.isError)
  const errors = channelQueries
    .filter(cq => cq.query.error)
    .map(cq => ({ channelId: cq.channelId, error: cq.query.error }))

  return {
    channelQueries,
    isLoading,
    hasError,
    errors,

    // Get data for specific channel
    getChannelData: (channelId: number) => {
      return channelQueries.find(cq => cq.channelId === channelId)?.query.channelData
    },

    // Get all channel data
    getAllChannelData: () => {
      return channelQueries.map(cq => ({
        channelId: cq.channelId,
        data: cq.query.channelData,
      }))
    },

    // Refetch all channels
    refetchAll: () => {
      return Promise.all(channelQueries.map(cq => cq.query.refetch()))
    },
  }
}

/**
 * Hook for waveform data with automatic pause/resume based on visibility
 */
export const useVisibilityAwareWaveformQuery = (params: WaveformQueryParams = {}) => {
  const queryClient = useQueryClient()
  const query = useWaveformQuery(params)

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Pause queries when tab is not visible
        queryClient.setQueryDefaults(queryKeys.waveform(), {
          enabled: false,
        })
      } else {
        // Resume queries when tab becomes visible
        queryClient.setQueryDefaults(queryKeys.waveform(), {
          enabled: true,
        })
        // Invalidate to get fresh data
        queryClient.invalidateQueries({ queryKey: queryKeys.waveform() })
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [queryClient])

  return query
}

/**
 * Composite hook for complete waveform data management
 */
export const useWaveformDataManagement = (params: WaveformQueryParams = {}) => {
  const standardQuery = useWaveformQuery(params)
  const realtimeStream = useRealTimeWaveformStream(params)
  const multiChannel = useMultiChannelWaveformQuery(params)
  const queryClient = useQueryClient()

  return {
    // Standard query for regular usage
    standard: standardQuery,

    // Real-time stream for high-frequency updates
    realtime: realtimeStream,

    // Multi-channel management
    multiChannel,

    // Utility functions
    pauseAllQueries: () => {
      // Implementation to pause all waveform queries
      queryClient.setQueryDefaults(queryKeys.waveform(), { enabled: false })
    },

    resumeAllQueries: () => {
      // Implementation to resume all waveform queries
      queryClient.setQueryDefaults(queryKeys.waveform(), { enabled: true })
    },
  }
}
