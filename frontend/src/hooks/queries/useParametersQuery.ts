/**
 * React Query hooks for parameter management with optimistic updates
 */
import { useRef, useState, useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useHapticStore } from '@/contexts/hapticStore'
import { queryKeys, queryDefaults } from '@/lib/queryClient'
import { HapticService } from '@/services/hapticService'
import type { IChannelParameters, IParametersResponse } from '@/types/hapticTypes'
import { logger } from '@/utils/logger'

/**
 * Hook for fetching all channel parameters
 */
export const useParametersQuery = () => {
  const setChannels = useHapticStore(state => state.setChannels)

  return useQuery({
    queryKey: queryKeys.parameters(),
    queryFn: async (): Promise<IParametersResponse> => {
      const result = await HapticService.getParameters()

      // Sync with Zustand store
      setChannels(result.channels)

      return result
    },
    ...queryDefaults.parameters,
  })
}

/**
 * Hook for updating all channel parameters at once
 */
export const useUpdateParametersMutation = () => {
  const queryClient = useQueryClient()
  const setChannels = useHapticStore(state => state.setChannels)

  return useMutation({
    mutationFn: async (channels: IChannelParameters[]) => {
      return await HapticService.updateParameters(channels)
    },

    // Optimistic update
    onMutate: async newChannels => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.parameters() })

      // Snapshot previous value
      const previousParameters = queryClient.getQueryData<IParametersResponse>(
        queryKeys.parameters()
      )

      // Optimistically update cache
      queryClient.setQueryData<IParametersResponse>(queryKeys.parameters(), _old => ({
        channels: newChannels,
      }))

      // Optimistically update Zustand store
      setChannels(newChannels)

      return { previousParameters }
    },

    onError: (error: any, _variables, context) => {
      // Rollback optimistic update
      if (context?.previousParameters) {
        queryClient.setQueryData(queryKeys.parameters(), context.previousParameters)
        setChannels(context.previousParameters.channels)
      }

      logger.error('Failed to update parameters', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
    },


    onSettled: () => {
      // Always refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.parameters() })
    },
  })
}

/**
 * Hook for updating a single channel with optimistic updates
 */
export const useUpdateChannelMutation = () => {
  const queryClient = useQueryClient()
  const updateChannel = useHapticStore(state => state.updateChannel)

  return useMutation({
    mutationFn: async ({
      channelId,
      params,
    }: {
      channelId: number
      params: Partial<Omit<IChannelParameters, 'channelId'>>
    }) => {
      return await HapticService.updateChannel(channelId, params)
    },

    // Optimistic update for single channel
    onMutate: async ({ channelId, params }) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.parameters() })

      // Snapshot previous value
      const previousParameters = queryClient.getQueryData<IParametersResponse>(
        queryKeys.parameters()
      )

      // Optimistically update cache
      queryClient.setQueryData<IParametersResponse>(queryKeys.parameters(), old => {
        if (!old) {
          return old
        }

        return {
          channels: old.channels.map(channel =>
            channel.channelId === channelId ? { ...channel, ...params } : channel
          ),
        }
      })

      // Optimistically update Zustand store
      updateChannel(channelId, params)

      return { previousParameters, channelId, params }
    },

    onError: (error: any, variables, context) => {
      // Rollback optimistic update
      if (context?.previousParameters) {
        queryClient.setQueryData(queryKeys.parameters(), context.previousParameters)

        // Rollback Zustand store
        const previousChannel = context.previousParameters.channels.find(
          ch => ch.channelId === context.channelId
        )
        if (previousChannel) {
          updateChannel(context.channelId, previousChannel)
        }
      }

      logger.error('Failed to update channel parameters', { channelId: variables.channelId, error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
    },


    onSettled: (_data, error, _variables) => {
      // Only refetch if there was an error or after a delay
      if (error) {
        queryClient.invalidateQueries({ queryKey: queryKeys.parameters() })
      } else {
        // Delayed refetch to ensure backend consistency
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: queryKeys.parameters() })
        }, 1000)
      }
    },
  })
}

/**
 * Hook for getting parameters of a specific channel
 */
export const useChannelParametersQuery = (channelId: number) => {
  const channelFromStore = useHapticStore(state =>
    state.channels.find(ch => ch.channelId === channelId)
  )

  return useQuery({
    queryKey: queryKeys.parametersByChannel(channelId),
    queryFn: async (): Promise<IChannelParameters | undefined> => {
      const result = await HapticService.getParameters()
      return result.channels.find(ch => ch.channelId === channelId)
    },
    ...queryDefaults.parameters,

    // Use store data as initial data for instant loading
    initialData: channelFromStore,

    // Enable this query only if channelId is valid
    enabled: channelId >= 0,

  })
}

/**
 * Composite hook for complete parameter management
 */
export const useParameterManagement = () => {
  const parametersQuery = useParametersQuery()
  const updateParametersMutation = useUpdateParametersMutation()
  const updateChannelMutation = useUpdateChannelMutation()

  return {
    // Query state
    parameters: parametersQuery.data?.channels ?? [],
    isLoading: parametersQuery.isLoading,
    error: parametersQuery.error,
    isError: parametersQuery.isError,

    // Mutation state
    isUpdating: updateParametersMutation.isPending || updateChannelMutation.isPending,
    updateError: updateParametersMutation.error || updateChannelMutation.error,

    // Actions
    updateAllParameters: updateParametersMutation.mutate,
    updateChannel: updateChannelMutation.mutate,

    // Advanced actions
    updateChannelField: (channelId: number, field: keyof IChannelParameters, value: any) => {
      updateChannelMutation.mutate({
        channelId,
        params: { [field]: value },
      })
    },

    // Async actions with promise returns
    updateAllParametersAsync: updateParametersMutation.mutateAsync,
    updateChannelAsync: updateChannelMutation.mutateAsync,

    // Refetch
    refetch: parametersQuery.refetch,

    // Reset mutations
    reset: () => {
      updateParametersMutation.reset()
      updateChannelMutation.reset()
    },
  }
}

/**
 * Hook for batch parameter updates with debouncing
 */
export const useBatchParameterUpdates = (debounceMs: number = 300) => {
  const updateChannelMutation = useUpdateChannelMutation()

  // Use refs to persist values across renders
  const pendingUpdatesRef = useRef(new Map<number, Partial<IChannelParameters>>())
  const debounceTimerRef = useRef<number | null>(null)
  const [_updateTrigger, setUpdateTrigger] = useState(0)

  const batchUpdate = useCallback(
    (channelId: number, params: Partial<IChannelParameters>) => {
      // Add to pending updates
      const existing = pendingUpdatesRef.current.get(channelId) || {}
      pendingUpdatesRef.current.set(channelId, { ...existing, ...params })

      // Trigger re-render to update UI
      setUpdateTrigger(prev => prev + 1)

      // Clear existing timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      // Set new timer
      debounceTimerRef.current = setTimeout(async () => {
        // Process all pending updates
        const updates = Array.from(pendingUpdatesRef.current.entries())

        // Clear pending updates immediately after capturing them
        pendingUpdatesRef.current.clear()
        setUpdateTrigger(prev => prev + 1)

        // Execute updates
        for (const [channelId, params] of updates) {
          updateChannelMutation.mutate({ channelId, params })
        }
      }, debounceMs)
    },
    [updateChannelMutation, debounceMs]
  )

  const clearPending = useCallback(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
      debounceTimerRef.current = null
    }
    pendingUpdatesRef.current.clear()
    setUpdateTrigger(prev => prev + 1)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  return {
    batchUpdate,
    hasPendingUpdates: pendingUpdatesRef.current.size > 0,
    pendingCount: pendingUpdatesRef.current.size,
    clearPending,
  }
}
