import { useQuery } from '@tanstack/react-query'
import { HapticService } from '@/services/hapticService'

const STREAMING_QUERY_KEY = ['streaming', 'status'] as const

export function useStreamingStatusQuery() {
  return useQuery({
    queryKey: STREAMING_QUERY_KEY,
    queryFn: HapticService.getStreamingStatus,
    refetchInterval: 5000, // Refresh every 5 seconds
    staleTime: 3000,
  })
}
