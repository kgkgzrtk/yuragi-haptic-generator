/**
 * React Query hooks for device information
 */
import { useQuery } from '@tanstack/react-query'
import { queryKeys, queryDefaults } from '@/lib/queryClient'
import { HapticService } from '@/services/hapticService'

export interface DeviceInfo {
  available: boolean
  channels: number
  name: string
  device_mode: 'dual' | 'single' | 'none'
}

/**
 * Hook for fetching audio device information
 */
export const useDeviceInfoQuery = () => {
  return useQuery({
    queryKey: queryKeys.device(),
    queryFn: async (): Promise<DeviceInfo> => {
      const result = await HapticService.getDeviceInfo()
      return result
    },
    ...queryDefaults.default,
    staleTime: 30000, // Device info doesn't change often
    refetchInterval: false, // Don't refetch automatically
  })
}
