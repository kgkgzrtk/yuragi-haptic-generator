/**
 * Middleware to synchronize React Query state with Zustand store
 * Provides a clean bridge between the two state management systems
 */
import { QueryClient } from '@tanstack/react-query'
import { StateCreator } from 'zustand'
import type {
  IChannelParameters,
  IStatusResponse,
  IVectorForce,
  IParametersResponse,
} from '@/types/hapticTypes'
import { logger } from '@/utils/logger'
import { queryKeys } from './queryClient'

export interface QuerySyncActions {
  // Query sync actions
  syncParametersFromQuery: (queryClient: QueryClient) => void
  syncStatusFromQuery: (queryClient: QueryClient) => void
  syncStreamingFromQuery: (queryClient: QueryClient) => void

  // Mutation helpers
  onParameterMutationSuccess: (queryClient: QueryClient, data: any) => void
  onStreamingMutationSuccess: (queryClient: QueryClient, data: any) => void
  onVectorForceMutationSuccess: (queryClient: QueryClient, deviceId: number, data: any) => void
}

/**
 * Zustand middleware for React Query synchronization
 */
export const createQuerySyncMiddleware = <T extends QuerySyncActions>(_queryClient: QueryClient) => {
  return (config: StateCreator<T, [], [], T>): StateCreator<T, [], [], T> => {
    return (set, get, api) => {
      const store = config(set, get, api)

      // Add query sync methods
      const syncActions: QuerySyncActions = {
        syncParametersFromQuery: (queryClient: QueryClient) => {
          const parametersData = queryClient.getQueryData<IParametersResponse>(
            queryKeys.parameters()
          )

          if (parametersData?.channels) {
            // @ts-expect-error - We know the store has setChannels method
            set(state => ({ ...state, channels: parametersData.channels }))
          }
        },

        syncStatusFromQuery: (queryClient: QueryClient) => {
          const statusData = queryClient.getQueryData<IStatusResponse>(queryKeys.status())

          if (statusData) {
            // @ts-expect-error - We know the store has setStatus method
            set(state => ({ ...state, status: statusData }))
          }
        },

        syncStreamingFromQuery: (queryClient: QueryClient) => {
          const streamingData = queryClient.getQueryData<IStatusResponse>(queryKeys.streaming())

          if (streamingData) {
            // @ts-expect-error - We know the store has setStreaming method
            set(state => ({ ...state, isStreaming: streamingData.isStreaming }))
          }
        },

        onParameterMutationSuccess: (queryClient: QueryClient, data: any) => {
          // Sync with query cache
          queryClient.setQueryData(
            queryKeys.parameters(),
            (old: IParametersResponse | undefined) => {
              if (!old) {
                return old
              }
              return { channels: data.channels || old.channels }
            }
          )
        },

        onStreamingMutationSuccess: (queryClient: QueryClient, data: any) => {
          // Sync streaming state
          queryClient.setQueryData(queryKeys.streaming(), (old: IStatusResponse | undefined) => {
            if (!old) {
              return { ...old, isStreaming: data.isStreaming }
            }
            return { ...old, isStreaming: data.isStreaming }
          })
        },

        onVectorForceMutationSuccess: (queryClient: QueryClient, deviceId: number, data: any) => {
          // Sync vector force state
          queryClient.setQueryData(queryKeys.vectorForceByDevice(deviceId), data)
        },
      }

      return {
        ...store,
        ...syncActions,
      } as T
    }
  }
}

/**
 * Hook to establish bidirectional sync between React Query and Zustand
 */
export const useQueryStoreSync = (
  queryClient: QueryClient,
  store: any // The Zustand store
) => {
  // Set up query cache subscribers to sync with Zustand
  const setupQuerySubscriptions = () => {
    // Subscribe to parameter changes
    const parametersUnsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.query.queryKey[1] === 'parameters') {
        const data = event.query.state.data as IParametersResponse
        if (data?.channels && store.getState().setChannels) {
          store.getState().setChannels(data.channels)
        }
      }
    })

    // Subscribe to streaming status changes
    const streamingUnsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.query.queryKey[1] === 'streaming') {
        const data = event.query.state.data as IStatusResponse
        if (data && store.getState().setStreaming && store.getState().setStatus) {
          store.getState().setStreaming(data.isStreaming)
          store.getState().setStatus(data)
        }
      }
    })

    // Subscribe to health/connection changes
    const healthUnsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (event.type === 'updated' && event.query.queryKey[1] === 'health') {
        const isSuccess = event.query.state.status === 'success'
        const error = event.query.state.error

        if (store.getState().setConnection) {
          store.getState().setConnection(isSuccess, error ? (error as any).message : null)
        }
      }
    })

    return () => {
      parametersUnsubscribe()
      streamingUnsubscribe()
      healthUnsubscribe()
    }
  }

  return {
    setupQuerySubscriptions,

    // Manual sync functions
    syncAll: () => {
      if (store.getState().syncParametersFromQuery) {
        store.getState().syncParametersFromQuery(queryClient)
      }
      if (store.getState().syncStatusFromQuery) {
        store.getState().syncStatusFromQuery(queryClient)
      }
      if (store.getState().syncStreamingFromQuery) {
        store.getState().syncStreamingFromQuery(queryClient)
      }
    },
  }
}

/**
 * Utility to create optimistic update helpers
 */
export const createOptimisticUpdateHelpers = (queryClient: QueryClient) => {
  return {
    // Optimistic parameter update
    updateParameterOptimistically: (channelId: number, updates: Partial<IChannelParameters>) => {
      queryClient.setQueryData<IParametersResponse>(queryKeys.parameters(), old => {
        if (!old) {
          return old
        }

        return {
          channels: old.channels.map(channel =>
            channel.channelId === channelId ? { ...channel, ...updates } : channel
          ),
        }
      })
    },

    // Optimistic streaming update
    updateStreamingOptimistically: (isStreaming: boolean) => {
      queryClient.setQueryData<IStatusResponse>(queryKeys.streaming(), old =>
        old ? { ...old, isStreaming } : ({ isStreaming } as any)
      )
    },

    // Optimistic vector force update
    updateVectorForceOptimistically: (deviceId: number, vectorForce: IVectorForce | null) => {
      queryClient.setQueryData(queryKeys.vectorForceByDevice(deviceId), vectorForce)
    },

    // Rollback functions
    rollbackParameter: (channelId: number, previousData: IParametersResponse) => {
      queryClient.setQueryData(queryKeys.parameters(), previousData)
    },

    rollbackStreaming: (previousData: IStatusResponse) => {
      queryClient.setQueryData(queryKeys.streaming(), previousData)
    },

    rollbackVectorForce: (deviceId: number, previousData: IVectorForce | null) => {
      queryClient.setQueryData(queryKeys.vectorForceByDevice(deviceId), previousData)
    },
  }
}

/**
 * Enhanced error handling that syncs with both systems
 */
export const createSyncedErrorHandler = (queryClient: QueryClient, store: any) => {
  return {
    handleParameterError: (error: any, _channelId?: number) => {
      // Set error state in both systems
      logger.error('Parameter error', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: queryKeys.parameters() })

      // Update store error state if available
      if (store.getState().setConnection && error.code === 'NETWORK_ERROR') {
        store.getState().setConnection(false, 'Network error during parameter update')
      }
    },

    handleStreamingError: (error: any) => {
      logger.error('Streaming error', { error: error instanceof Error ? error.message : error })

      // Force local streaming state to false on critical errors
      if (error.code === 'NETWORK_ERROR') {
        queryClient.setQueryData(queryKeys.streaming(), (old: any) =>
          old ? { ...old, isStreaming: false } : { isStreaming: false }
        )

        if (store.getState().setStreaming) {
          store.getState().setStreaming(false)
        }
      }
    },

    handleConnectionError: (error: any) => {
      logger.error('Connection error', { error: error instanceof Error ? error.message : error })

      // Update connection state in store
      if (store.getState().setConnection) {
        store.getState().setConnection(false, error.message || 'Connection lost')
      }

      // Pause background queries
      queryClient.setDefaultOptions({
        queries: {
          ...queryClient.getDefaultOptions().queries,
          enabled: false,
        },
      })
    },

    handleConnectionRestore: () => {
      logger.info('Connection restored')

      // Update connection state in store
      if (store.getState().setConnection) {
        store.getState().setConnection(true, null)
      }

      // Resume background queries
      queryClient.setDefaultOptions({
        queries: {
          ...queryClient.getDefaultOptions().queries,
          enabled: true,
        },
      })

      // Invalidate all queries to refetch fresh data
      queryClient.invalidateQueries()
    },
  }
}
