import { useStreamingStatusQuery } from '@/hooks/queries/useStreamingQuery'
import './StreamingStatusIndicator.css'

export function StreamingStatusIndicator() {
  const { data: streamingStatus, isLoading } = useStreamingStatusQuery()

  if (isLoading) {
    return (
      <div className="streaming-status-indicator">
        <div className="status-dot loading"></div>
        <span className="status-text">Checking...</span>
      </div>
    )
  }

  const isStreaming = streamingStatus?.is_streaming ?? false
  const latency = streamingStatus?.latency_ms ?? 0
  const deviceName = streamingStatus?.device_info?.name ?? 'Unknown'

  return (
    <div className="streaming-status-indicator">
      <div className={`status-dot ${isStreaming ? 'streaming' : 'stopped'}`}></div>
      <span className="status-text">
        {isStreaming ? (
          <>
            Streaming • {latency.toFixed(1)}ms • {deviceName}
          </>
        ) : (
          'Stopped'
        )}
      </span>
    </div>
  )
}