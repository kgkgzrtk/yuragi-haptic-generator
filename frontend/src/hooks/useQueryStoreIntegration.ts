/**
 * Hook to integrate React Query with Zustand store
 * Provides bidirectional synchronization and shared state management
 */
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useHapticStore } from '@/contexts/hapticStore'
import { useQueryStoreSync } from '@/lib/zustandQuerySync'
import { logger } from '@/utils/logger'

/**
 * Master integration hook that sets up all synchronization
 * Call this once in your main App component
 */
export const useQueryStoreIntegration = () => {
  const queryClient = useQueryClient()
  const store = useHapticStore

  const { setupQuerySubscriptions, syncAll } = useQueryStoreSync(queryClient, store)

  useEffect(() => {
    // Set up bidirectional sync
    const unsubscribe = setupQuerySubscriptions()

    // Initial sync from cache to store
    syncAll()

    // Cleanup subscriptions on unmount
    return unsubscribe
  }, [setupQuerySubscriptions, syncAll])

  return {
    // Expose manual sync functions if needed
    syncAll,
    queryClient,
    store,
  }
}

/**
 * Hook for components that need to trigger manual synchronization
 */
export const useManualSync = () => {
  const queryClient = useQueryClient()
  const store = useHapticStore

  const syncParametersToStore = () => {
    const parametersData = queryClient.getQueryData(['haptic', 'parameters']) as any

    if (parametersData?.channels) {
      store.getState().setChannels(parametersData.channels)
    }
  }

  const syncStatusToStore = () => {
    const statusData = queryClient.getQueryData(['haptic', 'streaming']) as any

    if (statusData) {
      store.getState().setStatus(statusData)
      store.getState().setStreaming(statusData.isStreaming)
    }
  }

  const syncConnectionToStore = () => {
    const healthData = queryClient.getQueryData(['haptic', 'health']) as any

    const isConnected =
      !!healthData && queryClient.getQueryState(['haptic', 'health'])?.status === 'success'
    const error = queryClient.getQueryState(['haptic', 'health'])?.error as any

    store.getState().setConnection(isConnected, error?.message || null)
  }

  const syncAll = () => {
    // Sync all data from queries to store
    syncParametersToStore()
    syncStatusToStore()
    syncConnectionToStore()
  }

  return {
    syncParametersToStore,
    syncStatusToStore,
    syncConnectionToStore,
    syncAll,
  }
}

/**
 * Hook that provides optimistic update helpers with store sync
 */
export const useOptimisticUpdates = () => {
  const queryClient = useQueryClient()
  const store = useHapticStore
  const { syncAll } = useManualSync()

  return {
    updateParameterOptimistically: (channelId: number, updates: Partial<any>) => {
      // Update both query cache and store
      queryClient.setQueryData(['haptic', 'parameters'], (old: any) => {
        if (!old) {
          return old
        }

        const newData = {
          channels: old.channels.map((channel: any) =>
            channel.channelId === channelId ? { ...channel, ...updates } : channel
          ),
        }

        // Sync to store
        store.getState().setChannels(newData.channels)

        return newData
      })
    },

    updateStreamingOptimistically: (isStreaming: boolean) => {
      // Update both query cache and store
      queryClient.setQueryData(['haptic', 'streaming'], (old: any) => {
        const newData = old ? { ...old, isStreaming } : { isStreaming }

        // Sync to store
        store.getState().setStreaming(isStreaming)
        store.getState().setStatus(newData)

        return newData
      })
    },

    updateVectorForceOptimistically: (deviceId: number, vectorForce: any) => {
      // Update both query cache and store
      queryClient.setQueryData(['haptic', 'vector-force', deviceId], vectorForce)
      store.getState().setVectorForce(deviceId as 1 | 2, vectorForce)
    },

    rollbackOptimisticUpdate: (queryKey: any[], previousData: any) => {
      // Rollback query cache
      queryClient.setQueryData(queryKey, previousData)

      // Re-sync from cache to store
      syncAll()
    },
  }
}

/**
 * Hook for handling errors that affect both systems
 */
export const useIntegratedErrorHandling = () => {
  const queryClient = useQueryClient()
  const store = useHapticStore
  const { syncAll } = useManualSync()

  return {
    handleNetworkError: (error: any) => {
      // Update connection state in store
      store.getState().setConnection(false, error.message || 'Network error')

      // Stop streaming if active
      store.getState().setStreaming(false)

      // Update query cache to reflect disconnected state
      queryClient.setQueryData(['haptic', 'streaming'], (old: any) =>
        old ? { ...old, isStreaming: false } : { isStreaming: false }
      )
    },

    handleConnectionRestore: () => {
      // Update connection state in store
      store.getState().setConnection(true, null)

      // Invalidate and refetch all queries
      queryClient.invalidateQueries({ queryKey: ['haptic'] })
    },

    handleMutationError: (queryKey: any[], previousData: any, error: any) => {
      // Rollback optimistic update
      queryClient.setQueryData(queryKey, previousData)

      // Re-sync store from cache
      syncAll()

      // Log error
      logger.error('Mutation failed, rolled back', { error: error instanceof Error ? error.message : error }, error instanceof Error ? error : undefined)
    },
  }
}
