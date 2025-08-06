/**
 * React Query hooks for vector force control with optimistic updates
 */
import { useCallback, useMemo } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { useHapticStore } from '@/contexts/hapticStore'
import { queryKeys, queryDefaults } from '@/lib/queryClient'
import { HapticService } from '@/services/hapticService'
import type { IVectorForce } from '@/types/hapticTypes'
import { logger } from '@/utils/logger'

/**
 * Hook for setting vector force with optimistic updates
 */
export const useSetVectorForceMutation = () => {
  const queryClient = useQueryClient()
  const setVectorForce = useHapticStore(state => state.setVectorForce)

  return useMutation({
    mutationFn: async (params: IVectorForce) => {
      return await HapticService.setVectorForce(params)
    },

    // Optimistic update
    onMutate: async newVectorForce => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.vectorForceByDevice(newVectorForce.deviceId),
      })

      // Snapshot previous value
      const currentState = useHapticStore.getState().vectorForce
      const previousVectorForce =
        currentState[`device${newVectorForce.deviceId}` as keyof typeof currentState]

      // Optimistically update Zustand store
      setVectorForce(newVectorForce.deviceId, newVectorForce)

      // Optimistically update cache
      queryClient.setQueryData(
        queryKeys.vectorForceByDevice(newVectorForce.deviceId),
        newVectorForce
      )

      return { previousVectorForce, deviceId: newVectorForce.deviceId }
    },

    onError: (_error, variables, context) => {
      // Rollback optimistic update
      if (context) {
        setVectorForce(context.deviceId, context.previousVectorForce)
        queryClient.setQueryData(
          queryKeys.vectorForceByDevice(context.deviceId),
          context.previousVectorForce
        )
      }

      logger.error('Failed to set vector force for device', { deviceId: variables.deviceId, error: _error instanceof Error ? _error.message : _error }, _error instanceof Error ? _error : undefined)
    },


    onSettled: (_data, _error, variables) => {
      // Refetch to ensure consistency with server
      queryClient.invalidateQueries({
        queryKey: queryKeys.vectorForceByDevice(variables.deviceId),
      })
    },
  })
}

/**
 * Hook for clearing vector force (setting to zero/null)
 */
export const useClearVectorForceMutation = () => {
  const queryClient = useQueryClient()
  const setVectorForce = useHapticStore(state => state.setVectorForce)

  return useMutation({
    mutationFn: async (deviceId: 1 | 2) => {
      // Clear by setting magnitude to 0
      const clearForce: IVectorForce = {
        deviceId,
        angle: 0,
        magnitude: 0,
        frequency: 60, // Default frequency
      }

      return await HapticService.setVectorForce(clearForce)
    },

    // Optimistic update
    onMutate: async deviceId => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.vectorForceByDevice(deviceId),
      })

      // Snapshot previous value
      const currentState = useHapticStore.getState().vectorForce
      const previousVectorForce = currentState[`device${deviceId}` as keyof typeof currentState]

      // Optimistically clear vector force
      setVectorForce(deviceId, null)

      // Optimistically update cache
      queryClient.setQueryData(queryKeys.vectorForceByDevice(deviceId), null)

      return { previousVectorForce, deviceId }
    },

    onError: (_error, deviceId, context) => {
      // Rollback optimistic update
      if (context) {
        setVectorForce(context.deviceId, context.previousVectorForce)
        queryClient.setQueryData(
          queryKeys.vectorForceByDevice(context.deviceId),
          context.previousVectorForce
        )
      }

      logger.error('Failed to clear vector force for device', { deviceId, error: _error instanceof Error ? _error.message : _error }, _error instanceof Error ? _error : undefined)
    },


    onSettled: (_data, _error, deviceId) => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({
        queryKey: queryKeys.vectorForceByDevice(deviceId),
      })
    },
  })
}

/**
 * Hook for getting current vector force for a specific device
 */
export const useVectorForceQuery = (deviceId: 1 | 2) => {
  const vectorForceFromStore = useHapticStore(
    state => state.vectorForce[`device${deviceId}` as keyof typeof state.vectorForce]
  )

  return useQuery({
    queryKey: queryKeys.vectorForceByDevice(deviceId),
    queryFn: async (): Promise<IVectorForce | null> => {
      // Note: The API doesn't have a GET endpoint for vector force
      // We rely on the store as the source of truth
      return vectorForceFromStore
    },

    // Use store data as initial data
    initialData: vectorForceFromStore,

    // Less frequent updates since vector force is user-controlled
    ...queryDefaults.parameters,

    enabled: true,

  })
}

/**
 * Hook for vector force validation
 */
export const useVectorForceValidation = () => {
  const validateVectorForce = useCallback(
    (
      force: Partial<IVectorForce>
    ): {
      isValid: boolean
      errors: Partial<Record<keyof IVectorForce, string>>
    } => {
      const errors: Partial<Record<keyof IVectorForce, string>> = {}

      if (force.angle !== undefined && (force.angle < 0 || force.angle > 360)) {
        errors.angle = 'Angle must be between 0-360 degrees'
      }

      if (force.magnitude !== undefined && (force.magnitude < 0 || force.magnitude > 1)) {
        errors.magnitude = 'Magnitude must be between 0-1'
      }

      if (force.frequency !== undefined && (force.frequency < 40 || force.frequency > 120)) {
        errors.frequency = 'Frequency must be between 40-120 Hz'
      }

      return {
        isValid: Object.keys(errors).length === 0,
        errors,
      }
    },
    []
  )

  return { validateVectorForce }
}

/**
 * Hook for vector force presets
 */
export const useVectorForcePresets = () => {
  const setVectorForceMutation = useSetVectorForceMutation()

  const presets = useMemo(() => ({
    // Directional presets
    north: { angle: 90, magnitude: 0.5, frequency: 80 },
    south: { angle: 270, magnitude: 0.5, frequency: 80 },
    east: { angle: 0, magnitude: 0.5, frequency: 80 },
    west: { angle: 180, magnitude: 0.5, frequency: 80 },

    // Intensity presets
    gentle: { angle: 45, magnitude: 0.3, frequency: 60 },
    moderate: { angle: 45, magnitude: 0.6, frequency: 80 },
    strong: { angle: 45, magnitude: 0.9, frequency: 100 },

    // Pattern presets
    circle: [
      { angle: 0, magnitude: 0.5, frequency: 70 },
      { angle: 90, magnitude: 0.5, frequency: 70 },
      { angle: 180, magnitude: 0.5, frequency: 70 },
      { angle: 270, magnitude: 0.5, frequency: 70 },
    ],
  }), [])

  const applyPreset = useCallback(
    async (deviceId: 1 | 2, presetName: keyof typeof presets) => {
      const preset = presets[presetName]

      if (Array.isArray(preset)) {
        // Sequential pattern for array presets
        for (const force of preset) {
          await setVectorForceMutation.mutateAsync({ deviceId, ...force })
          await new Promise(resolve => setTimeout(resolve, 500)) // 500ms delay between changes
        }
      } else {
        // Single preset
        await setVectorForceMutation.mutateAsync({ deviceId, ...preset })
      }
    },
    [setVectorForceMutation, presets]
  )

  return {
    presets,
    applyPreset,
    isApplyingPreset: setVectorForceMutation.isPending,
  }
}

/**
 * Composite hook for complete vector force management
 */
export const useVectorForceManagement = (deviceId: 1 | 2) => {
  const vectorForceQuery = useVectorForceQuery(deviceId)
  const setVectorForceMutation = useSetVectorForceMutation()
  const clearVectorForceMutation = useClearVectorForceMutation()
  const validation = useVectorForceValidation()
  const presets = useVectorForcePresets()

  const currentVectorForce = vectorForceQuery.data

  return {
    // Current state
    vectorForce: currentVectorForce,
    hasVectorForce: !!currentVectorForce && currentVectorForce.magnitude > 0,
    isLoading: vectorForceQuery.isLoading,
    error: vectorForceQuery.error,

    // Mutation state
    isUpdating: setVectorForceMutation.isPending || clearVectorForceMutation.isPending,
    updateError: setVectorForceMutation.error || clearVectorForceMutation.error,

    // Actions
    setVectorForce: (force: Omit<IVectorForce, 'deviceId'>) =>
      setVectorForceMutation.mutate({ deviceId, ...force }),
    clearVectorForce: () => clearVectorForceMutation.mutate(deviceId),

    // Async actions
    setVectorForceAsync: (force: Omit<IVectorForce, 'deviceId'>) =>
      setVectorForceMutation.mutateAsync({ deviceId, ...force }),
    clearVectorForceAsync: () => clearVectorForceMutation.mutateAsync(deviceId),

    // Validation
    validateVectorForce: validation.validateVectorForce,

    // Presets
    applyPreset: (presetName: keyof typeof presets.presets) =>
      presets.applyPreset(deviceId, presetName),
    presets: presets.presets,
    isApplyingPreset: presets.isApplyingPreset,

    // Refetch
    refetch: vectorForceQuery.refetch,

    // Reset
    reset: () => {
      setVectorForceMutation.reset()
      clearVectorForceMutation.reset()
    },
  }
}

/**
 * Hook for managing both devices simultaneously
 */
export const useDualVectorForceManagement = () => {
  const device1 = useVectorForceManagement(1)
  const device2 = useVectorForceManagement(2)

  // Synchronized actions
  const setBothVectorForces = useCallback(
    async (force1: Omit<IVectorForce, 'deviceId'>, force2: Omit<IVectorForce, 'deviceId'>) => {
      await Promise.all([device1.setVectorForceAsync(force1), device2.setVectorForceAsync(force2)])
    },
    [device1, device2]
  )

  const clearBothVectorForces = useCallback(async () => {
    await Promise.all([device1.clearVectorForceAsync(), device2.clearVectorForceAsync()])
  }, [device1, device2])

  return {
    device1,
    device2,

    // Combined state
    isLoading: device1.isLoading || device2.isLoading,
    isUpdating: device1.isUpdating || device2.isUpdating,
    hasAnyVectorForce: device1.hasVectorForce || device2.hasVectorForce,

    // Synchronized actions
    setBothVectorForces,
    clearBothVectorForces,

    // Reset both
    resetBoth: () => {
      device1.reset()
      device2.reset()
    },
  }
}
